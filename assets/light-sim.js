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
  frameIndex: 0,
  lastTs: 0,
  resetHandle: null,
  recommendation: "Collecting replay state",
};
const modeCopy = {
  patc: {
    label: "PATC shadow",
    effect: "Corridor coordination",
    overlay: "All controlled approaches coordinated",
  },
  fixed: {
    label: "Fixed-time baseline",
    effect: "Rigid timing",
    overlay: "Fixed cycle ignores sector pressure",
  },
};
const STOP_LINE_OFFSET = 56;
const FIELD_STOP_OFFSET = 36;
const CONTROL_NODE_RADIUS = 80;
const CROSSING_CLEAR_TIME = 1.15;
const FIXED_CONFLICT_LOOKAHEAD = 3.2;
const ENTRY_RESERVATION_MARGIN = 0.012;
const FIXED_APPROACH_STOP_ZONE = 0.034;
const FIXED_DWELL_BASE = 0.62;
const MIN_VEHICLE_GAP = 0.04;
const ROUTE_PRIORITY = ["east", "west", "feeder", "south", "north"];
const CANVAS_LAYOUT = {
  width: 1700,
  height: 860,
  scaleX: 1.02,
  scaleY: 1.04,
  offsetX: 70,
  offsetY: 30,
};
ensureSimulationStyles();
configureCanvas();
applySimulationGeometry();
function vehicleTargetCount() {
  return 16;
}
function ensureSimulationStyles() {
  if (document.querySelector('link[href$="simulation.css"]')) return;
  const scriptUrl = document.currentScript ? document.currentScript.src : "";
  const href = scriptUrl ? new URL("simulation.css", scriptUrl).href : "assets/simulation.css";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
function configureCanvas() {
  canvas.width = CANVAS_LAYOUT.width;
  canvas.height = CANVAS_LAYOUT.height;
}
function applySimulationGeometry() {
  if (globalThis.__patcGeometryApplied) return;
  /* Always widen the V-junction first, then transform to canvas coordinates */
  widenFeederSourceGeometry();
  transformSimulationGeometry();
  globalThis.__patcGeometryApplied = true;
}
function usesExpandedSourceGeometry() {
  const extent = routeExtent();
  return extent.maxX > 1300 || extent.maxY > 720;
}
function routeExtent() {
  return Object.values(routes).flatMap((route) => route.points).reduce((extent, point) => ({
    maxX: Math.max(extent.maxX, point[0]),
    maxY: Math.max(extent.maxY, point[1]),
  }), { maxX: 0, maxY: 0 });
}
function widenExpandedFeederGeometry() {
  /* No longer used — unified path handles everything */
}
function moveGridBackedNode(node, x, y) {
  replaceGridPoint(node.x, node.y, x, y);
  node.x = x;
  node.y = y;
}
function widenFeederSourceGeometry() {
  /* Widen the V-junction: push F3 north-east, F4 south-west */
  moveSupportNode("F3", 700, 32);
  moveSupportNode("F4", 440, 770);
  replaceGridPoint(640, 48, 700, 32);
  replaceGridPoint(500, 748, 440, 770);
  /* Spread south/north routes for wider V */
  routes.south.points = [[720, 10], [660, 140], [570, 365], [480, 780]];
  routes.north.points = [[420, 780], [500, 540], [570, 365], [480, 22]];
  routes.feeder.points = [[88, 666], [420, 575], [570, 365], [930, 130], [1560, 70]];
}
function moveSupportNode(id, x, y) {
  const node = supportNodes.find((item) => item.id === id);
  if (!node) return;
  node.x = x;
  node.y = y;
}
function replaceGridPoint(fromX, fromY, toX, toY) {
  gridLinks.forEach((points) => {
    points.forEach((point) => {
      if (point[0] !== fromX || point[1] !== fromY) return;
      point[0] = toX;
      point[1] = toY;
    });
  });
}
function transformSimulationGeometry() {
  [...junctions, ...supportNodes, ...sensorSites].forEach(transformNode);
  gridLinks.forEach((points) => points.forEach(transformPoint));
  cityBlocks.forEach(transformRect);
  Object.values(routes).forEach((route) => route.points.forEach(transformPoint));
}
function transformNode(node) {
  const [x, y] = layoutPoint(node.x, node.y);
  node.x = x;
  node.y = y;
}
function transformPoint(point) {
  const [x, y] = layoutPoint(point[0], point[1]);
  point[0] = x;
  point[1] = y;
}
function transformRect(rect) {
  const [x, y] = layoutPoint(rect[0], rect[1]);
  rect[0] = x;
  rect[1] = y;
  rect[2] = Math.round(rect[2] * CANVAS_LAYOUT.scaleX);
  rect[3] = Math.round(rect[3] * CANVAS_LAYOUT.scaleY);
}
function layoutPoint(x, y) {
  return [
    Math.round(x * CANVAS_LAYOUT.scaleX + CANVAS_LAYOUT.offsetX),
    Math.round(y * CANVAS_LAYOUT.scaleY + CANVAS_LAYOUT.offsetY),
  ];
}
function controlledNodes() {
  return [...junctions, ...coordinatedNodes()];
}
function isFieldNode(node) {
  return node.id.startsWith("F") || node.id.startsWith("S");
}
function isFixedMode() {
  return state.mode === "fixed";
}
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
function nodeProgress(route, node) {
  let covered = 0;
  const total = routeLength(route);
  let best = { distance: Infinity, progress: null };
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = nearestSegmentT(a, b, node);
    const x = lerp(a[0], b[0], t);
    const y = lerp(a[1], b[1], t);
    const distance = Math.hypot(x - node.x, y - node.y);
    if (distance < best.distance) best = { distance, progress: (covered + seg * t) / total };
    covered += seg;
  }
  return best.distance <= CONTROL_NODE_RADIUS ? best.progress : null;
}
function nearestSegmentT(a, b, node) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return 0;
  const t = ((node.x - a[0]) * dx + (node.y - a[1]) * dy) / lengthSq;
  return Math.max(0, Math.min(1, t));
}
function progressForNode(route, node, offset) {
  const centerP = nodeProgress(route, node);
  if (centerP === null) return null;
  return Math.max(0, centerP - offset / route.length);
}
function progressForJunction(route, junctionId) {
  const node = junctions.find((item) => item.id === junctionId);
  const progress = progressForNode(route, node, STOP_LINE_OFFSET);
  if (progress !== null) return progress;
  throw new Error(`Route stop ${junctionId} is not on its declared geometry.`);
}
function controlPoint(routeKey, route, node, kind, offset) {
  const centerP = nodeProgress(route, node);
  if (centerP === null) return null;
  const lineOffset = stopOffsetForControl(routeKey, node, kind, offset);
  return {
    id: node.id,
    p: Math.max(0, centerP - lineOffset / route.length),
    centerP,
    kind,
    group: movementGroup(routeKey, node.id),
  };
}
function syntheticControlPoint(routeKey, route, node) {
  const progress = syntheticEdgeProgress(routeKey);
  return {
    id: node.id,
    p: Math.max(0, progress - FIELD_STOP_OFFSET / route.length),
    centerP: progress,
    kind: "field",
    group: movementGroup(routeKey, node.id),
  };
}
function syntheticEdgeProgress(routeKey) {
  if (routeKey === "east") return 0.08;
  if (routeKey === "west") return 0.14;
  return 0;
}
function stopOffsetForControl(routeKey, node, kind, fallback) {
  if (kind !== "junction" || node.id !== "J2") return fallback;
  if (routeKey === "feeder") return 142;
  if (routeKey === "south" || routeKey === "north") return 78;
  return 58;
}
function edgeControlNodes(routeKey) {
  if (routeKey === "east") return [supportNodes.find((node) => node.id === "F1")].filter(Boolean);
  if (routeKey === "west") return [supportNodes.find((node) => node.id === "F6")].filter(Boolean);
  return [];
}
function controlPointsForRoute(route) {
  const routeKey = Object.entries(routes).find(([, item]) => item === route)[0];
  const points = route.stops
    .map((id) => junctions.find((node) => node.id === id))
    .map((node) => controlPoint(routeKey, route, node, "junction", STOP_LINE_OFFSET));
  edgeControlNodes(routeKey).forEach((node) => {
    points.push(controlPoint(routeKey, route, node, "field", FIELD_STOP_OFFSET) || syntheticControlPoint(routeKey, route, node));
  });
  coordinatedNodes().forEach((node) => {
    const point = controlPoint(routeKey, route, node, "field", FIELD_STOP_OFFSET);
    if (point) points.push(point);
  });
  return points.filter(Boolean).sort((a, b) => a.p - b.p).filter((point, index, list) => {
    const duplicate = list.findIndex((item) => item.id === point.id) !== index;
    return !duplicate;
  });
}
function movementGroup(routeKey, nodeId) {
  if (routeKey === "east" || routeKey === "west") return `${nodeId}:EW_MAIN`;
  if (routeKey === "south" || routeKey === "north") return `${nodeId}:NS_MAIN`;
  return `${nodeId}:FEEDER_DIAGONAL`;
}
Object.values(routes).forEach((route) => {
  route.length = routeLength(route);
  route.stopProgress = route.stops.map((id) => ({ id, p: progressForJunction(route, id) }));
  route.controlPoints = controlPointsForRoute(route);
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
  const kind = index % 5 === 0 || index % 7 === 0 ? "bike" : "car";
  const demandSpacing = Math.max(0.82, 1.72 - controlValue("demand") * 0.32);
  return {
    id: state.nextId++,
    kind,
    routeKey: key,
    route: routes[key],
    lane: laneForRoute(key, index),
    progress: 0,
    delay: index * scenario.spacing * demandSpacing,
    speed: (kind === "bike" ? 0.041 : 0.035) + (index % 4) * 0.004,
    wait: 0,
    delayCost: 0,
    stops: 0,
    fixedWaits: {},
    fixedReleased: {},
    complete: false,
    blocked: false,
    blockReason: "",
    visualPose: null,
  };
}
function laneForRoute(key, index) {
  if (key === "south") return 1;
  if (key === "north") return 1;
  return index % 2;
}
function resetReplay() {
  const scenario = currentScenario();
  controlledNodes().forEach((node, i) => {
    if (isFixedMode() && !isFieldNode(node)) {
      node.phase = i === 0 ? "EW" : "NS";
      node.timer = i * 0.8;
      node.groupCursor = {};
      assignFixedGroup(node, node.phase, false);
      return;
    }
    if (isFixedMode()) {
      node.phase = "OBS";
      node.timer = i * 0.35;
      node.activeGroup = null;
      return;
    }
    node.phase = scenario.primaryPhase === "NS" && node.id === "J2" ? "NS" : "EW";
    node.timer = i * 0.45;
    node.activeGroup = null;
  });
  state.nextId = 1;
  state.vehicles = Array.from({ length: vehicleTargetCount() }, (_, index) => createVehicle(index));
  setPaused(false);
  updateScenarioText();
}
function scheduleReset() {
  clearTimeout(state.resetHandle);
  state.resetHandle = setTimeout(resetReplay, 220);
}
function updateScenarioText() {
  document.getElementById("scenarioTitle").textContent = currentScenario().title;
  const scenarioCopy = document.getElementById("scenarioCopy");
  if (scenarioCopy) scenarioCopy.textContent = currentScenario().copy;
}
function nextStop(vehicle) {
  return vehicle.route.stopProgress.find((stop) => stop.p > vehicle.progress + 0.0005);
}
function nextControlPoint(vehicle) {
  return vehicle.route.controlPoints.find((point) => {
    const notCleared = vehicle.progress <= point.centerP + clearProgress(vehicle);
    const notMissed = point.p > vehicle.progress - 0.0005;
    return notCleared && notMissed;
  });
}
function controlPointForVehicle(vehicle, id) {
  return vehicle.route.controlPoints.find((point) => {
    return point.id === id && vehicle.progress < point.centerP + clearProgress(vehicle);
  });
}
function nodeById(id) {
  return controlledNodes().find((node) => node.id === id);
}
function controlPhase(point) {
  return point.group.includes(":NS") ? "NS" : "EW";
}
function groupsForNodePhase(nodeId, phase) {
  const groups = new Set();
  Object.values(routes).forEach((route) => {
    route.controlPoints.forEach((point) => {
      if (point.id === nodeId && route.phase === phase) groups.add(point.group);
    });
  });
  return [...groups];
}
function fixedGroupAllowed(node, point) {
  if (!isFixedMode() || isFieldNode(node) || node.phase === "OBS") return true;
  if (node.phase !== controlPhase(point)) return false;
  const groups = groupsForNodePhase(node.id, node.phase);
  if (groups.length <= 1) return true;
  if (!node.activeGroup || !groups.includes(node.activeGroup)) assignFixedGroup(node, node.phase, false);
  return node.activeGroup === point.group;
}
function assignFixedGroup(node, phase, rotate) {
  const groups = groupsForNodePhase(node.id, phase);
  if (groups.length === 0) {
    node.activeGroup = null;
    return;
  }
  node.groupCursor = node.groupCursor || {};
  const current = node.groupCursor[phase] || 0;
  node.groupCursor[phase] = rotate ? (current + 1) % groups.length : current;
  node.activeGroup = groups[node.groupCursor[phase]];
}
function pressure(junctionId, phase) {
  return state.vehicles.reduce((total, vehicle) => {
    if (vehicle.complete || vehicle.delay > 0 || vehicle.route.phase !== phase) return total;
    const stop = nextStop(vehicle);
    if (!stop || stop.id !== junctionId) return total;
    const distance = Math.max(0, stop.p - vehicle.progress);
    return total + Math.max(0, 1.4 - distance * 13) + vehicle.wait * 0.18;
  }, fieldNodePressure(junctionId, phase));
}
function fieldNodePressure(junctionId, phase) {
  if (isFixedMode()) return 0;
  return coordinatedNodes().reduce((total, node) => {
    if (closestJunction(node).id !== junctionId) return total;
    return total + state.vehicles.reduce((nodeTotal, vehicle) => {
      if (vehicle.complete || vehicle.delay > 0 || vehicle.route.phase !== phase) return nodeTotal;
      const pose = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
      const distance = Math.hypot(pose.x - node.x, pose.y - node.y);
      return distance < 126 ? nodeTotal + (1.05 - distance / 140) : nodeTotal;
    }, 0);
  }, 0);
}
function coordinatedNodes() {
  return [...supportNodes, ...sensorSites];
}
function localNodePressure(node, phase) {
  return state.vehicles.reduce((total, vehicle) => {
    if (vehicle.complete || vehicle.delay > 0 || vehicle.route.phase !== phase) return total;
    const pose = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
    const distance = Math.hypot(pose.x - node.x, pose.y - node.y);
    return distance < 128 ? total + Math.max(0, 1.15 - distance / 120) + vehicle.wait * 0.08 : total;
  }, 0);
}
function arrivalPressure(junctionId, phase) {
  return state.vehicles.reduce((total, vehicle) => {
    if (vehicle.complete || vehicle.delay > 0 || vehicle.route.phase !== phase) return total;
    const stop = nextStop(vehicle);
    if (!stop || stop.id !== junctionId) return total;
    const distance = Math.max(0, stop.p - vehicle.progress);
    return total + Math.max(0, 1.25 - distance * 4.8);
  }, 0);
}
function updateSignals(dt) {
  controlledNodes().forEach((node) => updateControlledNode(node, dt));
}
function updateControlledNode(node, dt) {
  node.timer += dt;
  if (isFieldNode(node)) {
    updateFieldNode(node);
    return;
  }
  updateJunctionNode(node);
}
function updateFieldNode(node) {
  if (isFixedMode()) {
    node.phase = "OBS";
    return;
  }
  const nearest = closestJunction(node);
  const ew = pressure(nearest.id, "EW") * 0.18 + localNodePressure(node, "EW");
  const ns = pressure(nearest.id, "NS") * 0.18 + localNodePressure(node, "NS");
  const target = ew >= ns ? "EW" : "NS";
  if (target !== node.phase && node.timer > Math.min(4.2, 2.6 * controlValue("safety"))) {
    node.phase = target;
    node.timer = 0;
  }
}
function updateJunctionNode(junction) {
  if (!isFixedMode() && junction.id !== "J2") {
    junction.phase = "EW";
    return;
  }
  const downstreamRisk = downstreamPenalty(junction.id);
  const ewLive = pressure(junction.id, "EW");
  const nsLive = pressure(junction.id, "NS");
  const ewDemand = ewLive + arrivalPressure(junction.id, "EW");
  const nsDemand = nsLive + arrivalPressure(junction.id, "NS");
  const ewBias = currentScenario().primaryPhase === "EW" ? 1.1 : 1;
  const nsBias = currentScenario().primaryPhase === "NS" && junction.id === "J2" ? 1.35 : 1;
  const ew = isFixedMode() ? ewLive : Math.max(0, ewDemand * ewBias - downstreamRisk * 0.1);
  const ns = isFixedMode() ? nsLive : nsDemand * nsBias;
  const minGreen = isFixedMode() ? 4.0 * controlValue("safety") : Math.min(4.8, 3.2 * controlValue("safety"));
  const maxGreen = isFixedMode() ? 10.8 : 11.8;
  const target = ew >= ns ? "EW" : "NS";
  const urgent = Math.max(ew, ns) > Math.min(ew, ns) * 1.06 + 0.55;
  const shouldPatcSwitch = !isFixedMode() && target !== junction.phase && urgent && junction.timer > minGreen;
  const shouldFixedSwitch = isFixedMode() && junction.timer > 10.2;
  const shouldPatcMaxSwitch = !isFixedMode() && target !== junction.phase && junction.timer > maxGreen;
  const shouldMaxSwitch = isFixedMode() && junction.timer > maxGreen;
  if ((shouldPatcSwitch || shouldPatcMaxSwitch || shouldFixedSwitch || shouldMaxSwitch) && junctionOccupied(junction.id)) return;
  if (shouldPatcSwitch || shouldPatcMaxSwitch) {
    junction.phase = target;
    junction.timer = 0;
    return;
  }
  if (shouldFixedSwitch || shouldMaxSwitch) {
    junction.phase = junction.phase === "EW" ? "NS" : "EW";
    assignFixedGroup(junction, junction.phase, true);
    junction.timer = 0;
  }
}
function downstreamPenalty(junctionId) {
  const order = ["J1", "J2", "J3", "J4"];
  const index = order.indexOf(junctionId);
  if (index < 0 || index > 2) return 0;
  const next = order[index + 1];
  return pressure(next, "EW") * 0.34 * currentScenario().downstream;
}
function blockedBySignal(vehicle, projected) {
  const point = nextControlPoint(vehicle);
  if (!point || projected < point.p) return false;
  if (inControlWindow(vehicle, point)) return false;
  const node = nodeById(point.id);
  if (!node || !isFixedMode()) return false;
  return !fixedGroupAllowed(node, point);
}
function leaderInfo(vehicle, projected) {
  return state.vehicles.reduce((closest, other) => {
    if (other === vehicle || other.complete || other.delay > 0) return closest;
    if (other.routeKey !== vehicle.routeKey || other.lane !== vehicle.lane) return closest;
    const gap = other.progress - projected;
    if (gap <= 0 || gap >= closest.gap) return closest;
    return { gap, vehicle: other };
  }, { gap: 1, vehicle: null });
}
function queueSpacingBlocked(vehicle, leader) {
  if (!leader || leader.gap >= MIN_VEHICLE_GAP) return false;
  return distanceToStop(vehicle) < 0.18;
}
function followingProgress(vehicle, projected, leader) {
  if (!leader.vehicle || leader.gap >= MIN_VEHICLE_GAP) return projected;
  return Math.max(vehicle.progress, Math.min(projected, leader.vehicle.progress - MIN_VEHICLE_GAP));
}
function distanceToStop(vehicle) {
  const point = nextControlPoint(vehicle);
  return point ? point.p - vehicle.progress : 1;
}
function physicalConflict(vehicle, projected) {
  const point = nextControlPoint(vehicle);
  if (!point) return false;
  const pose = pointAt(vehicle.route, projected, vehicle.lane);
  const node = nodeById(point.id);
  const currentPose = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
  const nearStop = Math.hypot(pose.x - node.x, pose.y - node.y) <= 58;
  return state.vehicles.some((other) => {
    if (other === vehicle || other.complete || other.delay > 0) return false;
    const otherPoint = controlPointForVehicle(other, point.id);
    if (!otherPoint || !controlsConflict(point, otherPoint)) return false;
    const otherPose = pointAt(other.route, other.progress, other.lane);
    const currentGap = Math.hypot(currentPose.x - otherPose.x, currentPose.y - otherPose.y);
    const projectedGap = Math.hypot(pose.x - otherPose.x, pose.y - otherPose.y);
    const occupiedJunction = nearStop && hasEnteredNode(other, point.id) && projectedGap < 38;
    return occupiedJunction && projectedGap < currentGap;
  });
}
function junctionEntryConflict(vehicle, projected) {
  const point = nextControlPoint(vehicle);
  if (!point || projected < point.p - 0.006) return false;
  const pose = pointAt(vehicle.route, projected, vehicle.lane);
  return state.vehicles.some((other) => {
    if (other === vehicle || other.complete || other.delay > 0 || other.routeKey === vehicle.routeKey) return false;
    const otherPoint = controlPointForVehicle(other, point.id);
    if (!otherPoint || !controlsConflict(point, otherPoint) || !hasEnteredNode(other, point.id)) return false;
    const otherPose = pointAt(other.route, other.progress, other.lane);
    return Math.hypot(pose.x - otherPose.x, pose.y - otherPose.y) < 46;
  });
}
function crossingConflict(vehicle, projected) {
  const point = nextControlPoint(vehicle);
  if (!point || projected < point.p - 0.006) return false;
  if (inControlWindow(vehicle, point)) return false;
  return state.vehicles.some((other) => {
    if (other === vehicle || other.complete || other.delay > 0) return false;
    const otherPoint = controlPointForVehicle(other, point.id);
    if (!otherPoint || !controlsConflict(point, otherPoint)) return false;
    if (isFixedMode()) return fixedConflictAhead(point, other, otherPoint);
    return !canReserveAhead(vehicle, point, other, otherPoint);
  });
}
function controlsConflict(point, otherPoint) {
  if (point.kind === "field" || otherPoint.kind === "field") return false;
  return point.id === otherPoint.id && point.group !== otherPoint.group;
}
function fixedConflictAhead(point, other, otherPoint) {
  return inControlWindow(other, otherPoint) && etaToControl(other, otherPoint) < FIXED_CONFLICT_LOOKAHEAD;
}
function fixedDwellBlocked(vehicle, projected, dt) {
  if (!isFixedMode()) return false;
  const point = nextControlPoint(vehicle);
  if (!point || point.kind !== "junction") return false;
  const key = controlKey(point);
  if (vehicle.fixedReleased[key]) return false;
  if (projected < point.p - FIXED_APPROACH_STOP_ZONE) return false;
  vehicle.fixedWaits[key] = (vehicle.fixedWaits[key] || 0) + dt;
  if (vehicle.fixedWaits[key] >= fixedDwellDuration(vehicle)) {
    vehicle.fixedReleased[key] = true;
    return false;
  }
  return true;
}
function fixedDwellDuration(vehicle) {
  return FIXED_DWELL_BASE + (vehicle.id % 4) * 0.16;
}
function controlKey(point) {
  return `${point.id}:${point.group}`;
}
function canReserveAhead(vehicle, point, other, otherPoint) {
  if (inControlWindow(other, otherPoint)) return false;
  if (hasEnteredNode(other, point.id)) return false;
  const selfEntry = etaToControl(vehicle, point);
  const selfClear = selfEntry + clearDuration(vehicle, point);
  const otherEntry = etaToControl(other, otherPoint);
  const otherClear = otherEntry + clearDuration(other, otherPoint);
  const buffer = 0.16 + controlValue("safety") * 0.44;
  if (selfClear + buffer < otherEntry) return true;
  if (otherClear + buffer < selfEntry) return false;
  const tieWindow = 0.38 + controlValue("safety") * 0.24;
  if (Math.abs(selfEntry - otherEntry) <= tieWindow) {
    const selfPriority = routePriority(vehicle.routeKey);
    const otherPriority = routePriority(other.routeKey);
    return selfPriority < otherPriority || (selfPriority === otherPriority && vehicle.id < other.id);
  }
  return selfEntry < otherEntry;
}
function routePriority(routeKey) {
  const index = ROUTE_PRIORITY.indexOf(routeKey);
  return index === -1 ? ROUTE_PRIORITY.length : index;
}
function etaToControl(vehicle, point) {
  const velocity = Math.max(0.004, vehicle.speed * controlValue("discharge"));
  return Math.max(0, (point.p - vehicle.progress) / velocity);
}
function clearDuration(vehicle, point) {
  const velocity = Math.max(0.004, vehicle.speed * controlValue("discharge"));
  return Math.max(0.2, (point.centerP + clearProgress(vehicle) - point.p) / velocity);
}
function clearProgress(vehicle) {
  return (vehicle.kind === "bike" ? 30 : 40) / vehicle.route.length;
}
function inControlWindow(vehicle, point) {
  const entered = vehicle.progress >= point.p;
  const cleared = vehicle.progress > point.centerP + clearProgress(vehicle);
  return entered && !cleared;
}
function insideAnyControlWindow(vehicle) {
  return vehicle.route.controlPoints.some((point) => inControlWindow(vehicle, point));
}
function vehicleClearance(a, b) {
  if (a.kind === "bike" && b.kind === "bike") return 22;
  if (a.kind === "bike" || b.kind === "bike") return 26;
  return 30;
}
function vehicleDimensions(vehicle) {
  return vehicle.kind === "bike" ? { length: 12, width: 3 } : { length: 16, width: 7 };
}
function bodyConflict(vehicle, projected) {
  const pose = pointAt(vehicle.route, projected, vehicle.lane);
  return state.vehicles.some((other) => {
    if (other === vehicle || other.complete || other.delay > 0) return false;
    if (other.routeKey === vehicle.routeKey && other.lane === vehicle.lane) return false;
    const otherPose = pointAt(other.route, other.progress, other.lane);
    return bodyOverlap(pose, vehicleDimensions(vehicle), otherPose, vehicleDimensions(other));
  });
}
function bodyOverlap(aPose, aDims, bPose, bDims) {
  const a = bodyCorners(aPose, aDims);
  const b = bodyCorners(bPose, bDims);
  return ![edgeAxis(a[0], a[1]), edgeAxis(a[1], a[2]), edgeAxis(b[0], b[1]), edgeAxis(b[1], b[2])]
    .some((axis) => separatedOnAxis(axis, a, b));
}
function bodyCorners(pose, dims) {
  const ux = { x: Math.cos(pose.angle), y: Math.sin(pose.angle) };
  const uy = { x: -Math.sin(pose.angle), y: Math.cos(pose.angle) };
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sx, sy]) => ({
    x: pose.x + ux.x * dims.length * 0.5 * sx + uy.x * dims.width * 0.5 * sy,
    y: pose.y + ux.y * dims.length * 0.5 * sx + uy.y * dims.width * 0.5 * sy,
  }));
}
function edgeAxis(a, b) {
  const x = b.x - a.x;
  const y = b.y - a.y;
  const length = Math.hypot(x, y) || 1;
  return { x: -y / length, y: x / length };
}
function separatedOnAxis(axis, aCorners, bCorners) {
  const a = projectBody(axis, aCorners);
  const b = projectBody(axis, bCorners);
  return a.max < b.min || b.max < a.min;
}
function projectBody(axis, corners) {
  return corners.reduce((range, point) => {
    const value = point.x * axis.x + point.y * axis.y;
    return { min: Math.min(range.min, value), max: Math.max(range.max, value) };
  }, { min: Infinity, max: -Infinity });
}
function junctionOccupied(junctionId) {
  return state.vehicles.some((vehicle) => !vehicle.complete && vehicle.delay <= 0 && hasEnteredNode(vehicle, junctionId));
}
function hasEnteredNode(vehicle, nodeId) {
  const point = vehicle.route.controlPoints.find((item) => item.id === nodeId);
  return point ? inControlWindow(vehicle, point) : false;
}
function setPaused(value) {
  state.paused = value;
  document.getElementById("startBtn").classList.toggle("active-control", !value);
  document.getElementById("stopBtn").classList.toggle("active-control", value);
}
function updateVehicle(vehicle, dt) {
  if (vehicle.complete) return;
  if (vehicle.delay > 0) {
    vehicle.delay -= dt;
    return;
  }
  const startup = startupFactor(vehicle);
  const velocity = vehicle.speed * controlValue("discharge") * startup;
  const projected = Math.min(1, vehicle.progress + velocity * dt);
  const signalBlocked = blockedBySignal(vehicle, projected);
  const dwellBlocked = fixedDwellBlocked(vehicle, projected, dt);
  const conflictBlocked = isFixedMode() && (
    crossingConflict(vehicle, projected) || junctionEntryConflict(vehicle, projected) || physicalConflict(vehicle, projected)
  );
  const leader = leaderInfo(vehicle, projected);
  const spacingBlocked = queueSpacingBlocked(vehicle, leader);
  const canClearPatcWindow = !isFixedMode() && insideAnyControlWindow(vehicle);
  const bodyBlocked = !spacingBlocked && !canClearPatcWindow && !(!isFixedMode() && distanceToStop(vehicle) < 0.10) && bodyConflict(vehicle, projected);
  const blocked = signalBlocked || dwellBlocked || conflictBlocked || spacingBlocked || bodyBlocked;
  const fixedSignalHold = isFixedMode() && conflictBlocked && distanceToStop(vehicle) < 0.16;
  vehicle.blocked = blocked;
  vehicle.blockReason = signalBlocked || dwellBlocked || fixedSignalHold ? "signal" : conflictBlocked || bodyBlocked ? "conflict" : spacingBlocked ? "spacing" : "";
  if (blocked) {
    if (signalBlocked || dwellBlocked || conflictBlocked) holdBeforeControl(vehicle, projected);
    if (signalBlocked || dwellBlocked || conflictBlocked || distanceToStop(vehicle) < 0.14) {
      vehicle.wait += dt;
      vehicle.delayCost += dt;
      if (vehicle.wait - vehicle.stops > 1) vehicle.stops += 1;
    }
    /* Deadlock breaker: if a vehicle has been stuck for too long, force-release it */
    if (vehicle.wait > 8) {
      vehicle.blocked = false;
      vehicle.blockReason = "";
      vehicle.wait = 0;
      vehicle.progress = Math.min(1, vehicle.progress + vehicle.speed * 0.012);
    }
    return;
  }
  vehicle.delayCost += (1 - startup) * dt;
  vehicle.progress = followingProgress(vehicle, projected, leader);
  if (vehicle.progress >= 1) {
    vehicle.progress = 1;
    vehicle.complete = true;
  }
}
function holdBeforeControl(vehicle, projected) {
  const point = nextControlPoint(vehicle);
  if (!point) return;
  if (inControlWindow(vehicle, point)) return;
  const margin = point.kind === "junction" ? ENTRY_RESERVATION_MARGIN + 0.002 : 0.002;
  const holdP = holdProgress(vehicle, point, margin, projected);
  vehicle.progress = Math.max(vehicle.progress, holdP);
}
function holdProgress(vehicle, point, margin, projected) {
  return Math.max(0, Math.max(vehicle.progress, Math.min(projected, point.p - margin)));
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
  if (state.vehicles.every((vehicle) => vehicle.complete)) {
    state.recommendation = "Replay complete";
    return;
  }
  const ranked = pressureRanked();
  const top = ranked[0];
  const phase = top.ew >= top.ns ? "EW" : "NS";
  if (isFixedMode()) {
    state.recommendation = `${top.j.id}: fixed cycle, ${phase} queue`;
    return;
  }
  const risk = downstreamPenalty(top.j.id) > 1.6 ? "protect downstream gap" : `${phase === top.j.phase ? "hold" : "prepare"} ${phase}`;
  state.recommendation = `${top.j.id}: ${risk}; F/S mesh synced`;
}
function pressureRanked() {
  const ranked = junctions.map((j) => ({ j, ew: pressure(j.id, "EW"), ns: pressure(j.id, "NS") }));
  ranked.sort((a, b) => Math.max(b.ew, b.ns) - Math.max(a.ew, a.ns));
  return ranked;
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
function drawBlocks() {
  cityBlocks.forEach(([x, y, width, height], index) => {
    ctx.fillStyle = index % 2 === 0 ? "#081016" : "#0a141b";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "rgba(128,167,189,0.12)";
    ctx.strokeRect(x, y, width, height);
  });
}
function drawLaneDash(points, color) {
  ctx.save();
  ctx.setLineDash([12, 15]);
  ctx.lineDashOffset = -state.frameIndex * 0.5;
  drawPath(points, 2, color);
  ctx.restore();
}
function drawRoads() {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBlocks();
  gridLinks.forEach((points) => drawPath(points, 42, "#0f2230"));
  drawFeederCrossroads();
  Object.values(routes).forEach((route) => drawPath(route.points, 64, colors.road));
  gridLinks.forEach((points) => drawLaneDash(points, "rgba(244,247,242,0.10)"));
  Object.values(routes).forEach((route) => drawLaneDash(route.points, colors.lane));
}
function drawFeederCrossroads() {
  const road = "#123040";
  const f3 = nodeById("F3");
  const f4 = nodeById("F4");
  const j2 = nodeById("J2");
  if (!f3 || !f4 || !j2) return;
  drawPath([offsetPoint(f3, -210, 78), offsetPoint(f3, 0, 22), offsetPoint(f3, 280, 66)], 62, road);
  drawPath([offsetPoint(f3, -38, -58), offsetPoint(f3, 0, 22), midPoint(f3, j2, 0.48)], 54, road);
  drawPath([offsetPoint(f4, -220, -62), offsetPoint(f4, 0, -24), offsetPoint(f4, 285, -104)], 62, road);
  drawPath([midPoint(f4, j2, 0.48), offsetPoint(f4, 0, -24), offsetPoint(f4, -38, 62)], 54, road);
}
function offsetPoint(node, dx, dy) {
  return [node.x + dx, node.y + dy];
}
function midPoint(a, b, t) {
  return [lerp(a.x, b.x, t), lerp(a.y, b.y, t)];
}
function drawSignals() {
  drawApproachSignals();
  supportNodes.forEach((node) => {
    drawFieldSignal(node, 10);
  });
  junctions.forEach((j) => {
    const color = j.phase === "EW" ? colors.amber : colors.cyan;
    ctx.fillStyle = "#071017";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(j.x, j.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(j.x, j.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.text;
    ctx.font = "700 13px sans-serif";
    ctx.fillText(j.id, j.x + 18, j.y - 12);
    ctx.fillStyle = colors.muted;
    ctx.font = "12px sans-serif";
    ctx.fillText(`${j.phase} ${j.timer.toFixed(0)}s`, j.x + 18, j.y + 6);
  });
  sensorSites.forEach((site) => {
    drawFieldSignal(site, 8);
  });
}
function drawApproachSignals() {
  Object.entries(routes).forEach(([routeKey, route]) => {
    route.controlPoints
      .filter((point) => point.kind === "junction")
      .forEach((point) => drawApproachSignal(routeKey, route, point));
  });
}
function drawApproachSignal(routeKey, route, point) {
  const pose = pointAt(route, point.p, routeKey === "south" || routeKey === "north" ? 1 : 0);
  const color = approachSignalColor(routeKey, point);
  const normal = { x: Math.cos(pose.angle + Math.PI / 2), y: Math.sin(pose.angle + Math.PI / 2) };
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.arc(pose.x + normal.x * 25, pose.y + normal.y * 25, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function approachSignalColor(routeKey, point) {
  const node = nodeById(point.id);
  if (!node) return colors.red;
  if (isFixedMode()) return fixedGroupAllowed(node, point) ? movementColor(routeKey) : colors.red;
  return node.phase === controlPhase(point) ? movementColor(routeKey) : colors.red;
}
function movementColor(routeKey) {
  if (routeKey === "south" || routeKey === "north") return colors.cyan;
  if (routeKey === "feeder") return routes.feeder.color;
  return colors.green;
}
function drawFieldSignal(node, radius) {
  const active = !isFixedMode();
  const color = !active ? "rgba(128,167,189,0.38)" : node.phase === "NS" ? colors.cyan : colors.green;
  ctx.fillStyle = "#0b151d";
  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? color : colors.muted;
  ctx.font = "700 10px sans-serif";
  ctx.fillText(node.id, node.x + radius + 4, node.y + 4);
  if (!active) return;
  ctx.fillStyle = colors.muted;
  ctx.font = "9px sans-serif";
  ctx.fillText(`${node.phase} ${node.timer.toFixed(0)}s`, node.x + radius + 4, node.y + 15);
}
function drawModeOverlay() {
  if (isFixedMode()) {
    drawFixedIssues();
    return;
  }
  drawPatcCoordination();
}
function drawPatcCoordination() {
  ctx.save();
  coordinatedNodes().forEach((node) => {
    const nearest = closestJunction(node);
    drawPath([[node.x, node.y], [nearest.x, nearest.y]], 1.2, "rgba(47,214,210,0.12)");
  });
  ctx.restore();
}
function badgeX(x) {
  return Math.min(Math.max(32, x), canvas.width - 420);
}
function badgeY(y) {
  return Math.min(Math.max(44, y), canvas.height - 44);
}
function closestJunction(node) {
  return junctions.reduce((best, junction) => {
    const distance = Math.hypot(node.x - junction.x, node.y - junction.y);
    return distance < best.distance ? { junction, distance } : best;
  }, { junction: junctions[0], distance: Infinity }).junction;
}
function drawFixedIssues() {
  const hotspots = pressureRanked().filter((item) => Math.max(item.ew, item.ns) > 2.4).slice(0, 3);
  if (hotspots.length === 0) {
    drawBadge(690, 92, "fixed cycle, no prediction", colors.amber);
    return;
  }
  hotspots.forEach(({ j, ew, ns }, index) => {
    const label = Math.max(ew, ns) > 8 ? "spillback risk" : "red-light queue";
    const pulse = 0.45 + Math.sin(state.frameIndex / 18 + index) * 0.15;
    ctx.fillStyle = `rgba(255,99,88,${pulse})`;
    ctx.strokeStyle = "rgba(255,177,42,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(j.x, j.y - 32);
    ctx.lineTo(j.x + 20, j.y + 4);
    ctx.lineTo(j.x - 20, j.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawBadge(j.x + 24, j.y - 36, label, colors.red);
  });
}
function drawBadge(x, y, label, color) {
  ctx.fillStyle = "rgba(5,7,10,0.82)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(118, label.length * 7.8), 28, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = "700 12px sans-serif";
  ctx.fillText(label, x + 10, y + 18);
}
function displayPose(vehicle, used) {
  const pose = vehicleVisualPose(vehicle);
  used.push({ ...pose, vehicle });
  return pose;
}
function vehicleVisualPose(vehicle) {
  const target = pointAt(vehicle.route, vehicle.progress, vehicle.lane);
  if (!vehicle.visualPose) {
    vehicle.visualPose = { ...target };
    return target;
  }
  const distance = Math.hypot(target.x - vehicle.visualPose.x, target.y - vehicle.visualPose.y);
  if (distance > 80) {
    vehicle.visualPose = { ...target };
    return target;
  }
  const alpha = vehicle.blocked ? 0.3 : 0.48;
  vehicle.visualPose.x = lerp(vehicle.visualPose.x, target.x, alpha);
  vehicle.visualPose.y = lerp(vehicle.visualPose.y, target.y, alpha);
  vehicle.visualPose.angle = smoothAngle(vehicle.visualPose.angle, target.angle, alpha);
  return vehicle.visualPose;
}
function smoothAngle(current, target, alpha) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
}
function drawVehicles() {
  const used = [];
  state.vehicles.forEach((vehicle) => {
    if (vehicle.complete || vehicle.delay > 0) return;
    const p = displayPose(vehicle, used);
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = vehicleColor(vehicle);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = vehicle.kind === "bike" ? 5 : 9;
    if (vehicle.kind === "bike") {
      ctx.fillRect(-6, -1.5, 12, 3);
      ctx.beginPath();
      ctx.arc(-4, 3, 2, 0, Math.PI * 2);
      ctx.arc(4, 3, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(-8, -3.5, 16, 7, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(5,7,10,0.42)";
      ctx.fillRect(1, -3, 4, 6);
    }
    ctx.restore();
  });
}
function vehicleColor(vehicle) {
  if (vehicle.blockReason === "conflict") return colors.red;
  if (vehicle.blockReason === "signal" && isFixedMode() && vehicle.wait > 2.8) return colors.red;
  if (vehicle.blockReason === "signal") return colors.amber;
  return vehicle.route.color;
}
function drawDashboardOverlay() {
  const complete = state.vehicles.filter((vehicle) => vehicle.complete).length;
  ctx.fillStyle = "rgba(5,7,10,0.72)";
  ctx.fillRect(24, 24, 356, 108);
  ctx.fillStyle = colors.text;
  ctx.font = "700 15px sans-serif";
  ctx.fillText(modeCopy[state.mode].label, 42, 54);
  ctx.fillStyle = colors.muted;
  ctx.font = "13px sans-serif";
  ctx.fillText(`${complete}/${state.vehicles.length} complete | ${modeCopy[state.mode].effect}`, 42, 80);
  ctx.fillText(state.recommendation, 42, 100);
  ctx.fillText(modeCopy[state.mode].overlay, 42, 120);
}
function completionPercent() {
  const done = state.vehicles.filter((vehicle) => vehicle.complete).length;
  if (done === state.vehicles.length) return 100;
  return Math.min(99, Math.floor((done / state.vehicles.length) * 100));
}
function updatePanel() {
  const active = state.vehicles.filter((vehicle) => !vehicle.complete && vehicle.delay <= 0).length;
  const avgDelay = state.vehicles.reduce((sum, vehicle) => sum + vehicle.delayCost, 0) / state.vehicles.length;
  const maxPressure = Math.max(...junctions.flatMap((j) => [pressure(j.id, "EW"), pressure(j.id, "NS")]));
  const breakdowns = severeStopCount();
  document.querySelector(".replay-shell").classList.toggle("fixed-mode", isFixedMode());
  document.getElementById("completionValue").textContent = `${completionPercent()}%`;
  document.getElementById("activeValue").textContent = `${active}/${state.vehicles.length}`;
  document.getElementById("delayValue").textContent = `${avgDelay.toFixed(1)}s`;
  document.getElementById("breakdownValue").textContent = `${breakdowns}`;
  document.getElementById("modeEffectValue").textContent = modeEffectText(avgDelay, breakdowns);
  document.getElementById("pressureValue").textContent = maxPressure > 8 ? "High" : maxPressure > 2.5 ? "Medium" : "Low";
  document.getElementById("recommendationValue").textContent = state.recommendation;
}
function severeStopCount() {
  const threshold = isFixedMode() ? 18 : 40;
  return state.vehicles.filter((vehicle) => vehicle.delayCost > threshold).length;
}
function modeEffectText(avgDelay, breakdowns) {
  if (state.vehicles.every((vehicle) => vehicle.complete)) {
    return isFixedMode() ? "Completed with higher delay" : "Clean replay";
  }
  if (breakdowns > 0) return isFixedMode() ? "Queue instability" : "Recovering queue";
  return modeCopy[state.mode].effect;
}
function startupFactor(vehicle) {
  if (!isFixedMode()) return 1;
  const point = nextControlPoint(vehicle);
  if (!point || point.p - vehicle.progress > 0.05) return 1;
  const junction = nodeById(point.id);
  if (!junction || isFieldNode(junction)) return 1;
  const startupWindow = isFixedMode() ? 4.0 : 0.8;
  const base = isFixedMode() ? 0.12 : 0.78;
  if (!fixedGroupAllowed(junction, point) || junction.timer > startupWindow) return 1;
  return base + (junction.timer / startupWindow) * (1 - base);
}
function render() {
  state.frameIndex += 1;
  drawRoads();
  drawSignals();
  drawVehicles();
  updatePanel();
}
function frame(ts) {
  if (state.lastTs && ts - state.lastTs < 22) {
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000 || 0.016) * state.speed * 3;
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
window.PATC = { state, resetReplay, step, render, completionPercent, pointAt, displayPose, controlledNodes, setPaused };
updateReadouts();
resetReplay();
requestAnimationFrame((ts) => {
  state.lastTs = ts;
  requestAnimationFrame(frame);
});
