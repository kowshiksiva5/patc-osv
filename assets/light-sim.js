/* PATC corridor simulation — 5 junctions, MAIN/SIDE phase model,
   lane-separated two-way mainline, one-way side roads.
   Coordinate space matches the canvas (1700 × 760), no transform applied. */

const canvas = document.getElementById("corridorCanvas");
const ctx = canvas.getContext("2d");

const CANVAS_W = 1700;
const CANVAS_H = 760;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

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
  frameIndex: 0,
  lastTs: 0,
  recommendation: "Collecting replay state",
};

const modeCopy = {
  patc:  { label: "PATC shadow",        effect: "Corridor coordination", overlay: "Mainline progression coordinated" },
  fixed: { label: "Fixed-time baseline", effect: "Rigid timing",          overlay: "Fixed cycle ignores sector pressure" },
};

/* Tuning constants */
const STOP_LINE_OFFSET = 38;
const JUNCTION_CLEAR_RADIUS = 22;
const ENTRY_RESERVATION_MARGIN = 0.012;
const MIN_VEHICLE_GAP = 0.038;
const AMBER_DURATION = 1.2;
const ALL_RED_DURATION = 0.8;
const PATC_MIN_GREEN = 4.0;
const PATC_MAX_GREEN = 12.0;
const FIXED_GREEN_MAIN = 8.0;
const FIXED_GREEN_SIDE = 6.0;
const VEHICLE_TARGET_COUNT = 24;
const VEHICLE_MIX = [
  { kind: "sedan", weight: 35 },
  { kind: "auto",  weight: 25 },
  { kind: "suv",   weight: 20 },
  { kind: "bike",  weight: 15 },
  { kind: "bus",   weight: 5  },
];

/* ─── Geometry helpers ────────────────────────────────────── */
function lerp(a, b, t) { return a + (b - a) * t; }

function routeLength(route) {
  return route.points.slice(1).reduce((sum, p, i) => {
    const prev = route.points[i];
    return sum + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
  }, 0);
}

function nearestSegmentT(a, b, node) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((node.x - a[0]) * dx + (node.y - a[1]) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

function nodeProgress(route, node) {
  let covered = 0;
  let best = { distance: Infinity, progress: null };
  const total = routeLength(route);
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1], b = route.points[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = nearestSegmentT(a, b, node);
    const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
    const d = Math.hypot(x - node.x, y - node.y);
    if (d < best.distance) best = { distance: d, progress: (covered + seg * t) / total };
    covered += seg;
  }
  return best.distance <= 60 ? best.progress : null;
}

