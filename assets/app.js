const canvas = document.getElementById("trafficCanvas");
const confidenceValue = document.getElementById("confidenceValue");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let tick = 0;
let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const vehicles = Array.from({ length: 120 }, (_, index) => ({
  offset: Math.random(),
  speed: 0.0012 + Math.random() * 0.0028,
  color: ["#00e5ff", "#ff9000", "#00ff88", "#ffc107"][index % 4],
}));

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function routePoints() {
  const x0 = width < 720 ? width * 0.2 : width * 0.48;
  return [
    { x: x0, y: height * 0.2 },
    { x: width * 0.6, y: height * 0.36 },
    { x: width * 0.76, y: height * 0.54 },
    { x: width * 0.9, y: height * 0.72 },
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

function drawLine(points, lineWidth, color) {
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

function drawBackground(points) {
  ctx.fillStyle = "#050d1a";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(222,238,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = -100; x < width + 100; x += 82) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.34, height);
    ctx.stroke();
  }
  drawLine(points, 78, "rgba(222,238,255,0.08)");
  drawLine(points, 42, "rgba(11,24,48,0.96)");
  drawLine(points, 3, "rgba(0,229,255,0.55)");
}

function drawSignals(points) {
  const active = Math.floor(tick / 120) % points.length;
  points.forEach((point, index) => {
    const color = index === active ? "#ffc107" : index === points.length - 1 ? "#ff3040" : "#00ff88";
    ctx.shadowColor = color;
    ctx.shadowBlur = index === active ? 28 : 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(222,238,255,0.34)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawVehicles(points) {
  vehicles.forEach((vehicle) => {
    const progress = (vehicle.offset + tick * vehicle.speed) % 1;
    const point = pointAt(points, progress);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    ctx.globalAlpha = 0.84;
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(-10, -4, 20, 8);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawOverlay(points) {
  const pulse = Math.sin(tick * 0.035) * 0.5 + 0.5;
  drawLine(points.slice(1), 18 + pulse * 16, `rgba(255,48,64,${0.1 + pulse * 0.18})`);
  drawLine(points.slice(0, 3), 8, `rgba(0,229,255,${0.18 + pulse * 0.18})`);
  ctx.fillStyle = `rgba(255,193,7,${0.08 + pulse * 0.08})`;
  ctx.beginPath();
  ctx.ellipse(points[2].x, points[2].y, 180 + pulse * 110, 76 + pulse * 42, 0.74, 0, Math.PI * 2);
  ctx.fill();
}

function updateConfidence() {
  const value = 82 + Math.round((Math.sin(tick * 0.018) * 0.5 + 0.5) * 8);
  confidenceValue.textContent = `${value}%`;
}

function draw() {
  if (document.hidden) return;
  tick += 1;
  const points = routePoints();
  drawBackground(points);
  drawOverlay(points);
  drawVehicles(points);
  drawSignals(points);
  updateConfidence();
  if (!reduceMotion) requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !reduceMotion) requestAnimationFrame(draw);
});
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  reduceMotion = event.matches;
  if (!reduceMotion && !document.hidden) requestAnimationFrame(draw);
});
resize();
draw();
