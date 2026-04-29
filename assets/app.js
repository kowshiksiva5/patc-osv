const canvas = document.getElementById("trafficCanvas");
const ctx = canvas.getContext("2d");
const confidenceValue = document.getElementById("confidenceValue");
const demandSlider = document.getElementById("demandSlider");
const scenarioButtons = Array.from(document.querySelectorAll(".scenario-button"));

const metrics = {
  density: document.getElementById("densityValue"),
  densityBar: document.getElementById("densityBar"),
  pim: document.getElementById("pimValue"),
  pimBar: document.getElementById("pimBar"),
  queue: document.getElementById("queueValue"),
  queueBar: document.getElementById("queueBar"),
  phase: document.getElementById("phaseValue"),
  recommendation: document.getElementById("recommendationText"),
  mapRecommendation: document.getElementById("mapRecommendationText"),
  densityChip: document.getElementById("densityChip"),
  pimChip: document.getElementById("pimChip"),
  queueChip: document.getElementById("queueChip"),
  log: document.getElementById("decisionLog"),
  junctions: Array.from(document.querySelectorAll("[data-junction]")),
};

const scenarios = {
  surge: {
    kind: "surge",
    phase: "E/W green",
    demandBias: [0.55, 0.78, 0.9, 0.82, 0.62],
    capacityBias: [0.92, 0.86, 0.78, 0.84, 0.9],
    dischargeLoss: 0.18,
    queueFactor: 1.15,
    pimBase: 0.7,
  },
  rain: {
    kind: "rain",
    phase: "Short cycle",
    demandBias: [0.52, 0.68, 0.78, 0.73, 0.58],
    capacityBias: [0.72, 0.68, 0.62, 0.67, 0.7],
    dischargeLoss: 0.34,
    queueFactor: 1.28,
    pimBase: 0.58,
  },
  blockage: {
    kind: "blockage",
    phase: "Meter release",
    demandBias: [0.5, 0.74, 0.9, 0.96, 0.7],
    capacityBias: [0.88, 0.78, 0.62, 0.42, 0.68],
    dischargeLoss: 0.42,
    queueFactor: 1.42,
    pimBase: 0.52,
  },
};