function pointAt(route, progress) {
  const target = progress * route.length;
  let covered = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1], b = route.points[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (covered + len >= target) {
      const t = (target - covered) / len;
      return {
        x: lerp(a[0], b[0], t),
        y: lerp(a[1], b[1], t),
        angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
      };
    }
    covered += len;
  }
  const n = route.points.length;
  const a = route.points[n - 2], b = route.points[n - 1];
  return { x: b[0], y: b[1], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

/* ─── Init: precompute route metadata ─────────────────────── */
Object.values(routes).forEach((route) => {
  route.length = routeLength(route);
  route.stopProgress = route.stops.map((id) => {
    const node = junctions.find((j) => j.id === id);
    const center = nodeProgress(route, node);
    if (center === null) throw new Error(`Route stop ${id} not on geometry`);
    return {
      id,
      centerP: center,
      stopP: Math.max(0, center - STOP_LINE_OFFSET / route.length),
      clearP: center + (JUNCTION_CLEAR_RADIUS + 8) / route.length,
    };
  });
});

/* ─── State helpers ───────────────────────────────────────── */
function isFixedMode() { return state.mode === "fixed"; }
function currentScenario() { return scenarios[state.scenarioKey]; }
function controlValue(key) { return Number(controls[key].value) / 100; }
function junctionById(id) { return junctions.find((j) => j.id === id); }

function updateReadouts() {
  document.getElementById("demandReadout").textContent = `${controls.demand.value}%`;
  document.getElementById("dischargeReadout").textContent = `${controls.discharge.value}%`;
  document.getElementById("safetyReadout").textContent = `${controls.safety.value}%`;
}

/* ─── Vehicles ────────────────────────────────────────────── */
function pickVehicleKind(index) {
  /* Deterministic, reproducible mix */
  const total = VEHICLE_MIX.reduce((s, v) => s + v.weight, 0);
  const slot = (index * 37) % total;
  let acc = 0;
  for (const v of VEHICLE_MIX) {
    acc += v.weight;
    if (slot < acc) return v.kind;
  }
  return "sedan";
}

function vehicleDims(kind) {
  switch (kind) {
    case "sedan": return { length: 22, width: 10 };
    case "suv":   return { length: 28, width: 11 };
    case "auto":  return { length: 18, width: 10 };
    case "bike":  return { length: 16, width: 5 };
    case "bus":   return { length: 36, width: 11 };
    default:      return { length: 22, width: 10 };
  }
}

function vehicleColor(kind) {
  switch (kind) {
    case "sedan": return colors.vSedan;
    case "suv":   return colors.vSuv;
    case "auto":  return colors.vAuto;
    case "bike":  return colors.vBike;
    case "bus":   return colors.vBus;
    default:      return colors.vSedan;
  }
}

function baseSpeed(kind) {
  /* Slightly varied so vehicles don't move in lockstep */
  switch (kind) {
    case "sedan": return 0.040;
    case "suv":   return 0.038;
    case "auto":  return 0.034;
    case "bike":  return 0.046;
    case "bus":   return 0.032;
    default:      return 0.040;
  }
}

function createVehicle(index) {
  const scenario = currentScenario();
  let routeKey = scenario.bias[index % scenario.bias.length];
  let kind = pickVehicleKind(index);
  /* Bus only on mainline */
  if (kind === "bus" && !routeKey.startsWith("main")) kind = "sedan";
  const demandSpacing = Math.max(0.42, 1.4 - controlValue("demand") * 0.55);
  return {
    id: state.nextId++,
    kind,
    routeKey,
    route: routes[routeKey],
    progress: 0,
    delay: index * scenario.spacing * demandSpacing,
    speed: baseSpeed(kind),
    wait: 0,
    delayCost: 0,
    stops: 0,
    blocked: false,
    blockReason: "",
    complete: false,
    visualPose: null,
  };
}

/* ─── Junction phase machine ──────────────────────────────── */
function initJunction(j, offsetIndex) {
  const scenario = currentScenario();
  j.phase = scenario.primaryPhase || "MAIN";
  j.subphase = "green";
  j.timer = offsetIndex * 1.6;
  j.pendingPhase = null;
}

function junctionGreen(junction, routePhase) {
  return junction.phase === routePhase && junction.subphase === "green";
}

function junctionRed(junction, routePhase) {
  /* Treat amber as still allowing entry within reservation, all-red blocks all */
  if (junction.subphase === "allred") return true;
  return junction.phase !== routePhase;
}

function approachLight(junction, routePhase) {
  /* Returns "red" | "amber" | "green" for a route's approach */
  if (junction.phase === routePhase) {
    if (junction.subphase === "green") return "green";
    if (junction.subphase === "amber") return "amber";
    return "red";
  }
  return "red";
}

/* ─── Pressure (used by PATC adaptive switching) ──────────── */
function approachPressure(junctionId, phase) {
  return state.vehicles.reduce((total, v) => {
    if (v.complete || v.delay > 0 || v.route.phase !== phase) return total;
    const stop = nextStop(v);
    if (!stop || stop.id !== junctionId) return total;
    const dist = Math.max(0, stop.stopP - v.progress);
    return total + Math.max(0, 1.4 - dist * 14) + v.wait * 0.18;
  }, 0);
}

function arrivalPressure(junctionId, phase) {
  return state.vehicles.reduce((total, v) => {
    if (v.complete || v.delay > 0 || v.route.phase !== phase) return total;
    const stop = nextStop(v);
    if (!stop || stop.id !== junctionId) return total;
    const dist = Math.max(0, stop.stopP - v.progress);
    return total + Math.max(0, 1.2 - dist * 5);
  }, 0);
}

function downstreamPressure(junctionId) {
  const order = ["J1", "J2", "J3", "J4", "J5"];
  const index = order.indexOf(junctionId);
  if (index < 0 || index >= order.length - 1) return 0;
  const next = order[index + 1];
  return approachPressure(next, "MAIN") * 0.32 * currentScenario().downstream;
}

/* ─── Update signals each frame ───────────────────────────── */
function updateSignals(dt) {
  junctions.forEach((j) => updateJunction(j, dt));
}

function updateJunction(j, dt) {
  j.timer += dt;
  if (j.subphase === "amber") {
    if (j.timer >= AMBER_DURATION) {
      j.subphase = "allred";
      j.timer = 0;
    }
    return;
  }
  if (j.subphase === "allred") {
    if (j.timer >= ALL_RED_DURATION) {
      j.phase = j.pendingPhase || (j.phase === "MAIN" ? "SIDE" : "MAIN");
      j.pendingPhase = null;
      j.subphase = "green";
      j.timer = 0;
    }
    return;
  }
  /* Currently green — decide whether to swap */
  const safety = controlValue("safety");
  const mainPressure = approachPressure(j.id, "MAIN") + arrivalPressure(j.id, "MAIN") - downstreamPressure(j.id) * 0.3;
  const sidePressure = approachPressure(j.id, "SIDE") + arrivalPressure(j.id, "SIDE");
  const target = mainPressure >= sidePressure ? "MAIN" : "SIDE";

  if (isFixedMode()) {
    const greenLen = (j.phase === "MAIN" ? FIXED_GREEN_MAIN : FIXED_GREEN_SIDE) * safety;
    if (j.timer >= greenLen) {
      j.pendingPhase = j.phase === "MAIN" ? "SIDE" : "MAIN";
      j.subphase = "amber";
      j.timer = 0;
    }
    return;
  }

  /* PATC mode */
  const minGreen = PATC_MIN_GREEN * safety;
  const maxGreen = PATC_MAX_GREEN;
  const urgent = Math.max(mainPressure, sidePressure) > Math.min(mainPressure, sidePressure) * 1.08 + 0.6;
  const shouldSwitch = (target !== j.phase && urgent && j.timer >= minGreen) || j.timer >= maxGreen;
  if (shouldSwitch && !junctionOccupied(j)) {
    j.pendingPhase = target !== j.phase ? target : (j.phase === "MAIN" ? "SIDE" : "MAIN");
    j.subphase = "amber";
    j.timer = 0;
  }
}

function junctionOccupied(junction) {
  return state.vehicles.some((v) => {
    if (v.complete || v.delay > 0) return false;
    const pose = pointAt(v.route, v.progress);
    return Math.hypot(pose.x - junction.x, pose.y - junction.y) < JUNCTION_CLEAR_RADIUS + 6;
  });
}

/* ─── Vehicle update ──────────────────────────────────────── */
function nextStop(v) {
  return v.route.stopProgress.find((s) => s.clearP > v.progress);
}

function blockedBySignal(v, projected) {
  const stop = nextStop(v);
  if (!stop) return false;
  /* Already past the stop line and within junction → committed; don't re-block */
  if (v.progress > stop.stopP - 0.001) return false;
  if (projected < stop.stopP - ENTRY_RESERVATION_MARGIN) return false;
  const j = junctionById(stop.id);
  return !junctionGreen(j, v.route.phase);
}

function leaderInfo(v, projected) {
  return state.vehicles.reduce((closest, other) => {
    if (other === v || other.complete || other.delay > 0) return closest;
    if (other.routeKey !== v.routeKey) return closest;
    const gap = other.progress - projected;
    if (gap <= 0 || gap >= closest.gap) return closest;
    return { gap, vehicle: other };
  }, { gap: 1, vehicle: null });
}

function followingProgress(v, projected, leader) {
  if (!leader.vehicle || leader.gap >= MIN_VEHICLE_GAP) return projected;
  return Math.max(v.progress, Math.min(projected, leader.vehicle.progress - MIN_VEHICLE_GAP));
}

function junctionEntryConflict(v, projected) {
  /* Already inside the junction box → don't re-evaluate */
  const stop = nextStop(v);
  if (!stop) return false;
  if (v.progress > stop.centerP) return false;
  if (projected < stop.stopP - 0.005) return false;
  const j = junctionById(stop.id);
  /* Only check conflicts with vehicles whose phase != ours */
  return state.vehicles.some((other) => {
    if (other === v || other.complete || other.delay > 0) return false;
    if (other.route.phase === v.route.phase) return false;
    const op = pointAt(other.route, other.progress);
    return Math.hypot(op.x - j.x, op.y - j.y) < JUNCTION_CLEAR_RADIUS + 4;
  });
}

function updateVehicle(v, dt) {
  if (v.complete) return;
  if (v.delay > 0) { v.delay -= dt; return; }

  const velocity = v.speed * controlValue("discharge");
  const projected = Math.min(1, v.progress + velocity * dt);

  const sigBlocked = blockedBySignal(v, projected);
  const conflict = junctionEntryConflict(v, projected);
  const leader = leaderInfo(v, projected);
  const spacingBlocked = leader.vehicle && leader.gap < MIN_VEHICLE_GAP;

  v.blocked = sigBlocked || conflict || spacingBlocked;
  v.blockReason = sigBlocked ? "signal" : conflict ? "conflict" : spacingBlocked ? "spacing" : "";

  if (v.blocked) {
    /* Clamp at stop line if signal-blocked */
    if (sigBlocked || conflict) {
      const stop = nextStop(v);
      if (stop) {
        v.progress = Math.min(Math.max(v.progress, projected), stop.stopP - ENTRY_RESERVATION_MARGIN);
      }
    } else {
      /* Spacing — follow leader */
      v.progress = followingProgress(v, projected, leader);
    }
    v.wait += dt;
    v.delayCost += dt;
    if (v.wait - v.stops > 1) v.stops += 1;
    /* Deadlock breaker */
    if (v.wait > 6 && !sigBlocked) {
      v.progress = Math.min(1, v.progress + v.speed * 0.01);
      v.wait = Math.max(0, v.wait - 1.5);
    }
    return;
  }

  v.wait = Math.max(0, v.wait - dt * 0.4);
  v.progress = followingProgress(v, projected, leader);
  if (v.progress >= 1) {
    v.progress = 1;
    v.complete = true;
  }
}

/* ─── Recommendation text ─────────────────────────────────── */
function updateRecommendation() {
  if (state.vehicles.every((v) => v.complete)) {
    state.recommendation = "Replay complete";
    return;
  }
  const ranked = junctions
    .map((j) => ({
      j,
      main: approachPressure(j.id, "MAIN"),
      side: approachPressure(j.id, "SIDE"),
    }))
    .sort((a, b) => Math.max(b.main, b.side) - Math.max(a.main, a.side));
  const top = ranked[0];
  const phase = top.main >= top.side ? "MAIN" : "SIDE";
  if (isFixedMode()) {
    state.recommendation = `${top.j.id}: fixed cycle, ${phase} queue building`;
    return;
  }
  const action = phase === top.j.phase ? "extend" : "prepare";
  state.recommendation = `${top.j.id}: ${action} ${phase}; corridor synced`;
}

/* ─── Render: roads ───────────────────────────────────────── */
function drawBackground() {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  /* Subtle grass strips top/bottom */
  ctx.fillStyle = "#0a1410";
  ctx.fillRect(0, 0, CANVAS_W, 24);
  ctx.fillRect(0, CANVAS_H - 24, CANVAS_W, 24);
}

function strokePath(points, width, color, lineDash) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (lineDash) ctx.setLineDash(lineDash);
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.stroke();
  ctx.restore();
}

