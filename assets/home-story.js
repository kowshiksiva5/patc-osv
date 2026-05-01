/* PATC homepage — mini corridor simulation.
   Phases: intro (3.5s) → fixed (12s) → patc (13s) → loop.
   Visually mirrors the full simulation: dark bg, 5 junctions, coloured vehicles,
   signal heads, cross-streets at J2+J4 with vertical traffic.
   PATC heading typed with typewriter animation. */
(function () {
  'use strict';

  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const titleEl  = document.querySelector('[data-home-story-title]');
  const copyEl   = document.querySelector('[data-home-story-copy]');
  const motionQ  = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr      = Math.min(window.devicePixelRatio || 1, 1.5);

  /* ── Palette (matches full sim) ─────────────────────────────── */
  const C = {
    bg:       '#03070b',
    asphalt:  '#222d3d',
    asphaltL: '#2c3a4d',
    curb:     '#0d1825',
    median:   'rgba(255,235,150,0.45)',
    edge:     'rgba(255,255,255,0.30)',
    dash:     'rgba(255,255,255,0.20)',
    green:    '#34D399',
    amber:    '#F59E0B',
    red:      '#F87171',
    bulbOff:  'rgba(244,247,242,0.10)',
    text:     '#f4f7f2',
    muted:    '#9fb2b1',
    panel:    'rgba(5,8,14,0.82)',
    vSedan:   '#4FD1C5',
    vSuv:     '#A78BFA',
    vAuto:    '#FBBF24',
    vBike:    '#F87171',
    vBus:     '#60A5FA',
  };

  /* ── Copy ───────────────────────────────────────────────────── */
  const COPY = {
    intro: {
      h:    'Stuck in rush hour.\n<span class="accent-glow">Every junction. Another red.</span>',
      p:    'Each signal adapts only to its own queue — blind to what\'s two junctions ahead. You slow down, you wait, you move, you stop again.',
      chip: 'Your commute now',
    },
    fixed: {
      h:    'Without corridor coordination,\n<span class="accent-glow">you stop at every junction.</span>',
      p:    'Junction-level adaptive signals fight independently. Traffic clears one queue only to stack up at the next. You pay the penalty.',
      chip: 'Without PATC',
    },
    patc: {
      h:    'PATC sees the whole corridor.\n<span class="accent-glow">Green follows you — everywhere.</span>',
      p:    'One decision layer coordinates all five junctions simultaneously. A green wave opens ahead of your vehicle. Near-zero stops.',
      chip: 'With PATC',
      tw:   'PATC sees the whole corridor.',
      tw2:  'Green follows you — everywhere.',
    },
  };

  /* ── Phases ─────────────────────────────────────────────────── */
  const PHASES = [
    { id: 'intro', ms: 3500 },
    { id: 'fixed', ms: 13000 },
    { id: 'patc',  ms: 14000 },
  ];

  /* ── State ───────────────────────────────────────────────────── */
  let W = 0, H = 0, rafId = 0, lastDraw = 0, simTime = 0;
  let seqStart = 0, manualPhase = '', manualStart = 0, activePhase = '';
  let typingInterval = null;

  /* Delay stats */
  const stat = { fixed: { wait: 0, n: 0 }, patc: { wait: 0, n: 0 } };

  /* Layout — computed in resize() */
  let mainY = 0, roadW = 0;
  let jxs = [];         /* junction x positions */

  /* ── Vehicles ────────────────────────────────────────────────── */
  let HCARS = [];  /* horizontal mainline */
  let VCARS = [];  /* vertical cross-street */

  const KINDS = [
    { kind: 'sedan', color: C.vSedan, len: 14, ht: 7  },
    { kind: 'suv',   color: C.vSuv,   len: 18, ht: 8  },
    { kind: 'auto',  color: C.vAuto,  len: 12, ht: 7  },
    { kind: 'bike',  color: C.vBike,  len: 10, ht: 5  },
    { kind: 'bus',   color: C.vBus,   len: 26, ht: 9  },
  ];

  function kindOf(i) { return KINDS[i % KINDS.length]; }

  function initHCars() {
    HCARS = [];
    for (let i = 0; i < 16; i++) {
      const k = kindOf(i);
      HCARS.push({
        x:      -60 - i * 55,   /* staggered off left edge */
        speed:  0,
        maxSpd: 130 + (i % 5) * 16,
        kind:   k,
        isHero: i === 4,
        wait:   0,
      });
    }
    HCARS.sort((a, b) => b.x - a.x); /* front car first */
  }

  function initVCars() {
    VCARS = [];
    /* J2 (index 1) and J4 (index 3) cross-streets */
    [1, 3].forEach((ji) => {
      /* southbound */
      VCARS.push({ ji, dir: 1,  y: -40 - Math.random() * H * 0.4, speed: 0, maxSpd: 75 + Math.random() * 30, kind: kindOf(ji * 2) });
      /* northbound */
      VCARS.push({ ji, dir: -1, y: H + 40 + Math.random() * H * 0.4, speed: 0, maxSpd: 75 + Math.random() * 30, kind: kindOf(ji * 2 + 1) });
    });
  }

  /* ── Signals ─────────────────────────────────────────────────── */
  const N = 5;
  const sig = {
    phase:    Array(N).fill('MAIN'),  /* MAIN=green-for-horiz, SIDE=red-for-horiz */
    sub:      Array(N).fill('green'), /* green | amber | allred */
    timer:    Array(N).fill(0),
    amberT:   Array(N).fill(0),
  };

  const FIXED_MAIN = 18, FIXED_SIDE = 14, AMBER = 1.4, ALLRED = 0.8;
  const PATC_MAX = 30, PATC_SIDE = 5, PATC_MIN = 4;

  function resetSignals(id) {
    for (let i = 0; i < N; i++) {
      sig.sub[i]    = 'green';
      sig.amberT[i] = 0;
      sig.timer[i]  = 0;
      if (id === 'fixed') {
        sig.phase[i] = i % 2 === 0 ? 'MAIN' : 'SIDE';
      } else {
        sig.phase[i] = 'MAIN';
        sig.timer[i] = i * 0.8;   /* green-wave stagger */
      }
    }
  }

  function updateSignals(dt, id) {
    for (let i = 0; i < N; i++) {
      if (sig.sub[i] === 'amber') {
        sig.amberT[i] += dt;
        if (sig.amberT[i] >= AMBER) {
          sig.phase[i]  = sig.phase[i] === 'MAIN' ? 'SIDE' : 'MAIN';
          sig.sub[i]    = sig.sub[i] === 'amber' ? 'allred' : 'green';
          sig.sub[i]    = 'allred';
          sig.amberT[i] = 0;
          sig.timer[i]  = 0;
        }
        continue;
      }
      if (sig.sub[i] === 'allred') {
        sig.amberT[i] += dt;
        if (sig.amberT[i] >= ALLRED) {
          sig.sub[i]    = 'green';
          sig.amberT[i] = 0;
          sig.timer[i]  = 0;
        }
        continue;
      }
      sig.timer[i] += dt;

      if (id === 'fixed') {
        const cap = sig.phase[i] === 'MAIN' ? FIXED_MAIN : FIXED_SIDE;
        if (sig.timer[i] >= cap) { sig.sub[i] = 'amber'; sig.amberT[i] = 0; }
      } else if (id !== 'intro') {
        /* PATC: hold MAIN; brief SIDE only when side queue high */
        if (sig.phase[i] === 'SIDE') {
          if (sig.timer[i] >= PATC_MIN && sig.timer[i] >= PATC_SIDE) {
            sig.sub[i] = 'amber'; sig.amberT[i] = 0;
          }
        } else {
          if (sig.timer[i] >= PATC_MAX) { sig.sub[i] = 'amber'; sig.amberT[i] = 0; }
        }
      }
    }
  }

  function mainGreen(i) { return sig.phase[i] === 'MAIN' && sig.sub[i] === 'green'; }
  function mainAmber(i) { return sig.phase[i] === 'MAIN' && sig.sub[i] === 'amber'; }
  function sideGreen(i) { return sig.phase[i] === 'SIDE' && sig.sub[i] === 'green'; }

  /* ── Physics ─────────────────────────────────────────────────── */
  const STOP_BEFORE = 32;   /* px from junction center to stop line */
  const BRAKE_DIST  = 180;  /* px at which braking begins */
  const SAFE_GAP    = 18;   /* min body gap between cars */

  function updateHCars(dt, id) {
    HCARS.forEach((car) => {
      /* next junction stop line */
      let stopX = Infinity, nextJi = -1;
      for (let i = 0; i < N; i++) {
        const sx = jxs[i] - STOP_BEFORE;
        if (sx > car.x + 2) { stopX = sx; nextJi = i; break; }
      }

      /* Target speed based on signal */
      let target = car.maxSpd;
      if (nextJi >= 0 && !mainGreen(nextJi) && !mainAmber(nextJi)) {
        const dist = stopX - car.x;
        if (car.x < stopX - 2 && dist < BRAKE_DIST) {
          target = dist < 4 ? 0 : car.maxSpd * Math.max(0, Math.min(1, (dist - 4) / (BRAKE_DIST - 4)));
        }
      }

      /* Following distance */
      HCARS.forEach((other) => {
        if (other === car) return;
        const gap = other.x - car.x;               /* center-to-center */
        const bodyGap = gap - (other.kind.len + car.kind.len) / 2;
        if (gap > 0 && bodyGap < SAFE_GAP + 90) {
          const f = bodyGap < SAFE_GAP ? 0 : (bodyGap - SAFE_GAP) / 90;
          target = Math.min(target, car.maxSpd * Math.max(0, f));
        }
      });

      /* Acceleration */
      const accel = target < car.speed ? -520 : 240;
      car.speed += accel * dt;
      car.speed = Math.max(0, Math.min(car.maxSpd, car.speed));
      car.x += car.speed * dt;

      /* Wrap around */
      if (car.x > W + 80) car.x = -60 - car.kind.len;

      /* Wait tracking */
      if (car.speed < 3) {
        car.wait += dt;
        if (id === 'fixed') stat.fixed.wait += dt;
        if (id === 'patc')  stat.patc.wait  += dt;
      }
    });

    if (id === 'fixed') stat.fixed.n = HCARS.length;
    if (id === 'patc')  stat.patc.n  = HCARS.length;
  }

  function updateVCars(dt) {
    const stopDown = mainY - roadW / 2 - STOP_BEFORE;
    const stopUp   = mainY + roadW / 2 + STOP_BEFORE;

    VCARS.forEach((vc) => {
      const x = jxs[vc.ji];
      const isGreen = sideGreen(vc.ji);
      let target = vc.maxSpd;

      if (!isGreen) {
        if (vc.dir === 1) {
          const dist = stopDown - vc.y;
          if (vc.y < stopDown - 2 && dist < 140) {
            target = dist < 4 ? 0 : vc.maxSpd * Math.max(0, (dist - 4) / 120);
          }
        } else {
          const dist = vc.y - stopUp;
          if (vc.y > stopUp + 2 && dist < 140) {
            target = dist < 4 ? 0 : vc.maxSpd * Math.max(0, (dist - 4) / 120);
          }
        }
      }

      const accel = target < vc.speed ? -450 : 220;
      vc.speed += accel * dt;
      vc.speed = Math.max(0, Math.min(vc.maxSpd, vc.speed));
      vc.y += vc.dir * vc.speed * dt;

      /* Respawn */
      if (vc.dir === 1  && vc.y > H + 50) { vc.y = -50; vc.speed = 0; }
      if (vc.dir === -1 && vc.y < -50)    { vc.y = H + 50; vc.speed = 0; }
    });
  }

  /* ── Drawing ─────────────────────────────────────────────────── */
  function drawBackground(id) {
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, '#070d18');
    bg.addColorStop(1, C.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Phase-tinted glow */
    if (id === 'fixed') {
      const g = ctx.createRadialGradient(W * 0.35, mainY, 0, W * 0.35, mainY, W * 0.55);
      g.addColorStop(0, 'rgba(248,113,113,0.07)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (id === 'patc') {
      const g = ctx.createRadialGradient(W * 0.5, mainY, 0, W * 0.5, mainY, W * 0.6);
      g.addColorStop(0, 'rgba(52,211,153,0.06)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  function drawCrossStreets() {
    [1, 3].forEach((ji) => {
      const x = jxs[ji];
      const cw = 22;
      ctx.fillStyle = C.asphalt;
      ctx.fillRect(x - cw / 2, 0, cw, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 0.5;
      [x - cw / 2, x + cw / 2].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, H); ctx.stroke();
      });
      /* Centre dash */
      ctx.setLineDash([8, 14]);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawMainRoad() {
    /* Curb */
    ctx.fillStyle = C.curb;
    ctx.fillRect(0, mainY - roadW / 2 - 3, W, roadW + 6);
    /* Asphalt */
    ctx.fillStyle = C.asphalt;
    ctx.fillRect(0, mainY - roadW / 2, W, roadW);
    /* Highlight strip */
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    ctx.fillRect(0, mainY - roadW / 2 + 2, W, roadW - 4);
    /* Edge lines */
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1;
    [mainY - roadW / 2, mainY + roadW / 2].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    });
    /* Median dashes */
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = C.median;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, mainY); ctx.lineTo(W, mainY); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawJunctionPads() {
    jxs.forEach((x, i) => {
      const broad = i === 1 || i === 3;
      const pw = broad ? 56 : 46;
      const ph = broad ? 50 : 42;
      ctx.fillStyle = C.asphaltL;
      ctx.fillRect(x - pw / 2, mainY - ph / 2, pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - pw / 2 + 0.5, mainY - ph / 2 + 0.5, pw - 1, ph - 1);
    });
  }

  function drawSignalHead(x, signalState) {
    const cx = x, cy = mainY - roadW / 2 - 18;
    /* Pole */
    ctx.fillStyle = '#1b2632';
    ctx.fillRect(cx - 0.5, cy + 4, 1, 14);
    /* Housing */
    ctx.fillStyle = '#0b1218';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;
    const hw = 9, hh = 24;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - hw / 2, cy - hh / 2 + 4, hw, hh, 2); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(cx - hw / 2, cy - hh / 2 + 4, hw, hh); ctx.strokeRect(cx - hw / 2, cy - hh / 2 + 4, hw, hh); }
    /* Bulbs */
    const bulbs = [
      { dy: -7, color: C.red,   on: signalState === 'red'   },
      { dy: -1, color: C.amber, on: signalState === 'amber' },
      { dy:  5, color: C.green, on: signalState === 'green' },
    ];
    bulbs.forEach(({ dy, color, on }) => {
      ctx.beginPath();
      ctx.arc(cx, cy + dy + 4, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = on ? color : C.bulbOff;
      if (on) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function drawSignalHeads(id) {
    jxs.forEach((x, i) => {
      const s = sig.sub[i] === 'allred' ? 'red'
              : mainAmber(i)            ? 'amber'
              : mainGreen(i)            ? 'green' : 'red';
      drawSignalHead(x, s);

      /* PATC wave pulse ring */
      if (id === 'patc' && mainGreen(i)) {
        const pulse = (simTime * 1.6 + i * 0.5) % 1;
        ctx.beginPath();
        ctx.arc(x, mainY, 16 + pulse * 30, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52,211,153,${(1 - pulse) * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* Junction label */
      ctx.fillStyle = C.muted;
      ctx.font = '600 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`J${i + 1}`, x, mainY + roadW / 2 + 13);
      ctx.textAlign = 'start';
    });
  }

  function drawCar(x, y, angle, kind, isHero, id) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    const color = isHero
      ? (id === 'patc' ? C.green : C.amber)
      : kind.color;
    ctx.fillStyle   = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.60)';
    ctx.lineWidth   = 0.5;
    if (isHero) { ctx.shadowColor = color; ctx.shadowBlur = 14; }

    const l = kind.len, h = kind.ht;
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(-l / 2, -h / 2, l, h, 2.5); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(-l / 2, -h / 2, l, h); ctx.strokeRect(-l / 2, -h / 2, l, h);
    }
    ctx.shadowBlur = 0;

    /* Window tint */
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(-l / 2 + 3, -h / 2 + 1.2, l - 6, h - 2.4);

    if (isHero) {
      ctx.font = '700 9px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText('you', 0, -h / 2 - 5);
    }
    ctx.textAlign = 'start';
    ctx.restore();
  }

  function drawHCars(id) {
    /* Draw back-to-front so front cars appear on top */
    [...HCARS].reverse().forEach((car) => {
      /* Hide cars that are off-screen to the left (not yet entered) */
      if (car.x < -car.kind.len) return;
      const y = mainY - 4; /* drive in upper lane */
      drawCar(car.x, y, 0, car.kind, car.isHero, id);

      /* Wait badge */
      if (car.isHero && car.speed < 3 && id === 'fixed') {
        ctx.font      = '700 9px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(248,113,113,0.88)';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ waiting', car.x, mainY - 4 - car.kind.ht / 2 - 16);
        ctx.textAlign = 'start';
      }
    });
  }

  function drawVCars(id) {
    VCARS.forEach((vc) => {
      const x = jxs[vc.ji];
      const angle = vc.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      drawCar(x, vc.y, angle, vc.kind, false, id);
    });
  }

  function drawModeChip(id) {
    const copy = COPY[id] || COPY.fixed;
    ctx.font = '700 10px JetBrains Mono, monospace';
    const label = copy.chip || '';
    const w = ctx.measureText(label).width + 26;
    const color = id === 'patc' ? C.green : id === 'fixed' ? C.red : C.amber;

    ctx.fillStyle   = C.panel;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 0.8;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(12, 12, w, 26, 13); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(12, 12, w, 26); ctx.strokeRect(12, 12, w, 26); }

    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(24, 25, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(label, 34, 29);
  }

  function drawDelayHUD() {
    const fAvg = stat.fixed.n > 0 ? (stat.fixed.wait / stat.fixed.n).toFixed(1) : null;
    const pAvg = stat.patc.n  > 0 ? (stat.patc.wait  / stat.patc.n ).toFixed(1) : null;
    if (!fAvg && !pAvg) return;

    const bw = 152, bh = 38, bx = W - bw - 12, by = H - bh - 50;
    ctx.fillStyle   = C.panel;
    ctx.strokeStyle = 'rgba(232,236,244,0.06)';
    ctx.lineWidth   = 0.8;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh); }

    /* Fixed column */
    ctx.font = '700 8px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(248,113,113,0.72)';
    ctx.textAlign = 'left';
    ctx.fillText('FIXED', bx + 10, by + 13);
    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = fAvg ? 'rgba(248,113,113,0.95)' : 'rgba(155,164,181,0.4)';
    ctx.fillText(fAvg ? fAvg + 's' : '—', bx + 10, by + 28);

    /* Separator */
    ctx.strokeStyle = 'rgba(232,236,244,0.06)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx + 72, by + 6); ctx.lineTo(bx + 72, by + bh - 6); ctx.stroke();

    /* PATC column */
    ctx.font = '700 8px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(52,211,153,0.72)';
    ctx.fillText('PATC', bx + 82, by + 13);
    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = pAvg ? 'rgba(52,211,153,0.95)' : 'rgba(155,164,181,0.4)';
    ctx.fillText(pAvg ? pAvg + 's' : '—', bx + 82, by + 28);

    ctx.textAlign = 'start';

    /* Update HTML badge elements */
    const fe = document.getElementById('homeFixedDelay');
    const pe = document.getElementById('homePatcDelay');
    if (fe) fe.textContent = fAvg ? fAvg + 's' : '—';
    if (pe) pe.textContent = pAvg ? pAvg + 's' : '—';
  }

  /* ── Full render frame ──────────────────────────────────────── */
  function renderFrame(id, dt) {
    simTime += dt;
    updateSignals(dt, id);
    updateHCars(dt, id);
    updateVCars(dt);

    ctx.clearRect(0, 0, W, H);
    drawBackground(id);
    drawCrossStreets();
    drawMainRoad();
    drawJunctionPads();
    drawSignalHeads(id);

    /* PATC green wave shimmer along road */
    if (id === 'patc') {
      const wx = ((simTime * 0.10) % 1.3) * W;
      const wg = ctx.createRadialGradient(wx, mainY, 0, wx, mainY, 110);
      wg.addColorStop(0, 'rgba(52,211,153,0.10)');
      wg.addColorStop(1, 'transparent');
      ctx.fillStyle = wg;
      ctx.fillRect(0, mainY - 80, W, 160);
    }

    drawVCars(id);
    drawHCars(id);
    drawModeChip(id);
    drawDelayHUD();
  }

  /* ── Copy + typewriter ─────────────────────────────────────── */
  function stopTyping() {
    if (typingInterval) { clearInterval(typingInterval); typingInterval = null; }
  }

  function typeInto(el, text, msPerChar, onDone) {
    stopTyping();
    el.innerHTML = '';
    let i = 0;
    typingInterval = setInterval(() => {
      if (i >= text.length) {
        clearInterval(typingInterval); typingInterval = null;
        el.innerHTML = text;
        if (onDone) onDone();
        return;
      }
      el.innerHTML = text.slice(0, ++i) + '<span class="tw-cursor">|</span>';
    }, msPerChar);
  }

  function showCopy(id) {
    if (activePhase === id) return;
    activePhase = id;
    stopTyping();

    const copy = COPY[id] || COPY.fixed;
    document.documentElement.dataset.storyPhase = id;

    document.querySelectorAll('[data-phase-pill]').forEach((p) => {
      p.classList.toggle('active', p.dataset.phasePill === (id === 'intro' ? 'fixed' : id));
    });

    if (id === 'patc' && copy.tw && titleEl) {
      /* Typewriter for PATC heading */
      typeInto(titleEl, copy.tw, 38, () => {
        /* Then fade in second line */
        setTimeout(() => {
          if (titleEl) titleEl.innerHTML = copy.tw + '<br/><span class="accent-glow">' + copy.tw2 + '</span>';
          if (copyEl) {
            copyEl.style.opacity = '0';
            copyEl.innerHTML = copy.p;
            copyEl.style.transition = 'opacity 0.7s ease';
            setTimeout(() => { copyEl.style.opacity = '1'; }, 80);
          }
        }, 400);
      });
    } else {
      if (titleEl) titleEl.innerHTML = (copy.h || '').replace(/\n/g, '<br/>');
      if (copyEl)  copyEl.innerHTML  = copy.p || '';
    }
  }

  /* ── Phase machine ──────────────────────────────────────────── */
  let lastPhaseId = '';
  let phaseStartTime = 0;

  function currentPhase(now) {
    if (manualPhase) {
      return { id: manualPhase, elapsed: now - manualStart };
    }
    if (!seqStart) seqStart = now;
    let elapsed = now - seqStart;
    let start = 0;
    for (const ph of PHASES) {
      const end = start + ph.ms;
      if (elapsed < end) return { id: ph.id, elapsed: elapsed - start };
      start = end;
    }
    /* Loop */
    seqStart = now;
    return { id: PHASES[0].id, elapsed: 0 };
  }

  /* ── RAF loop ─────────────────────────────────────────────── */
  function loop(now) {
    if (!lastDraw) lastDraw = now;
    const dt = Math.min((now - lastDraw) / 1000, 0.05);
    lastDraw = now;

    const { id } = currentPhase(now);

    if (id !== lastPhaseId) {
      lastPhaseId = id;
      simTime = 0;
      /* Reset cars at phase boundary */
      initHCars();
      initVCars();
      resetSignals(id);
      showCopy(id);
    }

    renderFrame(id, dt);
    rafId = requestAnimationFrame(loop);
  }

  /* ── Layout ─────────────────────────────────────────────────── */
  function computeLayout() {
    mainY = H * 0.50;
    roadW = Math.max(24, Math.min(40, H * 0.065));
    const margin = Math.max(44, W * 0.07);
    jxs = Array.from({ length: N }, (_, i) => margin + (W - 2 * margin) * (i / (N - 1)));
  }

  function resize() {
    const host = canvas.parentElement || canvas;
    const rect  = host.getBoundingClientRect();
    W = Math.max(320, rect.width);
    H = Math.max(200, rect.height);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout();
  }

  /* ── Manual controls ─────────────────────────────────────────── */
  function setPhase(id) {
    if (!COPY[id]) return;
    manualPhase = id; manualStart = performance.now();
  }

  function replay() {
    cancelAnimationFrame(rafId);
    stopTyping();
    seqStart = 0; manualPhase = ''; lastPhaseId = ''; lastDraw = 0; simTime = 0;
    stat.fixed.wait = 0; stat.fixed.n = 0;
    stat.patc.wait  = 0; stat.patc.n  = 0;
    initHCars(); initVCars();
    rafId = requestAnimationFrame(loop);
  }

  /* ── Boot ────────────────────────────────────────────────────── */
  function start() {
    resize();
    initHCars();
    initVCars();
    resetSignals('intro');
    if (motionQ.matches) {
      resetSignals('patc');
      showCopy('patc');
      renderFrame('patc', 0);
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    resize();
    if (motionQ.matches) renderFrame(activePhase || 'patc', 0);
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
