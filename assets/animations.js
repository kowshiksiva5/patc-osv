/* ═══════════════════════════════════════════════════════════════
   PATC — Site animations v4 · Bullet-proof reveal + corridor wave
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Scroll-reveal ─────────────────────────────────────────── */
  function initScrollReveal() {
    const targets = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-scale'
    );
    if (!targets.length) return;

    /* Use a generous rootMargin so elements trigger well before
       they're fully scrolled into view. threshold: 0 means "any
       pixel visible" — eliminates the bug where 8% threshold +
       negative rootMargin prevented elements from ever firing. */
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -20px 0px' }
    );

    targets.forEach((el) => observer.observe(el));

    /* Safety net: after 1.5s, force-reveal anything still hidden.
       Catches edge cases where IntersectionObserver fails (e.g.
       elements in overflow:hidden parents, or Safari timing). */
    setTimeout(() => {
      targets.forEach((el) => {
        if (!el.classList.contains('visible')) {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight + 100) {
            el.classList.add('visible');
          }
        }
      });
    }, 1500);

    /* Fallback scroll listener for any stragglers */
    let fallbackDone = false;
    function fallbackCheck() {
      if (fallbackDone) return;
      let allDone = true;
      targets.forEach((el) => {
        if (!el.classList.contains('visible')) {
          allDone = false;
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight + 60) {
            el.classList.add('visible');
          }
        }
      });
      if (allDone) {
        fallbackDone = true;
        window.removeEventListener('scroll', fallbackCheck);
      }
    }
    window.addEventListener('scroll', fallbackCheck, { passive: true });
  }

  /* ── Scroll progress bar ────────────────────────────────────── */
  function initScrollProgress() {
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          const ratio = h > 0 ? window.scrollY / h : 0;
          bar.style.transform = `scaleX(${ratio})`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Header scroll state ────────────────────────────────────── */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('scrolled', window.scrollY > 36);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Active nav link highlight ──────────────────────────────── */
  function initActiveNav() {
    const navLinks = document.querySelectorAll('nav a');
    const currentPath = window.location.pathname;

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      const linkPath = new URL(href, window.location.origin).pathname;
      const isHome = linkPath.endsWith('/') || linkPath.endsWith('/index.html');
      const isCurrent =
        currentPath === linkPath ||
        (isHome && (currentPath.endsWith('/') || currentPath.endsWith('/index.html')));

      if (isCurrent) link.classList.add('active');
    });
  }

  /* ── Corridor wave hero animation ───────────────────────────── */
  function initCorridorHero() {
    const canvas = document.getElementById('corridorHero');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W, H, animId;

    /* 5 junction nodes spread wide across the canvas */
    const NODES = [
      { x: 0.08, y: 0.45, scale: 1.0 },
      { x: 0.28, y: 0.35, scale: 1.4 },
      { x: 0.50, y: 0.52, scale: 1.0 },
      { x: 0.72, y: 0.40, scale: 1.1 },
      { x: 0.92, y: 0.50, scale: 1.0 },
    ];

    const LINKS = [
      [0, 1], [1, 2], [2, 3], [3, 4], [1, 3],
    ];

    const vehicles = [];
    const VEHICLE_COUNT = 16;

    function createVehicle() {
      const linkIdx = Math.floor(Math.random() * LINKS.length);
      return {
        link: linkIdx,
        t: Math.random(),
        speed: (0.002 + Math.random() * 0.005) * (Math.random() > 0.3 ? 1 : -1),
        size: 2,
        isPatc: Math.random() > 0.3,
      };
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function init() {
      resize();
      vehicles.length = 0;
      for (let i = 0; i < VEHICLE_COUNT; i++) vehicles.push(createVehicle());
    }

    let wavePhase = 0;

    /* Junction state based on wave proximity */
    function junctionState(nx) {
      const wavePosX = (wavePhase % 1) * W;
      const dist = Math.abs(nx - wavePosX);
      if (dist < 60) return { color: '#34D399', label: 'flowing' };
      if (dist < 140) return { color: '#F59E0B', label: 'holding' };
      return { color: 'rgba(79, 209, 197, 0.25)', label: 'idle' };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      wavePhase = (wavePhase + 0.003) % 2;

      /* Faint grid */
      ctx.strokeStyle = 'rgba(79, 209, 197, 0.03)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 80) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Green wave pulse */
      const wavePosX = (wavePhase % 1) * W;
      const grad = ctx.createRadialGradient(wavePosX, H * 0.45, 0, wavePosX, H * 0.45, 140);
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.10)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      /* Draw links (roads) — main corridor spine */
      LINKS.forEach(([a, b]) => {
        const na = NODES[a], nb = NODES[b];
        ctx.beginPath();
        ctx.moveTo(na.x * W, na.y * H);
        ctx.lineTo(nb.x * W, nb.y * H);
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.10)';
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.stroke();

        /* Lane center dash */
        ctx.setLineDash([6, 14]);
        ctx.strokeStyle = 'rgba(232, 236, 244, 0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      });

      /* Draw minor approach arms per junction */
      NODES.forEach((node) => {
        const nx = node.x * W;
        const ny = node.y * H;
        const armLen = 40 * (node.scale || 1);

        ctx.strokeStyle = 'rgba(79, 209, 197, 0.06)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';

        /* Vertical minor arm */
        ctx.beginPath();
        ctx.moveTo(nx, ny - armLen);
        ctx.lineTo(nx, ny + armLen);
        ctx.stroke();
      });

      /* Draw nodes with 3-state semantic colors */
      NODES.forEach((node, i) => {
        const nx = node.x * W;
        const ny = node.y * H;
        const scale = node.scale || 1;
        const state = junctionState(nx);
        const outerR = 14 * scale;
        const innerR = 4 * scale;

        /* Outer ring */
        ctx.beginPath();
        ctx.arc(nx, ny, outerR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 15, 26, 0.92)';
        ctx.fill();
        ctx.strokeStyle = state.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        /* Inner dot */
        ctx.beginPath();
        ctx.arc(nx, ny, innerR, 0, Math.PI * 2);
        ctx.fillStyle = state.color;
        ctx.fill();

        /* Label — under junction, monospace, muted */
        ctx.fillStyle = 'rgba(92, 102, 120, 0.8)';
        ctx.font = '500 11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`J${i + 1}`, nx, ny + outerR + 16);
        ctx.textAlign = 'start';
      });

      /* Draw + update vehicles — neutral white/grey dots */
      vehicles.forEach((v) => {
        const link = LINKS[v.link];
        const na = NODES[link[0]], nb = NODES[link[1]];

        v.t += v.speed;
        if (v.t > 1 || v.t < 0) {
          v.speed *= -1;
          v.t = Math.max(0, Math.min(1, v.t));
        }

        const vx = na.x * W + (nb.x - na.x) * W * v.t;
        const vy = na.y * H + (nb.y - na.y) * H * v.t;

        ctx.beginPath();
        ctx.arc(vx, vy, v.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232, 236, 244, 0.5)';
        ctx.fill();

        /* Faint trail */
        ctx.beginPath();
        ctx.arc(vx, vy, v.size + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232, 236, 244, 0.06)';
        ctx.fill();
      });

      /* Corner legend chip */
      const legendY = H - 24;
      const legendItems = [
        { color: '#34D399', label: 'flowing' },
        { color: '#F59E0B', label: 'holding' },
      ];
      ctx.font = '500 10px Inter, sans-serif';
      let lx = 14;
      legendItems.forEach(({ color, label }) => {
        ctx.beginPath();
        ctx.arc(lx, legendY, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = 'rgba(92, 102, 120, 0.7)';
        ctx.fillText(label, lx + 8, legendY + 3.5);
        lx += ctx.measureText(label).width + 24;
      });

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { cancelAnimationFrame(animId); }
    mq.addEventListener('change', (e) => {
      if (e.matches) cancelAnimationFrame(animId);
      else { animId = requestAnimationFrame(draw); }
    });
  }

  /* ── Animated stat counters ─────────────────────────────────── */
  function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  function animateCounter(el) {
    const target = el.getAttribute('data-count');
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const numericTarget = parseFloat(target.replace(/[^0-9.]/g, ''));
    const duration = 1600;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * numericTarget);
      el.textContent = prefix + current + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = prefix + target + suffix;
      }
    }

    requestAnimationFrame(update);
  }

  /* ── Card tilt on mouse move ────────────────────────────────── */
  function initCardTilt() {
    const cards = document.querySelectorAll(
      '.impact-grid article, .process-grid article, .page-links a'
    );

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-2px) perspective(600px) rotateX(${-y * 2}deg) rotateY(${x * 2}deg)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ── Smooth page transitions ────────────────────────────────── */
  function initPageTransitions() {
    const links = document.querySelectorAll('a[href]');
    const isInternal = (url) => {
      try {
        return new URL(url, window.location.origin).origin === window.location.origin;
      } catch { return false; }
    };

    links.forEach((link) => {
      if (
        !isInternal(link.href) ||
        link.target === '_blank' ||
        link.href.includes('#')
      ) return;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.add('page-exit');
        setTimeout(() => {
          window.location.href = link.href;
        }, 220);
      });
    });
  }

  /* ── Init ────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-enter');
    requestAnimationFrame(() => {
      document.body.classList.remove('page-enter');
    });

    initScrollReveal();
    initScrollProgress();
    initHeaderScroll();
    initActiveNav();
    initCorridorHero();
    initCounters();
    initCardTilt();
    initPageTransitions();
  });
})();