function drawRoads() {
  /* Asphalt strips */
  roads.forEach((road) => {
    /* Curb / outline */
    strokePath(road.centerline, road.width + 4, colors.curb);
    /* Asphalt body */
    strokePath(road.centerline, road.width, colors.asphalt);
  });
  /* Lane markings — center-line dash on two-way roads (median) */
  roads.forEach((road) => {
    if (road.type === "two-way") {
      strokePath(road.centerline, 1.5, colors.median, [10, 12]);
    } else {
      /* Direction arrow stripe down centre of one-way */
      strokePath(road.centerline, 1, colors.laneDash, [4, 18]);
    }
  });
}

/* ─── Render: junctions (broad asphalt + signal heads) ────── */
function drawJunctionPads() {
  junctions.forEach((j) => {
    const w = j.broad ? 76 : 58;
    const h = j.broad ? 58 : 50;
    ctx.fillStyle = colors.asphaltLight;
    ctx.fillRect(j.x - w / 2, j.y - h / 2, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(j.x - w / 2 + 0.5, j.y - h / 2 + 0.5, w - 1, h - 1);
  });
}

/* Signal heads are 3-bulb vertical bars, one per approach.
   We render them at the stop line of each approach route. */
function drawSignalHeads() {
  Object.entries(routes).forEach(([routeKey, route]) => {
    route.stopProgress.forEach((stop) => {
      const j = junctionById(stop.id);
      const light = approachLight(j, route.phase);
      const pose = pointAt(route, stop.stopP);
      drawSignalHead(pose, route.direction, light);
    });
  });
}

function drawSignalHead(pose, direction, light) {
  const nx = -Math.sin(pose.angle);
  const ny = Math.cos(pose.angle);
  /* Push out 22px from lane centre to clear the asphalt */
  const cx = pose.x + nx * 22;
  const cy = pose.y + ny * 22;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.angle + Math.PI / 2);
  /* Pole */
  ctx.fillStyle = "#1b2632";
  ctx.fillRect(-0.6, 0, 1.2, 14);
  /* Housing — bigger, 12×30 */
  ctx.fillStyle = "#0b1218";
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-6, -16, 12, 30, 2);
  else ctx.rect(-6, -16, 12, 30);
  ctx.fill();
  ctx.stroke();
  /* Three bulbs (red top, amber mid, green bottom), bigger radius */
  drawBulb(0, -10, light === "red"   ? colors.red   : colors.bulbOff, light === "red");
  drawBulb(0,  -1, light === "amber" ? colors.amber : colors.bulbOff, light === "amber");
  drawBulb(0,   8, light === "green" ? colors.green : colors.bulbOff, light === "green");
  ctx.restore();
}

