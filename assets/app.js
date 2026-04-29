const canvas = document.getElementById("trafficCanvas");
const confidenceValue = document.getElementById("confidenceValue");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let tick = 0;

const cars = Array.from({ length: 54 }, (_, index) => ({
  lane: index % 4,
  offset: Math.random(),
  speed: 0.0018 + Math.random() * 0.004,
  color: ["#f6c945", "#2f9c6b", "#d84d3f", "#fffaf0"][index % 4],
}));

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function carRect(car) {
  const centerX = width * 0.66;
  const centerY = height * 0.52;
  const roadW = Math.max(150, Math.min(width, height) * 0.27);
  const p = (car.offset + tick * car.speed) % 1;
  const queueSlowdown = Math.max(0.35, Math.sin(tick * 0.015 + car.lane) * 0.5 + 0.5);

  if (car.lane === 0) {
    return [centerX - roadW * 0.18, height * (1.05 - p * queueSlowdown), 13, 25, 0];
  }
  if (car.lane === 1) {
    return [centerX + roadW * 0.1, height * (p * queueSlowdown - 0.05), 13, 25, 0];
  }
  if (car.lane === 2) {
    return [width * (1.04 - p), centerY - roadW * 0.16, 27, 13, 1];
  }
  return [width * (p - 0.04), centerY + roadW * 0.08, 27, 13, 1];
}

function drawRoads(centerX, centerY, roadW) {
  ctx.fillStyle = "#1d272d";
  ctx.fillRect(centerX - roadW / 2, 0, roadW, height);
  ctx.fillRect(0, centerY - roadW / 2, width, roadW);

  ctx.strokeStyle = "rgba(255,250,240,0.27)";
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 18]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(246,201,69,0.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(centerX - roadW / 2, centerY - roadW / 2, roadW, roadW);
}

function drawSignals(centerX, centerY, roadW) {
  const phase = Math.floor(tick / 130) % 4;
  const positions = [
    [centerX - roadW * 0.66, centerY - roadW * 0.66],
    [centerX + roadW * 0.56, centerY + roadW * 0.56],
    [centerX + roadW * 0.56, centerY - roadW * 0.66],
    [centerX - roadW * 0.66, centerY + roadW * 0.56],
  ];

  positions.forEach(([x, y], index) => {
    ctx.fillStyle = "rgba(23,33,43,0.82)";
    ctx.fillRect(x, y, 30, 70);
    ["#d84d3f", "#f6c945", "#2f9c6b"].forEach((color, light) => {
      const isGreen = phase === index && light === 2;
      const isYellow = (tick % 130) > 105 && phase === index && light === 1;
      const isRed = phase !== index && light === 0;
      ctx.fillStyle = isGreen || isYellow || isRed ? color : "rgba(255,250,240,0.18)";
      ctx.beginPath();
      ctx.arc(x + 15, y + 15 + light * 20, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function drawQueueHeat(centerX, centerY, roadW) {
  const pulse = Math.sin(tick * 0.025) * 0.5 + 0.5;
  const gradient = ctx.createRadialGradient(centerX, centerY, roadW * 0.2, centerX, centerY, roadW * (1.8 + pulse));
  gradient.addColorStop(0, "rgba(216,77,63,0.28)");
  gradient.addColorStop(0.55, "rgba(246,201,69,0.14)");
  gradient.addColorStop(1, "rgba(47,156,107,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCars() {
  cars.forEach((car) => {
    const [x, y, w, h] = carRect(car);
    ctx.fillStyle = car.color;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  });
}

function draw() {
  tick += 1;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#263238";
  ctx.fillRect(0, 0, width, height);

  const centerX = width * 0.66;
  const centerY = height * 0.52;
  const roadW = Math.max(150, Math.min(width, height) * 0.27);
  drawRoads(centerX, centerY, roadW);
  drawQueueHeat(centerX, centerY, roadW);
  drawCars();
  drawSignals(centerX, centerY, roadW);

  if (confidenceValue) {
    const confidence = 78 + Math.round((Math.sin(tick * 0.018) * 0.5 + 0.5) * 9);
    confidenceValue.textContent = `${confidence}%`;
  }
  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();
draw();
