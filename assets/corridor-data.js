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
const gridLinks    = [];

/* Decorative buildings flanking the corridor — give the demo a real-city feel. */
const cityBlocks = [
  /* Top row, left to right */
  [40,  60,  120, 60, "#1a2433", "block"],
  [180, 50,  90,  50, "#1d2a3c", "block"],
  [300, 70,  100, 50, "#1a2433", "block"],
  [620, 60,  130, 70, "#22324b", "block"],
  [780, 70,  120, 60, "#1a2433", "block"],
  [930, 50,  130, 60, "#1d2a3c", "block"],
  [1280, 60, 130, 70, "#22324b", "block"],
  [1430, 50, 90,  50, "#1a2433", "block"],
  [1540, 70, 110, 60, "#1d2a3c", "block"],
  /* Bottom row */
  [80,  650, 110, 60, "#1a2433", "block"],
  [240, 660, 130, 60, "#1d2a3c", "block"],
  [400, 670, 100, 50, "#22324b", "block"],
  [660, 660, 110, 60, "#1a2433", "block"],
  [800, 650, 130, 70, "#1d2a3c", "block"],
  [970, 670, 100, 50, "#22324b", "block"],
  [1280, 660, 100, 60, "#1a2433", "block"],
  [1410, 650, 130, 70, "#1d2a3c", "block"],
];

/* Civic landmarks — labelled buildings that justify the simulation context. */
const landmarks = [
  { x: 800,  y: 50,  w: 130, h: 78, color: "#3a3057", border: "#a78bfa", label: "🏫 SCHOOL",     sub: "St. Mary's" },
  { x: 940,  y: 60,  w: 110, h: 68, color: "#3a3057", border: "#a78bfa", label: "🏫 SCHOOL",     sub: "Public school" },
  { x: 470,  y: 50,  w: 110, h: 80, color: "#3d2937", border: "#f87171", label: "🏥 HOSPITAL",   sub: "City care" },
  { x: 1090, y: 660, w: 130, h: 70, color: "#2c3a4d", border: "#60a5fa", label: "🏬 MALL",        sub: "Sector hub" },
  { x: 200,  y: 660, w: 110, h: 70, color: "#33402c", border: "#34d399", label: "🌳 PARK",        sub: "Green belt" },
  { x: 1330, y: 50,  w: 110, h: 70, color: "#3a3528", border: "#fbbf24", label: "🏢 OFFICE",      sub: "Tech park" },
  { x: 540,  y: 660, w: 110, h: 70, color: "#3a3528", border: "#fbbf24", label: "🏢 OFFICE",      sub: "BPO tower" },
];

/* ── Roads (drawn asphalt strips) ─────────────────────────────
   Each road carries 1 (one-way) or 2 (two-way) opposing routes.
   Drawing paints the asphalt + lane markings; routes carry vehicles. */
const roads = [
  /* Main two-way arterial — gentle wave so it reads as a real road, not graph paper */
  {
    id: "mainline",
    type: "two-way",
    width: 38,
    centerline: [
      [0, 380], [110, 378], [220, 380], [390, 374], [560, 380],
      [715, 386], [870, 380], [1025, 374], [1180, 380],
      [1330, 384], [1480, 380], [1590, 378], [1700, 380],
    ],
  },
  /* J2 broad cross-street — slight S-bow */
  {
    id: "j2cross",
    type: "two-way",
    width: 36,
    centerline: [[565, 0], [560, 100], [555, 220], [560, 380], [565, 540], [560, 660], [555, 760]],
  },
  /* J4 broad cross-street — opposite bow */
  {
    id: "j4cross",
    type: "two-way",
    width: 36,
    centerline: [[1175, 0], [1180, 100], [1185, 220], [1180, 380], [1175, 540], [1180, 660], [1185, 760]],
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
  /* J3 one-way side road — S-curve from school district */
  {
    id: "j3side",
    type: "one-way",
    width: 22,
    centerline: [[860, 0], [864, 120], [875, 240], [870, 380], [864, 520], [870, 640], [868, 760]],
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
  /* Mainline — follows the same gentle wave as the asphalt centerline,
     offset by ±10px for north / south lanes. */
  mainEast: {
    phase: "MAIN",
    points: [
      [-40, 370], [110, 368], [220, 370], [390, 364], [560, 370],
      [715, 376], [870, 370], [1025, 364], [1180, 370],
      [1330, 374], [1480, 370], [1590, 368], [1740, 370],
    ],
    stops: ["J1", "J2", "J3", "J4", "J5"],
    direction: "E",
  },
  mainWest: {
    phase: "MAIN",
    points: [
      [1740, 390], [1590, 388], [1480, 390], [1330, 394], [1180, 390],
      [1025, 384], [870, 390], [715, 396], [560, 390],
      [390, 384], [220, 390], [110, 388], [-40, 390],
    ],
    stops: ["J5", "J4", "J3", "J2", "J1"],
    direction: "W",
  },
  /* J2 cross — two-way, follows curved centerline */
  j2South: {
    phase: "SIDE",
    points: [[555, -40], [550, 100], [545, 220], [550, 380], [555, 540], [550, 660], [545, 800]],
    stops: ["J2"],
    direction: "S",
  },
  j2North: {
    phase: "SIDE",
    points: [[565, 800], [570, 660], [575, 540], [570, 380], [565, 220], [570, 100], [575, -40]],
    stops: ["J2"],
    direction: "N",
  },
  /* J4 cross — two-way */
  j4South: {
    phase: "SIDE",
    points: [[1165, -40], [1170, 100], [1175, 220], [1170, 380], [1165, 540], [1170, 660], [1175, 800]],
    stops: ["J4"],
    direction: "S",
  },
  j4North: {
    phase: "SIDE",
    points: [[1195, 800], [1190, 660], [1185, 540], [1190, 380], [1195, 220], [1190, 100], [1185, -40]],
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
  /* J3 side — one-way N→S only, gentle curve through school zone */
  j3Side: {
    phase: "SIDE",
    points: [[860, -40], [864, 120], [875, 240], [870, 380], [864, 520], [870, 640], [868, 800]],
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
    title: "Evening peak",
    copy: "Heavy office traffic flowing east. Cross-streets at J2 and J4 add pressure.",
    bias: [
      "mainEast", "mainEast", "mainEast", "mainWest",
      "mainEast", "j2North", "mainEast", "mainWest",
      "mainEast", "j4South", "mainEast", "j3Side",
      "mainWest", "mainEast", "j1Ramp", "mainEast",
      "mainWest", "j2South", "mainEast", "j5Ramp",
      "mainWest", "mainEast", "j4North", "mainEast",
      "mainEast", "j2North", "mainEast", "mainWest",
    ],
    downstream: 1.45,
    spacing: 0.50,
    primaryPhase: "MAIN",
  },
  school: {
    title: "School release",
    copy: "Schools at J3 finish at the same time. A surge of buses and parents floods the side road while the mainline keeps moving.",
    bias: [
      "j3Side", "j3Side", "mainEast", "j3Side",
      "j2North", "mainWest", "j3Side", "j2South",
      "mainEast", "j3Side", "j4South", "j3Side",
      "mainWest", "j5Ramp", "j3Side", "mainEast",
      "j1Ramp", "j3Side", "j4North", "mainWest",
      "j3Side", "mainEast", "j3Side", "j2South",
      "j3Side", "j3Side", "mainWest", "j3Side",
    ],
    downstream: 1.10,
    spacing: 0.54,
    primaryPhase: "SIDE",
  },
};