function drawBulb(x, y, color, glow) {
  ctx.save();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ─── Render: junction labels ─────────────────────────────── */
function drawJunctionLabels() {
  ctx.save();
  ctx.font = "600 11px ui-monospace, 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  junctions.forEach((j) => {
    ctx.fillStyle = colors.muted;
    ctx.fillText(j.id, j.x, j.y + 50);
  });
  ctx.restore();
}

/* ─── Render: vehicles (5 types) ──────────────────────────── */
function vehicleVisualPose(v) {
  const target = pointAt(v.route, v.progress);
  if (!v.visualPose) { v.visualPose = { ...target }; return target; }
  const dist = Math.hypot(target.x - v.visualPose.x, target.y - v.visualPose.y);
  if (dist > 80) { v.visualPose = { ...target }; return target; }
  const alpha = v.blocked ? 0.3 : 0.5;
  v.visualPose.x = lerp(v.visualPose.x, target.x, alpha);
  v.visualPose.y = lerp(v.visualPose.y, target.y, alpha);
  const da = Math.atan2(Math.sin(target.angle - v.visualPose.angle), Math.cos(target.angle - v.visualPose.angle));
  v.visualPose.angle = v.visualPose.angle + da * alpha;
  return v.visualPose;
}

function drawVehicles() {
  state.vehicles.forEach((v) => {
    if (v.complete || v.delay > 0) return;
    const p = vehicleVisualPose(v);
    drawVehicle(v, p);
  });
}

