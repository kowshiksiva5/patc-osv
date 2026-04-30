const colors = {
  bg: "#05070a",
  block: "#0a1116",
  road: "#172f3d",
  lane: "rgba(244,247,242,0.18)",
  text: "#f4f7f2",
  muted: "#9fb2b1",
  cyan: "#2fd6d2",
  amber: "#ffb12a",
  green: "#52d273",
  red: "#ff6358",
  blue: "#80a7bd",
};
const junctions = [
  { id: "J1", name: "HSR entry", x: 275, y: 338, phase: "EW", timer: 0 },
  { id: "J2", name: "Sector core", x: 500, y: 318, phase: "EW", timer: 1.5 },
  { id: "J3", name: "Downstream", x: 724, y: 294, phase: "NS", timer: 3.0 },
  { id: "J4", name: "Bommanahalli", x: 930, y: 268, phase: "EW", timer: 4.5 },
];
const supportNodes = [
  { id: "F1", name: "Service road merge", x: 180, y: 178 },
  { id: "F2", name: "Bus stop friction", x: 360, y: 500 },
  { id: "F3", name: "North feeder", x: 500, y: 120 },
  { id: "F4", name: "South feeder", x: 502, y: 520 },
  { id: "F5", name: "Exit queue watch", x: 760, y: 122 },
  { id: "F6", name: "Downstream merge", x: 890, y: 420 },
];
const sensorSites = [
  { id: "S1", x: 246, y: 300 },
  { id: "S2", x: 524, y: 268 },
  { id: "S3", x: 684, y: 352 },
  { id: "S4", x: 910, y: 220 },
];
const gridLinks = [
  [[40, 210], [180, 178], [360, 190], [500, 120], [760, 122], [1040, 92]],
  [[42, 500], [210, 458], [360, 500], [502, 520], [720, 492], [1045, 430]],
  [[180, 178], [275, 338], [360, 500]],
  [[500, 120], [500, 318], [502, 520]],
  [[760, 122], [724, 294], [890, 420]],
  [[930, 268], [890, 420], [1040, 520]],
];
const cityBlocks = [
  [74, 58, 146, 82],
  [240, 68, 178, 76],
  [584, 56, 126, 78],
  [826, 72, 150, 74],
  [78, 270, 130, 92],
  [340, 250, 98, 54],
  [566, 382, 118, 84],
  [824, 328, 148, 74],
  [188, 522, 118, 58],
  [770, 500, 174, 52],
];
const routes = {
  east: {
    phase: "EW",
    color: colors.amber,
    points: [[40, 365], [275, 338], [500, 318], [724, 294], [930, 268], [1050, 250]],
    stops: ["J1", "J2", "J3", "J4"],
  },
  west: {
    phase: "EW",
    color: colors.amber,
    points: [[1045, 298], [930, 318], [724, 342], [500, 366], [275, 386], [35, 414]],
    stops: ["J4", "J3", "J2", "J1"],
  },
  south: {
    phase: "NS",
    color: colors.cyan,
    laneShift: 42,
    points: [[515, 55], [500, 318], [482, 610]],
    stops: ["J2"],
  },
  north: {
    phase: "NS",
    color: colors.cyan,
    laneShift: -42,
    points: [[548, 615], [500, 318], [478, 55]],
    stops: ["J2"],
  },
  feeder: {
    phase: "EW",
    color: "#c6ec66",
    laneShift: -28,
    points: [[90, 565], [360, 500], [500, 318], [760, 122], [1040, 92]],
    stops: ["J2"],
  },
};
const scenarios = {
  peak: {
    title: "Peak spillback",
    copy: "Office traffic releases into a saturated downstream link.",
    bias: ["east", "east", "west", "feeder", "south"],
    downstream: 1.3,
    spacing: 0.58,
  },
  rain: {
    title: "Rain slowdown",
    copy: "Lower discharge and cautious starts make every green less efficient.",
    bias: ["south", "north", "east", "west", "south"],
    downstream: 1.0,
    spacing: 0.68,
  },
  event: {
    title: "Event surge",
    copy: "A short wave enters from one side and competes with residual queues.",
    bias: ["west", "west", "feeder", "east", "south"],
    downstream: 1.15,
    spacing: 0.48,
  },
  school: {
    title: "School release",
    copy: "Bursty demand arrives in pulses and should not starve cross traffic.",
    bias: ["south", "feeder", "north", "east", "feeder"],
    downstream: 0.95,
    spacing: 0.62,
  },
};
