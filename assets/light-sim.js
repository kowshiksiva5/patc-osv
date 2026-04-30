const canvas = document.getElementById("corridorCanvas");
const ctx = canvas.getContext("2d");
const controls = {
  demand: document.getElementById("demandRange"),
  discharge: document.getElementById("dischargeRange"),
  safety: document.getElementById("safetyRange"),
};
const state = {
  scenarioKey: "peak",
  mode: "patc",
  vehicles: [],
  nextId: 1,
  paused: false,
  speed: 1,
  lastTs: 0,
  resetHandle: null,
  recommendation: "Collecting replay state",
};
function currentScenario() {
  return scenarios[state.scenarioKey];
}
function controlValue(key) {
  return Number(controls[key].value) / 100;
}
function updateReadouts() {
  document.getElementById("demandReadout").textContent = `${controls.demand.value}%`;
  document.getElementById("dischargeReadout").textContent = `${controls.discharge.value}%`;
  document.getElementById("safetyReadout").textContent = `${controls.safety.value}%`;
}
function routeLength(route) {
  return route.points.slice(1).reduce((total, point, index) => {
    const prev = route.points[index];
    return total + Math.hypot(point[0] - prev[0], point[1] - prev[1]);
  }, 0);
}
function progressForJunction(route, junctionId) {
  const j = junctions.find((item) => item.id === junctionId);
  let covered = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const near = Math.hypot(b[0] - j.x, b[1] - j.y) < 68;
    if (near) return Math.max(0, (covered + seg - 34) / routeLength(route));
    covered += seg;
  }
  throw new Error(`Route stop ${junctionId} is not on its declared geometry.`);
}
Object.values(routes).forEach((route) => {
  route.length = routeLength(route);
  route.stopProgress = route.stops.map((id) => ({ id, p: progressForJunction(route, id) }));
});
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function pointAt(route, progress, lane) {
  const target = progress * route.length;
  let covered = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (covered + length >= target) return segmentPoint(route, a, b, (target - covered) / length, lane);
    covered += length;
  }
  const n = route.points.length;
  return segmentPoint(route, route.points[n - 2], route.points[n - 1], 1, lane);
}
function segmentPoint(route, a, b, t, lane) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const offset = (lane === 0 ? -8 : 8) + (route.laneShift || 0);
  return {
    x: lerp(a[0], b[0], t) + Math.cos(angle + Math.PI / 2) * offset,
    y: lerp(a[1], b[1], t) + Math.sin(angle + Math.PI / 2) * offset,
    angle,
  };
}
function createVehicle(index) {
  const scenario = currentScenario();
  const key = scenario.bias[index % scenario.bias.length];
  return {
    id: state.nextId++,
    routeKey: key,
    route: routes[key],
    lane: index % 2,
    progress: 0,
    delay: index * scenario.spacing * (1.45 - controlValue("demand") * 0.35),
    speed: 0.036 + (index % 4) * 0.004,
    wait: 0,
    stops: 0,
    complete: false,
    blocked: false,
  };
}
function resetReplay() {
  const scenario = currentScenario();
  junctions.forEach((j, i) => {
    j.phase = i === 2 && scenario.title !== "Peak spillback" ? "NS" : "EW";
    j.timer = i * 1.5;
  });
  state.nextId = 1;
  state.vehicles = Array.from({ length: 72 }, (_, index) => createVehicle(index));
  setPaused(false);
  updateScenarioText();
}
function scheduleReset() {
  clearTimeout(state.resetHandle);
  state.resetHandle = setTimeout(resetReplay, 220);
}
function updateScenarioText() {
  document.getElementById("scenarioTitle").textContent = currentScenario().title;
  document.getElementById("scenarioCopy").textContent = currentScenario().copy;
}
function nextStop(vehicle) {
  return vehicle.route.stopProgress.find((stop) => stop.p > vehicle.progress + 0.005);
}
function pressure(junctionId, phase) {
  return state.vehicles.reduce((total, vehicle) => {
    if (vehicle.complete || vehicle.delay > 0 || vehicle.route.phase !== phase) return total;
    const stop = nextStop(vehicle);
    if (!stop || stop.id !== junctionId) return total;
    const distance = Math.max(0, stop.p - vehicle.progress);
    return total + Math.max(0, 1.4 - distance * 13) + vehicle.wait * 0.18;
  }, 0);
}
function updateSignals(dt) {
  junctions.forEach((junction) => {
    junction.timer += dt;
    const ew = pressure(junction.id, "EW") + downstreamPenalty(junction.id);
    const ns = pressure(junction.id, "NS");
    const minGreen = 4.8 * controlValue("safety");
    const maxGreen = state.mode === "fixed" ? 8.8 : 11.5;
    const target = ew >= ns ? "EW" : "NS";
    const urgent = Math.max(ew, ns) > Math.min(ew, ns) * 1.22 + 1.5;
    const shouldPatcSwitch = state.mode === "patc" && target !== junction.phase && urgent && junction.timer > minGreen;
    const shouldFixedSwitch = state.mode === "fixed" && junction.timer > 7.5;
    if (shouldPatcSwitch || shouldFixedSwitch || junction.timer > maxGreen) {
      junction.phase = junction.phase === "EW" ? "NS" : "EW";
      junction.timer = 0;
    }
  });
}
function downstreamPenalty(junctionId) {
  const order = ["J1", "J2", "J3", "J4"];
  const index = order.indexOf(junctionId);
  if (index < 0 || index > 2) return 0;
  const next = order[index + 1];
  return pressure(next, "EW") * 0.34 * currentScenario().downstream;
}
function blockedBySignal(vehicle, dt) {
  const stop = nextStop(vehicle);
  if (!stop) return false;
  const junction = junctions.find((item) => item.id === stop.id);
  const projected = vehicle.progress + vehicle.speed * controlValue("discharge") * dt;
  return projected >= stop.p && junction.phase !== vehicle.route.phase;
}
function leaderGap(vehicle, projected) {
  return state.vehicles.reduce((min, other) => {
    if (other === vehicle || other.complete || other.delay > 0) return min;
    if (other.routeKey !== vehicle.routeKey || other.lane !== vehicle.lane) return min;
    const gap = other.progress - projected;
    return gap > 0 ? Math.min(min, gap) : min;
  }, 1);
}
function physicalConflict(vehicle, projected) {
  const stop = nextStop(vehicle);
  if (!stop) return false;
  const pose = pointAt(vehicle.route, projected, vehicle.lane);
  const junction = junctions.find((item) => item.id === stop.id);
  const currentPose = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
  const nearStop = Math.hypot(pose.x - junction.x, pose.y - junction.y) <= 56;
  return state.vehicles.some((other) => {
    if (other === vehicle || other.complete || other.delay > 0) return false;
    const otherPose = pointAt(other.route, other.progress, other.lane);
    const currentGap = Math.hypot(currentPose.x - otherPose.x, currentPose.y - otherPose.y);
    const projectedGap = Math.hypot(pose.x - otherPose.x, pose.y - otherPose.y);
    const occupiedJunction = nearStop && hasEnteredJunction(other, stop.id) && projectedGap < 34;
    const closingConflict = projectedGap < 0 && projectedGap < currentGap;
    return occupiedJunction || closingConflict;
  });
}
function hasEnteredJunction(vehicle, junctionId) {
  const stop = vehicle.route.stopProgress.find((item) => item.id === junctionId);
  if (!stop || vehicle.progress <= stop.p + 0.004) return false;
  const pose = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
  const junction = junctions.find((item) => item.id === junctionId);
  return Math.hypot(pose.x - junction.x, pose.y - junction.y) < 62;
}
function setPaused(value) {
  state.paused = value;
  document.getElementById("pauseBtn").textContent = value ? "Resume" : "Pause";
}
function updateVehicle(vehicle, dt) {
  if (vehicle.complete) return;
  if (vehicle.delay > 0) {
    vehicle.delay -= dt;
    return;
  }
  const rain = state.scenarioKey === "rain" ? 0.76 : 1;
  const velocity = vehicle.speed * controlValue("discharge") * rain;
  const projected = Math.min(1, vehicle.progress + velocity * dt);
  const blocked = blockedBySignal(vehicle, dt) || leaderGap(vehicle, projected) < 0.032 || physicalConflict(vehicle, projected);
  vehicle.blocked = blocked;
  if (blocked) {
    vehicle.wait += dt;
    if (vehicle.wait - vehicle.stops > 1) vehicle.stops += 1;
    return;
  }
  vehicle.progress = projected;
  if (vehicle.progress >= 1) {
    vehicle.progress = 1;
    vehicle.complete = true;
  }
}
function step(dt) {
  updateSignals(dt);
  state.vehicles
    .slice()
    .sort((a, b) => b.progress - a.progress)
    .forEach((vehicle) => updateVehicle(vehicle, dt));
  updateRecommendation();
  if (state.vehicles.every((vehicle) => vehicle.complete)) setPaused(true);
}
function updateRecommendation() {
  const ranked = junctions.map((j) => ({ j, ew: pressure(j.id, "EW"), ns: pressure(j.id, "NS") }));
  ranked.sort((a, b) => Math.max(b.ew, b.ns) - Math.max(a.ew, a.ns));
  const top = ranked[0];
  const phase = top.ew >= top.ns ? "EW" : "NS";
  state.recommendation = `${top.j.id}: ${phase === top.j.phase ? "hold" : "prepare"} ${phase}`;
}
function drawPath(points, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));
  ctx.stroke();
}
function drawRoads() {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  Object.values(routes).forEach((route) => drawPath(route.points, 54, colors.road));
  Object.values(routes).forEach((route) => drawPath(route.points, 2, colors.lane));
}
function drawSignals() {
  junctions.forEach((j) => {
    ctx.fillStyle = j.phase === "EW" ? colors.amber : colors.cyan;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(j.x, j.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.text;
    ctx.font = "700 13px sans-serif";
    ctx.fillText(j.id, j.x + 18, j.y - 12);
    ctx.fillStyle = colors.muted;
    ctx.font = "12px sans-serif";
    ctx.fillText(`${j.phase} ${j.timer.toFixed(0)}s`, j.x + 18, j.y + 6);
  });
}
function displayPose(vehicle, used) {
  const pose = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
  let attempts = 0;
  while (used.some((item) => Math.hypot(item.x - pose.x, item.y - pose.y) < 28) && attempts < 4) {
    const direction = vehicle.id % 2 === 0 ? 1 : -1;
    pose.x += Math.cos(pose.angle + Math.PI / 2) * 16 * direction;
    pose.y += Math.sin(pose.angle + Math.PI / 2) * 16 * direction;
    attempts += 1;
  }
  used.push(pose);
  return pose;
}
function drawVehicles() {
  const used = [];
  state.vehicles.forEach((vehicle) => {
    if (vehicle.complete || vehicle.delay > 0) return;
    const p = displayPose(vehicle, used);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = vehicle.blocked ? colors.red : vehicle.route.color;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.roundRect(-12, -5, 24, 10, 4);
    ctx.fill();
    ctx.restore();
  });
}
function drawDashboardOverlay() {
  const complete = state.vehicles.filter((vehicle) => vehicle.complete).length;
  ctx.fillStyle = "rgba(5,7,10,0.72)";
  ctx.fillRect(24, 24, 260, 88);
  ctx.fillStyle = colors.text;
  ctx.font = "700 15px sans-serif";
  ctx.fillText("PATC shadow corridor", 42, 54);
  ctx.fillStyle = colors.muted;
  ctx.font = "13px sans-serif";
  ctx.fillText(`${complete}/72 complete | ${state.mode.toUpperCase()}`, 42, 80);
  ctx.fillText(state.recommendation, 42, 100);
}
function completionPercent() {
  const done = state.vehicles.filter((vehicle) => vehicle.complete).length;
  if (done === state.vehicles.length) return 100;
  return Math.min(99, Math.floor((done / state.vehicles.length) * 100));
}
function updatePanel() {
  const active = state.vehicles.filter((vehicle) => !vehicle.complete && vehicle.delay <= 0).length;
  const avgDelay = state.vehicles.reduce((sum, vehicle) => sum + vehicle.wait, 0) / state.vehicles.length;
  const maxPressure = Math.max(...junctions.flatMap((j) => [pressure(j.id, "EW"), pressure(j.id, "NS")]));
  document.getElementById("completionValue").textContent = `${completionPercent()}%`;
  document.getElementById("activeValue").textContent = `${active}`;
  document.getElementById("delayValue").textContent = `${avgDelay.toFixed(1)}s`;
  document.getElementById("pressureValue").textContent = maxPressure > 42 ? "High" : maxPressure > 18 ? "Medium" : "Low";
  document.getElementById("recommendationValue").textContent = state.recommendation;
}
function render() {
  drawRoads();
  drawSignals();
  drawVehicles();
  drawDashboardOverlay();
  updatePanel();
}
function frame(ts) {
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000 || 0.016) * state.speed * 12;
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
document.querySelectorAll(".mode-btn").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach((item) => item.classList.toggle("active", item === button));
    resetReplay();
  });
});
Object.values(controls).forEach((control) => {
  control.addEventListener("input", () => {
    updateReadouts();
    scheduleReset();
  });
});
document.getElementById("pauseBtn").addEventListener("click", () => {
  setPaused(!state.paused);
});
document.getElementById("restartBtn").addEventListener("click", resetReplay);
document.getElementById("speedBtn").addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 0.5 : 1;
  document.getElementById("speedBtn").textContent = `${state.speed}x speed`;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPaused(true);
});
window.PATC = { state, resetReplay, step, render, completionPercent, pointAt, setPaused };
updateReadouts();
resetReplay();
requestAnimationFrame((ts) => {
  state.lastTs = ts;
  requestAnimationFrame(frame);
});
