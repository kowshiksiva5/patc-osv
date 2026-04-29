// ═══════════════════════════════════════════════════════════════
// CITY SIMULATION
// ═══════════════════════════════════════════════════════════════

const CW = 620, CH = 430;
const COLS = 6, ROWS = 5;
const DX = 98, DY = 84;
const OX = 62, OY = 46;
const ROAD_W = 22;
const INT_R = 15;

const C = {
  bg:'#050d1a', block:'#08111f', road:'#0e1d36', roadSurf:'#122444',
  markY:'rgba(220,180,60,0.55)', markW:'rgba(255,255,255,0.25)',
  cyan:'#00e5ff', orange:'#ff9000', green:'#00ff88',
  red:'#ff3040', yellow:'#ffc107', purple:'#8b5cf6', blue:'#1a6fd4',
  text:'#deeeff', text2:'#5e80a8'
};

function nodePos(c,r){ return {x:OX+c*DX, y:OY+r*DY}; }

// Routes as [col,row]
const R_A_CR = [[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,3],[5,3],[5,4]];
const R_B_CR = [[0,4],[1,4],[2,4],[2,3],[2,2],[3,2],[4,2],[4,1],[5,1],[5,0]];
const RA = R_A_CR.map(([c,r])=>nodePos(c,r));
const RB = R_B_CR.map(([c,r])=>nodePos(c,r));

const KEY = nodePos(3,2); // intersection pixel position
const KEY_SEG = 4;        // approach segment index for both cars
const SIGNAL_NODES = [
  {c:1,r:0,offset:0.12},
  {c:3,r:0,offset:0.34},
  {c:5,r:1,offset:0.52},
  {c:2,r:2,offset:0.22},
  {c:3,r:2,offset:0},
  {c:4,r:3,offset:0.72}
];

// ── Simulation state ──────────────────────────────────────────
let simSpeed = 1, paused = false, frame = 0, resetTimer = 0;

// Timeline history
const TL_MAX = 600; // frames of history
const tlHistory = []; // {frame, phase}
let lastTlPhase = null;

// Rolling horizon state
let mpcHorizon = Array(6).fill(null).map(()=>({ns:0.4,ew:0.4,lost:0.2}));
let mpcUpdateTimer = 0;

// Signal
const sig = {
  phase: 'EW',          // 'NS' or 'EW' active green
  timer: 0,
  greenDuration: 280,   // frames for current green
  transitioning: false,
  transTimer: 0,
  TRANS_DUR: 24,
  cycleCount: 0,
  minGreen: 140,
  maxGreen: 560,
  log: []
};

const SCENARIOS = {
  peak: {
    label: 'peak',
    title: 'Peak spillback from a saturated approach',
    copy: 'One approach discharges, but the next road is already full. PATC detects pressure before the downstream queue blocks the sector.',
    phase: 'EW',
    greenDuration: 280,
    delayA: 10,
    delayB: 80,
    densityA: 1.06,
    densityB: 1.24,
    speedFactor: 1,
    lambda1: 1.45,
    lambda2: 0.9,
    switchSensitivity: 1.55
  },
  rain: {
    label: 'rain',
    title: 'Rain slowdown with longer startup loss',
    copy: 'Lower acceleration and cautious discharge create a slower recovery after red. The replay shows whether longer greens reduce stop-start churn.',
    phase: 'NS',
    greenDuration: 310,
    delayA: 30,
    delayB: 95,
    densityA: 1.18,
    densityB: 1.16,
    speedFactor: 0.76,
    lambda1: 1.05,
    lambda2: 0.64,
    switchSensitivity: 1.42
  },
  event: {
    label: 'event',
    title: 'Event surge pushing one corridor hard',
    copy: 'A concentrated wave enters from one side of the network. PATC weighs the surge against residual queues before recommending a phase shift.',
    phase: 'EW',
    greenDuration: 340,
    delayA: 45,
    delayB: 15,
    densityA: 0.92,
    densityB: 1.58,
    speedFactor: 0.92,
    lambda1: 1.28,
    lambda2: 0.78,
    switchSensitivity: 1.36
  },
  school: {
    label: 'school',
    title: 'School release with short bursty queues',
    copy: 'Demand appears in pulses instead of one continuous stream. The useful recommendation is the one that clears bursts without starving the cross movement.',
    phase: 'NS',
    greenDuration: 260,
    delayA: 5,
    delayB: 125,
    densityA: 1.42,
    densityB: 0.96,
    speedFactor: 0.88,
    lambda1: 1.32,
    lambda2: 0.82,
    switchSensitivity: 1.48
  }
};

let activeScenarioKey = 'peak';
let scenario = SCENARIOS[activeScenarioKey];
const tuning = {
  demand: 1.12,
  friction: 0.9,
  safety: 1.08
};

function el(id){
  return document.getElementById(id);
}

function setText(id, value){
  const node=el(id);
  if(node) node.textContent=value;
}

function syncTuningFromControls(){
  const demand=el('demandRange');
  const friction=el('frictionRange');
  const safety=el('safetyRange');
  if(demand) tuning.demand=Number(demand.value)/100;
  if(friction) tuning.friction=Number(friction.value)/100;
  if(safety) tuning.safety=Number(safety.value)/100;
  setText('demandReadout', `${Math.round(tuning.demand*100)}%`);
  setText('frictionReadout', `${Math.round(tuning.friction*100)}%`);
  setText('safetyReadout', `${Math.round(tuning.safety*100)}%`);
}

function pushLog(msg, color=''){
  const t = (frame/30).toFixed(1);
  const box = document.getElementById('patcLog');
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-ts">[${t.padStart(5,'0')}s]</span> <span style="color:${color||'#00e5ff'}">${msg}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if(box.children.length > 30) box.removeChild(box.children[0]);
}

