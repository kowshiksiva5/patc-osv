/* ═══════════════════════════════════════════════════════════════
   PATC — Site animations v3 · Corridor wave + scroll reveal fix
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Scroll-reveal (FIX: fire immediately for above-fold) ──── */
  function initScrollReveal() {
    const targets = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-scale'
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    /* Observe all targets — IntersectionObserver fires on first
       observe() if the element is already in the viewport, so
       above-fold elements get .visible on first paint. */
    targets.forEach((el) => observer.observe(el));
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
    });
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
    });
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

    /* Nodes: 5 junction nodes in a corridor layout */
    const NODES = [
      { x: 0.12, y: 0.48 },
      { x: 0.30, y: 0.38 },
      { x: 0.50, y: 0.50 },
      { x: 0.70, y: 0.42 },
      { x: 0.88, y: 0.52 },
    ];

    /* Links between nodes */
    const LINKS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [1, 3],
    ];

    /* Vehicle dots that travel along links */
    const vehicles = [];
    const VEHICLE_COUNT = 14;

    function createVehicle() {
      const linkIdx = Math.floor(Math.random() * LINKS.length);
      return {
        link: linkIdx,
        t: Math.random(),
        speed: (0.003 + Math.random() * 0.006) * (Math.random() > 0.3 ? 1 : -1),
        size: Math.random() > 0.6 ? 3 : 2,
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

    /* Green wave: a pulse that travels left→right over ~7s */
    let wavePhase = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      wavePhase = (wavePhase + 0.004) % 2;

      /* Faint grid */
      ctx.strokeStyle = 'rgba(79, 209, 197, 0.04)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Draw links (roads) */
      LINKS.forEach(([a, b]) => {
        const na = NODES[a], nb = NODES[b];
        ctx.beginPath();
        ctx.moveTo(na.x * W, na.y * H);
        ctx.lineTo(nb.x * W, nb.y * H);
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.12)';
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.stroke();

        /* Lane dashes */
        ctx.setLineDash([8, 12]);
        ctx.strokeStyle = 'rgba(232, 236, 244, 0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      });

      /* Draw green wave pulse traveling along the corridor */
      const wavePosX = (wavePhase % 1) * W;
      const grad = ctx.createRadialGradient(wavePosX, H * 0.45, 0, wavePosX, H * 0.45, 120);
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.12)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      /* Draw nodes */
      NODES.forEach((node, i) => {
        const nx = node.x * W;
        const ny = node.y * H;

        /* Node glow based on wave proximity */
        const dist = Math.abs(nx - wavePosX);
        const glow = Math.max(0, 1 - dist / 100);

        /* Outer ring */
        ctx.beginPath();
        ctx.arc(nx, ny, 16 + glow * 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
        ctx.fill();
        ctx.strokeStyle = glow > 0.3
          ? `rgba(52, 211, 153, ${0.4 + glow * 0.4})`
          : 'rgba(79, 209, 197, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        /* Inner dot */
        ctx.beginPath();
        ctx.arc(nx, ny, 5 + glow * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow > 0.3 ? `rgba(52, 211, 153, ${0.7 + glow * 0.3})` : 'rgba(79, 209, 197, 0.5)';
        ctx.fill();

        /* Label */
        ctx.fillStyle = 'rgba(232, 236, 244, 0.6)';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillText(`J${i + 1}`, nx + 20, ny - 8);
      });

      /* Draw + update vehicles */
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
        ctx.fillStyle = v.isPatc ? 'rgba(79, 209, 197, 0.7)' : 'rgba(245, 158, 11, 0.6)';
        ctx.fill();

        /* Faint trail */
        ctx.beginPath();
        ctx.arc(vx, vy, v.size + 3, 0, Math.PI * 2);
        ctx.fillStyle = v.isPatc ? 'rgba(79, 209, 197, 0.08)' : 'rgba(245, 158, 11, 0.06)';
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); }, 200);
    });

    /* Respect prefers-reduced-motion */
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { cancelAnimationFrame(animId); draw(); /* single frame */ }
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
      { threshold: 0.4 }
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
        card.style.transform = `translateY(-3px) perspective(600px) rotateX(${-y * 3}deg) rotateY(${x * 3}deg)`;
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
        }, 250);
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
