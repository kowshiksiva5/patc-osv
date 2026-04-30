const canvas = document.getElementById("sectorCanvas");
const ctx = canvas.getContext("2d");

const colors = {
  bg: "#050b13",
  road: "#122947",
  roadEdge: "#0b1a2d",
  cyan: "#00d7ff",
  amber: "#ffb21a",
  green: "#16f28f",
  red: "#ff4d5e",
  text: "#f1f7ff",
  muted: "#99afc8",
};

const points = {
  west: { x: 60, y: 280 },
  east: { x: 900, y: 280 },
  north: { x: 480, y: 60 },
  south: { x: 480, y: 500 },
  center: { x: 480, y: 280 },
  nw: { x: 200, y: 130 },
  se: { x: 760, y: 430 },
  sw: { x: 220, y: 430 },
  ne: { x: 760, y: 130 },
};

const routes = [
  { key: "ew", phase: "EW", color: colors.amber, path: [points.west, points.center, points.east] },
  { key: "we", phase: "EW", color: colors.amber, path: [points.east, points.center, points.west] },
  { key: "ns", phase: "NS", color: colors.cyan, path: [points.north, points.center, points.south] },
  { key: "sn", phase: "NS", color: colors.cyan, path: [points.south, points.center, points.north] },
  { key: "nwse", phase: "NS", color: colors.cyan, path: [points.nw, points.center, points.se] },
  { key: "swne", phase: "EW", color: colors.amber, path: [points.sw, points.center, points.ne] },
];

const scenarios = {
  peak: {
    title: "Peak spillback",
    copy: "Downstream pressure builds while arrivals keep feeding the sector.",
    phase: "EW",
    routeBias: ["ew", "we", "ew", "ns", "swne"],
  },
  rain: {
    title: "Rain slowdown",
    copy: "Lower discharge and longer startup delay make each green less efficient.",
    phase: "NS",
    routeBias: ["ns", "sn", "nwse", "ew", "we"],
  },
  event: {
    title: "Event surge",
    copy: "A short wave arrives from one side and competes with residual queues.",
    phase: "EW",
    routeBias: ["we", "we", "swne", "ns", "ew"],
  },
  school: {
    title: "School release",
    copy: "Burst arrivals create short queues that need clearing without starving cross traffic.",
    phase: "NS",
    routeBias: ["ns", "nwse", "sn", "ew", "swne"],
  },
};

const controls = {
  demand: document.getElementById("demandRange"),
  discharge: document.getElementById("dischargeRange"),
  safety: document.getElementById("safetyRange"),
};

const state = {
  scenarioKey: "peak",
  phase: "EW",
  phaseTime: 0,
  vehicles: [],
  nextId: 1,
  paused: false,
  speed: 1,
  lastTs: 0,
  resetHandle: null,
};

function currentScenario() {
  return scenarios[state.scenarioKey];
}

function controlValue(name) {
  return Number(controls[name].value) / 100;
}

function updateReadouts() {
  document.getElementById("demandReadout").textContent = `${controls.demand.value}%`;
  document.getElementById("dischargeReadout").textContent = `${controls.discharge.value}%`;
  document.getElementById("safetyReadout").textContent = `${controls.safety.value}%`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function routeByKey(key) {
  return routes.find((route) => route.key === key) || routes[0];
}

function pointAt(path, progress) {
  const segmentCount = path.length - 1;
  const scaled = Math.min(segmentCount - 0.001, progress * segmentCount);
  const index = Math.floor(scaled);
  const t = scaled - index;
  const a = path[index];
  const b = path[index + 1];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle };
}

function createVehicle(index) {
  const scenario = currentScenario();
  const key = scenario.routeBias[index % scenario.routeBias.length];
  const route = routeByKey(key);
  const delay = index * (0.8 + (150 - Number(controls.demand.value)) / 120);
  return {
    id: state.nextId++,
    route,
    progress: 0,
    delay,
    wait: 0,
    complete: false,
    color: route.color,
    speed: 0.056 + (index % 5) * 0.006,
  };
}

