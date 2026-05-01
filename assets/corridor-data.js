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

/* ── 3-junction straight corridor (reference layout) ─────────────
   Main EW arterial at y=400.  Side roads cross at each junction.
   J1 ← left     J2 ← center (V-junction)     J4 ← right       */
const junctions = [
  { id: "J1", name: "HSR entry",    x: 300,  y: 400, phase: "EW", timer: 0 },
  { id: "J2", name: "Sector core",  x: 760,  y: 400, phase: "EW", timer: 2.0 },
  { id: "J4", name: "Bommanahalli", x: 1220, y: 400, phase: "EW", timer: 4.0 },
];

/* No field support nodes — all roads defined by routes + gridLinks */
const supportNodes = [];

/* Sensor near J2 only */
const sensorSites = [
  { id: "S2", x: 830, y: 360 },
];

/* ── Cross-streets at each junction ──────────────────────────────
   J1: angled NW→SE  (like the reference image curved side road)
   J2: V-junction handled by south/north/feeder routes
   J4: angled NE→SW                                               */
const gridLinks = [
  [[200, 120], [300, 400], [400, 680]],
  [[760, 60], [760, 400], [760, 740]],
  [[1340, 120], [1220, 400], [1100, 680]],
];

/* City blocks — decorative built environment */
const cityBlocks = [
  [80, 140, 130, 70],
  [400, 130, 170, 70],
  [560, 100, 120, 60],
  [950, 120, 140, 60],
  [1320, 100, 130, 60],
  [80, 480, 130, 60],
  [420, 520, 150, 60],
  [560, 530, 120, 58],
  [950, 500, 140, 58],
  [1320, 510, 130, 58],
];

/* ── Routes ───────────────────────────────────────────────────────
   east/west: main corridor through all 3 junctions, laneShift split
   south/north: NS through J2 (V-junction)
   feeder: diagonal through J2
   j1cross: minor NS traffic through J1
   j4cross: minor NS traffic through J4

   Cross-check: every route passes exactly through junction (x,y)  */
const routes = {
  east: {
    phase: "EW",
    color: colors.amber,
    laneShift: 14,
    points: [[30, 400], [300, 400], [760, 400], [1220, 400], [1560, 400]],
    stops: ["J1", "J2", "J4"],
  },
  west: {
    phase: "EW",
    color: colors.amber,
    laneShift: -14,
    points: [[1560, 400], [1220, 400], [760, 400], [300, 400], [30, 400]],
    stops: ["J4", "J2", "J1"],
  },
  south: {
    phase: "NS",
    color: colors.cyan,
    laneShift: 12,
    points: [[810, 20], [780, 200], [760, 400], [730, 740]],
    stops: ["J2"],
  },
  north: {
    phase: "NS",
    color: colors.cyan,
    laneShift: -12,
    points: [[690, 740], [730, 530], [760, 400], [720, 22]],
    stops: ["J2"],
  },
  feeder: {
    phase: "EW",
    color: "#c6ec66",
    laneShift: -6,
    points: [[60, 680], [420, 540], [760, 400], [1060, 260], [1540, 80]],
    stops: ["J2"],
  },
  j1cross: {
    phase: "NS",
    color: colors.blue,
    laneShift: 10,
    points: [[240, 60], [300, 400], [360, 730]],
    stops: ["J1"],
  },
  j4cross: {
    phase: "NS",
    color: colors.blue,
    laneShift: -10,
    points: [[1300, 60], [1220, 400], [1140, 730]],
    stops: ["J4"],
  },
};

const scenarios = {
  peak: {
    title: "Peak spillback",
    copy: "Office traffic releases into a saturated downstream link.",
    bias: ["east", "east", "west", "feeder", "south", "j1cross"],
    downstream: 1.3,
    spacing: 0.58,
    primaryPhase: "EW",
  },
  school: {
    title: "School release",
    copy: "Bursty demand arrives in pulses and should not starve cross traffic.",
    bias: ["south", "feeder", "north", "east", "j4cross", "feeder"],
    downstream: 0.95,
    spacing: 0.62,
    primaryPhase: "EW",
  },
};