// ── Car class ─────────────────────────────────────────────────
class Car {
  constructor(id, route, color, delay, approach){
    this.id=id; this.route=route; this.color=color;
    this.startDelay=delay; this.approach=approach;
    this.reset();
  }
  reset(){
    this.segIdx=0; this.t=0;
    this.pos={...this.route[0]};
    this.dir={x:1,y:0};
    this.stopped=false; this.arrived=false;
    this.delay=this.startDelay;
    this.waitFrames=0; this.totalDelay=0;
    this.mState=2; this.mTimer=0; this.piM=1.0; // start in flow
    this.pi=[0,0,1];
    this.trail=[]; this.justReleased=false;
    this.stopPos=null;
  }
  get progress(){
    return Math.min(1,(this.segIdx + this.t)/( this.route.length-1));
  }
  get density(){
    if(this.arrived) return 0;
    const boost = (this.id === 'A' ? scenario.densityA : scenario.densityB) * tuning.demand;
    if(this.stopped){
      return Math.min(180, (22 + this.waitFrames*0.35) * boost);
    }
    const wave = Math.sin(frame*0.045 + this.startDelay*0.07 + this.segIdx);
    const burst = activeScenarioKey === 'school'
      ? Math.max(0, Math.sin(frame*0.095 + this.segIdx*1.8))
      : activeScenarioKey === 'event'
        ? Math.max(0, Math.sin(frame*0.036 + this.segIdx))
        : 0;
    const pulse = (wave + 1) * 0.5 + burst * 0.5;
    if(this.segIdx < KEY_SEG) return (12 + pulse*5) * boost;
    if(this.segIdx === KEY_SEG) return (8 + pulse*4) * boost;
    return (4 + pulse*2) * boost;
  }
  update(signal){
    if(this.arrived) return;
    if(this.delay>0){this.delay--;return;}
    if(this.segIdx>=this.route.length-1){
      this.arrived=true;
      this.pos={...this.route[this.route.length-1]};
      pushLog(`Vehicle ${this.id} reached destination.`, this.color);
      return;
    }

    const atApproach = this.segIdx===KEY_SEG;
    const myGreen = signal.phase===this.approach && !signal.transitioning;

    if(atApproach && !myGreen && this.t>=0.79){
      if(!this.stopped){
        this.stopped=true;
        this.mState=0; this.piM=0;
        this.pi=[1,0,0];
        this.stopPos={...this.pos};
        this.waitFrames=0;
      }
      this.waitFrames++; this.totalDelay++;
      return;
    }

    if(this.stopped && (myGreen || !atApproach)){
      this.stopped=false;
      this.justReleased=true;
      this.mState=0; this.mTimer=0;
      this.pi=[1,0,0];
      this.piM=0;
    }

    // Markov update
    if(this.mState===0 || this.mState===1){
      this.mTimer++;
      const dt=1/30;
      const lam1=scenario.lambda1*tuning.friction;
      const lam2=scenario.lambda2*tuning.friction;
      const p1=1-Math.exp(-lam1*dt);
      const p2=1-Math.exp(-lam2*dt);
      const [idle, accel, flow]=this.pi;
      const nextIdle=idle*(1-p1);
      const nextAccel=accel*(1-p2)+idle*p1;
      const nextFlow=Math.min(1, flow+accel*p2);
      const total=nextIdle+nextAccel+nextFlow || 1;
      this.pi=[nextIdle/total,nextAccel/total,nextFlow/total];
      this.piM=Math.min(1, 0.65*this.pi[1]+this.pi[2]);
      this.mState=this.pi.indexOf(Math.max(...this.pi));
      if(this.piM>0.93 || this.mTimer>120){ this.mState=2; this.pi=[0,0,1]; this.piM=1; this.mTimer=0; }
    } else {
      this.mState=2; this.piM=1.0;
      this.pi=[0,0,1];
    }

    const baseSpd = 0.011 * scenario.speedFactor * tuning.friction;
    let spd = baseSpd * this.piM;
    if(spd<0.002 && !this.stopped) spd=0.002;

    this.t += spd;
    if(this.t>=1){
      this.t-=1; this.segIdx++;
      if(this.segIdx>=this.route.length-1){
        this.arrived=true;
        this.pos={...this.route[this.route.length-1]};
        pushLog(`Vehicle ${this.id} reached destination.`, this.color);
        return;
      }
      if(this.mState<2&&!this.stopped) this.mState=1;
    }

    const from=this.route[this.segIdx], to=this.route[this.segIdx+1];
    this.pos.x=from.x+(to.x-from.x)*this.t;
    this.pos.y=from.y+(to.y-from.y)*this.t;
    const dx=to.x-from.x, dy=to.y-from.y;
    const len=Math.sqrt(dx*dx+dy*dy)||1;
    this.dir={x:dx/len, y:dy/len};

    this.trail.push({x:this.pos.x, y:this.pos.y, a:1});
    if(this.trail.length>35) this.trail.shift();
    this.trail.forEach(p=>p.a*=0.90);
  }
}

const carA = new Car('A',RA,C.cyan,10,'NS');
const carB = new Car('B',RB,C.orange,80,'EW');

// ── Signal update ─────────────────────────────────────────────
function updateSignal(carA,carB){
  sig.timer++;

  if(sig.transitioning){
    sig.transTimer++;
    if(sig.transTimer>=sig.TRANS_DUR) doSwitch(carA,carB);
    return;
  }

  // PATC recommendation check every 30 frames
  if(sig.timer%30===0) patcOptimise(carA,carB);

  if(sig.timer>=sig.greenDuration) startTransition();
}

function patcOptimise(carA,carB){
  if(sig.timer<sig.minGreen) return;
  const sectorRisk = downstreamContextRisk();
  const nsScore = carA.density*(1+carA.waitFrames/60)*(1+sectorRisk.ns*0.35);
  const ewScore = carB.density*(1+carB.waitFrames/60)*(1+sectorRisk.ew*0.35);
  const sensitivity = scenario.switchSensitivity / tuning.safety;
  if(sig.phase==='NS' && ewScore>nsScore*sensitivity){
    pushLog(`PATC: E/W pressure surge (ρ=${carB.density.toFixed(0)} veh/km), recommend early switch.`, C.orange);
    startTransition();
  } else if(sig.phase==='EW' && nsScore>ewScore*sensitivity){
    pushLog(`PATC: N/S pressure surge (ρ=${carA.density.toFixed(0)} veh/km), recommend early switch.`, C.cyan);
    startTransition();
  }
}

function downstreamContextRisk(){
  const context = SIGNAL_NODES.filter(node => !(node.c===3 && node.r===2));
  const totals = context.reduce((acc,node)=>{
    const phaseState=nodePhase(node);
    const pressure=nodePressure(node);
    if(phaseState.phase==='NS') acc.ns += pressure;
    else acc.ew += pressure;
    return acc;
  },{ns:0,ew:0});
  const scale=Math.max(1,context.length/2);
  return {
    ns: Math.min(1,totals.ns/scale),
    ew: Math.min(1,totals.ew/scale)
  };
}

function nodePressure(node){
  const wave=(Math.sin(frame*0.04+node.offset*10)+1)*0.5;
  const scenarioBoost = activeScenarioKey==='event' ? 1.35 : activeScenarioKey==='rain' ? 1.12 : 1;
  return Math.min(1,(0.28+wave*0.55)*tuning.demand*scenarioBoost);
}

function startTransition(){
  if(sig.transitioning) return;
  sig.transitioning=true; sig.transTimer=0;
}

function doSwitch(carA,carB){
  sig.transitioning=false; sig.transTimer=0;
  sig.phase = sig.phase==='NS'?'EW':'NS';
  sig.timer=0; sig.cycleCount++;

  const serving = sig.phase==='NS'?carA:carB;
  const base=activeScenarioKey==='rain' ? 270 : activeScenarioKey==='event' ? 255 : 240;
  const dBonus=Math.min(180,serving.density*1.2);
  const wBonus=Math.min(140,serving.waitFrames*0.7);
  sig.greenDuration=Math.max(sig.minGreen, Math.min(sig.maxGreen, base+dBonus+wBonus));

  pushLog(`Phase → ${sig.phase} GREEN | recommended g=${(sig.greenDuration/30).toFixed(1)}s | Πₘ=${serving.piM.toFixed(2)}`, C.green);
  updateMPC(carA,carB);
}