function drawVehicle(v, pose) {
  const dim = vehicleDims(v.kind);
  const color = vehicleColor(v.kind);
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 0.6;
  switch (v.kind) {
    case "bike":
      ctx.fillRect(-dim.length / 2, -dim.width / 2, dim.length, dim.width);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.arc(-dim.length / 2 + 2, 0, 1.6, 0, Math.PI * 2);
      ctx.arc(dim.length / 2 - 2, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "auto":
      ctx.beginPath();
      ctx.moveTo(-dim.length / 2, -dim.width / 2 + 1);
      ctx.lineTo(dim.length / 2, -dim.width / 2 + 2.5);
      ctx.lineTo(dim.length / 2, dim.width / 2 - 2.5);
      ctx.lineTo(-dim.length / 2, dim.width / 2 - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(-2, -dim.width / 2 + 2, 4, dim.width - 4);
      break;
    case "suv":
      drawRoundedRect(-dim.length / 2, -dim.width / 2, dim.length, dim.width, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(-dim.length / 2 + 4, -dim.width / 2 + 1.5, dim.length - 8, dim.width - 3);
      break;
    case "bus":
      drawRoundedRect(-dim.length / 2, -dim.width / 2, dim.length, dim.width, 2);
      ctx.fill();
      ctx.stroke();
      /* Window strip */
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-dim.length / 2 + 4, -dim.width / 2 + 1.8, dim.length - 8, dim.width - 3.6);
      /* Window dividers */
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 0.5;
      for (let i = -dim.length / 2 + 8; i < dim.length / 2 - 4; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i, -dim.width / 2 + 1.8);
        ctx.lineTo(i, dim.width / 2 - 1.8);
        ctx.stroke();
      }
      break;
    case "sedan":
    default:
      drawRoundedRect(-dim.length / 2, -dim.width / 2, dim.length, dim.width, 2.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-dim.length / 2 + 5, -dim.width / 2 + 1.5, dim.length - 10, dim.width - 3);
      break;
  }
  ctx.restore();
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ─── Render: overlay badge (single, bottom-left) ─────────── */
function drawOverlay() {
  const text = isFixedMode() ? "FIXED CYCLE — UNCOORDINATED" : "MAINLINE COORDINATED";
  const color = isFixedMode() ? colors.amber : colors.green;
  const x = 24, y = CANVAS_H - 50, w = ctx.measureText(text).width + 32, h = 32;
  ctx.save();
  ctx.fillStyle = "rgba(5,7,10,0.78)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
  /* Status dot */
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x + 14, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  /* Label */
  ctx.fillStyle = colors.text;
  ctx.font = "700 11px ui-monospace, 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 24, y + h / 2 + 4);
  ctx.restore();
}

/* ─── Metrics panel ───────────────────────────────────────── */
function severeStopCount() {
  const threshold = isFixedMode() ? 12 : 28;
  return state.vehicles.filter((v) => v.delayCost > threshold).length;
}

function modeEffectText(avgDelay, breakdowns) {
  if (state.vehicles.every((v) => v.complete)) {
    return isFixedMode() ? "Completed with higher delay" : "Clean replay";
  }
  if (breakdowns > 0) return isFixedMode() ? "Queue instability" : "Recovering queue";
  return modeCopy[state.mode].effect;
}

function completionPercent() {
  const done = state.vehicles.filter((v) => v.complete).length;
  if (done === state.vehicles.length) return 100;
  return Math.min(99, Math.floor((done / state.vehicles.length) * 100));
}

function updatePanel() {
  const active = state.vehicles.filter((v) => !v.complete && v.delay <= 0).length;
  const avgDelay = state.vehicles.reduce((s, v) => s + v.delayCost, 0) / state.vehicles.length;
  const maxPressure = Math.max(...junctions.flatMap((j) => [
    approachPressure(j.id, "MAIN"),
    approachPressure(j.id, "SIDE"),
  ]));
  const breakdowns = severeStopCount();
  document.querySelector(".replay-shell").classList.toggle("fixed-mode", isFixedMode());
  document.getElementById("completionValue").textContent = `${completionPercent()}%`;
  document.getElementById("activeValue").textContent = `${active}/${state.vehicles.length}`;
  document.getElementById("delayValue").textContent = `${avgDelay.toFixed(1)}s`;
  document.getElementById("breakdownValue").textContent = `${breakdowns}`;
  document.getElementById("modeEffectValue").textContent = modeEffectText(avgDelay, breakdowns);
  document.getElementById("pressureValue").textContent = maxPressure > 7 ? "High" : maxPressure > 2.5 ? "Medium" : "Low";
  document.getElementById("recommendationValue").textContent = state.recommendation;
}

function updateScenarioText() {
  document.getElementById("scenarioTitle").textContent = currentScenario().title;
  const node = document.getElementById("scenarioCopy");
  if (node) node.textContent = currentScenario().copy;
}

/* ─── Loop ────────────────────────────────────────────────── */
function step(dt) {
  updateSignals(dt);
  state.vehicles
    .slice()
    .sort((a, b) => b.progress - a.progress)
    .forEach((v) => updateVehicle(v, dt));
  updateRecommendation();
  if (state.vehicles.every((v) => v.complete)) setPaused(true);
}

function render() {
  state.frameIndex += 1;
  drawBackground();
  drawRoads();
  drawJunctionPads();
  drawSignalHeads();
  drawJunctionLabels();
  drawVehicles();
  drawOverlay();
  updatePanel();
}

function frame(ts) {
  if (state.lastTs && ts - state.lastTs < 30) {
    requestAnimationFrame(frame);
    return;
  }
  const elapsed = state.lastTs ? (ts - state.lastTs) / 1000 : 0.033;
  const dt = Math.min(0.05, elapsed) * state.speed * 1.4;
  state.lastTs = ts;
  if (!state.paused) step(dt);
  render();
  requestAnimationFrame(frame);
}

/* ─── Replay reset ────────────────────────────────────────── */
function resetReplay() {
  junctions.forEach((j, i) => initJunction(j, i));
  state.nextId = 1;
  state.vehicles = Array.from({ length: VEHICLE_TARGET_COUNT }, (_, i) => createVehicle(i));
  setPaused(false);
  updateScenarioText();
}

function setPaused(value) {
  state.paused = value;
  document.getElementById("startBtn").classList.toggle("active-control", !value);
  document.getElementById("stopBtn").classList.toggle("active-control", value);
}

/* ─── Soft slider response (no full reset) ────────────────── */
function applyControlsLive() {
  /* Re-distribute spawn delays only for vehicles that haven't started yet. */
  const scenario = currentScenario();
  const demandSpacing = Math.max(0.42, 1.4 - controlValue("demand") * 0.55);
  state.vehicles.forEach((v, i) => {
    if (v.progress > 0) return;
    v.delay = i * scenario.spacing * demandSpacing;
  });
}

/* ─── Wiring ──────────────────────────────────────────────── */
document.querySelectorAll(".scenario-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.scenarioKey = btn.dataset.scenario;
    document.querySelectorAll(".scenario-btn").forEach((b) => b.classList.toggle("active", b === btn));
    resetReplay();
  });
});
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
    resetReplay();
  });
});
Object.values(controls).forEach((c) => {
  c.addEventListener("input", () => {
    updateReadouts();
    applyControlsLive();
  });
});
document.getElementById("startBtn").addEventListener("click", () => setPaused(false));
document.getElementById("stopBtn").addEventListener("click", () => setPaused(true));
document.getElementById("restartBtn").addEventListener("click", resetReplay);
document.querySelectorAll(".speed-selector button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.speed = Number(btn.dataset.speed) || 1;
    document.querySelectorAll(".speed-selector button").forEach((b) => b.classList.remove("active-control"));
    btn.classList.add("active-control");
  });
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPaused(true);
});

window.PATC = { state, junctions, routes, resetReplay, step, render };

updateReadouts();
resetReplay();
if (!window.__patcLoopRunning) {
  window.__patcLoopRunning = true;
  requestAnimationFrame((ts) => {
    state.lastTs = ts;
    requestAnimationFrame(frame);
  });
}
