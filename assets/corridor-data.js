/* PATC corridor — 5 junctions, two-way mainline, one-way side roads, grid connectors.
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
  [40,  60,  80,  55, "#1a2433", "block"],
  [135, 50,  75,  50, "#1d2a3c", "block"],
  [300, 70,  95,  50, "#1a2433", "block"],
  [410, 55,  80,  52, "#1d2a3c", "block"],
  [650, 60,  110, 65, "#22324b", "block"],
  [775, 68,  105, 55, "#1a2433", "block"],
  [1005, 52, 100, 60, "#1d2a3c", "block"],
  [1115, 62, 90,  52, "#22324b", "block"],
  [1240, 55, 95,  60, "#1a2433", "block"],
  [1355, 48, 85,  55, "#1d2a3c", "block"],
  [1540, 70, 100, 55, "#22324b", "block"],
  [1645, 55, 55,  48, "#1a2433", "block"],
  /* Bottom row */
  [55,  640, 95,  60, "#1a2433", "block"],
  [165, 655, 105, 55, "#1d2a3c", "block"],
  [390, 645, 100, 58, "#22324b", "block"],
  [500, 658, 85,  52, "#1a2433", "block"],
  [680, 648, 100, 62, "#1d2a3c", "block"],
  [795, 638, 110, 68, "#22324b", "block"],
  [1000, 655, 95, 55, "#1a2433", "block"],
  [1110, 642, 88, 58, "#1d2a3c", "block"],
  [1250, 648, 120, 65, "#22324b", "block"],
  [1390, 640, 100, 58, "#1a2433", "block"],
  [1545, 650, 95,  58, "#1d2a3c", "block"],
  /* Grid-zone city blocks — between the connector roads and mainline */
  [55,  218, 75,  40, "#141e2d", "block"],
  [145, 222, 65,  38, "#17233a", "block"],
  [290, 215, 80,  42, "#141e2d", "block"],
  [660, 218, 95,  40, "#17233a", "block"],
  [770, 225, 80,  38, "#141e2d", "block"],
  [1005, 220, 90, 40, "#17233a", "block"],
  [1115, 218, 80, 42, "#141e2d", "block"],
  [1295, 220, 90, 38, "#17233a", "block"],
  [1540, 215, 80, 42, "#141e2d", "block"],
  /* Between mainline and lower connector */
  [55,  488, 80,  40, "#141e2d", "block"],
  [148, 492, 65,  38, "#17233a", "block"],
  [295, 488, 75,  42, "#141e2d", "block"],
  [655, 490, 90,  40, "#17233a", "block"],
  [770, 485, 85,  42, "#141e2d", "block"],
  [1010, 490, 80, 40, "#17233a", "block"],
  [1112, 486, 78, 42, "#141e2d", "block"],
  [1298, 488, 88, 40, "#17233a", "block"],
  [1540, 490, 80, 38, "#141e2d", "block"],
];

/* Civic landmarks — away from all road asphalt (safe positions verified).
   Cross-streets: j2cross x≈542-578, j3side x≈849-879, j4cross x≈1157-1203, j5ramp x≈1491-1509.
   Grid roads: y≈186-204 and y≈556-574. Mainline y≈361-399. */
const landmarks = [
  /* TOP STRIP — y=35 (well above grid road at y=195) */
  { x: 160,  y: 35,  w: 115, h: 68, color: "#3d2937", border: "#f87171", label: "🏥 HOSPITAL",   sub: "City Care" },
  { x: 660,  y: 35,  w: 125, h: 68, color: "#3a3057", border: "#a78bfa", label: "🏫 SCHOOL",     sub: "St. Mary's" },
  { x: 1000, y: 35,  w: 120, h: 68, color: "#3a3057", border: "#a78bfa", label: "🏫 SCHOOL",     sub: "Public Sch" },
  { x: 1350, y: 35,  w: 110, h: 68, color: "#3a3528", border: "#fbbf24", label: "🏢 OFFICE",      sub: "Tech Park" },
  /* BOTTOM STRIP — y=622 (well below grid road at y=565) */
  { x: 55,   y: 622, w: 110, h: 65, color: "#33402c", border: "#34d399", label: "🌳 PARK",        sub: "Green Belt" },
  { x: 380,  y: 622, w: 110, h: 65, color: "#3a3528", border: "#fbbf24", label: "🏢 OFFICE",      sub: "BPO Tower" },
  { x: 1250, y: 622, w: 130, h: 65, color: "#2c3a4d", border: "#60a5fa", label: "🏬 MALL",        sub: "Sector Hub" },
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
  /* Upper grid connector — one-way eastbound at y≈195, between landmark strip and mainline */
  {
    id: "upperGrid",
    type: "one-way",
    width: 14,
    centerline: [
      [0, 197], [220, 196], [560, 197], [870, 196], [1180, 197], [1480, 196], [1700, 197],
    ],
  },
  /* Lower grid connector — one-way westbound at y≈563 */
  {
    id: "lowerGrid",
    type: "one-way",
    width: 14,
    centerline: [
      [1700, 563], [1480, 564], [1180, 563], [870, 564], [560, 563], [220, 564], [0, 563],
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
  /* Grid connector routes — no junction stops, vehicles flow freely */
  upperGridEast: {
    phase: "MAIN",
    points: [[-40, 197], [220, 196], [560, 197], [870, 196], [1180, 197], [1480, 196], [1740, 197]],
    stops: [],
    direction: "E",
  },
  lowerGridWest: {
    phase: "MAIN",
    points: [[1740, 563], [1480, 564], [1180, 563], [870, 564], [560, 563], [220, 564], [-40, 563]],
    stops: [],
    direction: "W",
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
      "upperGridEast", "lowerGridWest", "mainEast", "upperGridEast",
      "lowerGridWest", "mainEast", "mainWest", "mainEast",
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
      "upperGridEast", "lowerGridWest", "j3Side", "mainEast",
      "upperGridEast", "lowerGridWest", "j3Side", "mainWest",
    ],
    downstream: 1.10,
    spacing: 0.54,
    primaryPhase: "SIDE",
  },
};
