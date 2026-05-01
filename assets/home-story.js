/* PATC homepage opening story: sentence -> grid -> traffic -> coordinated run. */
(function () {
  'use strict';

  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const titleEl = document.querySelector('[data-home-story-title]');
  const copyEl = document.querySelector('[data-home-story-copy]');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const C = {
    bg: '#070B12',
    road: 'rgba(26,40,64,0.95)',
    edge: 'rgba(61,191,176,0.16)',
    lane: 'rgba(232,236,244,0.10)',
    green: '#34D399',
    amber: '#F59E0B',
    red: '#F87171',
    text: '#E8ECF4',
    muted: 'rgba(155,164,181,0.72)',
    panel: 'rgba(10,15,26,0.78)',
  };

  const COPY = {
    intro: {
      h: 'Imagine driving across an empty grid. No traffic at all. Just you on the road.',
      p: 'Still, every fixed signal can ask you to stop because it does not know the road is empty.',
      chip: 'Sentence first',
    },
    empty: {
      h: 'The road is empty,<br/><span class="accent-glow">but the lights are blind.</span>',
      p: 'Your car moves through the same grid and pauses at junctions that have no real conflict.',
      chip: 'Single labeled user car',
    },
    traffic: {
      h: 'Now rush hour arrives<br/><span class="accent-glow">from every direction.</span>',
      p: 'The same trip slows down because each junction is solving itself, not the whole corridor.',
      chip: 'Rush-hour load',
    },
    patc: {
      h: 'PATC coordinates<br/><span class="accent-glow">before the wave reaches you.</span>',
      p: 'The system predicts arrival, opens the right greens, and lets the same route move faster.',
      chip: 'Coordinated faster run',
    },
    tagline: {
      h: 'What if traffic lights<br/><span class="accent-glow">knew you were coming?</span>',
      p: 'PATC makes every signal part of the same corridor intelligence.',
      chip: 'Final question',
    },
  };

  const SEQUENCE = [
    { id: 'intro', ms: 2400 },
    { id: 'empty', ms: 5200 },
    { id: 'traffic', ms: 5200 },
    { id: 'patc', ms: 4600 },
  ];

  const TRAFFIC = Array.from({ length: 22 }, (_, i) => ({
    axis: i % 4 === 0 ? 'v' : 'h',
    lane: i % 5,
    offset: ((i * 37) % 100) / 100,
    speed: 0.018 + (i % 7) * 0.004,
    size: 7 + (i % 4),
    shade: i % 3,
  }));

  let width = 0;
  let height = 0;
  let rafId = 0;
  let sequenceStart = 0;
  let activePhase = '';
  let manualPhase = '';
  let manualStart = 0;

  function showCopy(id) {
    if (activePhase === id) return;
    const copy = COPY[id] || COPY.intro;
    activePhase = id;
    document.documentElement.dataset.storyPhase = id;
    if (titleEl) titleEl.innerHTML = copy.h;
    if (copyEl) copyEl.textContent = copy.p;
    document.querySelectorAll('[data-phase-pill]').forEach((pill) => {
      const phase = pill.dataset.phasePill;
      const active = phase === id || (id === 'intro' && phase === 'empty') || (id === 'tagline' && phase === 'patc');
      pill.classList.toggle('active', active);
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
      if (elapsed < end) return makeState(phase.id, elapsed - start, phase.ms);
      start = end;
    }
    return makeState('tagline', Math.max(0, elapsed - start), 2400);
  }

  function makeState(id, ageMs, totalMs) {
    return { id, age: ageMs / 1000, progress: clamp(ageMs / totalMs, 0, 1) };
  }

  function currentState(now) {
    if (manualPhase) return makeState(manualPhase, now - manualStart, 2200);
    return stateForElapsed(now - sequenceStart);
  }

  function render(now, state) {
    const layout = sceneLayout();
    const hero = getHero(state, layout);
    drawBackground(now / 1000, state.id);
    if (state.id === 'intro') return;
    drawRoadGrid(layout, roadReveal(state));
    drawPatcWave(layout, state);
    drawSignals(layout, state, hero);
    drawTraffic(layout, state, hero);
    if (hero) drawHero(hero, state);
    drawStageChip(state.id);
    if (state.id === 'tagline') drawFinalBadge(state);
  }

  function drawBackground(time, id) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.68, height * 0.28, 0, width * 0.68, height * 0.28, width * 0.7);
    glow.addColorStop(0, id === 'traffic' ? 'rgba(248,113,113,0.09)' : 'rgba(61,191,176,0.10)');
    glow.addColorStop(1, 'rgba(7,11,18,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(61,191,176,0.035)';
    ctx.lineWidth = 1;
    for (let x = -48 + (time * 7) % 48; x < width; x += 48) line(x, 0, x, height);
    for (let y = 0; y < height; y += 48) line(0, y, width, y);
  }

  function drawIntro(state) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.progress * 2.2);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.text;
    ctx.font = `${Math.max(20, width * 0.045)}px Inter, sans-serif`;
    textLines(['The first problem is simple:', 'the signal does not know you exist.'], width / 2, height * 0.45, 34);
    ctx.fillStyle = C.muted;
    ctx.font = '600 12px JetBrains Mono, monospace';
    ctx.fillText('PATC opening story', width / 2, height * 0.66);
    ctx.restore();
  }

  function drawRoadGrid(layout, reveal) {
    const lanes = [
      ...layout.ys.map((y) => ['h', y]),
      ...layout.xs.map((x) => ['v', x]),
    ];
    lanes.forEach(([axis, pos], index) => {
      const shown = clamp((reveal - index * 0.045) / 0.55, 0, 1);
      if (axis === 'h') roadLine(0, pos, width, pos, shown);
      else roadLine(pos, 0, pos, height, shown);
    });
  }

  function roadLine(x1, y1, x2, y2, reveal) {
    const endX = lerp(x1, x2, reveal);
    const endY = lerp(y1, y2, reveal);
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.road;
    ctx.lineWidth = Math.max(18, Math.min(width, height) * 0.06);
    line(x1, y1, endX, endY);
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1;
    line(x1, y1, endX, endY);
    ctx.setLineDash([10, 18]);
    ctx.strokeStyle = C.lane;
    line(x1, y1, endX, endY);
    ctx.setLineDash([]);
  }

  function drawSignals(layout, state, hero) {
    layout.ys.forEach((y, row) => {
      layout.xs.forEach((x, col) => {
        const color = signalColor(x, y, col, row, state, hero);
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
  }

  function signalColor(x, y, col, row, state, hero) {
    if (isPatc(state.id)) {
      const nearHero = hero && Math.hypot(x - hero.x, y - hero.y) < width * 0.16;
      return Math.abs(x - waveX(state)) < width * 0.13 || nearHero ? C.green : 'rgba(52,211,153,0.26)';
    }
    if (state.id === 'traffic') {
      return (col + row + Math.floor(state.age * 0.8)) % 4 === 0 ? C.green : C.red;
    }
    if (hero && Math.abs(x - hero.x) < width * 0.12 && row === 1) return C.red;
    return col % 2 === 0 ? C.red : 'rgba(248,113,113,0.42)';
  }

  function drawPatcWave(layout, state) {
    if (!isPatc(state.id)) return;
    const x = waveX(state);
    const wave = ctx.createRadialGradient(x, layout.midY, 0, x, layout.midY, width * 0.28);
    wave.addColorStop(0, 'rgba(52,211,153,0.22)');
    wave.addColorStop(0.45, 'rgba(52,211,153,0.08)');
    wave.addColorStop(1, 'rgba(52,211,153,0)');
    ctx.fillStyle = wave;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTraffic(layout, state, hero) {
    const alpha = trafficAlpha(state);
    if (alpha <= 0) return;
    const used = hero ? [hero] : [];
    TRAFFIC.forEach((vehicle) => {
      const point = trafficPoint(vehicle, layout, state);
      if (isTooClose(point, used, 28)) return;
      used.push(point);
      const color = trafficColor(vehicle, state.id);
      drawVehicle(point.x, point.y, point.angle, vehicle.size, color, alpha, isPatc(state.id));
    });
  }

  function trafficPoint(vehicle, layout, state) {
    const fast = isPatc(state.id);
    const raw = (vehicle.offset + state.age * vehicle.speed * (fast ? 4.2 : 1.25)) % 1;
    const progress = fast ? raw : queuedProgress(raw);
    if (vehicle.axis === 'v') {
      return { x: layout.xs[vehicle.lane % 5], y: lerp(-30, height + 30, progress), angle: Math.PI / 2 };
    }
    return { x: lerp(-34, width + 34, progress), y: layout.ys[vehicle.lane % 3], angle: 0 };
  }

  function trafficColor(vehicle, id) {
    if (isPatc(id)) return vehicle.shade === 0 ? 'rgba(52,211,153,0.74)' : 'rgba(232,236,244,0.58)';
    if (vehicle.shade === 0) return 'rgba(248,113,113,0.68)';
    if (vehicle.shade === 1) return 'rgba(245,158,11,0.70)';
    return 'rgba(232,236,244,0.50)';
  }

  function getHero(state, layout) {
    if (state.id === 'intro') return null;
    const color = isPatc(state.id) ? C.green : C.amber;
    const label = state.id === 'empty' ? 'you' : 'your car';
    return { ...heroPose(layout, heroProgress(state)), color, label };
  }

  function heroProgress(state) {
    if (state.id === 'empty') return stoppedProgress(state.progress);
    if (state.id === 'traffic') return clamp(0.18 + state.progress * 0.33 + Math.sin(state.age * 4) * 0.005, 0, 0.56);
    return (state.age * 0.24 + 0.06) % 1;
  }

  function heroPose(layout, progress) {
    const route = heroRoute(layout);
    const target = progress * route.total;
    let covered = 0;
    for (let i = 1; i < route.points.length; i += 1) {
      const a = route.points[i - 1];
      const b = route.points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (covered + length >= target) {
        const t = (target - covered) / length;
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
        };
      }
      covered += length;
    }
    const last = route.points[route.points.length - 1];
    const prev = route.points[route.points.length - 2];
    return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
  }

  function heroRoute(layout) {
    const points = [
      { x: layout.xs[4] + 46, y: layout.ys[0] - 26 },
      { x: layout.xs[4], y: layout.ys[0] },
      { x: layout.xs[4], y: layout.ys[1] },
      { x: layout.xs[3], y: layout.ys[1] },
      { x: layout.xs[3], y: layout.ys[2] },
      { x: layout.xs[1], y: layout.ys[2] },
    ];
    const total = points.slice(1).reduce((sum, point, index) => {
      const prev = points[index];
      return sum + Math.hypot(point.x - prev.x, point.y - prev.y);
    }, 0);
    return { points, total };
  }

  function stoppedProgress(progress) {
    if (progress < 0.20) return ease(progress / 0.20) * 0.22;
    if (progress < 0.38) return 0.22;
    if (progress < 0.58) return 0.22 + ease((progress - 0.38) / 0.20) * 0.24;
    if (progress < 0.72) return 0.46;
    if (progress < 0.88) return 0.46 + ease((progress - 0.72) / 0.16) * 0.26;
    return 0.72 + ease((progress - 0.88) / 0.12) * 0.18;
  }

  function drawHero(hero, state) {
    drawVehicle(hero.x, hero.y, hero.angle, 13, hero.color, 1, true);
    label(hero.label, hero.x, hero.y - 28);
    if (state.id === 'traffic') waitBadge(hero.x, hero.y + 31);
  }

  function drawVehicle(x, y, angle, size, color, alpha, glow) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = glow ? color : 'transparent';
    ctx.shadowBlur = glow ? 16 : 0;
    ctx.fillStyle = color;
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
    ctx.fillStyle = id === 'traffic' ? C.red : C.green;
    ctx.beginPath();
    ctx.arc(28, 29, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.fillText(text, 40, 33);
  }

  function drawFinalBadge(state) {
    ctx.save();
    ctx.globalAlpha = ease(state.progress);
    ctx.fillStyle = 'rgba(7,11,18,0.36)';
    box(width - 146, 18, 126, 32, 16);
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillText('PATC ACTIVE', width - 130, 38);
    ctx.restore();
  }

  function queuedProgress(progress) {
    for (const stop of [0.27, 0.50, 0.73]) {
      if (progress > stop - 0.075 && progress < stop + 0.018) {
        return stop - 0.055 + (progress - stop + 0.075) * 0.22;
      }
    }
    return progress;
  }

  function isTooClose(point, used, distance) {
    return used.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < distance);
  }

  function trafficAlpha(state) {
    if (state.id === 'traffic') return ease(state.progress);
    return isPatc(state.id) ? 1 : 0;
  }

  function roadReveal(state) {
    return state.id === 'empty' ? ease(state.progress) : 1;
  }

  function waveX(state) {
    return ((state.age * 0.36) % 1) * width;
  }

  function isPatc(id) {
    return id === 'patc' || id === 'tagline';
  }

  function box(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function textLines(lines, x, y, lineHeight) {
    lines.forEach((text, index) => ctx.fillText(text, x, y + index * lineHeight));
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function ease(value) {
    return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loop(now) {
    if (!sequenceStart) sequenceStart = now;
    const state = currentState(now);
    showCopy(state.id);
    render(now, state);
    rafId = requestAnimationFrame(loop);
  }

  function setManualPhase(id) {
    if (!COPY[id]) return;
    manualPhase = id;
    manualStart = performance.now();
    showCopy(id);
  }

  function initScrollPhases() {
    const sections = document.querySelectorAll('[data-story-phase]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setManualPhase(entry.target.dataset.storyPhase);
      });
    }, { threshold: 0.42 });
    sections.forEach((section) => observer.observe(section));
  }

  function start() {
    resize();
    if (motionQuery.matches) {
      showCopy('tagline');
      render(performance.now(), { id: 'tagline', age: 8, progress: 1 });
      return;
    }
    initScrollPhases();
    rafId = requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (motionQuery.matches) render(performance.now(), { id: 'tagline', age: 8, progress: 1 });
    }, 160);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    else if (!rafId && !motionQuery.matches) rafId = requestAnimationFrame(loop);
  });

  if (motionQuery.addEventListener) motionQuery.addEventListener('change', () => window.location.reload());
  else motionQuery.addListener(() => window.location.reload());

  window.HomeStory = { setPhase: setManualPhase };
  start();
})();
