/* PATC homepage opening story: rush hour → PATC wave. */
(function () {
  'use strict';

  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const titleEl = document.querySelector('[data-home-story-title]');
  const copyEl = document.querySelector('[data-home-story-copy]');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const C = {
    bg: '#070B12', road: 'rgba(26,40,64,0.95)', edge: 'rgba(61,191,176,0.16)',
    lane: 'rgba(232,236,244,0.10)', green: '#34D399', amber: '#F59E0B',
    red: '#F87171', text: '#E8ECF4', muted: 'rgba(155,164,181,0.72)',
    panel: 'rgba(10,15,26,0.78)',
  };

  const COPY = {
    fixed: {
      h: 'Imagine being stuck in traffic<br/><span class="accent-glow">during a rush hour.</span>',
      p: 'Every junction fights alone. Each signal optimizes itself. The corridor jams because no junction sees the full picture.',
      chip: 'Without PATC',
    },
    patc: {
      h: 'PATC sees the corridor<br/><span class="accent-glow">and opens a green wave.</span>',
      p: 'The system predicts arrivals, opens the right greens, and dynamically holds cross-traffic to optimize corridor flow.',
      chip: 'With PATC',
    },
    done: {
      h: 'The corridor clears.<br/><span class="accent-glow">Ready for the next wave.</span>',
      p: 'Once the wave passes, the system resets efficiently without leaving stranded vehicles.',
      chip: 'Clear road',
    }
  };

  const SEQUENCE = [
    { id: 'fixed', ms: 14000 },
    { id: 'patc', ms: 14000 },
    { id: 'done', ms: 4000 },
  ];

  let width = 0, height = 0, rafId = 0, sequenceStart = 0;
  let activePhase = '', manualPhase = '', manualStart = 0;
  let typedTitleUntil = 0, typedBodyUntil = 0, phaseStart = 0, lastDraw = 0;
  let simTime = 0, layout = null;
  let SIM_CARS = [];

  function initSimCars() {
    SIM_CARS = [];
    const carsPerLane = {};
    for (let i = 0; i < 28; i++) {
      const axis = i % 4 === 0 ? 'v' : 'h';
      const lane = i % 5;
      const key = axis + (axis === 'v' ? lane : (lane % 3));
      carsPerLane[key] = (carsPerLane[key] || 0) + 1;
      
      SIM_CARS.push({
        axis,
        lane,
        pos: (carsPerLane[key] * 0.3 + Math.random() * 0.1) % 1,
        maxSpeed: 0.12 + Math.random() * 0.05,
        currentSpeed: 0.05,
        size: i % 8 === 0 ? 11 : 7 + (i % 4),
        shade: i % 3,
        id: i
      });
    }
    // Add the "hero" car
    SIM_CARS.push({
      axis: 'h', lane: 1, pos: 0.05, maxSpeed: 0.15, currentSpeed: 0.05, size: 9, shade: 99, id: 'hero'
    });
  }

  function showCopy(id) {
    if (activePhase === id) return;
    const copy = COPY[id] || COPY.fixed;
    activePhase = id;
    phaseStart = performance.now();
    typedTitleUntil = -1;
    typedBodyUntil = -1;
    document.documentElement.dataset.storyPhase = id;
    document.querySelectorAll('[data-phase-pill]').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.phasePill === id);
    });
  }

  function resize() {
    const host = canvas.parentElement || canvas;
    const rect = host.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(220, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout = sceneLayout();
  }

  function sceneLayout() {
    const mx = Math.max(34, width * 0.10);
    const my = Math.max(38, height * 0.18);
    const xs = Array.from({ length: 5 }, (_, i) => lerp(mx, width - mx, i / 4));
    const ys = Array.from({ length: 3 }, (_, i) => lerp(my, height - my, i / 2));
    return { xs, ys, midY: ys[1] };
  }

  function stateForElapsed(elapsed) {
    let start = 0;
    for (const phase of SEQUENCE) {
      const end = start + phase.ms;
      if (elapsed < end) return { id: phase.id, progress: clamp((elapsed - start)/phase.ms, 0, 1) };
      start = end;
    }
    return { id: 'done', progress: 1 };
  }

  function currentState(now) {
    if (manualPhase) {
       const elapsed = now - manualStart;
       if (manualPhase === 'done') return { id: 'done', progress: clamp(elapsed/4000, 0, 1) };
       return { id: manualPhase, progress: clamp(elapsed/14000, 0, 1) };
    }
    return stateForElapsed(now - sequenceStart);
  }

  function getSignalColor(col, row, stateId) {
    if (stateId === 'done') return 'rgba(232,236,244,0.08)';
    if (stateId === 'patc') {
      // Give HERO absolute priority, otherwise fallback to a cycle so NS flows too
      let heroDemand = false;
      for (const car of SIM_CARS) {
        if (car.id === 'hero' && (car.lane % 3) === row) {
          const carX = car.pos * (width + 120) - 60;
          const dist = layout.xs[col] - carX;
          if (dist > -20 && dist < width * 0.35) { heroDemand = true; break; }
        }
      }
      if (heroDemand) return C.green;
      // Normal optimized cycle
      const cycle = Math.floor((simTime + col * 3.5 + row * 2.5) / 4) % 2;
      return cycle === 0 ? C.green : C.red;
    }
    const cycle = Math.floor((simTime + col * 3.5 + row * 2.5) / 4) % 2;
    return cycle === 0 ? C.green : C.red;
  }

  function updatePhysics(dt, stateId) {
    simTime += dt;
    const BRAKING_DIST = 90;
    const STOP_DIST = 26;

    for (const car of SIM_CARS) {
      let nextPos = -1;
      let isRed = false;
      
      const realLane = car.axis === 'v' ? (car.lane % layout.xs.length) : (car.lane % layout.ys.length);
      const span = car.axis === 'h' ? width + 120 : height + 120;
      const currentPos = car.pos * span - 60;

      if (car.axis === 'h') {
        const carY = layout.ys[realLane];
        for (let col = 0; col < layout.xs.length; col++) {
          if (layout.xs[col] > currentPos) {
            nextPos = layout.xs[col];
            isRed = getSignalColor(col, realLane, stateId) !== C.green;
            break;
          }
        }
      } else {
        const carX = layout.xs[realLane];
        for (let row = 0; row < layout.ys.length; row++) {
          if (layout.ys[row] > currentPos) {
            nextPos = layout.ys[row];
            isRed = getSignalColor(realLane, row, stateId) === C.green; // If EW is green, NS is red
            break;
          }
        }
      }

      let targetSpeed = car.maxSpeed;
      if (nextPos !== -1 && isRed) {
        let dist = nextPos - currentPos;
        if (dist > 0 && dist < BRAKING_DIST) {
          // Linear braking looks smoother and less aggressive than quadratic
          targetSpeed = dist < STOP_DIST ? 0 : car.maxSpeed * ((dist - STOP_DIST) / (BRAKING_DIST - STOP_DIST));
        }
      }
      
      // Avoid hitting car ahead
      let distToAhead = Infinity;
      for (const other of SIM_CARS) {
        if (other !== car && other.axis === car.axis && other.lane === car.lane) {
          let oPos = other.pos * span - 60;
          let d = oPos - currentPos;
          if (d < 0) d += span; // loop around
          if (d > 0 && d < distToAhead) distToAhead = d;
        }
      }
      const SAFE_GAP = 35;
      const FOLLOW_DIST = 75;
      if (distToAhead < SAFE_GAP) targetSpeed = 0;
      else if (distToAhead < FOLLOW_DIST) targetSpeed = Math.min(targetSpeed, car.maxSpeed * ((distToAhead - SAFE_GAP)/(FOLLOW_DIST - SAFE_GAP)));

      // Smoother acceleration, faster braking
      const lerpFactor = targetSpeed < car.currentSpeed ? 0.20 : 0.08;
      car.currentSpeed = lerp(car.currentSpeed, targetSpeed, lerpFactor);
      car.pos += (car.currentSpeed * 100 * dt) / span;
      if (car.pos > 1) car.pos -= 1;
    }
  }

  /* ── Main render ─────────────────────────────────────────────── */
  function render(now, state, dt) {
    if (state.id !== 'done') updatePhysics(dt, state.id);
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.68, height * 0.28, 0, width * 0.68, height * 0.28, width * 0.7);
    glow.addColorStop(0, state.id === 'fixed' ? 'rgba(248,113,113,0.06)' : state.id === 'patc' ? 'rgba(52,211,153,0.07)' : 'rgba(7,11,18,0)');
    glow.addColorStop(1, 'rgba(7,11,18,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    updateTyping(now, state.id);
    drawRoadGrid(layout, 1);
    
    // Draw Signals
    layout.ys.forEach((y, row) => {
      layout.xs.forEach((x, col) => {
        const color = getSignalColor(col, row, state.id);
        ctx.fillStyle = 'rgba(10,15,26,0.92)';
        box(x - 12, y - 12, 24, 24, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(232,236,244,0.08)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5.3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = color === C.green ? 18 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    });

    // Draw Traffic
    let alpha = state.id === 'done' ? Math.max(0, 1 - state.progress * 4) : 1;
    if (alpha > 0) {
      for (const car of SIM_CARS) {
        const realLane = car.axis === 'v' ? (car.lane % layout.xs.length) : (car.lane % layout.ys.length);
        const span = car.axis === 'h' ? width + 120 : height + 120;
        const currentPos = car.pos * span - 60;
        const x = car.axis === 'h' ? currentPos : layout.xs[realLane];
        const y = car.axis === 'h' ? layout.ys[realLane] : currentPos;
        const angle = car.axis === 'h' ? 0 : Math.PI / 2;
        
        let color = C.muted;
        if (car.id === 'hero') color = state.id === 'patc' ? C.green : C.amber;
        else if (state.id === 'patc') color = car.shade === 0 ? 'rgba(52,211,153,0.65)' : 'rgba(232,236,244,0.40)';
        else color = car.shade === 0 ? 'rgba(248,113,113,0.68)' : 'rgba(232,236,244,0.30)';

        drawVehicle(x, y, angle, car.size, color, alpha, car.id === 'hero');
        
        if (car.id === 'hero') {
          label('you', x, y - 28);
          if (car.currentSpeed < 0.02 && state.id === 'fixed') waitBadge(x, y + 31);
        }
      }
    }
    drawStageChip(state.id);
  }

  function updateTyping(now, id) {
    const copy = COPY[id] || COPY.fixed;
    const elapsed = now - phaseStart;
    const titleText = stripTags(copy.h);
    const charDelay = 36;
    const bodyDelay = 20;
    const titleCount = Math.min(titleText.length, Math.floor(elapsed / charDelay));
    const bodyCount = Math.min(copy.p.length, Math.floor(Math.max(0, elapsed - titleText.length * charDelay * 0.6) / bodyDelay));
    
    if (titleCount === typedTitleUntil && bodyCount === typedBodyUntil) return;
    typedTitleUntil = titleCount;
    typedBodyUntil = bodyCount;

    if (titleEl) {
      if (titleCount >= titleText.length) titleEl.innerHTML = copy.h;
      else titleEl.innerHTML = titleText.slice(0, titleCount) + '<span class="cursor-blink">|</span>';
    }
    if (copyEl) copyEl.textContent = copy.p.slice(0, bodyCount);
  }

  function stripTags(html) { return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''); }

  function drawRoadGrid(layout, reveal) {
    const lanes = [...layout.ys.map((y) => ['h', y]), ...layout.xs.map((x) => ['v', x])];
    lanes.forEach(([axis, pos]) => {
      if (axis === 'h') roadLine(0, pos, width, pos);
      else roadLine(pos, 0, pos, height);
    });
  }

  function roadLine(x1, y1, x2, y2) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.road;
    ctx.lineWidth = Math.max(18, Math.min(width, height) * 0.06);
    line(x1, y1, x2, y2);
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1;
    line(x1, y1, x2, y2);
    ctx.setLineDash([10, 18]);
    ctx.strokeStyle = C.lane;
    line(x1, y1, x2, y2);
    ctx.setLineDash([]);
  }

  function drawVehicle(x, y, angle, size, color, alpha, glow) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    box(-size, -size * 0.48, size * 2, size * 0.96, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(7,11,18,0.46)';
    box(size * 0.18, -size * 0.32, size * 0.50, size * 0.64, 2);
    ctx.fill();
    ctx.restore();
  }

  function label(text, x, y) {
    ctx.font = '700 11px Inter, sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = C.panel;
    box(x - w / 2, y - 15, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'start';
  }

  function waitBadge(x, y) {
    ctx.font = '700 10px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(248,113,113,0.16)';
    box(x - 29, y - 13, 58, 20, 10);
    ctx.fill();
    ctx.fillStyle = C.red;
    ctx.textAlign = 'center';
    ctx.fillText('waiting', x, y + 1);
    ctx.textAlign = 'start';
  }

  function drawStageChip(id) {
    const text = COPY[id].chip;
    ctx.font = '700 11px JetBrains Mono, monospace';
    const w = Math.min(width - 28, ctx.measureText(text).width + 28);
    ctx.fillStyle = C.panel;
    box(14, 14, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = id === 'fixed' ? C.red : id === 'patc' ? C.green : C.amber;
    ctx.beginPath();
    ctx.arc(28, 29, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.fillText(text, 40, 33);
  }

  function box(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function lerp(start, end, amount) { return start + (end - start) * amount; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function loop(now) {
    if (!lastDraw) lastDraw = now;
    const dt = Math.min((now - lastDraw) / 1000, 0.05); // cap dt at 50ms
    lastDraw = now;
    
    if (!sequenceStart) sequenceStart = now;
    const state = currentState(now);
    showCopy(state.id);
    render(now, state, dt);
    rafId = requestAnimationFrame(loop);
  }

  function setManualPhase(id) {
    if (!COPY[id]) return;
    manualPhase = id;
    manualStart = performance.now();
    showCopy(id);
  }

  function start() {
    initSimCars();
    resize();
    if (motionQuery.matches) {
      showCopy('patc');
      render(performance.now(), { id: 'patc', progress: 1 }, 0.016);
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { resize(); if (motionQuery.matches) render(performance.now(), { id: 'patc', progress: 1 }, 0); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
    else if (!rafId && !motionQuery.matches) { lastDraw = performance.now(); rafId = requestAnimationFrame(loop); }
  });

  function replayStory() {
    cancelAnimationFrame(rafId);
    sequenceStart = 0; manualPhase = ''; manualStart = 0; activePhase = '';
    typedTitleUntil = -1; typedBodyUntil = -1; phaseStart = 0; lastDraw = 0;
    initSimCars();
    rafId = requestAnimationFrame(loop);
  }

  const replayBtn = document.getElementById('storyReplayBtn');
  if (replayBtn) replayBtn.addEventListener('click', replayStory);
  document.querySelectorAll('[data-phase-pill]').forEach((pill) => {
    pill.style.cursor = 'pointer';
    pill.addEventListener('click', () => setManualPhase(pill.dataset.phasePill));
  });

  window.HomeStory = { setPhase: setManualPhase, replay: replayStory };
  start();
})();
