const canvas = document.getElementById("trafficCanvas");
const confidenceValue = document.getElementById("confidenceValue");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let tick = 0;

const vehicles = Array.from({ length: 78 }, (_, index) => ({
  route: index % 3,
  offset: Math.random(),
  speed: 0.0015 + Math.random() * 0.0034,
  color: ["#ffd24a", "#28d17c", "#ff5d52", "#36d2e2"][index % 4],
}));

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function sectorPoints() {
  const startX = width < 700 ? width * 0.18 : width * 0.48;
  return [
    { x: startX, y: height * 0.24 },
    { x: width * 0.62, y: height * 0.39 },
    { x: width * 0.76, y: height * 0.55 },
    { x: width * 0.9, y: height * 0.71 },
  ];
}

function interpolate(points, progress) {
  const segmentCount = points.length - 1;
  const scaled = progress * segmentCount;
  const index = Math.min(segmentCount - 1, Math.floor(scaled));
  const local = scaled - index;
  const from = points[index];
  const to = points[index + 1];
  return {
    angle: Math.atan2(to.y - from.y, to.x - from.x),
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function drawPath(points, widthPx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
}

function drawBackground(points) {
  ctx.fillStyle = "#05080d";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(238,246,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = -80; x < width + 80; x += 84) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.32, height);
    ctx.stroke();
  }

  drawPath(points, 76, "rgba(238,246,255,0.08)");
  drawPath(points, 42, "rgba(22,33,45,0.94)");
  drawPath(points, 2, "rgba(255,210,74,0.45)");

  points.forEach((point, index) => {
    const arm = index % 2 === 0 ? 90 : -90;
    const radians = (Math.PI / 180) * arm;
    ctx.strokeStyle = "rgba(238,246,255,0.08)";
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(point.x - Math.cos(radians) * 120, point.y - Math.sin(radians) * 120);
    ctx.lineTo(point.x + Math.cos(radians) * 120, point.y + Math.sin(radians) * 120);
    ctx.stroke();
  });
}

function drawCoordination(points) {
  const pulse = Math.sin(tick * 0.028) * 0.5 + 0.5;
  drawPath(points.slice(1), 18, `rgba(255,93,82,${0.12 + pulse * 0.16})`);
  drawPath(points.slice(0, 3), 8, `rgba(54,210,226,${0.16 + pulse * 0.24})`);

  ctx.fillStyle = "rgba(255,210,74,0.1)";
  ctx.beginPath();
  ctx.ellipse(points[2].x, points[2].y, 190 + pulse * 80, 82 + pulse * 36, 0.74, 0, Math.PI * 2);
  ctx.fill();
}

function drawSignals(points) {
  const active = Math.floor(tick / 120) % points.length;
  points.forEach((point, index) => {
    ctx.fillStyle = index === active ? "#ffd24a" : "#28d17c";
    ctx.shadowBlur = index === active ? 28 : 16;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(238,246,255,0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 28, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawVehicles(points) {
  vehicles.forEach((vehicle) => {
    const speedPenalty = vehicle.route === 1 ? 0.72 : 1;
    const progress = (vehicle.offset + tick * vehicle.speed * speedPenalty) % 1;
    const point = interpolate(points, progress);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(-11, -5, 22, 10);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawLabels(points) {
  if (width < 700) {
    return;
  }

  ctx.font = "700 12px Arial";
  ctx.fillStyle = "rgba(248,251,255,0.72)";
  points.forEach((point, index) => {
    ctx.fillText(`S${index + 1}`, point.x + 20, point.y - 18);
  });
}

function draw() {
  tick += 1;
  const points = sectorPoints();
  ctx.clearRect(0, 0, width, height);
  drawBackground(points);
  drawCoordination(points);
  drawVehicles(points);
  drawSignals(points);
  drawLabels(points);

  if (confidenceValue) {
    const confidence = 78 + Math.round((Math.sin(tick * 0.018) * 0.5 + 0.5) * 9);
    confidenceValue.textContent = `${confidence}%`;
  }
  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();
draw();
