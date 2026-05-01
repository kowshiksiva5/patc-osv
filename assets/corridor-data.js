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

/* ── Junctions ────────────────────────────────────────────────────
   4 signal-controlled intersections along an east-west corridor.
   Y-values descend slightly left→right to model a gentle grade. */
const junctions = [
  { id: "J1", name: "HSR entry",     x: 260,  y: 400, phase: "EW", timer: 0 },
  { id: "J2", name: "Sector core",   x: 570,  y: 365, phase: "EW", timer: 1.5 },
  { id: "J3", name: "Downstream",    x: 895,  y: 330, phase: "NS", timer: 3.0 },
  { id: "J4", name: "Bommanahalli",  x: 1215, y: 295, phase: "EW", timer: 4.5 },
];

/* ── Support nodes ────────────────────────────────────────────────
   Field-level control points on the V-junction feeder arms at J2.
   F1 = NW service road. F2 = SW bus-stop friction.
   F3 = North feeder entry. F4 = South feeder entry. */
const supportNodes = [
  { id: "F1", name: "Service road merge", x: 228, y: 200 },
  { id: "F2", name: "Bus stop friction",  x: 380, y: 560 },
  { id: "F3", name: "North feeder",       x: 640, y: 48 },
  { id: "F4", name: "South feeder",       x: 500, y: 748 },
];

/* Sensor sites — kept near junctions that need monitoring */
const sensorSites = [
  { id: "S2", x: 640, y: 310 },
  { id: "S4", x: 1180, y: 230 },
];

/* ── Grid links ───────────────────────────────────────────────────
   Secondary cross-streets that physically cross each junction.
   Each extends well above/below the corridor to look like real roads.
   V-junction corridor (F3→J2→F4) handled by south/north routes. */
const gridLinks = [
  /* J1: NS cross-street */
  [[260, 100], [260, 400], [260, 680]],
  /* J2: V-junction NS (drawn by south/north route, gridLink just a backup) */
  [[640, 48], [570, 365], [500, 748]],
  /* J3: NS cross-street */
  [[895, 100], [895, 330], [895, 580]],
  /* J4: NS cross-street */
  [[1215, 80], [1215, 295], [1215, 560]],
];

/* City blocks — decorative rectangles representing built environment */
const cityBlocks = [
  [74, 100, 146, 76],
  [310, 100, 170, 76],
  [710, 80, 130, 68],
  [1050, 80, 130, 68],
  [74, 460, 140, 70],
  [370, 440, 120, 62],
  [700, 420, 150, 70],
  [1050, 390, 140, 60],
  [200, 640, 130, 56],
  [980, 580, 200, 56],
];

/* ── Routes ───────────────────────────────────────────────────────
   East and West share the SAME junction coordinates so they draw
   on the same road. laneShift separates them visually into lanes.

   Coordinate cross-check (all routes pass through junction coords):
     east:  J1(260,400) → J2(570,365) → J3(895,330) → J4(1215,295)
     west:  J4(1215,295) → J3(895,330) → J2(570,365) → J1(260,400)
     south: enters top → J2(570,365) → exits bottom
     north: enters bottom → J2(570,365) → exits top
     feeder: enters SW → J2(570,365) → exits NE                  */
const routes = {
  east: {
    phase: "EW",
    color: colors.amber,
    laneShift: 14,
    points: [[42, 420], [260, 400], [570, 365], [895, 330], [1215, 295], [1560, 270]],
    stops: ["J1", "J2", "J3", "J4"],
  },
  west: {
    phase: "EW",
    color: colors.amber,
    laneShift: -14,
    points: [[1560, 270], [1215, 295], [895, 330], [570, 365], [260, 400], [42, 420]],
    stops: ["J4", "J3", "J2", "J1"],
  },
  south: {
    phase: "NS",
    color: colors.cyan,
    laneShift: 12,
    points: [[660, 20], [620, 140], [570, 365], [520, 760]],
    stops: ["J2"],
  },
  north: {
    phase: "NS",
    color: colors.cyan,
    laneShift: -12,
    points: [[470, 760], [520, 540], [570, 365], [510, 22]],
    stops: ["J2"],
  },
  feeder: {
    phase: "EW",
    color: "#c6ec66",
    laneShift: -6,
    points: [[88, 640], [380, 560], [570, 365], [895, 195], [1560, 70]],
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
