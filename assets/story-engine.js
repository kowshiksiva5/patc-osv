/* ═══════════════════════════════════════════════════════════════
   PATC — Story Engine · Cinematic grid-road animation
   Shows: empty grid → wait at junctions → traffic → PATC fixes it
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, animId;

  /* ── Colors ──────────────────────────────────────────────────── */
  const C = {
    bg:       '#0A0F1A',
    road:     '#1A2840',
    roadLine: 'rgba(61,191,176,0.08)',
    junction: '#1F2937',
    green:    '#34D399',
    red:      '#F87171',
    amber:    '#F59E0B',
    car:      '#F59E0B',
    carPatc:  '#34D399',
    text:     '#E8ECF4',
    muted:    'rgba(155,164,181,0.6)',
    glow:     'rgba(52,211,153,0.12)',
  };

  /* ── Grid config: 4 columns × 3 rows of intersections ──────── */
  const COLS = 5;
  const ROWS = 3;
  const MARGIN = 60;
  let cellW, cellH;
  const junctions = [];

  /* ── Story phases ───────────────────────────────────────────── */
  const PHASES = ['empty', 'traffic', 'patc'];
  let phase = 'empty';
  let phaseTimer = 0;

  /* ── Vehicles ───────────────────────────────────────────────── */
  const vehicles = [];
  let heroCarId = null;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    cellW = (W - MARGIN * 2) / (COLS - 1);
    cellH = (H - MARGIN * 2) / (ROWS - 1);

    buildJunctions();
  }

  function buildJunctions() {
    junctions.length = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        junctions.push({
          x: MARGIN + c * cellW,
          y: MARGIN + r * cellH,
          col: c, row: r,
          state: 'red',
          timer: Math.random() * 6,
          cycleLen: phase === 'patc' ? 4 : 6,
          greenDur: phase === 'patc' ? 3.2 : 2.5,
        });
      }
    }
  }

  /* Create a vehicle on a route (horizontal or vertical) */
  function spawnVehicle(isHero) {
    const isHoriz = Math.random() > 0.35;
    let route;
    if (isHoriz) {
      const row = Math.floor(Math.random() * ROWS);
      const y = MARGIN + row * cellH;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const startX = dir > 0 ? -20 : W + 20;
      const endX = dir > 0 ? W + 20 : -20;
      route = { startX, startY: y, endX, endY: y, dir, axis: 'h', row, col: null };
    } else {
      const col = Math.floor(Math.random() * COLS);
      const x = MARGIN + col * cellW;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const startY = dir > 0 ? -20 : H + 20;
      const endY = dir > 0 ? H + 20 : -20;
      route = { startX: x, startY, endX: x, endY, dir, axis: 'v', row: null, col };
    }

    const v = {
      id: vehicles.length,
      x: route.startX,
      y: route.startY,
      route,
      speed: 80 + Math.random() * 40,
      baseSpeed: 80 + Math.random() * 40,
      waiting: false,
      waitTime: 0,
      totalWait: 0,
      isHero: isHero || false,
      size: isHero ? 10 : 6 + Math.random() * 3,
    };
    if (isHero) {
      v.route.startX = -20;
      v.route.startY = MARGIN + 1 * cellH;
      v.route.endX = W + 20;
      v.route.endY = MARGIN + 1 * cellH;
      v.route.dir = 1;
      v.route.axis = 'h';
      v.route.row = 1;
      v.x = v.route.startX;
      v.y = v.route.startY;
      v.speed = 100;
      v.baseSpeed = 100;
      heroCarId = v.id;
    }
    vehicles.push(v);
    return v;
  }

  /* Check if vehicle is near a red junction */
  function nearestJunction(v) {
    const checkDist = 28;
    for (const j of junctions) {
      if (v.route.axis === 'h') {
        if (Math.abs(v.y - j.y) < 8) {
          const dx = j.x - v.x;
          if (v.route.dir > 0 && dx > 0 && dx < checkDist) return j;
          if (v.route.dir < 0 && dx < 0 && dx > -checkDist) return j;
        }
      } else {
        if (Math.abs(v.x - j.x) < 8) {
          const dy = j.y - v.y;
          if (v.route.dir > 0 && dy > 0 && dy < checkDist) return j;
          if (v.route.dir < 0 && dy < 0 && dy > -checkDist) return j;
        }
      }
    }
    return null;
  }

  function isGreen(junction, vehicle) {
    if (phase === 'patc') {
      // PATC: smart coordination — green wave for horizontal, responsive for vertical
      if (vehicle.route.axis === 'h') return true; // Green wave
      return junction.state === 'green';
    }
    // Fixed timing
    return junction.state === 'green' && (
      (vehicle.route.axis === 'h' && junction.timer < junction.greenDur) ||
      (vehicle.route.axis === 'v' && junction.timer >= junction.greenDur)
    );
  }

  /* ── Phase management ───────────────────────────────────────── */
  function setPhase(p) {
    phase = p;
    phaseTimer = 0;
    vehicles.length = 0;
    heroCarId = null;

    junctions.forEach(j => {
      j.cycleLen = phase === 'patc' ? 4 : 6;
      j.greenDur = phase === 'patc' ? 3.2 : 2.5;
      j.timer = Math.random() * j.cycleLen;
    });

    // Always spawn hero car
    spawnVehicle(true);

    // Spawn traffic based on phase
    const count = phase === 'empty' ? 2 : phase === 'traffic' ? 18 : 12;
    for (let i = 0; i < count; i++) spawnVehicle(false);
  }

  /* ── Update ─────────────────────────────────────────────────── */
  function update(dt) {
    phaseTimer += dt;

    // Update junction signals
    junctions.forEach(j => {
      j.timer = (j.timer + dt) % j.cycleLen;
      j.state = j.timer < j.greenDur ? 'green' : 'red';
    });

    // Update vehicles
    vehicles.forEach(v => {
      const nj = nearestJunction(v);
      if (nj && !isGreen(nj, v)) {
        v.waiting = true;
        v.waitTime += dt;
        v.totalWait += dt;
        v.speed = 0;
      } else {
        v.waiting = false;
        v.waitTime = 0;
        v.speed = v.baseSpeed;
      }

      if (v.route.axis === 'h') {
        v.x += v.speed * v.route.dir * dt;
      } else {
        v.y += v.speed * v.route.dir * dt;
      }

      // Respawn if off-screen
      if (v.x > W + 40 || v.x < -40 || v.y > H + 40 || v.y < -40) {
        if (v.isHero) {
          v.x = v.route.startX;
          v.y = v.route.startY;
          v.totalWait = 0;
        } else {
          v.x = v.route.startX;
          v.y = v.route.startY;
          v.totalWait = 0;
        }
      }
    });

    // Auto-advance phases
    if (phaseTimer > 12 && phase === 'empty') setPhase('traffic');
    if (phaseTimer > 14 && phase === 'traffic') setPhase('patc');
    if (phaseTimer > 14 && phase === 'patc') setPhase('empty');
  }

  /* ── Render ─────────────────────────────────────────────────── */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Roads — horizontal
    for (let r = 0; r < ROWS; r++) {
      const y = MARGIN + r * cellH;
      ctx.fillStyle = C.road;
      ctx.fillRect(0, y - 12, W, 24);
      // Center line
      ctx.setLineDash([10, 16]);
      ctx.strokeStyle = C.roadLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Roads — vertical
    for (let c = 0; c < COLS; c++) {
      const x = MARGIN + c * cellW;
      ctx.fillStyle = C.road;
      ctx.fillRect(x - 12, 0, 24, H);
      ctx.setLineDash([10, 16]);
      ctx.strokeStyle = C.roadLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Junctions — traffic lights
    junctions.forEach(j => {
      // Junction box
      ctx.fillStyle = C.junction;
      ctx.fillRect(j.x - 14, j.y - 14, 28, 28);

      // Signal dot
      const color = j.state === 'green' ? C.green : C.red;
      ctx.beginPath();
      ctx.arc(j.x, j.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow
      if (j.state === 'green') {
        ctx.beginPath();
        ctx.arc(j.x, j.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = C.glow;
        ctx.fill();
      }
    });

    // Vehicles
    vehicles.forEach(v => {
      ctx.save();
      ctx.translate(v.x, v.y);

      if (v.route.axis === 'v') {
        ctx.rotate(Math.PI / 2);
      }

      if (v.isHero) {
        // Hero car — larger, highlighted
        ctx.fillStyle = phase === 'patc' ? C.carPatc : C.car;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(-v.size, -v.size * 0.5, v.size * 2, v.size, 3);
        ctx.fill();

        // Windshield
        ctx.fillStyle = 'rgba(10,15,26,0.5)';
        ctx.fillRect(v.size * 0.4, -v.size * 0.35, v.size * 0.5, v.size * 0.7);
      } else {
        // Other cars
        const isWaiting = v.waiting;
        ctx.fillStyle = isWaiting ? C.amber : (phase === 'patc' ? 'rgba(52,211,153,0.7)' : 'rgba(232,236,244,0.45)');
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(-v.size * 0.8, -v.size * 0.35, v.size * 1.6, v.size * 0.7, 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // PATC green wave overlay
    if (phase === 'patc') {
      const waveX = (phaseTimer * 0.08 % 1) * W;
      const grad = ctx.createRadialGradient(waveX, H / 2, 0, waveX, H / 2, 180);
      grad.addColorStop(0, 'rgba(52,211,153,0.06)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Phase indicator — top right
    const label = phase === 'empty' ? 'Empty road' : phase === 'traffic' ? 'Rush hour' : 'PATC Active';
    const labelColor = phase === 'empty' ? C.muted : phase === 'traffic' ? C.red : C.green;

    ctx.fillStyle = 'rgba(10,15,26,0.85)';
    ctx.fillRect(W - 160, 12, 148, 32);
    ctx.fillStyle = labelColor;
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, W - 24, 34);

    // Phase dot
    ctx.beginPath();
    ctx.arc(W - 148, 28, 4, 0, Math.PI * 2);
    ctx.fillStyle = labelColor;
    ctx.fill();

    ctx.textAlign = 'start';

    // Hero car wait time display
    const hero = vehicles.find(v => v.isHero);
    if (hero && hero.waiting) {
      ctx.fillStyle = 'rgba(10,15,26,0.8)';
      ctx.fillRect(hero.x - 30, hero.y - 30, 60, 18);
      ctx.fillStyle = C.red;
      ctx.font = '700 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hero.waitTime.toFixed(1)}s`, hero.x, hero.y - 17);
      ctx.textAlign = 'start';
    }
  }

  /* ── Animation loop ─────────────────────────────────────────── */
  let lastTs = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  /* ── Scroll-driven phase control ────────────────────────────── */
  function initScrollPhases() {
    const sections = document.querySelectorAll('[data-story-phase]');
    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const newPhase = entry.target.dataset.storyPhase;
          if (newPhase && newPhase !== phase) {
            setPhase(newPhase);
          }
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(s => observer.observe(s));
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    resize();
    setPhase('empty');
    lastTs = performance.now();
    animId = requestAnimationFrame(loop);
    initScrollPhases();
  }

  init();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
    }, 200);
  });

  // Expose for external phase control
  window.StoryEngine = { setPhase };
})();
