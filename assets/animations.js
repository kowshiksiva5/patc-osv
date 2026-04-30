/* ═══════════════════════════════════════════════════════════════
   PATC — Site-wide animations & interactions
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Scroll-reveal observer ────────────────────────────────── */
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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* ── Header scroll state ───────────────────────────────────── */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('scrolled', window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ── Active nav link highlight ─────────────────────────────── */
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

      if (isCurrent) {
        link.classList.add('active');
      }
    });
  }

  /* ── Particle canvas for hero ──────────────────────────────── */
  function initParticleCanvas() {
    const canvas = document.getElementById('heroParticles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    const particles = [];
    const PARTICLE_COUNT = 60;
    const CONNECTION_DIST = 150;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = canvas.width = rect.width;
      height = canvas.height = rect.height;
    }

    function createParticle() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      };
    }

    function init() {
      resize();
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle());
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(47, 214, 210, ${p.opacity})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            const lineOpacity = (1 - dist / CONNECTION_DIST) * 0.12;
            ctx.strokeStyle = `rgba(47, 214, 210, ${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    init();
    draw();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(init, 200);
    });
  }

  /* ── Animated stat counters ────────────────────────────────── */
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
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  function animateCounter(el) {
    const target = el.getAttribute('data-count');
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const numericTarget = parseFloat(target.replace(/[^0-9.]/g, ''));
    const duration = 1800;
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

  /* ── Card tilt on mouse move (subtle) ──────────────────────── */
  function initCardTilt() {
    const cards = document.querySelectorAll(
      '.impact-grid article, .process-grid article, .page-links a'
    );

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-4px) perspective(600px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ── Smooth page transitions ───────────────────────────────── */
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
        }, 280);
      });
    });
  }

  /* ── Init everything on DOM ready ──────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-enter');
    requestAnimationFrame(() => {
      document.body.classList.remove('page-enter');
    });

    initScrollReveal();
    initHeaderScroll();
    initActiveNav();
    initParticleCanvas();
    initCounters();
    initCardTilt();
    initPageTransitions();
  });
})();
