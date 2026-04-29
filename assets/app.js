const canvas = document.getElementById("trafficCanvas");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let tick = 0;
let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const vehicles = Array.from({ length: 130 }, (_, index) => ({
  color: ["#00e5ff", "#ff9000", "#00ff88", "#ffc107"][index % 4],
  lane: index % 3,
  offset: Math.random(),
  speed: 0.0011 + Math.random() * 0.0025,
}));

function scrollToHashTarget(hash) {
  if (!hash || hash === "#top") return;
  const target = document.querySelector(hash);
  if (!target) return;
  const header = document.querySelector(".site-header");
  const offset = (header?.offsetHeight || 68) + 18;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function routes() {
  return [
    [
      { x: width * 0.05, y: height * 0.72 },
      { x: width * 0.28, y: height * 0.56 },
      { x: width * 0.55, y: height * 0.5 },
      { x: width * 0.86, y: height * 0.28 },
    ],
    [
      { x: width * 0.12, y: height * 0.16 },
      { x: width * 0.38, y: height * 0.34 },
      { x: width * 0.66, y: height * 0.46 },
      { x: width * 0.96, y: height * 0.66 },
    ],
    [
      { x: width * 0.26, y: height * 0.88 },
      { x: width * 0.45, y: height * 0.58 },
      { x: width * 0.62, y: height * 0.3 },
      { x: width * 0.82, y: height * 0.08 },
    ],
  ];
}

function pointAt(points, progress) {
  const segmentCount = points.length - 1;
  const scaled = progress * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const local = scaled - index;
  const from = points[index];
  const to = points[index + 1];
  return {
    angle: Math.atan2(to.y - from.y, to.x - from.x),
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function drawRoute(points, lineWidth, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function drawHeroDistricts() {
  const cols = 6;
  const rows = 4;
  const cellW = width / cols;
  const cellH = height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const seed = row * cols + col;
      if ((seed + row) % 5 === 0) continue;
      const x = col * cellW + 24 + (seed % 3) * 8;
      const y = row * cellH + 38 + (seed % 4) * 9;
      const w = cellW * (0.48 + ((seed % 4) * 0.05));
      const h = cellH * (0.28 + ((seed % 3) * 0.05));
      const lit = (Math.floor(tick / 80) + seed) % 7 === 0;

      ctx.fillStyle = lit ? "rgba(0,229,255,0.055)" : "rgba(11,24,48,0.22)";
      ctx.strokeStyle = lit ? "rgba(0,229,255,0.16)" : "rgba(222,238,255,0.035)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(222,238,255,0.028)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + (w * i) / 3, y + 8);
        ctx.lineTo(x + (w * i) / 3, y + h - 8);
        ctx.stroke();
      }
    }
  }
}

function drawBackground(routeSet) {
  ctx.fillStyle = "#050d1a";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(222,238,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = -120; x < width + 140; x += 82) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.36, height);
    ctx.stroke();
  }
  drawHeroDistricts();
  routeSet.forEach((route) => drawRoute(route, 78, "rgba(222,238,255,0.075)"));
  routeSet.forEach((route) => drawRoute(route, 42, "rgba(11,24,48,0.88)"));
  routeSet.forEach((route, index) => {
    const color = index === 1 ? "rgba(255,144,0,0.24)" : "rgba(0,229,255,0.32)";
    drawRoute(route, 3, color);
  });
}

function drawPressure(routeSet) {
  const pulse = Math.sin(tick * 0.032) * 0.5 + 0.5;
  drawRoute(routeSet[0].slice(1), 18 + pulse * 18, `rgba(255,48,64,${0.1 + pulse * 0.16})`);
  drawRoute(routeSet[1].slice(0, 3), 10, `rgba(255,193,7,${0.16 + pulse * 0.14})`);
  ctx.fillStyle = `rgba(0,229,255,${0.05 + pulse * 0.06})`;
  ctx.beginPath();
  ctx.ellipse(width * 0.66, height * 0.42, 220 + pulse * 100, 90 + pulse * 38, 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(0,229,255,${0.12 + pulse * 0.16})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 14]);
  ctx.lineDashOffset = -tick * 0.8;
  ctx.beginPath();
  ctx.ellipse(width * 0.62, height * 0.43, 260 + pulse * 50, 116 + pulse * 18, 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVehicles(routeSet) {
  vehicles.forEach((vehicle) => {
    const point = pointAt(routeSet[vehicle.lane], (vehicle.offset + tick * vehicle.speed) % 1);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(-9, -4, 18, 8);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawSignals(routeSet) {
  const signals = routeSet.flatMap((route) => route.slice(1, 3));
  signals.forEach((point, index) => {
    const active = index === Math.floor(tick / 95) % signals.length;
    const color = active ? "#ffc107" : index % 2 ? "#00ff88" : "#ff3040";
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 26 : 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawHero() {
  if (document.hidden) return;
  tick += 1;
  const routeSet = routes();
  drawBackground(routeSet);
  drawPressure(routeSet);
  drawVehicles(routeSet);
  drawSignals(routeSet);
  if (!reduceMotion) requestAnimationFrame(drawHero);
}

window.addEventListener("resize", resizeCanvas);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !reduceMotion) requestAnimationFrame(drawHero);
});
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  reduceMotion = event.matches;
  if (!reduceMotion && !document.hidden) requestAnimationFrame(drawHero);
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    event.preventDefault();
    history.pushState(null, "", hash);
    scrollToHashTarget(hash);
  });
});

window.addEventListener("load", () => {
  if (window.location.hash) {
    setTimeout(() => scrollToHashTarget(window.location.hash), 80);
  }
});

resizeCanvas();
drawHero();
