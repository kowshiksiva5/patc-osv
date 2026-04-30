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
