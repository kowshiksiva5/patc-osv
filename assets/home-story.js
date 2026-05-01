/* PATC homepage: mini corridor sim — Fixed vs PATC with live delay comparison.
   5 junctions on a horizontal corridor. Fixed mode: J2+J4 start red → vehicles queue.
   PATC mode: green wave propagates ahead of traffic → vehicles flow freely. */
(function () {
  'use strict';

  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const titleEl   = document.querySelector('[data-home-story-title]');
  const copyEl    = document.querySelector('[data-home-story-copy]');
  const motionQ   = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr       = Math.min(window.devicePixelRatio || 1, 1.5);

  /* ── Palette ──────────────────────────────────────────────── */
  const C = {
    bg:     '#060C14',
    road:   '#1c2a3e',
    edge:   'rgba(61,191,176,0.14)',
    lane:   'rgba(232,236,244,0.08)',
    green:  '#34D399',
    amber:  '#F59E0B',
    red:    '#F87171',
    text:   '#E8ECF4',
    muted:  'rgba(155,164,181,0.72)',
    panel:  'rgba(6,12,20,0.82)',
    accent: '#3DBFB0',
    grid:   'rgba(61,191,176,0.04)',
  };

  /* ── Copy ─────────────────────────────────────────────────── */
  const COPY = {
    fixed: {
      h: 'Every junction fights alone.<br/><span class="accent-glow">The corridor jams.</span>',
      p: 'Fixed timers ignore what the rest of the road is doing. Vehicles queue at J2 and J4 while other junctions sit idle.',
      chip: 'Without PATC',
    },
    patc: {
      h: 'PATC opens a green wave<br/><span class="accent-glow">before you arrive.</span>',
      p: 'One adaptive timing layer coordinates all five junctions. Vehicles flow end-to-end with near-zero waiting.',
      chip: 'With PATC',
    },
  };

  /* ── Sequence ─────────────────────────────────────────────── */
  const PHASE_DURATION = 13000; // ms per phase
  const SEQUENCE = [
    { id: 'fixed', ms: PHASE_DURATION },
    { id: 'patc',  ms: PHASE_DURATION },
  ];

  /* ── State ────────────────────────────────────────────────── */
  let W = 0, H = 0, rafId = 0, lastDraw = 0, simTime = 0;
  let seqStart = 0, manualPhase = '', manualStart = 0, activePhase = '';
  let junctionXs = [];
  const ROAD_Y    = 0;
  const ROAD_W    = 24;
  const N_JUNC    = 5;

  /* Per-phase accumulated delay for the comparison badge */
  const phaseDelay = { fixed: 0, patc: 0 };
  const phaseVehicles = { fixed: 0, patc: 0 };
  const phaseComplete = { fixed: false, patc: false };

  /* ── Vehicles ─────────────────────────────────────────────── */
  let CARS = [];

  function initCars() {
    CARS = [];
    /* 18 cars spread across the mainline */
    for (let i = 0; i < 18; i++) {
      CARS.push({
        id: i,
        pos:     (i / 18) % 1,        /* 0..1 along corridor */
        speed:   0,
        maxSpd:  180 + (i % 5) * 20,  /* 180-260 px/s */
        wait:    0,
        kind:    i % 6 === 0 ? 'bus' : i % 3 === 0 ? 'suv' : 'car',
        shade:   i % 4,
        isHero:  i === 3,
      });
    }
    /* Space them so no overlap at start */
    CARS.sort((a, b) => a.pos - b.pos);
  }

  /* ── Layout ───────────────────────────────────────────────── */
  function computeLayout() {
    const margin = Math.max(40, W * 0.07);
    junctionXs = Array.from({ length: N_JUNC }, (_, i) =>
      margin + (W - 2 * margin) * (i / (N_JUNC - 1))
    );
    ROAD_Y_VAL = H * 0.50;
  }
  let ROAD_Y_VAL = 0;

  /* ── Signal logic ─────────────────────────────────────────── */
  const signalTimers = [0, 0, 0, 0, 0];
  const signalPhase  = ['MAIN', 'SIDE', 'MAIN', 'SIDE', 'MAIN'];

  function resetSignals(id) {
    if (id === 'fixed') {
      /* Anti-green-wave: even junctions green, odd junctions RED for mainline */
      for (let i = 0; i < N_JUNC; i++) {
        signalPhase[i] = i % 2 === 0 ? 'MAIN' : 'SIDE';
        signalTimers[i] = 0;
      }
    } else {
      /* PATC: all green (MAIN), staggered timers so wave propagates */
      for (let i = 0; i < N_JUNC; i++) {
        signalPhase[i]  = 'MAIN';
        signalTimers[i] = i * 0.8;
      }
    }
  }

  const FIXED_MAIN = 18.0;
  const FIXED_SIDE = 14.0;
  const PATC_MAX   = 30.0;
  const PATC_SIDE  = 5.0;
  const AMBER_DUR  = 1.2;

  const signalSubphase = ['green', 'green', 'green', 'green', 'green'];
  const signalAmberT   = [0, 0, 0, 0, 0];

  function updateSignals(dt, id) {
    for (let i = 0; i < N_JUNC; i++) {
      if (signalSubphase[i] === 'amber') {
        signalAmberT[i] += dt;
        if (signalAmberT[i] >= AMBER_DUR) {
          signalSubphase[i] = 'green';
          signalPhase[i]    = signalPhase[i] === 'MAIN' ? 'SIDE' : 'MAIN';
          signalAmberT[i]   = 0;
          signalTimers[i]   = 0;
        }
        continue;
      }

      signalTimers[i] += dt;

      if (id === 'fixed') {
        const cap = signalPhase[i] === 'MAIN' ? FIXED_MAIN : FIXED_SIDE;
        if (signalTimers[i] >= cap) {
          signalSubphase[i] = 'amber';
          signalAmberT[i]   = 0;
        }
      } else {
        /* PATC — hold MAIN; briefly serve SIDE only if vehicles pile up */
        if (signalPhase[i] === 'SIDE') {
          const sideQ = countApproaching(i, 'side');
          if (signalTimers[i] >= 3 && (sideQ < 1 || signalTimers[i] >= PATC_SIDE)) {
            signalSubphase[i] = 'amber';
            signalAmberT[i]   = 0;
          }
        } else {
          /* MAIN — only flip if a side queue is building AND main is quiet */
          const sideQ = countApproaching(i, 'side');
          const mainQ = countApproaching(i, 'main');
          if (signalTimers[i] >= PATC_MAX && sideQ > 0) {
            signalSubphase[i] = 'amber';
            signalAmberT[i]   = 0;
          }
        }
      }
    }
  }

  function countApproaching(jIdx, lane) {
    /* Rough estimate: cars within 15% of corridor ahead of this junction */
    const jPos = junctionXs[jIdx] / W;
    return CARS.filter((c) => {
      const d = jPos - c.pos;
      return d > 0 && d < 0.18;
    }).length;
  }

  function isGreenForCar(jIdx) {
    return signalPhase[jIdx] === 'MAIN' && signalSubphase[jIdx] !== 'amber';
  }

  /* ── Physics ──────────────────────────────────────────────── */
  function updatePhysics(dt, id) {
    const span = W + 120;

    CARS.forEach((car) => {
      const carX = car.pos * span - 60;

      /* Find next junction */
      let nextJX = Infinity, nextJIdx = -1;
      for (let i = 0; i < N_JUNC; i++) {
        if (junctionXs[i] > carX + 2) { nextJX = junctionXs[i]; nextJIdx = i; break; }
      }

      let target = car.maxSpd;

      /* Signal stop */
      if (nextJIdx >= 0 && !isGreenForCar(nextJIdx)) {
        const dist = nextJX - carX;
        const stopLine = nextJX - 22;
        if (carX < stopLine - 1 && dist < 220) {
          /* Smooth brake: full stop at stopLine */
          const brakeDist = stopLine - carX;
          target = dist < 10 ? 0 : car.maxSpd * Math.max(0, Math.min(1, (brakeDist - 4) / 130));
        }
      }

      /* Following */
      CARS.forEach((other) => {
        if (other === car) return;
        const oX = other.pos * span - 60;
        const gap = oX - carX;
        const safeGap = car.kind === 'bus' ? 52 : 40;
        if (gap > 0 && gap < safeGap + 60) {
          const followTarget = car.maxSpd * Math.max(0, (gap - safeGap) / 60);
          target = Math.min(target, followTarget);
        }
      });

      /* Acceleration physics */
      const accel = target < car.speed ? -550 : 260;
      car.speed += accel * dt;
      car.speed = Math.max(0, Math.min(car.maxSpd, car.speed));
      car.speed = Math.max(car.speed, target < 1 ? 0 : Math.min(car.speed, target));

      car.pos += (car.speed * dt) / span;
      if (car.pos > 1) car.pos -= 1;

      /* Wait tracking */
      if (car.speed < 5) {
        car.wait += dt;
        phaseDelay[id] += dt;
      }
    });

    phaseVehicles[id] = CARS.length;
  }

  /* ── Copy + pill sync ─────────────────────────────────────── */
  function showCopy(id) {
    if (activePhase === id) return;
    activePhase = id;
    const copy = COPY[id] || COPY.fixed;
    if (titleEl) { titleEl.innerHTML = copy.h; }
    if (copyEl)  { copyEl.innerHTML  = copy.p; }
    document.documentElement.dataset.storyPhase = id;
    document.querySelectorAll('[data-phase-pill]').forEach((p) => {
      p.classList.toggle('active', p.dataset.phasePill === id);
    });
    /* Update external delay display if present */
    updateDelayBadge();
  }

  function updateDelayBadge() {
    const fixedEl = document.getElementById('homeFixedDelay');
    const patcEl  = document.getElementById('homePatcDelay');
    if (fixedEl) {
      const avg = phaseVehicles.fixed > 0 ? phaseDelay.fixed / phaseVehicles.fixed : null;
      fixedEl.textContent = avg !== null ? avg.toFixed(1) + 's' : '—';
    }
    if (patcEl) {
      const avg = phaseVehicles.patc > 0 ? phaseDelay.patc / phaseVehicles.patc : null;
      patcEl.textContent = avg !== null ? avg.toFixed(1) + 's' : '—';
    }
  }

  /* ── Draw helpers ─────────────────────────────────────────── */
  function box(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawGrid() {
    ctx.strokeStyle = C.grid;
    ctx.lineWidth   = 0.5;
    const step = Math.round(W / 14);
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    const vStep = Math.round(H / 8);
    for (let y = 0; y < H; y += vStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawRoad(y, w, label) {
    /* Asphalt */
    ctx.fillStyle = C.road;
    ctx.fillRect(0, y - w / 2, W, w);
    /* Edge glow */
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y - w / 2); ctx.lineTo(W, y - w / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + w / 2); ctx.lineTo(W, y + w / 2); ctx.stroke();
    /* Centre dash */
    ctx.setLineDash([8, 16]);
    ctx.strokeStyle = C.lane;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
    /* Road label */
    if (label) {
      ctx.fillStyle = 'rgba(155,164,181,0.28)';
      ctx.font      = '500 9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, 8, y - w / 2 - 4);
    }
  }

  function drawCrossArms(y, w) {
    /* Minor vertical cross-roads at each junction */
    junctionXs.forEach((x) => {
      ctx.fillStyle = '#16243a';
      ctx.fillRect(x - 9, 0, 18, H);
      /* Edge lines */
      ctx.strokeStyle = 'rgba(61,191,176,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x - 9, 0); ctx.lineTo(x - 9, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 9, 0); ctx.lineTo(x + 9, H); ctx.stroke();
    });
  }

  function drawJunctions(id, y) {
    junctionXs.forEach((x, i) => {
      const isGreen = isGreenForCar(i);
      const isAmber = signalSubphase[i] === 'amber';
      const color   = isAmber ? C.amber : isGreen ? C.green : C.red;

      /* Junction pad */
      ctx.fillStyle = '#1e2e42';
      box(x - 14, y - ROAD_W / 2 - 2, 28, ROAD_W + 4, 4);
      ctx.fill();

      /* Signal head housing */
      ctx.fillStyle   = '#0a1218';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth   = 0.8;
      box(x - 5.5, y - ROAD_W / 2 - 22, 11, 22, 3);
      ctx.fill(); ctx.stroke();

      /* Three-bulb signal */
      const bOff = 'rgba(244,247,242,0.10)';
      [
        { dy: -17, active: color === C.red,   col: C.red   },
        { dy: -11, active: isAmber,            col: C.amber },
        { dy:  -5, active: isGreen,            col: C.green },
      ].forEach(({ dy, active, col }) => {
        ctx.beginPath();
        ctx.arc(x, y - ROAD_W / 2 + dy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = active ? col : bOff;
        if (active) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      /* Junction ID */
      ctx.fillStyle = 'rgba(155,164,181,0.5)';
      ctx.font      = '600 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`J${i + 1}`, x, y + ROAD_W / 2 + 14);
      ctx.textAlign = 'start';

      /* PATC green wave pulse ring */
      if (id === 'patc' && isGreen) {
        const pulse = (simTime * 1.8 + i * 0.4) % 1;
        ctx.beginPath();
        ctx.arc(x, y, 14 + pulse * 28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52,211,153,${(1 - pulse) * 0.18})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
    });
  }

  function carColor(car, id) {
    if (car.isHero) return id === 'patc' ? C.green : C.amber;
    if (id === 'patc') return car.shade % 2 === 0 ? 'rgba(52,211,153,0.70)' : 'rgba(100,180,255,0.55)';
    return car.shade % 2 === 0 ? 'rgba(248,113,113,0.72)' : 'rgba(232,236,244,0.35)';
  }

  function drawCars(id, y) {
    const span = W + 120;
    CARS.forEach((car) => {
      const x     = car.pos * span - 60;
      const color = carColor(car, id);
      const len   = car.kind === 'bus' ? 22 : car.kind === 'suv' ? 15 : 11;
      const ht    = car.kind === 'bus' ? 9 : 7;

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle   = color;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth   = 0.5;
      if (car.isHero) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
      box(-len / 2, -ht / 2, len, ht, 2.5);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      /* Window tint */
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(-len / 2 + 3, -ht / 2 + 1.5, len - 6, ht - 3);
      /* "you" label */
      if (car.isHero) {
        ctx.font      = '700 10px Inter, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText('you', 0, -ht / 2 - 6);
        /* Wait badge */
        if (car.speed < 5 && id === 'fixed') {
          ctx.font      = '700 9px JetBrains Mono, monospace';
          ctx.fillStyle = 'rgba(248,113,113,0.85)';
          ctx.fillText('⏸ waiting', 0, -ht / 2 - 18);
        }
      }
      ctx.textAlign = 'start';
      ctx.restore();
    });
  }

  /* Head-up display: mode chip + delay comparison */
  function drawHUD(id) {
    const copy   = COPY[id];
    const chipTxt = copy.chip;
    ctx.font = '700 10px JetBrains Mono, monospace';
    const chipW = ctx.measureText(chipTxt).width + 26;

    /* Mode chip */
    ctx.fillStyle   = C.panel;
    ctx.strokeStyle = id === 'fixed' ? 'rgba(248,113,113,0.30)' : 'rgba(52,211,153,0.30)';
    ctx.lineWidth   = 1;
    box(14, 14, chipW, 26, 13);
    ctx.fill(); ctx.stroke();
    const dotColor = id === 'fixed' ? C.red : C.green;
    ctx.fillStyle = dotColor;
    ctx.shadowColor = dotColor; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(26, 27, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle   = id === 'fixed' ? 'rgba(248,113,113,0.88)' : 'rgba(52,211,153,0.88)';
    ctx.fillText(chipTxt, 36, 31);

    /* Delay comparison box (bottom-right) */
    const fixedAvg = phaseVehicles.fixed > 0 ? (phaseDelay.fixed / phaseVehicles.fixed).toFixed(1) : null;
    const patcAvg  = phaseVehicles.patc  > 0 ? (phaseDelay.patc  / phaseVehicles.patc ).toFixed(1) : null;

    if (fixedAvg !== null || patcAvg !== null) {
      const bx = W - 184, by = H - 54, bw = 170, bh = 40;
      ctx.fillStyle   = C.panel;
      ctx.strokeStyle = 'rgba(232,236,244,0.06)';
      ctx.lineWidth   = 1;
      box(bx, by, bw, bh, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = '700 9px JetBrains Mono, monospace';
      /* Fixed label */
      ctx.fillStyle = 'rgba(248,113,113,0.70)';
      ctx.textAlign = 'left';
      ctx.fillText('FIXED', bx + 12, by + 14);
      ctx.fillStyle = fixedAvg !== null ? 'rgba(248,113,113,0.95)' : 'rgba(155,164,181,0.4)';
      ctx.font = '700 13px JetBrains Mono, monospace';
      ctx.fillText(fixedAvg !== null ? fixedAvg + 's' : '—', bx + 12, by + 30);

      /* PATC label */
      ctx.font = '700 9px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(52,211,153,0.70)';
      ctx.textAlign = 'left';
      ctx.fillText('PATC', bx + 90, by + 14);
      ctx.fillStyle = patcAvg !== null ? 'rgba(52,211,153,0.95)' : 'rgba(155,164,181,0.4)';
      ctx.font = '700 13px JetBrains Mono, monospace';
      ctx.fillText(patcAvg !== null ? patcAvg + 's' : '—', bx + 90, by + 30);

      /* Divider */
      ctx.strokeStyle = 'rgba(232,236,244,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 78, by + 6);
      ctx.lineTo(bx + 78, by + bh - 6);
      ctx.stroke();

      ctx.textAlign = 'start';
    }

    /* Live ticker when in fixed mode — growing avg delay */
    if (id === 'fixed') {
      const live = (phaseDelay.fixed / Math.max(1, phaseVehicles.fixed)).toFixed(1);
      ctx.font      = '700 10px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(248,113,113,0.65)';
      ctx.textAlign = 'right';
      ctx.fillText(`avg wait ↑ ${live}s`, W - 14, 28);
      ctx.textAlign = 'start';
    }
    if (id === 'patc') {
      const live = (phaseDelay.patc / Math.max(1, phaseVehicles.patc)).toFixed(1);
      ctx.font      = '700 10px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(52,211,153,0.65)';
      ctx.textAlign = 'right';
      ctx.fillText(`avg wait ↓ ${live}s`, W - 14, 28);
      ctx.textAlign = 'start';
    }
  }

  /* ── Full render frame ─────────────────────────────────────── */
  function render(id, dt) {
    simTime += dt;
    updateSignals(dt, id);
    updatePhysics(dt, id);

    ctx.clearRect(0, 0, W, H);

    /* Background + grid */
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.8);
    bg.addColorStop(0, id === 'fixed' ? 'rgba(40,10,10,0.55)' : 'rgba(5,25,20,0.55)');
    bg.addColorStop(1, C.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    /* Roads */
    const mainY = ROAD_Y_VAL;
    const upperY = mainY - H * 0.24;
    const lowerY = mainY + H * 0.24;

    drawCrossArms(mainY, ROAD_W);
    drawRoad(upperY, 10, null);
    drawRoad(lowerY, 10, null);
    drawRoad(mainY,  ROAD_W, 'MAIN CORRIDOR');

    drawJunctions(id, mainY);

    /* PATC green-wave shimmer along road */
    if (id === 'patc') {
      const waveX = ((simTime * 0.09) % 1.2) * W;
      const wg = ctx.createRadialGradient(waveX, mainY, 0, waveX, mainY, 120);
      wg.addColorStop(0, 'rgba(52,211,153,0.10)');
      wg.addColorStop(1, 'transparent');
      ctx.fillStyle = wg;
      ctx.fillRect(0, mainY - 60, W, 120);
    }

    /* Fixed congestion glow near J2 / J4 */
    if (id === 'fixed') {
      [1, 3].forEach((ji) => {
        const gx = junctionXs[ji];
        const cg = ctx.createRadialGradient(gx, mainY, 0, gx, mainY, 90);
        cg.addColorStop(0, 'rgba(248,113,113,0.12)');
        cg.addColorStop(1, 'transparent');
        ctx.fillStyle = cg;
        ctx.fillRect(gx - 90, mainY - 90, 180, 180);
      });
    }

    drawCars(id, mainY);
    drawHUD(id);

    updateDelayBadge();
  }

  /* ── State machine ─────────────────────────────────────────── */
  function currentPhase(now) {
    if (manualPhase) {
      return { id: manualPhase, t: Math.min(1, (now - manualStart) / PHASE_DURATION) };
    }
    if (!seqStart) seqStart = now;
    let elapsed = now - seqStart;
    let start = 0;
    for (const s of SEQUENCE) {
      const end = start + s.ms;
      if (elapsed < end) return { id: s.id, t: (elapsed - start) / s.ms };
      start = end;
    }
    /* Loop */
    seqStart = now;
    return { id: SEQUENCE[0].id, t: 0 };
  }

  /* ── RAF loop ──────────────────────────────────────────────── */
  let lastPhaseId = '';
  function loop(now) {
    if (!lastDraw) lastDraw = now;
    const dt = Math.min((now - lastDraw) / 1000, 0.05);
    lastDraw = now;
    const { id } = currentPhase(now);

    if (id !== lastPhaseId) {
      lastPhaseId = id;
      simTime = 0;
      initCars();
      resetSignals(id);
      /* Reset subphase arrays */
      for (let i = 0; i < N_JUNC; i++) {
        signalSubphase[i] = 'green';
        signalAmberT[i]   = 0;
      }
      showCopy(id);
    }

    render(id, dt);
    rafId = requestAnimationFrame(loop);
  }

  /* ── Resize ────────────────────────────────────────────────── */
  function resize() {
    const host = canvas.parentElement || canvas;
    const rect  = host.getBoundingClientRect();
    W = Math.max(320, rect.width);
    H = Math.max(220, rect.height);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout();
  }

  /* ── Manual phase controls ─────────────────────────────────── */
  function setPhase(id) {
    if (!COPY[id]) return;
    manualPhase = id;
    manualStart = performance.now();
  }

  function replay() {
    cancelAnimationFrame(rafId);
    seqStart = manualPhase = manualStart = lastPhaseId = '';
    seqStart = 0; lastDraw = 0; simTime = 0;
    phaseDelay.fixed = 0; phaseDelay.patc = 0;
    phaseVehicles.fixed = 0; phaseVehicles.patc = 0;
    initCars();
    rafId = requestAnimationFrame(loop);
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  function start() {
    resize();
    initCars();
    if (motionQ.matches) {
      resetSignals('patc');
      render('patc', 0);
      showCopy('patc');
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    resize();
    if (motionQ.matches) render(activePhase || 'patc', 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
    else if (!rafId && !motionQ.matches) { lastDraw = 0; rafId = requestAnimationFrame(loop); }
  });

  const replayBtn = document.getElementById('storyReplayBtn');
  if (replayBtn) replayBtn.addEventListener('click', replay);

  document.querySelectorAll('[data-phase-pill]').forEach((pill) => {
    pill.style.cursor = 'pointer';
    pill.addEventListener('click', () => setPhase(pill.dataset.phasePill));
  });

  window.HomeStory = { setPhase, replay };
  start();
})();