// ── DRAWING ───────────────────────────────────────────────────
function drawRoadSegment(ctx, x1, y1, x2, y2, orientation){
  ctx.lineCap='square';
  ctx.strokeStyle='rgba(0,0,0,0.42)';
  ctx.lineWidth=ROAD_W+15;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

  ctx.strokeStyle='#0c1a30';
  ctx.lineWidth=ROAD_W+8;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

  ctx.strokeStyle=C.roadSurf;
  ctx.lineWidth=ROAD_W;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

  ctx.strokeStyle=orientation==='h' ? 'rgba(0,229,255,0.08)' : 'rgba(255,144,0,0.08)';
  ctx.lineWidth=ROAD_W*0.45;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}

function drawDistrictBlock(ctx, x, y, w, h, c, r){
  const seed=(c+1)*17+(r+1)*29;
  const glow=(Math.sin(frame*0.018+seed)+1)*0.5;

  ctx.fillStyle='rgba(2,8,16,0.62)';
  ctx.beginPath(); ctx.roundRect(x-4,y-3,w+8,h+7,5); ctx.fill();

  ctx.fillStyle='#07131f';
  ctx.strokeStyle='rgba(26,111,212,0.18)';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(x,y,w,h,4); ctx.fill(); ctx.stroke();

  const cols=2+(seed%3);
  const rows=2+((seed>>2)%3);
  const gap=4;
  const cellW=(w-gap*(cols+1))/cols;
  const cellH=(h-gap*(rows+1))/rows;

  for(let yy=0; yy<rows; yy++) for(let xx=0; xx<cols; xx++){
    const bx=x+gap+xx*(cellW+gap);
    const by=y+gap+yy*(cellH+gap);
    const lit=((xx+yy+seed+Math.floor(frame/90))%5)===0;
    ctx.fillStyle=lit
      ? `rgba(0,229,255,${0.08+glow*0.10})`
      : 'rgba(8,24,39,0.92)';
    ctx.strokeStyle=lit ? 'rgba(0,229,255,0.20)' : 'rgba(23,45,82,0.32)';
    ctx.beginPath(); ctx.roundRect(bx,by,Math.max(4,cellW),Math.max(4,cellH),2);
    ctx.fill(); ctx.stroke();
  }

  if((seed%4)===0){
    ctx.fillStyle='rgba(0,255,136,0.08)';
    ctx.strokeStyle='rgba(0,255,136,0.16)';
    ctx.beginPath(); ctx.roundRect(x+w*0.58,y+h*0.12,w*0.28,h*0.22,3); ctx.fill(); ctx.stroke();
  }
}

