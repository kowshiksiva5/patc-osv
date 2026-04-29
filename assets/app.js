const canvas = document.getElementById("trafficCanvas");
const confidenceValue = document.getElementById("confidenceValue");
const heroMode = document.getElementById("heroMode");
const heroRisk = document.getElementById("heroRisk");
const observedState = document.getElementById("observedState");
const recommendationText = document.getElementById("recommendationText");
const queueMetric = document.getElementById("queueMetric");
const delayMetric = document.getElementById("delayMetric");
const phaseMetric = document.getElementById("phaseMetric");
const confidenceMetric = document.getElementById("confidenceMetric");
const rainSlider = document.getElementById("rainSlider");
const surgeSlider = document.getElementById("surgeSlider");
const boardWave = document.querySelector(".board-wave");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let tick = 0;

const state = {
  mode: "patc",
  scenario: "normal",
  rain: 22,
  surge: 35,
};

const vehicles = Array.from({ length: 96 }, (_, index) => ({
  lane: index % 4,
  offset: Math.random(),
  speed: 0.0013 + Math.random() * 0.003,
  color: ["#ffd24a", "#28d17c", "#ff5d52", "#36d2e2"][index % 4],
}));

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function pressure() {
  const scenarioBoost = { normal: 0, rain: 18, surge: 24, blocked: 34 }[state.scenario];
  const modeRelief = { fixed: -4, actuated: 4, patc: 16 }[state.mode];
  return Math.max(8, Math.min(96, 28 + state.rain * 0.22 + state.surge * 0.34 + scenarioBoost - modeRelief));
}

function confidence() {
  const base = state.mode === "patc" ? 88 : state.mode === "actuated" ? 73 : 61;
  const uncertainty = state.rain * 0.08 + (state.scenario === "blocked" ? 8 : 0);
  return Math.max(52, Math.round(base - uncertainty + Math.sin(tick * 0.02) * 3));
}

function sectorPoints() {
  const startX = width < 700 ? width * 0.18 : width * 0.48;
  return [
    { x: startX, y: height * 0.24 },
    { x: width * 0.62, y: height * 0.39 },
    { x: width * 0.76, y: height * 0.55 },
    { x: width * 0.9, y: height * 0.71 },
  ];
}

function interpolate(points, progress) {
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

function drawPath(points, widthPx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
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
  ctx.fillStyle = "#05080d";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(238,246,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = -80; x < width + 80; x += 84) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.32, height);
    ctx.stroke();
  }
  drawPath(points, 76, "rgba(238,246,255,0.08)");
  drawPath(points, 42, "rgba(22,33,45,0.94)");
  drawPath(points, 2, "rgba(255,210,74,0.42)");
}

function drawFeeders(points) {
  points.forEach((point, index) => {
    const radians = (Math.PI / 180) * (index % 2 === 0 ? 90 : -90);
    ctx.strokeStyle = "rgba(238,246,255,0.08)";
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(point.x - Math.cos(radians) * 120, point.y - Math.sin(radians) * 120);
    ctx.lineTo(point.x + Math.cos(radians) * 120, point.y + Math.sin(radians) * 120);
    ctx.stroke();
  });
}

function drawRisk(points) {
  const p = pressure() / 100;
  drawPath(points.slice(1), 14 + p * 20, `rgba(255,93,82,${0.08 + p * 0.24})`);
  drawPath(points.slice(0, 3), 8, `rgba(54,210,226,${0.14 + (1 - p) * 0.24})`);
  ctx.fillStyle = `rgba(255,210,74,${0.06 + p * 0.14})`;
  ctx.beginPath();
  ctx.ellipse(points[2].x, points[2].y, 160 + p * 150, 74 + p * 56, 0.74, 0, Math.PI * 2);
  ctx.fill();
}

function drawSignals(points) {
  const active = Math.floor(tick / 110) % points.length;
  points.forEach((point, index) => {
    ctx.fillStyle = index === active ? "#ffd24a" : index === points.length - 1 && pressure() > 65 ? "#ff5d52" : "#28d17c";
    ctx.shadowBlur = index === active ? 28 : 16;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(238,246,255,0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 28, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawVehicles(points) {
  const slowdown = 1 - pressure() / 170;
  vehicles.forEach((vehicle) => {
    const progress = (vehicle.offset + tick * vehicle.speed * slowdown) % 1;
    const point = interpolate(points, progress);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(-11, -5, 22, 10);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawLabels(points) {
  if (width < 700) return;
  ctx.font = "700 12px Arial";
  ctx.fillStyle = "rgba(248,251,255,0.72)";
  points.forEach((point, index) => ctx.fillText(`S${index + 1}`, point.x + 20, point.y - 18));
}

function updateMetrics() {
  const p = Math.round(pressure());
  const c = confidence();
  const risk = p > 72 ? "High" : p > 44 ? "Medium" : "Low";
  const action = state.mode === "patc" ? (p > 70 ? "S3 +22s" : "S2 +18s") : state.mode === "actuated" ? "Extend active" : "No change";
  const observed = state.scenario === "blocked" ? "Downstream discharge blocked" : state.scenario === "rain" ? "Rain slowing discharge" : "Queue forming near S2";
  const rec = state.mode === "patc" ? "Coordinate upstream hold and downstream clearance" : state.mode === "actuated" ? "Extend detected green locally" : "Maintain fixed cycle";
  queueMetric.textContent = `${p}`;
  delayMetric.textContent = risk;
  phaseMetric.textContent = action;
  confidenceMetric.textContent = `${c}%`;
  confidenceValue.textContent = `${c}%`;
  heroMode.textContent = state.mode.toUpperCase();
  heroRisk.textContent = risk;
  observedState.textContent = observed;
  recommendationText.textContent = rec;
  boardWave.style.setProperty("--wave-width", `${Math.max(20, Math.min(82, p))}%`);
}

function draw() {
  tick += 1;
  const points = sectorPoints();
  ctx.clearRect(0, 0, width, height);
  drawBackground(points);
  drawFeeders(points);
  drawRisk(points);
  drawVehicles(points);
  drawSignals(points);
  drawLabels(points);
  updateMetrics();
  requestAnimationFrame(draw);
}

function bindControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
    });
  });
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scenario = button.dataset.scenario;
      document.querySelectorAll("[data-scenario]").forEach((item) => item.classList.toggle("active", item === button));
    });
  });
  rainSlider.addEventListener("input", () => { state.rain = Number(rainSlider.value); });
  surgeSlider.addEventListener("input", () => { state.surge = Number(surgeSlider.value); });
}

window.addEventListener("resize", resize);
bindControls();
resize();
draw();
