const colors = {
  bg: "#03070b",
  block: "#08121a",
  road: "#183648",
  lane: "rgba(244,247,242,0.20)",
  text: "#f4f7f2",
  muted: "#9fb2b1",
  cyan: "#2fd6d2",
  amber: "#ffb12a",
  green: "#52d273",
  red: "#ff6358",
  blue: "#80a7bd",
};
const junctions = [
  { id: "J1", name: "HSR entry", x: 260, y: 402, phase: "EW", timer: 0 },
  { id: "J2", name: "Sector core", x: 570, y: 365, phase: "EW", timer: 1.5 },
  { id: "J3", name: "Downstream", x: 895, y: 326, phase: "NS", timer: 3.0 },
  { id: "J4", name: "Bommanahalli", x: 1215, y: 292, phase: "EW", timer: 4.5 },
];
const supportNodes = [
  { id: "F1", name: "Service road merge", x: 228, y: 176 },
  { id: "F2", name: "Bus stop friction", x: 420, y: 575 },
  { id: "F3", name: "North feeder", x: 610, y: 92 },
  { id: "F4", name: "South feeder", x: 530, y: 690 },
  { id: "F5", name: "Exit queue watch", x: 930, y: 130 },
  { id: "F6", name: "Downstream merge", x: 1160, y: 510 },
];
const sensorSites = [
  { id: "S1", x: 228, y: 350 },
  { id: "S2", x: 620, y: 305 },
  { id: "S3", x: 835, y: 400 },
  { id: "S4", x: 1190, y: 232 },
];
const gridLinks = [
  [[50, 230], [228, 176], [430, 200], [610, 92], [930, 130], [1535, 96]],
  [[54, 602], [250, 540], [420, 575], [530, 690], [890, 575], [1530, 500]],
  [[228, 176], [260, 402], [420, 575]],
  [[610, 92], [570, 365], [530, 690]],
  [[930, 130], [895, 326], [1160, 510]],
  [[1215, 292], [1160, 510], [1490, 620]],
];
const cityBlocks = [
  [74, 62, 146, 82],
  [286, 70, 190, 86],
  [706, 56, 140, 82],
  [1114, 76, 190, 80],
  [88, 290, 130, 94],
  [384, 286, 116, 62],
  [700, 438, 146, 86],
  [1088, 350, 170, 82],
  [194, 622, 132, 60],
  [1000, 610, 210, 58],
];
const routes = {
  east: {
    phase: "EW",
    color: colors.amber,
    points: [[42, 432], [260, 402], [570, 365], [895, 326], [1215, 292], [1560, 258]],
    stops: ["J1", "J2", "J3", "J4"],
  },
  west: {
    phase: "EW",
    color: colors.amber,
    points: [[1550, 338], [1215, 350], [895, 386], [570, 428], [260, 462], [36, 492]],
    stops: ["J4", "J3", "J2", "J1"],
  },
  south: {
    phase: "NS",
    color: colors.cyan,
    laneShift: 8,
    points: [[625, 20], [602, 178], [570, 365], [548, 742]],
    stops: ["J2"],
  },
  north: {
    phase: "NS",
    color: colors.cyan,
    laneShift: -24,
    points: [[500, 742], [534, 540], [570, 365], [515, 22]],
    stops: ["J2"],
  },
  feeder: {
    phase: "EW",
    color: "#c6ec66",
    laneShift: -8,
    points: [[88, 666], [420, 575], [570, 365], [930, 130], [1560, 70]],
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
    primaryPhase: "EW",
  },
  school: {
    title: "School release",
    copy: "Bursty demand arrives in pulses and should not starve cross traffic.",
    bias: ["south", "feeder", "north", "east", "feeder"],
    downstream: 0.95,
    spacing: 0.62,
    primaryPhase: "EW",
  },
};