function drawCity(ctx){
  ctx.clearRect(0,0,CW,CH);

  // Background
  ctx.fillStyle=C.bg;
  ctx.fillRect(0,0,CW,CH);

  // Subtle dot grid
  ctx.fillStyle='rgba(26,111,212,0.07)';
  for(let x=0;x<CW;x+=24) for(let y=0;y<CH;y+=24){
    ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill();
  }

  // District blocks
  for(let r=0;r<ROWS-1;r++) for(let c=0;c<COLS-1;c++){
    const x1=OX+c*DX+INT_R+3, y1=OY+r*DY+INT_R+3;
    const x2=OX+(c+1)*DX-INT_R-3, y2=OY+(r+1)*DY-INT_R-3;
    const w=x2-x1, h=y2-y1;
    drawDistrictBlock(ctx,x1,y1,w,h,c,r);
  }

  // Roads (horizontal)
  for(let r=0;r<ROWS;r++){
    const y=OY+r*DY;
    drawRoadSegment(ctx, OX-30, y, OX+(COLS-1)*DX+30, y, 'h');
  }
  // Roads (vertical)
  for(let c=0;c<COLS;c++){
    const x=OX+c*DX;
    drawRoadSegment(ctx, x, OY-30, x, OY+(ROWS-1)*DY+30, 'v');
  }

  // Route highlights
  drawRouteHL(ctx, RA, C.cyan, 0.22);
  drawRouteHL(ctx, RB, C.orange, 0.22);

  // Density overlay
  drawDensityOverlay(ctx);

  // Road center markings (animated dash)
  ctx.setLineDash([7,11]); ctx.lineDashOffset=-(frame%18);
  ctx.lineWidth=1.2; ctx.strokeStyle=C.markY;
  for(let r=0;r<ROWS;r++){
    const y=OY+r*DY;
    ctx.beginPath(); ctx.moveTo(OX-30,y); ctx.lineTo(OX+(COLS-1)*DX+30,y); ctx.stroke();
  }
  for(let c=0;c<COLS;c++){
    const x=OX+c*DX;
    ctx.beginPath(); ctx.moveTo(x,OY-30); ctx.lineTo(x,OY+(ROWS-1)*DY+30); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Intersections
  drawIntersections(ctx);

  // Trails
  drawTrail(ctx,carA); drawTrail(ctx,carB);

  // Cars
  drawCar(ctx,carA); drawCar(ctx,carB);

  // Origin/destination markers
  drawMarker(ctx, RA[0], C.cyan, '⊙ A₀');
  drawMarker(ctx, RA[RA.length-1], C.cyan, '⊠ A₁');
  drawMarker(ctx, RB[0], C.orange, '⊙ B₀');
  drawMarker(ctx, RB[RB.length-1], C.orange, '⊠ B₁');

  // PATC overlay at key intersection
  drawPatcOverlay(ctx);

  // Sim time HUD
  ctx.fillStyle='rgba(5,13,26,0.75)';
  ctx.fillRect(6,6,126,19);
  ctx.fillStyle=C.green; ctx.font='10px IBM Plex Mono';
  ctx.fillText(`SIM ${(frame/30).toFixed(1).padStart(5,'0')}s  CYC #${sig.cycleCount}`, 11,19);
}

function drawRouteHL(ctx, route, color, alpha){
  ctx.strokeStyle=color; ctx.globalAlpha=alpha;
  ctx.lineWidth=ROAD_W*0.55; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(route[0].x, route[0].y);
  route.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.stroke();
  ctx.globalAlpha=1;
}

function drawDensityOverlay(ctx){
  // For each route segment, color based on car presence / density
  function segDensity(car, idx){
    if(car.arrived) return 0;
    if(car.segIdx===idx) return car.stopped?1.0:0.5;
    if(Math.abs(car.segIdx-idx)===1) return 0.2;
    return 0;
  }
  const routes=[{r:RA,car:carA,c:C.cyan},{r:RB,car:carB,c:C.orange}];
  routes.forEach(({r,car,c})=>{
    for(let i=0;i<r.length-1;i++){
      const d=Math.max(segDensity(car,i),0);
      if(d<0.01) continue;
      ctx.strokeStyle=c; ctx.globalAlpha=d*0.5;
      ctx.lineWidth=ROAD_W*0.35; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(r[i].x,r[i].y); ctx.lineTo(r[i+1].x,r[i+1].y); ctx.stroke();
    }
  });

  const pressure=(carA.density*scenario.densityA + carB.density*scenario.densityB) / 360;
  const pulse=0.5+0.5*Math.sin(frame*0.06);
  ctx.globalAlpha=Math.min(0.34,0.08+pressure*0.42);
  ctx.fillStyle=activeScenarioKey==='event' ? C.orange : activeScenarioKey==='rain' ? C.blue : C.cyan;
  ctx.beginPath();
  ctx.ellipse(KEY.x+10, KEY.y-8, 74+pulse*18, 42+pulse*8, -0.25, 0, Math.PI*2);
  ctx.fill();

  ctx.globalAlpha=0.32;
  ctx.strokeStyle=activeScenarioKey==='school' ? C.green : C.yellow;
  ctx.lineWidth=1.4;
  ctx.setLineDash([3,8]);
  ctx.beginPath();
  ctx.arc(KEY.x, KEY.y, 48+pulse*16, 0, Math.PI*2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha=1;
}

function drawIntersections(ctx){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p=nodePos(c,r);
    const isKey=(c===3&&r===2);
    const activeNode=SIGNAL_NODES.find(n=>n.c===c&&n.r===r);

    // Base circle
    ctx.fillStyle=isKey?'#0d1b30':'#0a1525';
    ctx.beginPath(); ctx.arc(p.x,p.y,INT_R,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=isKey?C.blue:'rgba(26,111,212,0.3)';
    ctx.lineWidth=isKey?1.5:0.8;
    ctx.stroke();

    if(activeNode){
      const localPhase = nodePhase(activeNode);
      const nsCol = localPhase.trans?C.yellow:(localPhase.phase==='NS'?C.green:C.red);
      const ewCol = localPhase.trans?C.yellow:(localPhase.phase==='EW'?C.green:C.red);

      ctx.fillStyle=nsCol;
      ctx.shadowColor=nsCol; ctx.shadowBlur=isKey?8:5;
      ctx.beginPath(); ctx.arc(p.x,p.y-INT_R-8,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=ewCol;
      ctx.shadowColor=ewCol;
      ctx.beginPath(); ctx.arc(p.x+INT_R+8,p.y,5,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }

    if(activeNode && !isKey){
      const pressure=nodePressure(activeNode);
      ctx.strokeStyle=pressure>0.43?C.orange:C.cyan;
      ctx.lineWidth=1;
      ctx.globalAlpha=pressure;
      ctx.beginPath(); ctx.arc(p.x,p.y,INT_R+9+pressure*7,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }

    if(isKey){
      // Pulsing ring on key intersection
      const pulse=0.5+0.5*Math.sin(frame*0.08);
      ctx.strokeStyle=C.purple; ctx.lineWidth=1.5; ctx.globalAlpha=pulse*0.5;
      ctx.beginPath(); ctx.arc(p.x,p.y,INT_R+6,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;

      // PATC label
      ctx.fillStyle=C.purple; ctx.font='bold 8px IBM Plex Mono';
      ctx.textAlign='center';
      ctx.fillText('PATC',p.x,p.y+INT_R+18);
      ctx.textAlign='left';
    }
  }
}

function nodePhase(node){
  if(node.c===3 && node.r===2){
    return {phase:sig.phase, trans:sig.transitioning};
  }
  const local=((frame/260)+node.offset)%1;
  return {
    phase: local<0.5 ? 'NS' : 'EW',
    trans: local>0.46 && local<0.53
  };
}

function drawTrail(ctx, car){
  car.trail.forEach((p,i)=>{
    if(i===0) return;
    ctx.strokeStyle=car.color; ctx.globalAlpha=p.a*0.35;
    ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(car.trail[i-1].x,car.trail[i-1].y);
    ctx.lineTo(p.x,p.y); ctx.stroke();
  });
  ctx.globalAlpha=1;
}

function drawCar(ctx, car){
  if(!car) return;
  const p=car.pos, d=car.dir;
  const angle=Math.atan2(d.y,d.x);
  const L=14, W=8;

  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(angle);

  // Glow
  if(!car.stopped){
    ctx.shadowColor=car.color; ctx.shadowBlur=12;
  }

  // Car body
  ctx.fillStyle=car.color;
  ctx.beginPath();
  ctx.roundRect(-L/2,-W/2,L,W,3);
  ctx.fill();

  // Windshield
  ctx.fillStyle='rgba(0,0,0,0.5)';
  ctx.fillRect(L/2-5,-W/2+2,4,W-4);

  // Headlights
  if(!car.stopped){
    ctx.fillStyle='rgba(255,255,200,0.9)';
    ctx.fillRect(L/2-1,-W/2+1,2,2);
    ctx.fillRect(L/2-1,W/2-3,2,2);
  }

  // Brake lights if stopped
  if(car.stopped){
    ctx.fillStyle=C.red;
    ctx.shadowColor=C.red; ctx.shadowBlur=8;
    ctx.fillRect(-L/2,-W/2+1,2,2);
    ctx.fillRect(-L/2,W/2-3,2,2);
  }

  ctx.shadowBlur=0;
  ctx.restore();

  // Label
  ctx.font='bold 9px IBM Plex Mono';
  ctx.fillStyle=car.color;
  ctx.fillText(car.id, p.x-4, p.y-L);
}

function drawMarker(ctx, p, color, label){
  ctx.strokeStyle=color; ctx.lineWidth=1.5;
  ctx.fillStyle='rgba(5,13,26,0.8)';
  ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle=color; ctx.font='9px IBM Plex Mono';
  ctx.fillText(label, p.x+10, p.y+3);
}

function drawPatcOverlay(ctx){
  const p=KEY;
  const boxX=p.x+22, boxY=p.y-46;
  ctx.fillStyle='rgba(8,17,34,0.88)';
  ctx.strokeStyle=C.purple; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(boxX,boxY,96,56,4); ctx.fill(); ctx.stroke();

  const phase=sig.phase, trans=sig.transitioning;
  const phaseLabel=trans?'TRANSIT':phase+' GREEN';
  const phaseCol=trans?C.yellow:C.green;

  ctx.font='7px IBM Plex Mono'; ctx.fillStyle=C.text2;
  ctx.fillText('PATC CTRL', boxX+5, boxY+11);
  ctx.font='bold 9px IBM Plex Mono'; ctx.fillStyle=phaseCol;
  ctx.fillText(phaseLabel, boxX+5, boxY+24);

  ctx.font='7px IBM Plex Mono'; ctx.fillStyle=C.text2;
  const rem=Math.max(0,(sig.greenDuration-sig.timer)/30).toFixed(1);
  ctx.fillText(`g=${rem}s rem`, boxX+5, boxY+36);
  ctx.fillText(`Πₘ(A)=${carA.piM.toFixed(2)} Πₘ(B)=${carB.piM.toFixed(2)}`, boxX+5, boxY+48);

  // Connector line
  ctx.strokeStyle=C.purple; ctx.lineWidth=0.8; ctx.globalAlpha=0.5;
  ctx.beginPath(); ctx.moveTo(p.x+INT_R+10,p.y-8); ctx.lineTo(boxX,boxY+28); ctx.stroke();
  ctx.globalAlpha=1;
}

function drawSimTime(ctx){
  // Already in drawCity
}

// ── MARKOV CANVAS ─────────────────────────────────────────────
function drawMarkov(ctx){
  const W=560, H=260;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07111f'; ctx.fillRect(0,0,W,H);

  const states=['Idle','Accel.','Flow'];
  const stColors=[C.red, C.yellow, C.green];
  const stX=[86,260,434], stY=86, SR=30;

  // Transition arrows
  function arrow(x1,y1,x2,y2,prob,lam){
    const sx=x1+SR, ex=x2-SR;
    const mx=(sx+ex)/2, my=y1-36;
    ctx.strokeStyle='rgba(255,255,255,0.34)'; ctx.lineWidth=1.4;
    ctx.setLineDash([4,7]);
    ctx.beginPath(); ctx.moveTo(sx,y1); ctx.quadraticCurveTo(mx,my,ex,y2); ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const dx=ex-mx, dy=y2-my;
    const len=Math.sqrt(dx*dx+dy*dy)||1;
    const ax=mx+dx/len*(Math.sqrt((ex-mx)**2+(y2-my)**2)-1);
    const ay=my+dy/len*(Math.sqrt((ex-mx)**2+(y2-my)**2)-1);
    ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(ax+dy/len*5-dx/len*6, ay-dx/len*5-dy/len*6);
    ctx.lineTo(ex,y2);
    ctx.lineTo(ax-dy/len*5-dx/len*6, ay+dx/len*5-dy/len*6);
    ctx.fill();

    ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono'; ctx.textAlign='center';
    ctx.fillText(lam, mx, my-7);
    ctx.fillStyle='rgba(0,229,255,0.85)'; ctx.font='bold 9px IBM Plex Mono';
    ctx.fillText(prob, mx, my+7);
    ctx.textAlign='left';
  }

  arrow(stX[0],stY,stX[1],stY,'p=1-e^-λ₁dt','λ₁=1.45/s');
  arrow(stX[1],stY,stX[2],stY,'p=1-e^-λ₂dt','λ₂=0.90/s');

  // Self-loop labels
  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono'; ctx.textAlign='center';
  ctx.fillText('1-p₁', stX[0], stY-SR-12);
  ctx.fillText('1-p₂', stX[1], stY-SR-12);
  ctx.fillText('absorbing', stX[2], stY-SR-12);

  const carsData=[
    {car:carA, label:'Veh-A', color:C.cyan},
    {car:carB, label:'Veh-B', color:C.orange}
  ];

  states.forEach((s,i)=>{
    const activeCars=carsData.filter(({car})=>car.mState===i);
    ctx.strokeStyle=stColors[i]; ctx.lineWidth=2;
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(stX[i],stY,SR,0,Math.PI*2); ctx.fill(); ctx.stroke();

    if(activeCars.length){
      ctx.save();
      activeCars.forEach(({color},idx)=>{
        ctx.strokeStyle=color;
        ctx.shadowColor=color;
        ctx.shadowBlur=10;
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(stX[i],stY,SR+6+idx*5,0,Math.PI*2);
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.fillStyle=stColors[i]; ctx.font='bold 11px IBM Plex Mono'; ctx.textAlign='center';
    ctx.fillText(s,stX[i],stY+4);
    activeCars.forEach(({color,label},idx)=>{
      ctx.fillStyle=color;
      ctx.font='bold 8px IBM Plex Mono';
      ctx.fillText(label.replace('Veh-',''), stX[i]-7+idx*14, stY+SR+20);
    });
    ctx.textAlign='left';
  });

  function probabilityRow(car,label,color,y){
    const x=24, w=292, h=13;
    ctx.fillStyle=color; ctx.font='bold 9px IBM Plex Mono';
    ctx.fillText(label,x,y+10);
    ctx.fillStyle='rgba(255,255,255,0.08)';
    ctx.fillRect(x+50,y,w,h);

    let cursor=x+50;
    car.pi.forEach((p,i)=>{
      const segW=Math.max(1,w*p);
      ctx.fillStyle=stColors[i];
      ctx.globalAlpha=0.78;
      ctx.fillRect(cursor,y,segW,h);
      ctx.globalAlpha=1;
      cursor+=segW;
    });
    ctx.strokeStyle='rgba(255,255,255,0.14)';
    ctx.strokeRect(x+50,y,w,h);

    ctx.fillStyle=C.text2; ctx.font='8px IBM Plex Mono';
    ctx.fillText(`I ${car.pi[0].toFixed(2)}  A ${car.pi[1].toFixed(2)}  F ${car.pi[2].toFixed(2)}  Πm ${car.piM.toFixed(2)}`, x+50, y+29);
  }

  probabilityRow(carA,'Veh-A',C.cyan,156);
  probabilityRow(carB,'Veh-B',C.orange,202);

  // Transition matrix display
  const mx=368, my=154, mw=168, mh=70;
  ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(mx,my,mw,mh);
  ctx.strokeStyle=C.border||'rgba(23,45,82,0.6)'; ctx.lineWidth=1; ctx.strokeRect(mx,my,mw,mh);
  ctx.fillStyle=C.text2; ctx.font='8px IBM Plex Mono';
  ctx.fillText('Transition matrix P', mx+8,my+16);
  ctx.fillStyle=C.cyan; ctx.font='8px IBM Plex Mono';
  ctx.fillText('⎡1-p₁  p₁   0⎤', mx+8, my+32);
  ctx.fillText('⎢  0  1-p₂ p₂⎥', mx+8, my+45);
  ctx.fillText('⎣  0    0   1 ⎦', mx+8, my+58);
  ctx.fillStyle=C.text2;
  ctx.fillText(`dt=1/30s`, mx+114, my+58);

  ctx.textAlign='center';
  ctx.fillStyle=C.text2; ctx.font='10px IBM Plex Mono';
  ctx.fillText(`π(k) = Pᵏ · π(0)  |  Πm(k) = α·πAccel(k) + πFlow(k)`, W/2, H-10);
  ctx.textAlign='left';
}

// ── LWR CANVAS ────────────────────────────────────────────────
function drawLWR(ctx){
  const W=560, H=260;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07111f'; ctx.fillRect(0,0,W,H);

  const PAD={l:62,r:28,t:28,b:48};
  const pw=W-PAD.l-PAD.r, ph=H-PAD.t-PAD.b;
  const rhoJ=180, rhoC=48;
  const vf=44;
  const w=(vf*rhoC)/(rhoJ-rhoC);
  const qMax=vf*rhoC;

  function rx(rho){ return PAD.l+rho/rhoJ*pw; }
  function qOf(rho){ return rho<=rhoC ? vf*rho : w*(rhoJ-rho); }
  function ry(q){ return PAD.t+ph-(q/qMax)*ph; }

  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  ctx.font='8px IBM Plex Mono'; ctx.fillStyle=C.text2;
  for(let i=0;i<=4;i++){
    const y=PAD.t+ph-ph*i/4;
    ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(PAD.l+pw,y); ctx.stroke();
    if(i>0) ctx.fillText(`${Math.round(qMax*i/4)}`, 12, y+3);
  }
  for(let i=1;i<=4;i++){
    const x=PAD.l+pw*i/4;
    ctx.beginPath(); ctx.moveTo(x,PAD.t); ctx.lineTo(x,PAD.t+ph); ctx.stroke();
    ctx.fillText(`${Math.round(rhoJ*i/4)}`, x-8, H-24);
  }

  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(PAD.l,PAD.t); ctx.lineTo(PAD.l,PAD.t+ph); ctx.lineTo(PAD.l+pw,PAD.t+ph); ctx.stroke();

  const rcX=rx(rhoC), qmY=ry(qMax);

  ctx.fillStyle='rgba(0,229,255,0.10)';
  ctx.beginPath(); ctx.moveTo(rx(0),ry(0)); ctx.lineTo(rcX,qmY); ctx.lineTo(rcX,ry(0)); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,48,64,0.10)';
  ctx.beginPath(); ctx.moveTo(rcX,qmY); ctx.lineTo(rx(rhoJ),ry(0)); ctx.lineTo(rcX,ry(0)); ctx.closePath(); ctx.fill();

  ctx.strokeStyle='rgba(255,193,7,0.95)'; ctx.lineWidth=3; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(rx(0),ry(0)); ctx.lineTo(rcX,qmY); ctx.lineTo(rx(rhoJ),ry(0)); ctx.stroke();

  ctx.setLineDash([4,5]); ctx.strokeStyle='rgba(255,255,255,0.32)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(rcX,PAD.t); ctx.lineTo(rcX,PAD.t+ph); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.l,qmY); ctx.lineTo(rcX,qmY); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle=C.cyan; ctx.font='9px IBM Plex Mono';
  ctx.fillText('free flow', rx(18), ry(qMax*0.32));
  ctx.fillStyle=C.red;
  ctx.fillText('congested', rx(98), ry(qMax*0.38));
  ctx.fillStyle=C.text2; ctx.font='8px IBM Plex Mono';
  ctx.fillText(`rho_c=${rhoC}`, rcX-15, H-10);
  ctx.fillText(`rho_j=${rhoJ}`, rx(rhoJ)-28, H-10);
  ctx.fillText(`q_max=${Math.round(qMax)}`, PAD.l+4, qmY-6);

  function plotPoint(car, label, color, row){
    if(car.arrived) return;
    const rho=Math.max(0,Math.min(rhoJ,car.density));
    const q = qOf(rho);
    const effQ = q * car.piM;
    const px=rx(rho);
    const py=ry(effQ);

    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(px,ry(q),4,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=color; ctx.shadowColor=color; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;

    ctx.strokeStyle=color; ctx.globalAlpha=0.35; ctx.lineWidth=1;
    ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px,PAD.t+ph); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;

    const textX=Math.min(px+12, W-174);
    const textY=Math.max(PAD.t+92+row*24, py-18+row*22);
    ctx.strokeStyle=color; ctx.globalAlpha=0.38; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(textX-6,textY-6); ctx.stroke();
    ctx.globalAlpha=1;

    ctx.fillStyle='rgba(5,13,26,0.82)';
    ctx.strokeStyle=color;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.roundRect(textX-5,textY-16,150,21,4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle=color; ctx.font='bold 9px IBM Plex Mono';
    ctx.fillText(`${label}: rho=${rho.toFixed(0)} q_eff=${Math.round(effQ)}`, textX, textY);
  }

  plotPoint(carA,'A',C.cyan,0);
  plotPoint(carB,'B',C.orange,1);

  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono'; ctx.textAlign='center';
  ctx.fillText('traffic density rho [veh/km/lane]', PAD.l+pw/2, H-4);
  ctx.save(); ctx.translate(16,PAD.t+ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('flow q [veh/hour/lane]',0,0); ctx.restore();
  ctx.textAlign='left';

  ctx.fillStyle='rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(PAD.l+10, H-24, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono';
  ctx.fillText('q(ρ) actual', PAD.l+18, H-20);
  ctx.fillStyle=C.cyan;
  ctx.beginPath(); ctx.arc(PAD.l+108, H-24, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=C.text2;
  ctx.fillText('q_eff = Pi_m x Q(rho)', PAD.l+118, H-20);
}

// ── SIGNAL TIMELINE ───────────────────────────────────────────
function updateTimeline(){
  tlHistory.push({frame, phase: sig.transitioning?'Y':sig.phase});
  if(tlHistory.length>TL_MAX) tlHistory.shift();
}

function drawTimeline(ctx){
  const W=1160, H=120;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07111f'; ctx.fillRect(0,0,W,H);

  const LABEL_W=60, PH=36, PAD_Y=20;
  const phases=[{k:'NS',y:PAD_Y,label:'N/S',activeCol:C.cyan},{k:'EW',y:PAD_Y+PH+8,label:'E/W',activeCol:C.orange}];
  const drawW=W-LABEL_W-10;

  // Row labels
  phases.forEach(({label,y})=>{
    ctx.fillStyle=C.text2; ctx.font='bold 10px IBM Plex Mono';
    ctx.textAlign='right';
    ctx.fillText(label, LABEL_W-6, y+PH/2+4);
  });
  ctx.textAlign='left';

  // History bars
  const n=tlHistory.length;
  const barW=Math.max(1, drawW/n);

  tlHistory.forEach(({phase:p},i)=>{
    const x=LABEL_W+i*barW;
    phases.forEach(({k,y,activeCol})=>{
      if(p===k){
        ctx.fillStyle=activeCol; ctx.globalAlpha=0.7;
      } else if(p==='Y'){
        ctx.fillStyle=C.yellow; ctx.globalAlpha=0.6;
      } else {
        ctx.fillStyle=C.red; ctx.globalAlpha=0.15;
      }
      ctx.fillRect(x,y,barW+0.5,PH);
    });
    ctx.globalAlpha=1;
  });

  // Current time marker
  ctx.strokeStyle=C.text; ctx.lineWidth=1.5; ctx.globalAlpha=0.8;
  ctx.beginPath(); ctx.moveTo(W-10,PAD_Y-4); ctx.lineTo(W-10,PAD_Y+PH*2+8+4); ctx.stroke();
  ctx.globalAlpha=1;

  // Time labels (every ~100 frames)
  ctx.fillStyle=C.text2; ctx.font='8px IBM Plex Mono';
  for(let i=0;i<n;i+=60){
    const x=LABEL_W+i*barW;
    const sec=((frame-n+i)/30).toFixed(0);
    ctx.fillText(`${sec}s`,x,H-6);
  }

  // Phase legend
  ctx.fillStyle=C.cyan; ctx.fillRect(W-180,8,12,8);
  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono'; ctx.fillText('N/S Green',W-164,16);
  ctx.fillStyle=C.orange; ctx.fillRect(W-100,8,12,8);
  ctx.fillText('E/W Green',W-84,16);
}

// ── Pi_m GAUGES ───────────────────────────────────────────────
function drawGauge(ctx, cx, cy, R, value, color, label, sublabel){
  const start=Math.PI*0.75, end=Math.PI*2.25;

  // Track
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=12; ctx.lineCap='butt';
  ctx.beginPath(); ctx.arc(cx,cy,R,start,end); ctx.stroke();

  // Fill
  const fillEnd=start+(end-start)*Math.min(1,Math.max(0,value));
  ctx.strokeStyle=color; ctx.lineWidth=12;
  ctx.shadowColor=color; ctx.shadowBlur=value>0.1?10:0;
  ctx.beginPath(); ctx.arc(cx,cy,R,start,fillEnd); ctx.stroke();
  ctx.shadowBlur=0;

  // Ticks
  for(let i=0;i<=10;i++){
    const angle=start+(end-start)*i/10;
    const inner=R-8, outer=R+2;
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=0.8;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(angle)*inner, cy+Math.sin(angle)*inner);
    ctx.lineTo(cx+Math.cos(angle)*outer, cy+Math.sin(angle)*outer);
    ctx.stroke();
  }

  // Value text
  ctx.fillStyle=color; ctx.font=`bold 20px IBM Plex Mono`; ctx.textAlign='center';
  ctx.fillText(value.toFixed(2),cx,cy+6);
  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono';
  ctx.fillText(label,cx,cy+22);
  ctx.fillStyle=C.text; ctx.font='8px IBM Plex Mono';
  ctx.fillText(sublabel,cx,cy-R-16);
  ctx.textAlign='left';
}

function drawPim(ctx){
  const W=560, H=220;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07111f'; ctx.fillRect(0,0,W,H);

  drawGauge(ctx, 140, 120, 65, carA.piM, C.cyan, 'Πₘ(A)', 'Vehicle A');
  drawGauge(ctx, 420, 120, 65, carB.piM, C.orange, 'Πₘ(B)', 'Vehicle B');

  // State label
  function stateLabel(car, x){
    const labels=['Idle','Accelerating','Constant Flow'];
    const cols=[C.red,C.yellow,C.green];
    ctx.fillStyle=cols[car.mState]; ctx.font='bold 10px IBM Plex Mono'; ctx.textAlign='center';
    ctx.fillText(labels[car.mState],x,H-18);
    ctx.textAlign='left';
  }
  stateLabel(carA,140); stateLabel(carB,420);

  // Formula
  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono'; ctx.textAlign='center';
  ctx.fillText('Πₘ(k) = α·πₐ(k) + 1·πꜰ(k)   |   α ≈ 0.65   |   q_eff = Πₘ · Q(ρ)', W/2, H-4);
  ctx.textAlign='left';
}

// ── MPC HORIZON ───────────────────────────────────────────────
function updateMPC(carA,carB){
  for(let h=0;h<6;h++){
    const nsRaw = carA.density*(1+carA.waitFrames/80);
    const ewRaw = carB.density*(1+carB.waitFrames/80);
    const total = nsRaw+ewRaw+10;
    const nsShare=nsRaw/total*0.75;
    const ewShare=ewRaw/total*0.75;
    const lost=1-nsShare-ewShare;
    // Apply decay for future steps
    const decay=Math.pow(0.9,h);
    mpcHorizon[h]={
      ns: Math.max(0.05, nsShare*decay + 0.1*(1-decay)),
      ew: Math.max(0.05, ewShare*decay + 0.1*(1-decay)),
      lost: Math.max(0.05, lost)
    };
  }
}

function drawMPC(ctx){
  const W=560, H=220;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07111f'; ctx.fillRect(0,0,W,H);

  const PAD={l:50,r:20,t:20,b:50};
  const pw=W-PAD.l-PAD.r, ph=H-PAD.t-PAD.b;
  const N=6, bw=pw/N, gap=8;

  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(PAD.l,PAD.t); ctx.lineTo(PAD.l,PAD.t+ph);
  ctx.lineTo(PAD.l+pw,PAD.t+ph); ctx.stroke();

  mpcHorizon.forEach((step,i)=>{
    const x=PAD.l+i*bw+gap/2;
    const bWidth=bw-gap;
    const isCurrent=i===0;

    // Current step highlight
    if(isCurrent){
      ctx.fillStyle='rgba(26,111,212,0.1)';
      ctx.fillRect(x-2,PAD.t,bWidth+4,ph);
    }

    // Stacked bar: NS (bottom) + EW (middle) + Lost (top)
    const nsH=step.ns*ph, ewH=step.ew*ph, lostH=step.lost*ph;
    const yBase=PAD.t+ph;

    // N/S bar
    ctx.fillStyle=C.cyan; ctx.globalAlpha=isCurrent?1:0.5+0.5/6*(6-i);
    ctx.fillRect(x, yBase-nsH, bWidth, nsH);

    // E/W bar
    ctx.fillStyle=C.orange;
    ctx.fillRect(x, yBase-nsH-ewH, bWidth, ewH);

    // Lost time
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(x, yBase-nsH-ewH-lostH, bWidth, lostH);
    ctx.globalAlpha=1;

    // Step label
    ctx.fillStyle=isCurrent?C.text:C.text2; ctx.font=isCurrent?'bold 9px IBM Plex Mono':'9px IBM Plex Mono';
    ctx.textAlign='center';
    ctx.fillText(`n+${i}`, x+bWidth/2, PAD.t+ph+14);
    ctx.fillText(`${((step.ns+step.ew)*30).toFixed(0)}s`, x+bWidth/2, PAD.t+ph+26);
    ctx.textAlign='left';
  });

  // Y axis labels
  ctx.fillStyle=C.text2; ctx.font='8px IBM Plex Mono';
  ['0%','25%','50%','75%','100%'].forEach((l,i)=>{
    const y=PAD.t+ph-i*ph/4;
    ctx.fillText(l,4,y+3);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.5;
    if(i>0){ ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(PAD.l+pw,y); ctx.stroke(); }
  });

  // Legend
  ctx.fillStyle=C.cyan; ctx.fillRect(PAD.l,H-16,10,8);
  ctx.fillStyle=C.text2; ctx.font='9px IBM Plex Mono'; ctx.fillText('N/S Green',PAD.l+14,H-8);
  ctx.fillStyle=C.orange; ctx.fillRect(PAD.l+100,H-16,10,8);
  ctx.fillText('E/W Green',PAD.l+114,H-8);
  ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(PAD.l+205,H-16,10,8);
  ctx.fillText('Lost Time',PAD.l+219,H-8);

  ctx.fillStyle=C.text2; ctx.font='8px IBM Plex Mono'; ctx.textAlign='right';
  ctx.fillText('Prediction steps (N꜀=5s each → 30s horizon)',W-PAD.r,H-8);
  ctx.textAlign='left';
}

// ── UI UPDATES ────────────────────────────────────────────────
function updateUI(){
  // Signal phases
  const ns=document.getElementById('sigNS');
  const ew=document.getElementById('sigEW');
  ns.className='sig-phase '+(sig.transitioning?'yellow-phase':sig.phase==='NS'?'green-phase':'red-phase');
  ew.className='sig-phase '+(sig.transitioning?'yellow-phase':sig.phase==='EW'?'green-phase':'red-phase');
  document.getElementById('nsTimer').textContent=sig.phase==='NS'?`${Math.max(0,(sig.greenDuration-sig.timer)/30).toFixed(1)}s`:'—';
  document.getElementById('ewTimer').textContent=sig.phase==='EW'?`${Math.max(0,(sig.greenDuration-sig.timer)/30).toFixed(1)}s`:'—';
  document.getElementById('cycleCount').textContent=sig.cycleCount;
  document.getElementById('switchCountdown').textContent=
    sig.transitioning?'TRANSIT…':
    `${Math.max(0,(sig.greenDuration-sig.timer)/30).toFixed(1)}s`;

  function stateClass(car){
    if(car.arrived) return 'state-done';
    return ['state-idle','state-acc','state-flow'][car.mState]||'state-idle';
  }
  function stateText(car){
    if(car.arrived) return 'ARRIVED';
    return ['IDLE','ACCEL','FLOW'][car.mState]||'IDLE';
  }

  const aBadge=document.getElementById('aStateBadge');
  aBadge.className=`car-state-badge ${stateClass(carA)}`;
  aBadge.textContent=stateText(carA);

  const bBadge=document.getElementById('bStateBadge');
  bBadge.className=`car-state-badge ${stateClass(carB)}`;
  bBadge.textContent=stateText(carB);

  // Car A metrics
  document.getElementById('aDensity').textContent=carA.density.toFixed(1);
  document.getElementById('aDensityBar').style.width=`${Math.min(100,carA.density/180*100)}%`;
  document.getElementById('aPim').textContent=carA.piM.toFixed(2);
  document.getElementById('aPimBar').style.width=`${carA.piM*100}%`;
  document.getElementById('aWait').textContent=(carA.waitFrames/30).toFixed(1);
  const aP=Math.round(carA.progress*100);
  document.getElementById('aProgress').textContent=aP;
  document.getElementById('aProgressBar').style.width=`${aP}%`;

  // Car B metrics
  document.getElementById('bDensity').textContent=carB.density.toFixed(1);
  document.getElementById('bDensityBar').style.width=`${Math.min(100,carB.density/180*100)}%`;
  document.getElementById('bPim').textContent=carB.piM.toFixed(2);
  document.getElementById('bPimBar').style.width=`${carB.piM*100}%`;
  document.getElementById('bWait').textContent=(carB.waitFrames/30).toFixed(1);
  const bP=Math.round(carB.progress*100);
  document.getElementById('bProgress').textContent=bP;
  document.getElementById('bProgressBar').style.width=`${bP}%`;

  const load=Math.min(100, Math.round((carA.density + carB.density) / 360 * 100));
  const maxWait=Math.max(carA.waitFrames, carB.waitFrames) / 30;
  const risk=maxWait > 8 || load > 55 ? 'high' : maxWait > 3 || load > 34 ? 'medium' : 'low';
  setText('networkLoad', `${load}%`);
  setText('queueRisk', risk);
  setText('activeScenario', scenario.label);
}

// ── MAIN LOOP ─────────────────────────────────────────────────
const cityCtx = document.getElementById('cityCanvas').getContext('2d');
const markovCtx = document.getElementById('markovCanvas').getContext('2d');
const lwrCtx = document.getElementById('lwrCanvas').getContext('2d');
const tlCtx = document.getElementById('timelineCanvas').getContext('2d');
const pimCtx = document.getElementById('pimCanvas').getContext('2d');
const mpcCtx = document.getElementById('mpcCanvas').getContext('2d');

let lastTime=0, acc=0;
const STEP=1000/30; // 30fps target

function simStep(){
  syncTuningFromControls();
  for(let i=0;i<Math.round(simSpeed);i++){
    updateSignal(carA,carB);
    carA.update(sig); carB.update(sig);
    updateTimeline();
    frame++;
    mpcUpdateTimer++;
    if(mpcUpdateTimer>=150){ updateMPC(carA,carB); mpcUpdateTimer=0; }
  }
}

function mainLoop(ts){
  requestAnimationFrame(mainLoop);
  if(paused) return;

  acc+=ts-lastTime; lastTime=ts;
  const limit=simSpeed>1?STEP/simSpeed:STEP;
  if(acc<limit) return;
  acc=acc%limit;

  // Reset if both arrived
  if(carA.arrived && carB.arrived){
    resetTimer++;
    if(resetTimer>90){
      resetSimulation('Replay loop restarted');
    }
  } else { resetTimer=0; }

  simStep();

  // Render
  drawCity(cityCtx);
  drawMarkov(markovCtx);
  drawLWR(lwrCtx);
  drawTimeline(tlCtx);
  drawPim(pimCtx);
  drawMPC(mpcCtx);
  updateUI();
}

// ── CONTROLS ──────────────────────────────────────────────────
function resetSimulation(message='Replay restarted'){
  carA.startDelay=scenario.delayA;
  carB.startDelay=scenario.delayB;
  carA.reset(); carB.reset();
  sig.phase=scenario.phase;
  sig.greenDuration=scenario.greenDuration;
  sig.timer=0; sig.transitioning=false; sig.transTimer=0;
  sig.cycleCount=0; frame=0; resetTimer=0; mpcUpdateTimer=0;
  tlHistory.length=0;
  updateMPC(carA,carB);
  pushLog(`— ${message} —`, C.purple);
}

function applyScenario(key){
  if(!SCENARIOS[key]) return;
  activeScenarioKey=key;
  scenario=SCENARIOS[key];

  document.querySelectorAll('.scenario-btn').forEach(btn=>{
    const active=btn.dataset.scenario===key;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });

  const title=document.getElementById('scenarioTitle');
  const copy=document.getElementById('scenarioCopy');
  if(title) title.textContent=scenario.title;
  if(copy) copy.textContent=scenario.copy;

  resetSimulation(`${scenario.label} scenario loaded`);
}

function setSpeed(s, btn){
  simSpeed=s;
  document.querySelectorAll('.btn').forEach(b=>{
    if(['btn1x','btn2x','btn05x'].includes(b.id)) b.classList.remove('active');
  });
  btn.classList.add('active');
}

document.getElementById('btnPause').addEventListener('click',()=>{
  paused=!paused;
  document.getElementById('btnPause').textContent=paused?'▶ RESUME':'⏸ PAUSE';
});
document.getElementById('btnRestart').addEventListener('click',()=>{
  resetSimulation('Manual replay restart');
});

document.addEventListener('click',event=>{
  const btn=event.target.closest('.scenario-btn');
  if(btn) applyScenario(btn.dataset.scenario);
});

['demandRange','frictionRange','safetyRange'].forEach(id=>{
  const control=el(id);
  if(control) control.addEventListener('input',syncTuningFromControls);
});

// ── INITIAL MPC fill ─────────────────────────────────────────
syncTuningFromControls();
updateMPC(carA,carB);

// ── KPI BAR ANIMATION ─────────────────────────────────────────
setTimeout(()=>{
  document.querySelectorAll('.kpi-bar-fill').forEach(el=>{
    const target=el.dataset.target;
    el.style.width=target+'%';
  });
},600);

// ── Start ─────────────────────────────────────────────────────
requestAnimationFrame(ts=>{ lastTime=ts; requestAnimationFrame(mainLoop); });
