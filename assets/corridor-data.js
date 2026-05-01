/* PATC corridor — 5 junctions, two-way mainline, one-way side roads.
   Geometry mirrors the reference diagram (J1–J5, J2 + J4 are broad cross-streets).
   Coordinate space is the canvas directly: 1700 × 760. No transform applied. */

const colors = {
  bg:        "#03070b",
  asphalt:   "#222d3d",
  asphaltLight: "#2c3a4d",
  median:    "rgba(255,235,150,0.45)",
  laneDash:  "rgba(255,255,255,0.22)",
  curb:      "#0d1825",
  text:      "#f4f7f2",
  muted:     "#9fb2b1",
  green:     "#34d399",
  amber:     "#fbbf24",
  red:       "#f87171",
  bulbOff:   "rgba(244,247,242,0.10)",
  /* Vehicle palette — high contrast against asphalt */
  vSedan:    "#4FD1C5",
  vSuv:      "#A78BFA",
  vAuto:     "#FBBF24",
  vBike:     "#F87171",
  vBus:      "#60A5FA",
};

/* ── Junctions (5, all on y=380) ───────────────────────────── */
const junctions = [
  { id: "J1", name: "Curved entry",  x: 220,  y: 380, phase: "MAIN", timer: 0,    arms: 3, broad: false },
  { id: "J2", name: "Sector core",   x: 560,  y: 380, phase: "MAIN", timer: 1.6,  arms: 4, broad: true  },
  { id: "J3", name: "School block",  x: 870,  y: 380, phase: "MAIN", timer: 3.2,  arms: 3, broad: false },
  { id: "J4", name: "Bommanahalli",  x: 1180, y: 380, phase: "MAIN", timer: 4.8,  arms: 4, broad: true  },
  { id: "J5", name: "Outflow ramp",  x: 1480, y: 380, phase: "MAIN", timer: 6.4,  arms: 3, broad: false },
];

const supportNodes = [];
const sensorSites  = [];
const cityBlocks   = [];
const gridLinks    = [];

/* ── Roads (drawn asphalt strips) ─────────────────────────────
   Each road carries 1 (one-way) or 2 (two-way) opposing routes.
   Drawing paints the asphalt + lane markings; routes carry vehicles. */
const roads = [
  /* Main two-way arterial */
  {
    id: "mainline",
    type: "two-way",
    width: 36,
    centerline: [
      [0, 380], [220, 380], [560, 380], [870, 380],
      [1180, 380], [1480, 380], [1700, 380],
    ],
  },
  /* J2 broad cross-street (two-way) */
  {
    id: "j2cross",
    type: "two-way",
    width: 36,
    centerline: [[560, 0], [560, 380], [560, 760]],
  },
  /* J4 broad cross-street (two-way) */
  {
    id: "j4cross",
    type: "two-way",
    width: 36,
    centerline: [[1180, 0], [1180, 380], [1180, 760]],
  },
  /* J1 one-way curved ramp (NW → S) */
  {
    id: "j1ramp",
    type: "one-way",
    width: 18,
    centerline: [
      [60, 60], [120, 160], [180, 260], [220, 380],
      [248, 500], [262, 620], [262, 760],
    ],
  },
  /* J3 one-way side road (N → S) */
  {
    id: "j3side",
    type: "one-way",
    width: 18,
    centerline: [[870, 0], [870, 380], [870, 760]],
  },
  /* J5 one-way curved off-ramp (N → SE) */
  {
    id: "j5ramp",
    type: "one-way",
    width: 18,
    centerline: [
      [1500, 0], [1492, 140], [1486, 250], [1480, 380],
      [1530, 500], [1600, 630], [1660, 760],
    ],
  },
];

/* ── Routes (vehicle paths, lane-correct) ─────────────────────
   Indian left-hand traffic convention:
     – Eastbound on top lane (y=372), westbound on bottom (y=388).
     – On J2/J4 cross-streets, southbound on left of centre, northbound on right.
   Each route lists the junctions it stops at, in order. */
const LANE_OFFSET = 10;
const routes = {
  mainEast: {
    phase: "MAIN",
    points: [
      [-40, 370], [220, 370], [560, 370], [870, 370],
      [1180, 370], [1480, 370], [1740, 370],
    ],
    stops: ["J1", "J2", "J3", "J4", "J5"],
    direction: "E",
  },
  mainWest: {
    phase: "MAIN",
    points: [
      [1740, 390], [1480, 390], [1180, 390], [870, 390],
      [560, 390], [220, 390], [-40, 390],
    ],
    stops: ["J5", "J4", "J3", "J2", "J1"],
    direction: "W",
  },
  /* J2 cross — two-way */
  j2South: {
    phase: "SIDE",
    points: [[550, -40], [550, 380], [550, 800]],
    stops: ["J2"],
    direction: "S",
  },
  j2North: {
    phase: "SIDE",
    points: [[570, 800], [570, 380], [570, -40]],
    stops: ["J2"],
    direction: "N",
  },
  /* J4 cross — two-way */
  j4South: {
    phase: "SIDE",
    points: [[1170, -40], [1170, 380], [1170, 800]],
    stops: ["J4"],
    direction: "S",
  },
  j4North: {
    phase: "SIDE",
    points: [[1190, 800], [1190, 380], [1190, -40]],
    stops: ["J4"],
    direction: "N",
  },
  /* J1 ramp — one-way only (NW down through J1 and out) */
  j1Ramp: {
    phase: "SIDE",
    points: [
      [60, 60], [120, 160], [180, 260], [220, 380],
      [248, 500], [262, 620], [262, 800],
    ],
    stops: ["J1"],
    direction: "S",
  },
  /* J3 side — one-way N→S only */
  j3Side: {
    phase: "SIDE",
    points: [[870, -40], [870, 380], [870, 800]],
    stops: ["J3"],
    direction: "S",
  },
  /* J5 ramp — one-way N→SE only */
  j5Ramp: {
    phase: "SIDE",
    points: [
      [1500, -40], [1492, 140], [1486, 250], [1480, 380],
      [1530, 500], [1600, 630], [1660, 800],
    ],
    stops: ["J5"],
    direction: "S",
  },
};

const scenarios = {
  peak: {
    title: "Peak spillback",
    copy: "Office traffic releases east; J3 side road and J4 cross press in.",
    /* Heavy mainline, modest cross-traffic — primary phase MAIN */
    bias: [
      "mainEast", "mainEast", "mainEast", "mainWest",
      "mainEast", "j2North", "mainEast", "mainWest",
      "mainEast", "j4South", "mainEast", "j3Side",
      "mainWest", "mainEast", "j1Ramp", "mainEast",
      "mainWest", "j2South", "mainEast", "j5Ramp",
      "mainWest", "mainEast", "j4North", "mainEast",
    ],
    downstream: 1.30,
    spacing: 0.58,
    primaryPhase: "MAIN",
  },
  school: {
    title: "School release",
    copy: "Bursty side-road demand at J3; mainline must not starve.",
    bias: [
      "j3Side", "j3Side", "mainEast", "j3Side",
      "j2North", "mainWest", "j3Side", "j2South",
      "mainEast", "j3Side", "j4South", "j3Side",
      "mainWest", "j5Ramp", "j3Side", "mainEast",
      "j1Ramp", "j3Side", "j4North", "mainWest",
      "j3Side", "mainEast", "j3Side", "j2South",
    ],
    downstream: 0.95,
    spacing: 0.62,
    primaryPhase: "SIDE",
  },
};