function resetReplay() {
  state.phase = currentScenario().phase;
  state.phaseTime = 0;
  state.nextId = 1;
  state.vehicles = Array.from({ length: 54 }, (_, index) => createVehicle(index));
  updateScenarioText();
}

function scheduleReset() {
  clearTimeout(state.resetHandle);
  state.resetHandle = setTimeout(resetReplay, 220);
}

function updateScenarioText() {
  const scenario = currentScenario();
  document.getElementById("scenarioTitle").textContent = scenario.title;
  document.getElementById("scenarioCopy").textContent = scenario.copy;
}

function isAtSignal(vehicle) {
  return vehicle.progress > 0.45 && vehicle.progress < 0.53;
}

function isBlockedBySignal(vehicle) {
  return isAtSignal(vehicle) && state.phase !== vehicle.route.phase;
}

function isBlockedByQueue(vehicle) {
  return state.vehicles.some((other) => {
    if (other === vehicle || other.complete || other.route.key !== vehicle.route.key) return false;
    const gap = other.progress - vehicle.progress;
    return gap > 0 && gap < 0.035;
  });
}

function updateVehicle(vehicle, dt) {
  if (vehicle.complete) return;
  if (vehicle.delay > 0) {
    vehicle.delay -= dt;
    return;
  }
  if (isBlockedBySignal(vehicle) || isBlockedByQueue(vehicle)) {
    vehicle.wait += dt;
    return;
  }
  const discharge = controlValue("discharge");
  const rainSlowdown = state.scenarioKey === "rain" ? 0.76 : 1;
  vehicle.progress += vehicle.speed * discharge * rainSlowdown * dt;
  if (vehicle.progress >= 1) {
    vehicle.progress = 1;
    vehicle.complete = true;
  }
}

function phasePressure(phase) {
  return state.vehicles.reduce((total, vehicle) => {
    if (vehicle.complete || vehicle.delay > 0 || vehicle.route.phase !== phase) return total;
    const signalWeight = isAtSignal(vehicle) ? 2.2 : 1;
    return total + signalWeight + vehicle.wait * 0.45;
  }, 0);
}

function updateSignal(dt) {
  state.phaseTime += dt;
  const ns = phasePressure("NS");
  const ew = phasePressure("EW");
  const safety = controlValue("safety");
  const minTime = 4.2 * safety;
  const shouldSwitchToNS = state.phase === "EW" && ns > ew * 1.18 && state.phaseTime > minTime;
  const shouldSwitchToEW = state.phase === "NS" && ew > ns * 1.18 && state.phaseTime > minTime;
  const maxTime = 9.5 + safety * 2;
  if (shouldSwitchToNS || shouldSwitchToEW || state.phaseTime > maxTime) {
    state.phase = state.phase === "NS" ? "EW" : "NS";
    state.phaseTime = 0;
  }
}

function step(dt) {
  updateSignal(dt);
  state.vehicles.forEach((vehicle) => updateVehicle(vehicle, dt));
  if (state.vehicles.every((vehicle) => vehicle.complete)) {
    state.paused = true;
    document.getElementById("pauseBtn").textContent = "Replay complete";
  }
}

function drawRoads() {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colors.roadEdge;
  ctx.lineWidth = 72;
  drawPath([points.west, points.center, points.east]);
  drawPath([points.north, points.center, points.south]);
  drawPath([points.nw, points.center, points.se]);
  drawPath([points.sw, points.center, points.ne]);
  ctx.strokeStyle = colors.road;
  ctx.lineWidth = 48;
  routes.forEach((route) => drawPath(route.path));
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  routes.forEach((route) => drawPath(route.path));
}

function drawPath(path) {
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  path.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();
}

function drawSignals() {
  const nsColor = state.phase === "NS" ? colors.green : colors.red;
  const ewColor = state.phase === "EW" ? colors.green : colors.red;
  drawSignal(points.center.x - 18, points.center.y - 46, nsColor, "N/S");
  drawSignal(points.center.x + 34, points.center.y + 18, ewColor, "E/W");
}

