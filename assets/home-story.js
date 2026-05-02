/* PATC homepage — mini corridor simulation v6.
   Phases: fixed (12s) → patc (stays). No intro. No loop.
   Text typed at constant time-based rate (not car-position-based).
   Canvas slides in from right after first word is typed.
   Manual toggle: instant text + looping sim in that mode. */
(function () {
  'use strict';

  const canvas  = document.getElementById('storyCanvas');
  if (!canvas) return;
  const ctx     = canvas.getContext('2d');
  if (!ctx) return;

  const titleEl = document.querySelector('[data-home-story-title]');
  const copyEl  = document.querySelector('[data-home-story-copy]');
  const motionQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr     = Math.min(window.devicePixelRatio || 1, 1.5);

  /* ── Palette ──────────────────────────────────────────────── */
  const C = {
    bg: '#03070b', asphalt: '#222d3d', asphaltL: '#2c3a4d',
    curb: '#0d1825', median: 'rgba(255,235,150,0.45)',
    edge: 'rgba(255,255,255,0.30)',
    green: '#34D399', amber: '#F59E0B', red: '#F87171',
    bulbOff: 'rgba(244,247,242,0.10)',
    muted: '#9fb2b1', panel: 'rgba(5,8,14,0.82)',
    vSedan: '#4FD1C5', vSuv: '#A78BFA', vAuto: '#FBBF24',
    vBike: '#F87171', vBus: '#60A5FA',
  };

  /* ── Copy ─────────────────────────────────────────────────── */
  const COPY = {
    fixed: {
      line1: 'Rush hour. Every junction forces a stop.',
      line2: 'Signals act alone. You pay the penalty every time.',
      p:     'Junction-level signals adapt to their own queue — blind to what\'s ahead. Traffic clears one bottleneck only to pile up at the next.',
      chip:  'Without PATC',
    },
    patc: {
      line1: 'PATC coordinates every junction ahead of you.',
      line2: 'Every green works for you.',
      p:     'One adaptive layer sees the whole corridor. A green wave opens before your vehicle arrives. Smooth flow, all the way through.',
      chip:  'With PATC',
    },
  };

  /* ── Phases: fixed → patc (stays, no loop) ───────────────── */
  const PHASES = [
    { id: 'fixed', ms: 12000 },
    { id: 'patc',  ms: Infinity },
  ];
  /* Seconds over which typing completes — matches how long hero takes
     to cross the canvas in each phase (fixed ~10s, patc ~5.5s). */
  const TYPING_SECS = { fixed: 10, patc: 5.5 };

  /* ── State ────────────────────────────────────────────────── */
  let W = 0, H = 0, rafId = 0, lastDraw = 0, simTime = 0;
  let seqStart = 0, manualPhase = '', manualStart = 0;
  let lastPhaseId = '', manualJustSet = false;
  let mainY = 0, roadW = 0, jxs = [];

  /* ── Canvas entrance (one-time, triggered after 1st word) ─── */
  let canvasEntered = false;
  function triggerCanvasEntrance() {
    if (canvasEntered) return;
    canvasEntered = true;
    const visual = document.querySelector('.story-visual');
    if (visual) visual.classList.add('canvas-entered');
  }

  /* ── Vehicles ─────────────────────────────────────────────── */
  let HCARS = [], VCARS = [];

  const KINDS = [
    { kind: 'sedan', color: C.vSedan, len: 14, ht: 7 },
    { kind: 'suv',   color: C.vSuv,   len: 18, ht: 8 },
    { kind: 'auto',  color: C.vAuto,  len: 12, ht: 7 },
    { kind: 'bike',  color: C.vBike,  len: 10, ht: 5 },
    { kind: 'bus',   color: C.vBus,   len: 26, ht: 9 },
  ];
  function kindOf(i) { return KINDS[i % KINDS.length]; }

  function initHCars() {
    HCARS = [];
    for (let i = 0; i < 16; i++) {
      HCARS.push({
        x: -60 - i * 55, speed: 0,
        maxSpd: 130 + (i % 5) * 16,
        kind: kindOf(i),
        isHero: i === 0,  /* lead car — enters screen fast */
        wait: 0,
      });
    }
    HCARS.sort((a, b) => b.x - a.x);
  }

  function initVCars() {
    VCARS = [];
    [1, 3].forEach((ji) => {
      VCARS.push({ ji, dir:  1, y: -40 - Math.random() * 80, speed: 0, maxSpd: 75 + Math.random() * 30, kind: kindOf(ji * 2) });
      VCARS.push({ ji, dir: -1, y: H + 40 + Math.random() * 80, speed: 0, maxSpd: 75 + Math.random() * 30, kind: kindOf(ji * 2 + 1) });
    });
  }

  /* ── Signals ──────────────────────────────────────────────── */
  const N = 5;
  const sig = {
    phase: Array(N).fill('MAIN'), sub: Array(N).fill('green'),
    timer: Array(N).fill(0),      amberT: Array(N).fill(0),
  };
  const FIXED_MAIN = 18, FIXED_SIDE = 14, AMBER = 1.4, ALLRED = 0.8;
  const PATC_MAX = 30, PATC_SIDE = 5;

  function resetSignals(id) {
    for (let i = 0; i < N; i++) {
      sig.sub[i] = 'green'; sig.amberT[i] = 0;
      if (id === 'fixed') {
        sig.phase[i] = i % 2 === 0 ? 'MAIN' : 'SIDE';
        /* Advance J2+J4 timers so hero can cross in ~9s:
           remaining SIDE = 4s (J2) + 2.2s transitions = ~6.2s until MAIN */
        sig.timer[i] = (i === 1 || i === 3) ? 10 : 0;
      } else {
        sig.phase[i] = 'MAIN';
        sig.timer[i] = i * 0.8;  /* green-wave stagger */
      }
    }
  }

  function updateSignals(dt, id) {
    for (let i = 0; i < N; i++) {
      if (sig.sub[i] === 'amber') {
        sig.amberT[i] += dt;
        if (sig.amberT[i] >= AMBER) {
          sig.phase[i] = sig.phase[i] === 'MAIN' ? 'SIDE' : 'MAIN';
          sig.sub[i] = 'allred'; sig.amberT[i] = 0; sig.timer[i] = 0;
        }
        continue;
      }
      if (sig.sub[i] === 'allred') {
        sig.amberT[i] += dt;
        if (sig.amberT[i] >= ALLRED) { sig.sub[i] = 'green'; sig.amberT[i] = 0; sig.timer[i] = 0; }
        continue;
      }
      sig.timer[i] += dt;
      if (id === 'fixed') {
        const cap = sig.phase[i] === 'MAIN' ? FIXED_MAIN : FIXED_SIDE;
        if (sig.timer[i] >= cap) { sig.sub[i] = 'amber'; sig.amberT[i] = 0; }
      } else if (id === 'patc') {
        const cap = sig.phase[i] === 'MAIN' ? PATC_MAX : PATC_SIDE;
        if (sig.timer[i] >= cap) { sig.sub[i] = 'amber'; sig.amberT[i] = 0; }
      }
    }
  }

  function mainGreen(i) { return sig.phase[i] === 'MAIN' && sig.sub[i] === 'green'; }
  function mainAmber(i) { return sig.phase[i] === 'MAIN' && sig.sub[i] === 'amber'; }
  function sideGreen(i) { return sig.phase[i] === 'SIDE' && sig.sub[i] === 'green'; }

  /* ── Physics ──────────────────────────────────────────────── */
  const STOP_BEFORE = 32, BRAKE_DIST = 180, SAFE_GAP = 18;

  function updateHCars(dt, id) {
    HCARS.forEach((car) => {
      let stopX = Infinity, nextJi = -1;
      for (let i = 0; i < N; i++) {
        const sx = jxs[i] - STOP_BEFORE;
        if (sx > car.x + 2) { stopX = sx; nextJi = i; break; }
      }
      let target = car.maxSpd;
      if (nextJi >= 0 && !mainGreen(nextJi) && !mainAmber(nextJi)) {
        const dist = stopX - car.x;
        if (car.x < stopX - 2 && dist < BRAKE_DIST)
          target = dist < 4 ? 0 : car.maxSpd * Math.max(0, Math.min(1, (dist - 4) / (BRAKE_DIST - 4)));
      }
      HCARS.forEach((other) => {
        if (other === car) return;
        const gap = other.x - car.x;
        const bodyGap = gap - (other.kind.len + car.kind.len) / 2;
        if (gap > 0 && bodyGap < SAFE_GAP + 90) {
          const f = bodyGap < SAFE_GAP ? 0 : (bodyGap - SAFE_GAP) / 90;
          target = Math.min(target, car.maxSpd * Math.max(0, f));
        }
      });
      const accel = target < car.speed ? -520 : 240;
      car.speed += accel * dt;
      car.speed  = Math.max(0, Math.min(car.maxSpd, car.speed));
      car.x     += car.speed * dt;

      if (car.x > W + 80) car.x = -60 - car.kind.len;

      if (car.speed < 5) car.wait += dt;
    });
  }

  function updateVCars(dt) {
    const stopDown = mainY - roadW / 2 - STOP_BEFORE;
    const stopUp   = mainY + roadW / 2 + STOP_BEFORE;
    VCARS.forEach((vc) => {
      const isGreen = sideGreen(vc.ji);
      let target = vc.maxSpd;
      if (!isGreen) {
        if (vc.dir === 1) {
          const dist = stopDown - vc.y;
          if (vc.y < stopDown - 2 && dist < 140) target = dist < 4 ? 0 : vc.maxSpd * Math.max(0, (dist - 4) / 120);
        } else {
          const dist = vc.y - stopUp;
          if (vc.y > stopUp + 2 && dist < 140) target = dist < 4 ? 0 : vc.maxSpd * Math.max(0, (dist - 4) / 120);
        }
      }
      const accel = target < vc.speed ? -450 : 220;
      vc.speed += accel * dt;
      vc.speed  = Math.max(0, Math.min(vc.maxSpd, vc.speed));
      vc.y     += vc.dir * vc.speed * dt;
      if (vc.dir === 1  && vc.y > H + 50) { vc.y = -50;    vc.speed = 0; }
      if (vc.dir === -1 && vc.y < -50)    { vc.y = H + 50; vc.speed = 0; }
    });
  }

  /* ── Text sync (hero-position-driven both phases) ─────────── */
  let tsPhase = '', tsDone = false, tsLastN = -1, tsDescShown = false;

  function updateSyncedTitle(id) {
    const copy = COPY[id];
    if (!copy) return;

    if (tsPhase !== id) {
      tsPhase = id; tsDone = false; tsLastN = -1; tsDescShown = false;
      if (titleEl) titleEl.innerHTML = '<span class="tw-cursor">|</span>';
      if (copyEl)  { copyEl.innerHTML = ''; copyEl.style.opacity = '0'; }
    }
    if (tsDone) return;

    const full     = copy.line1 + ' ' + copy.line2;
    /* Constant typing rate: divide total chars evenly over the phase crossing window */
    const progress = Math.min(simTime / (TYPING_SECS[id] || 10), 1.0);
    const n        = Math.min(Math.floor(progress * full.length), full.length);
    if (n === tsLastN) return;
    tsLastN = n;

    /* Trigger canvas entrance after first word */
    const firstSpace = full.indexOf(' ');
    if (n > firstSpace) triggerCanvasEntrance();

    const shown  = full.slice(0, n);
    const isDone = n >= full.length;
    const cursor = isDone ? '' : '<span class="tw-cursor">|</span>';

    if (titleEl) {
      if (n <= copy.line1.length) {
        titleEl.innerHTML = shown + cursor;
      } else {
        const rest = shown.slice(copy.line1.length).trimStart();
        titleEl.innerHTML =
          copy.line1 + '<br/><span class="accent-glow">' + rest + cursor + '</span>';
      }
    }

    if (isDone && !tsDescShown) {
      tsDescShown = true; tsDone = true;
      if (copyEl && copy.p) {
        copyEl.innerHTML = copy.p;
        copyEl.style.transition = 'opacity 0.7s ease';
        requestAnimationFrame(() => { if (copyEl) copyEl.style.opacity = '1'; });
      }
    }
  }

  /* ── Drawing ──────────────────────────────────────────────── */
  function drawBackground(id) {
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, '#070d18'); bg.addColorStop(1, C.bg);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (id === 'fixed') {
      const g = ctx.createRadialGradient(W * 0.35, mainY, 0, W * 0.35, mainY, W * 0.55);
      g.addColorStop(0, 'rgba(248,113,113,0.08)'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (id === 'patc') {
      const g = ctx.createRadialGradient(W * 0.5, mainY, 0, W * 0.5, mainY, W * 0.6);
      g.addColorStop(0, 'rgba(52,211,153,0.07)'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  function drawCrossStreets() {
    [1, 3].forEach((ji) => {
      const x = jxs[ji], cw = 22;
      ctx.fillStyle = C.asphalt; ctx.fillRect(x - cw / 2, 0, cw, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.5;
      [x - cw / 2, x + cw / 2].forEach((ex) => { ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, H); ctx.stroke(); });
      ctx.setLineDash([8, 14]);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawMainRoad() {
    ctx.fillStyle = C.curb; ctx.fillRect(0, mainY - roadW / 2 - 3, W, roadW + 6);
    ctx.fillStyle = C.asphalt; ctx.fillRect(0, mainY - roadW / 2, W, roadW);
    ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(0, mainY - roadW / 2 + 2, W, roadW - 4);
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1;
    [mainY - roadW / 2, mainY + roadW / 2].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = C.median; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, mainY); ctx.lineTo(W, mainY); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawJunctionPads() {
    jxs.forEach((x, i) => {
      const broad = i === 1 || i === 3, pw = broad ? 56 : 46, ph = broad ? 50 : 42;
      ctx.fillStyle = C.asphaltL; ctx.fillRect(x - pw / 2, mainY - ph / 2, pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.strokeRect(x - pw / 2 + 0.5, mainY - ph / 2 + 0.5, pw - 1, ph - 1);
    });
  }

  function drawSignalHead(x, signalState) {
    const cx = x, cy = mainY - roadW / 2 - 18;
    ctx.fillStyle = '#1b2632'; ctx.fillRect(cx - 0.5, cy + 4, 1, 14);
    ctx.fillStyle = '#0b1218'; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8;
    const hw = 9, hh = 24;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - hw / 2, cy - hh / 2 + 4, hw, hh, 2); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(cx - hw / 2, cy - hh / 2 + 4, hw, hh); ctx.strokeRect(cx - hw / 2, cy - hh / 2 + 4, hw, hh); }
    const bulbs = [
      { dy: -7, color: C.red,   on: signalState === 'red'   },
      { dy: -1, color: C.amber, on: signalState === 'amber' },
      { dy:  5, color: C.green, on: signalState === 'green' },
    ];
    bulbs.forEach(({ dy, color, on }) => {
      ctx.beginPath(); ctx.arc(cx, cy + dy + 4, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = on ? color : C.bulbOff;
      if (on) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
      ctx.fill(); ctx.shadowBlur = 0;
    });
  }

  function drawSignalHeads(id) {
    jxs.forEach((x, i) => {
      const s = sig.sub[i] === 'allred' ? 'red' : mainAmber(i) ? 'amber' : mainGreen(i) ? 'green' : 'red';
      drawSignalHead(x, s);
      if (id === 'patc' && mainGreen(i)) {
        const pulse = (simTime * 1.6 + i * 0.5) % 1;
        ctx.beginPath(); ctx.arc(x, mainY, 16 + pulse * 30, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52,211,153,${(1 - pulse) * 0.22})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.fillStyle = C.muted; ctx.font = '600 9px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.fillText(`J${i + 1}`, x, mainY + roadW / 2 + 13); ctx.textAlign = 'start';
    });
  }

  function drawCar(x, y, angle, kind, isHero, id) {
    ctx.save(); ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    const color = isHero ? (id === 'patc' ? C.green : C.amber) : kind.color;
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(255,255,255,0.60)'; ctx.lineWidth = 0.5;
    if (isHero) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
    const l = kind.len, h = kind.ht;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-l / 2, -h / 2, l, h, 2.5); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(-l / 2, -h / 2, l, h); ctx.strokeRect(-l / 2, -h / 2, l, h); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(-l / 2 + 3, -h / 2 + 1.2, l - 6, h - 2.4);
    if (isHero) {
      ctx.font = '700 9px Inter, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.fillText('you', 0, -h / 2 - 5);
    }
    ctx.textAlign = 'start'; ctx.restore();
  }

  function drawHCars(id) {
    [...HCARS].reverse().forEach((car) => {
      if (car.x < -car.kind.len) return;
      drawCar(car.x, mainY - 4, 0, car.kind, car.isHero, id);
      /* Show "waiting" badge only when hero is fully stopped */
      if (car.isHero && car.speed < 1 && id === 'fixed') {
        ctx.font = '700 9px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(248,113,113,0.88)'; ctx.textAlign = 'center';
        ctx.fillText('⏸ waiting', car.x, mainY - 4 - car.kind.ht / 2 - 16);
        ctx.textAlign = 'start';
      }
    });
  }

  function drawVCars(id) {
    VCARS.forEach((vc) => {
      const angle = vc.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      drawCar(jxs[vc.ji], vc.y, angle, vc.kind, false, id);
    });
  }

  function drawModeChip(id) {
    const copy = COPY[id] || COPY.fixed;
    ctx.font = '700 10px JetBrains Mono, monospace';
    const label = copy.chip || '';
    const w = ctx.measureText(label).width + 26;
    const color = id === 'patc' ? C.green : C.red;
    ctx.fillStyle = C.panel; ctx.strokeStyle = color; ctx.lineWidth = 0.8;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(12, 12, w, 26, 13); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(12, 12, w, 26); ctx.strokeRect(12, 12, w, 26); }
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(24, 25, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.fillText(label, 34, 29);
  }

  /* ── Render frame ──────────────────────────────────────────── */
  function renderFrame(id, dt) {
    simTime += dt;
    updateSignals(dt, id);
    updateHCars(dt, id);
    updateVCars(dt);
    updateSyncedTitle(id);

    ctx.clearRect(0, 0, W, H);
    drawBackground(id);
    drawCrossStreets();
    drawMainRoad();
    drawJunctionPads();
    drawSignalHeads(id);

    if (id === 'patc') {
      const wx = ((simTime * 0.10) % 1.3) * W;
      const wg = ctx.createRadialGradient(wx, mainY, 0, wx, mainY, 110);
      wg.addColorStop(0, 'rgba(52,211,153,0.10)'); wg.addColorStop(1, 'transparent');
      ctx.fillStyle = wg; ctx.fillRect(0, mainY - 80, W, 160);
    }

    drawVCars(id); drawHCars(id); drawModeChip(id);
  }

  /* ── showCopy: set pills + text ───────────────────────────── */
  function showCopy(id, instant) {
    document.documentElement.dataset.storyPhase = id;
    document.querySelectorAll('[data-phase-pill]').forEach((p) => {
      p.classList.toggle('active',
        (id === 'fixed' && p.dataset.phasePill === 'fixed') ||
        (id === 'patc'  && p.dataset.phasePill === 'patc'));
    });

    const copy = COPY[id];
    if (!copy) return;

    if (instant) {
      /* Manual toggle: show full text right away, no typing */
      if (titleEl) {
        titleEl.innerHTML =
          copy.line1 + '<br/><span class="accent-glow">' + copy.line2 + '</span>';
      }
      if (copyEl) { copyEl.innerHTML = copy.p || ''; copyEl.style.opacity = '1'; }
      tsPhase = id; tsDone = true; tsDescShown = true; tsLastN = 99999;
      triggerCanvasEntrance();
    } else {
      /* Auto-play: clear and let updateSyncedTitle handle typing */
      if (titleEl) titleEl.innerHTML = '<span class="tw-cursor">|</span>';
      if (copyEl)  { copyEl.innerHTML = ''; copyEl.style.opacity = '0'; }
      tsPhase = '';
    }
  }

  /* ── Phase machine: no loop ────────────────────────────────── */
  function currentPhase(now) {
    if (manualPhase) return { id: manualPhase, elapsed: now - manualStart };
    if (!seqStart) seqStart = now;
    const elapsed = now - seqStart;
    let start = 0;
    for (const ph of PHASES) {
      if (ph.ms === Infinity) return { id: ph.id, elapsed: elapsed - start };
      if (elapsed < start + ph.ms) return { id: ph.id, elapsed: elapsed - start };
      start += ph.ms;
    }
    return { id: PHASES[PHASES.length - 1].id, elapsed: elapsed - start };
  }

  /* ── RAF loop ──────────────────────────────────────────────── */
  function loop(now) {
    if (!lastDraw) lastDraw = now;
    const dt = Math.min((now - lastDraw) / 1000, 0.05);
    lastDraw = now;
    const { id } = currentPhase(now);
    if (id !== lastPhaseId) {
      lastPhaseId = id; simTime = 0;
      initHCars(); initVCars(); resetSignals(id);
      showCopy(id, manualJustSet);
      manualJustSet = false;
    }
    renderFrame(id, dt);
    rafId = requestAnimationFrame(loop);
  }

  /* ── Layout ────────────────────────────────────────────────── */
  function computeLayout() {
    mainY = H * 0.50;
    roadW = Math.max(24, Math.min(40, H * 0.065));
    const margin = Math.max(44, W * 0.07);
    jxs = Array.from({ length: N }, (_, i) => margin + (W - 2 * margin) * (i / (N - 1)));
  }

  function resize() {
    const host = canvas.parentElement || canvas;
    const rect  = host.getBoundingClientRect();
    W = Math.max(320, rect.width); H = Math.max(200, rect.height);
    canvas.width  = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); computeLayout();
  }

  /* ── Manual controls ───────────────────────────────────────── */
  function setPhase(id) {
    if (!COPY[id]) return;
    manualJustSet = true;
    manualPhase   = id;
    manualStart   = performance.now();
  }

  function replay() {
    cancelAnimationFrame(rafId);
    seqStart = 0; manualPhase = ''; lastPhaseId = ''; lastDraw = 0; simTime = 0;
    manualJustSet = false;
    tsPhase = ''; tsDone = false; tsLastN = -1; tsDescShown = false;
    /* Reset canvas entrance for replay */
    canvasEntered = false;
    const visual = document.querySelector('.story-visual');
    if (visual) visual.classList.remove('canvas-entered');
    initHCars(); initVCars();
    rafId = requestAnimationFrame(loop);
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  function start() {
    resize(); initHCars(); initVCars(); resetSignals('fixed');
    /* Set initial pill state */
    document.documentElement.dataset.storyPhase = 'fixed';
    document.querySelectorAll('[data-phase-pill]').forEach((p) => {
      p.classList.toggle('active', p.dataset.phasePill === 'fixed');
    });
    if (titleEl) titleEl.innerHTML = '<span class="tw-cursor">|</span>';
    if (copyEl)  { copyEl.innerHTML = ''; copyEl.style.opacity = '0'; }

    if (motionQ.matches) {
      resetSignals('patc'); showCopy('patc', true); renderFrame('patc', 0); return;
    }
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    resize();
    if (motionQ.matches) renderFrame(lastPhaseId || 'patc', 0);
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