let width = 0;
let height = 0;
let tick = 0;
let activeScenario = "surge";
let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const vehicles = Array.from({ length: 150 }, (_, index) => ({
  offset: Math.random(),
  lane: index % 3,
  speed: 0.001 + Math.random() * 0.0022,
  color: ["#35d4e5", "#ff9b2f", "#29d681", "#ffd34f"][index % 4],
}));

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function buildRoutes() {
  const baseX = width < 720 ? width * 0.14 : width * 0.38;
  return [
    [
      { x: baseX, y: height * 0.2 },
      { x: width * 0.55, y: height * 0.34 },
      { x: width * 0.76, y: height * 0.48 },
      { x: width * 0.95, y: height * 0.66 },
    ],
    [
      { x: width * 0.1, y: height * 0.7 },
      { x: width * 0.35, y: height * 0.56 },
      { x: width * 0.6, y: height * 0.5 },
      { x: width * 0.88, y: height * 0.3 },
    ],
    [
      { x: width * 0.18, y: height * 0.9 },
      { x: width * 0.42, y: height * 0.58 },
      { x: width * 0.64, y: height * 0.32 },
      { x: width * 0.83, y: height * 0.12 },
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

function drawRoute(points, widthValue, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = widthValue;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function drawBackground(routes) {
  ctx.fillStyle = "#04070b";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(237,247,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = -140; x < width + 160; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.36, height);
    ctx.stroke();
  }
  routes.forEach((route) => drawRoute(route, 62, "rgba(237,247,255,0.075)"));
  routes.forEach((route) => drawRoute(route, 3, "rgba(53,212,229,0.25)"));
}

function drawPressure(routes) {
  const pulse = Math.sin(tick * 0.032) * 0.5 + 0.5;
  drawRoute(routes[0].slice(1), 20 + pulse * 15, `rgba(255,90,87,${0.1 + pulse * 0.18})`);
  drawRoute(routes[1].slice(0, 3), 12, `rgba(255,211,79,${0.18 + pulse * 0.14})`);
  ctx.fillStyle = `rgba(53,212,229,${0.06 + pulse * 0.05})`;
  ctx.beginPath();
  ctx.ellipse(width * 0.72, height * 0.44, 230 + pulse * 90, 92 + pulse * 34, 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawSignals(routes) {
  const signals = routes.flatMap((route) => route.slice(1, 3));
  signals.forEach((point, index) => {
    const active = index === Math.floor(tick / 90) % signals.length;
    const color = active ? "#ffd34f" : index % 2 ? "#29d681" : "#ff5a57";
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 28 : 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawVehicles(routes) {
  vehicles.forEach((vehicle) => {
    const progress = (vehicle.offset + tick * vehicle.speed) % 1;
    const point = pointAt(routes[vehicle.lane], progress);
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

function updateConfidence() {
  const value = 80 + Math.round((Math.sin(tick * 0.018) * 0.5 + 0.5) * 10);
  confidenceValue.textContent = `${value}%`;
}

function drawHero() {
  if (document.hidden) return;
  tick += 1;
  const routes = buildRoutes();
  drawBackground(routes);
  drawPressure(routes);
  drawVehicles(routes);
  drawSignals(routes);
  updateConfidence();
  if (!reduceMotion) requestAnimationFrame(drawHero);
}

function setBar(element, value) {
  element.style.width = `${Math.max(8, Math.min(100, value))}%`;
}

function updateLog(items) {
  metrics.log.innerHTML = "";
  items.forEach((item) => {
    const node = document.createElement("li");
    node.textContent = item;
    metrics.log.appendChild(node);
  });
}

function classifyQueue(value) {
  if (value > 88) return "blocked";
  if (value > 70) return "dense";
  if (value > 52) return "watch";
  return "clear";
}

function buildSectorState(demand, config) {
  const queues = config.demandBias.map((bias, index) => {
    const upstream = index ? config.demandBias[index - 1] * 12 : 0;
    const capacity = config.capacityBias[index] * 100;
    return Math.max(18, Math.min(100, demand * bias + upstream - capacity * 0.18));
  });
  const downstreamPressure = queues.slice(2).reduce((sum, value) => sum + value, 0) / 3;
  const avgQueue = queues.reduce((sum, value) => sum + value, 0) / queues.length;
  const pim = Math.max(0.36, Math.min(0.92, config.pimBase - config.dischargeLoss * 0.28 + (80 - demand) / 210));
  const residualQueue = Math.round(avgQueue * config.queueFactor * 1.55);
  return { queues, downstreamPressure, avgQueue, pim, residualQueue };
}

function recommendationFor(state, config) {
  if (config.kind === "blockage") return "Meter upstream release; protect downstream recovery";
  if (config.kind === "rain") return "Shorten cycle; preserve discharge gaps";
  if (state.downstreamPressure > 78) return "Meter upstream release; protect downstream recovery";
  if (config.dischargeLoss > 0.3) return "Shorten cycle; preserve discharge gaps";
  if (state.avgQueue > 58) return "Shift offset before mid-sector queue locks";
  return "Hold current split and continue shadow replay";
}

function logFor(state, config) {
  const worstIndex = state.queues.indexOf(Math.max(...state.queues)) + 1;
  return [
    `Sector model: J${worstIndex} has the highest queue pressure.`,
    `Effective movement probability is ${state.pim.toFixed(2)} after startup-loss correction.`,
    recommendationFor(state, config),
  ];
}

function updateJunctions(queues) {
  metrics.junctions.forEach((node, index) => {
    const status = classifyQueue(queues[index]);
    node.dataset.status = status;
    node.innerHTML = `J${index + 1} <strong>${status}</strong>`;
  });
}

function updateScenario() {
  const demand = Number(demandSlider.value);
  const config = scenarios[activeScenario];
  const state = buildSectorState(demand, config);
  metrics.density.textContent = `${Math.round(state.avgQueue)} veh/km`;
  metrics.pim.textContent = state.pim.toFixed(2);
  metrics.queue.textContent = `${state.residualQueue} m`;
  metrics.phase.textContent = config.phase;
  metrics.recommendation.textContent = recommendationFor(state, config);
  metrics.mapRecommendation.textContent = recommendationFor(state, config);
  metrics.densityChip.textContent = `${Math.round(state.avgQueue)} veh/km`;
  metrics.pimChip.textContent = state.pim.toFixed(2);
  metrics.queueChip.textContent = `${state.residualQueue} m`;
  setBar(metrics.densityBar, state.avgQueue);
  setBar(metrics.pimBar, state.pim * 100);
  setBar(metrics.queueBar, Math.min(95, state.residualQueue / 1.8));
  updateJunctions(state.queues);
  updateLog(logFor(state, config));
}

function bindScenarioControls() {
  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      scenarioButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeScenario = button.dataset.scenario;
      updateScenario();
    });
  });
  demandSlider.addEventListener("input", updateScenario);
}

window.addEventListener("resize", resizeCanvas);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !reduceMotion) requestAnimationFrame(drawHero);
});
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  reduceMotion = event.matches;
  if (!reduceMotion && !document.hidden) requestAnimationFrame(drawHero);
});

bindScenarioControls();
updateScenario();
resizeCanvas();
drawHero();