function drawSignal(x, y, color, label) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = colors.text;
  ctx.font = "12px sans-serif";
  ctx.fillText(label, x + 14, y + 4);
}

function drawVehicles() {
  state.vehicles.forEach((vehicle) => {
    if (vehicle.complete || vehicle.delay > 0) return;
    const point = pointAt(vehicle.route.path, vehicle.progress);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    ctx.fillStyle = vehicle.color;
    ctx.shadowColor = vehicle.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-11, -5, 22, 10, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = isBlockedBySignal(vehicle) || isBlockedByQueue(vehicle) ? colors.red : "#ffffff";
    ctx.fillRect(5, -3, 4, 6);
    ctx.restore();
  });
}

function drawPressure() {
  const ns = phasePressure("NS");
  const ew = phasePressure("EW");
  const max = Math.max(ns, ew, 1);
  drawBar(30, 30, 180, "N/S pressure", ns / max, colors.cyan);
  drawBar(30, 62, 180, "E/W pressure", ew / max, colors.amber);
}

function drawBar(x, y, width, label, value, color) {
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x, y, width, 12);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * Math.min(1, value), 12);
  ctx.fillStyle = colors.muted;
  ctx.font = "12px sans-serif";
  ctx.fillText(label, x + width + 12, y + 11);
}

function drawCompletionRing() {
  const completed = state.vehicles.filter((vehicle) => vehicle.complete).length;
  const ratio = completed / state.vehicles.length;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(880, 72, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = colors.green;
  ctx.beginPath();
  ctx.arc(880, 72, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = "700 14px sans-serif";
  ctx.fillText(`${completionPercent()}%`, 866, 77);
}

function completionPercent() {
  const done = state.vehicles.filter((vehicle) => vehicle.complete).length;
  if (done === state.vehicles.length) return 100;
  return Math.min(99, Math.floor((done / state.vehicles.length) * 100));
}

function updatePanel() {
  const pressure = Math.max(phasePressure("NS"), phasePressure("EW"));
  const risk = pressure > 80 ? "High" : pressure > 42 ? "Medium" : "Low";
  const rec = phasePressure("NS") > phasePressure("EW") ? "Favor N/S next" : "Favor E/W next";
  document.getElementById("completionValue").textContent = `${completionPercent()}%`;
  document.getElementById("pressureValue").textContent = risk;
  document.getElementById("phaseValue").textContent = `${state.phase} green`;
  document.getElementById("recommendationValue").textContent = rec;
}

function render() {
  drawRoads();
  drawSignals();
  drawVehicles();
  drawPressure();
  drawCompletionRing();
  updatePanel();
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000 || 0.016) * state.speed;
  state.lastTs = ts;
  if (!state.paused) step(dt);
  render();
  requestAnimationFrame(frame);
}

function setScenario(key) {
  state.scenarioKey = key;
  document.querySelectorAll(".scenario-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === key);
  });
  resetReplay();
}

document.querySelectorAll(".scenario-btn").forEach((button) => {
  button.addEventListener("click", () => setScenario(button.dataset.scenario));
});

Object.values(controls).forEach((control) => {
  control.addEventListener("input", () => {
    updateReadouts();
    scheduleReset();
  });
});

document.getElementById("pauseBtn").addEventListener("click", () => {
  state.paused = !state.paused;
  document.getElementById("pauseBtn").textContent = state.paused ? "Resume" : "Pause";
});

document.getElementById("restartBtn").addEventListener("click", () => {
  state.paused = false;
  document.getElementById("pauseBtn").textContent = "Pause";
  resetReplay();
});

document.getElementById("speedBtn").addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 0.5 : 1;
  document.getElementById("speedBtn").textContent = `${state.speed}x speed`;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) state.paused = true;
});

updateReadouts();
resetReplay();
requestAnimationFrame((ts) => {
  state.lastTs = ts;
  requestAnimationFrame(frame);
});
