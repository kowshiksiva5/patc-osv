/* PATC homepage opening story: rush hour → quieter road → PATC wave. */
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

  /* ── Story copy ─────────────────────────────────────────────── */
  const COPY = {
    intro: {
      h: 'Imagine being stuck in traffic\u2026',
      p: 'You see the road ahead is clear, but the signal won\u2019t budge.',
      chip: 'The problem',
    },
    rush: {
      h: 'Rush hour.<br/><span class="accent-glow">Every junction fights alone.</span>',
      p: 'Each signal optimizes itself. The corridor jams because no junction sees the full picture.',
      chip: 'Full traffic load',
    },
    quiet: {
      h: 'Traffic eases,<br/><span class="accent-glow">but the wait stays.</span>',
      p: 'Fewer cars, same fixed timers. You still stop at signals with no cross-traffic.',
      chip: 'Lighter load, same delays',
    },
    patc: {
      h: 'PATC sees the corridor<br/><span class="accent-glow">and opens a green wave.</span>',
      p: 'The system predicts your arrival, opens the right greens, and holds cross-traffic at signals.',
      chip: 'Coordinated faster run',
    },
  };

  /* 3-layer sequence: rush → quiet → PATC */
  const SEQUENCE = [
    { id: 'intro', ms: 3200 },
    { id: 'rush', ms: 9000 },
    { id: 'quiet', ms: 8000 },
    { id: 'patc', ms: 7000 },
  ];

  /* Traffic vehicles for rush/quiet scenes */
  const TRAFFIC = Array.from({ length: 24 }, (_, i) => ({
    axis: i % 4 === 0 ? 'v' : 'h',
    lane: i % 5,
    offset: ((i * 37) % 100) / 100,
    speed: 0.016 + (i % 7) * 0.004,
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
  let typedUntil = 0;
  let phaseStart = 0;
  let lastDraw = 0;

  function showCopy(id) {
    if (activePhase === id) return;
    const copy = COPY[id] || COPY.intro;
    activePhase = id;
    phaseStart = performance.now();
    typedUntil = 0;
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
    return makeState('patc', Math.max(0, elapsed - start), 7000);
  }

  function makeState(id, ageMs, totalMs) {
    return { id, age: ageMs / 1000, progress: clamp(ageMs / totalMs, 0, 1) };
  }

  function currentState(now) {
    if (manualPhase) return makeState(manualPhase, now - manualStart, 4000);
    return stateForElapsed(now - sequenceStart);
  }

  /* ── Main render ─────────────────────────────────────────────── */
  function render(now, state) {
    const layout = sceneLayout();
    const hero = getHero(state, layout);
    drawBackground(now / 1000, state.id);
    updateTyping(now, state.id);
    if (state.id === 'intro') return;
    drawRoadGrid(layout, roadReveal(state));
    drawPatcWave(layout, state);
    drawSignals(layout, state, hero);
    drawTraffic(layout, state, hero);
    if (hero) drawHero(hero, state);
    drawStageChip(state.id);
  }

  function drawBackground(time, id) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);
    if (id === 'intro') return;
    const glow = ctx.createRadialGradient(width * 0.68, height * 0.28, 0, width * 0.68, height * 0.28, width * 0.7);
    glow.addColorStop(0, id === 'rush' ? 'rgba(248,113,113,0.06)' : isPatc(id) ? 'rgba(52,211,153,0.07)' : 'rgba(245,158,11,0.05)');
    glow.addColorStop(1, 'rgba(7,11,18,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  /* ── Typing animation ──────────────────────────────────────── */
  function updateTyping(now, id) {
    const copy = COPY[id] || COPY.intro;
    const elapsed = now - phaseStart;
    const titleText = stripTags(copy.h);
    const charDelay = id === 'intro' ? 55 : 36;
    const bodyDelay = id === 'intro' ? 30 : 20;
    const titleCount = Math.min(titleText.length, Math.floor(elapsed / charDelay));
    const bodyCount = Math.min(copy.p.length, Math.floor(Math.max(0, elapsed - titleText.length * charDelay * 0.6) / bodyDelay));
    if (titleCount === typedUntil) return;
    typedUntil = titleCount;
    if (titleEl) {
      if (titleCount >= titleText.length) {
        titleEl.innerHTML = copy.h;
      } else {
        titleEl.innerHTML = titleText.slice(0, titleCount) + '<span class="cursor-blink">|</span>';
      }
    }
    if (copyEl) copyEl.textContent = copy.p.slice(0, bodyCount);
  }

  function stripTags(html) {
    return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '');
  }

  /* ── Road grid ──────────────────────────────────────────────── */
  function drawRoadGrid(layout, reveal) {
    const lanes = [
      ...layout.ys.map((y) => ['h', y]),
      ...layout.xs.map((x) => ['v', x]),
    ];
    lanes.forEach(([axis, pos], index) => {
      const shown = clamp((reveal - index * 0.04) / 0.5, 0, 1);
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

  /* ── Signals ────────────────────────────────────────────────── */
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
      /* In PATC: hero's row gets green wave, other rows are RED (cross-traffic stops) */
      const heroRow = hero ? closestRow(hero.y, state) : 1;
      const onHeroPath = isOnHeroPath(col, row, state);
      if (onHeroPath) {
        const nearWave = Math.abs(x - waveX(state)) < width * 0.18;
        return nearWave ? C.green : 'rgba(52,211,153,0.3)';
      }
      return C.red;
    }
    if (state.id === 'rush') {
      return (col + row + Math.floor(state.age * 0.7)) % 4 === 0 ? C.green : C.red;
    }
    if (state.id === 'quiet') {
      /* Fewer reds but hero still waits at some */
      if (hero && Math.abs(x - hero.x) < width * 0.10 && Math.abs(y - hero.y) < height * 0.12) return C.red;
      return col % 3 === 0 ? C.red : 'rgba(248,113,113,0.35)';
    }
    return col % 2 === 0 ? C.red : 'rgba(248,113,113,0.42)';
  }

  function isOnHeroPath(col, row, state) {
    /* Hero zigzags: row 0→col 0..1, row 1→col 1..3, row 2→col 3..4 */
    const p = heroZigzagProgress(state);
    if (row === 0 && col <= 1 && p < 0.35) return true;
    if (row === 1 && col >= 1 && col <= 3 && p > 0.15 && p < 0.75) return true;
    if (row === 2 && col >= 3 && p > 0.6) return true;
    return false;
  }

  function closestRow(y, state) {
    const layout = sceneLayout();
    let best = 0;
    let bestDist = Infinity;
    layout.ys.forEach((rowY, i) => {
      const d = Math.abs(y - rowY);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  function drawPatcWave(layout, state) {
    if (!isPatc(state.id)) return;
    const x = waveX(state);
    const wave = ctx.createRadialGradient(x, layout.midY, 0, x, layout.midY, width * 0.28);
    wave.addColorStop(0, 'rgba(52,211,153,0.14)');
    wave.addColorStop(0.45, 'rgba(52,211,153,0.05)');
    wave.addColorStop(1, 'rgba(52,211,153,0)');
    ctx.fillStyle = wave;
    ctx.fillRect(0, 0, width, height);
  }

  /* ── Traffic vehicles ──────────────────────────────────────── */
  function drawTraffic(layout, state, hero) {
    const alpha = trafficAlpha(state);
    if (alpha <= 0) return;
    const used = hero ? [hero] : [];
    TRAFFIC.forEach((vehicle) => {
      const point = trafficPoint(vehicle, layout, state);
      if (isTooClose(point, used, 24)) return;
      used.push(point);
      const color = trafficColor(vehicle, state.id);
      drawVehicle(point.x, point.y, point.angle, vehicle.size, color, alpha, isPatc(state.id));
    });
  }

  function trafficPoint(vehicle, layout, state) {
    const fast = isPatc(state.id);
    const base = (vehicle.offset + state.age * vehicle.speed * (fast ? 3.5 : 1.1)) % 1;
    const progress = fast ? base : queuedProgress(base);
    if (vehicle.axis === 'v') {
      return { x: layout.xs[vehicle.lane % 5], y: lerp(-30, height + 30, progress), angle: Math.PI / 2 };
    }
    return { x: lerp(-34, width + 34, progress), y: layout.ys[vehicle.lane % 3], angle: 0 };
  }

  function trafficColor(vehicle, id) {
    if (isPatc(id)) return vehicle.shade === 0 ? 'rgba(52,211,153,0.65)' : 'rgba(232,236,244,0.50)';
    if (id === 'rush') {
      if (vehicle.shade === 0) return 'rgba(248,113,113,0.68)';
      if (vehicle.shade === 1) return 'rgba(245,158,11,0.65)';
      return 'rgba(232,236,244,0.45)';
    }
    /* quiet — fewer, muted */
    return 'rgba(232,236,244,0.35)';
  }

  /* ── Hero car — zigzag path across grid (top-left start) ──── */
  function getHero(state, layout) {
    if (state.id === 'intro') return null;
    const color = isPatc(state.id) ? C.green : state.id === 'rush' ? C.red : C.amber;
    const label = 'you';
    const p = heroZigzagProgress(state);
    return { ...heroPose(layout, p), color, label };
  }

  function heroZigzagProgress(state) {
    if (state.id === 'rush') {
      /* Slow, stuck in traffic — crawling with stops */
      const raw = 0.02 + state.progress * 0.45;
      const wobble = Math.sin(state.age * 2.0) * 0.004;
      return clamp(raw + wobble, 0, 0.5);
    }
    if (state.id === 'quiet') {
      /* Bit faster, but still stops at some signals */
      const raw = 0.05 + state.progress * 0.60;
      const wobble = Math.sin(state.age * 1.5) * 0.003;
      return clamp(raw + wobble, 0, 0.7);
    }
    /* PATC — fast, smooth traversal */
    return clamp(state.age * 0.11 + 0.02, 0, 0.98);
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

  /* Hero zigzags: top-left → east → down → east → down → east */
  function heroRoute(layout) {
    const points = [
      { x: -20, y: layout.ys[0] },
      { x: layout.xs[1], y: layout.ys[0] },
      { x: layout.xs[1], y: layout.ys[1] },
      { x: layout.xs[3], y: layout.ys[1] },
      { x: layout.xs[3], y: layout.ys[2] },
      { x: width + 20, y: layout.ys[2] },
    ];
    const total = points.slice(1).reduce((sum, point, index) => {
      const prev = points[index];
      return sum + Math.hypot(point.x - prev.x, point.y - prev.y);
    }, 0);
    return { points, total };
  }

  /* ── Drawing helpers ────────────────────────────────────────── */
  function drawHero(hero, state) {
    drawVehicle(hero.x, hero.y, hero.angle, 13, hero.color, 1, true);
    label(hero.label, hero.x, hero.y - 28);
    if (state.id === 'rush') waitBadge(hero.x, hero.y + 31);
  }

  function drawVehicle(x, y, angle, size, color, alpha, glow) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
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
    ctx.fillStyle = id === 'rush' ? C.red : id === 'quiet' ? C.amber : C.green;
    ctx.beginPath();
    ctx.arc(28, 29, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.fillText(text, 40, 33);
  }

  function queuedProgress(progress) {
    for (const stop of [0.25, 0.48, 0.72]) {
      if (progress > stop - 0.06 && progress < stop + 0.02) {
        return stop - 0.04 + (progress - stop + 0.06) * 0.2;
      }
    }
    return progress;
  }

  function isTooClose(point, used, distance) {
    return used.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < distance + 12);
  }

  function trafficAlpha(state) {
    if (state.id === 'intro') return 0;
    if (state.id === 'rush') return clamp(state.progress * 3, 0, 1);
    if (state.id === 'quiet') return clamp(state.progress * 2, 0, 0.5);
    if (isPatc(state.id)) return 0.85;
    return 0;
  }

  function roadReveal(state) {
    if (state.id === 'rush') return ease(clamp(state.progress * 2, 0, 1));
    return 1;
  }

  function waveX(state) {
    return ((state.age * 0.30) % 1) * width;
  }

  function isPatc(id) {
    return id === 'patc';
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

  /* ── Main loop ──────────────────────────────────────────────── */
  function loop(now) {
    if (lastDraw && now - lastDraw < 24) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    lastDraw = now;
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
      showCopy('patc');
      render(performance.now(), { id: 'patc', age: 8, progress: 1 });
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
      if (motionQuery.matches) render(performance.now(), { id: 'patc', age: 8, progress: 1 });
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

  function replayStory() {
    cancelAnimationFrame(rafId);
    sequenceStart = 0;
    manualPhase = '';
    manualStart = 0;
    activePhase = '';
    typedUntil = 0;
    phaseStart = 0;
    lastDraw = 0;
    rafId = requestAnimationFrame(loop);
  }

  const replayBtn = document.getElementById('storyReplayBtn');
  if (replayBtn) replayBtn.addEventListener('click', replayStory);

  window.HomeStory = { setPhase: setManualPhase, replay: replayStory };
  start();
})();
