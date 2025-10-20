// ===== CONFIG =====
const BAUD_RATE = 9600;
const COLS = 12;
const ROWS = 12;

// ===== Game vars =====
let cellSize = 40;
let playerX = 0;
let playerY = 0; // start bovenste rij links
let score = 0;
let highScore = 0;
let co2Level = 0;

// ===== Serial vars =====
let port = null;
let writer = null;

// DOM
let connectBtn, statusEl;

// Top 10 scores
let topScores = [];

// p5 setup
function setup() {
  createCanvas(COLS*cellSize + 150, ROWS*cellSize + 120); // +150 voor highscore lijst
  textFont('sans-serif');

  loadState();
  topScores = JSON.parse(localStorage.getItem('topScores')||'[]');

  // UI elements
  connectBtn = select('#connectBtn');
  statusEl = select('#status');

  connectBtn.mousePressed(connectSerial);

  createActionButtons();
  updateStatus();
}

function draw() {
  background(245);
  drawGrid();
  drawPlayer();
  drawHUD();
  drawTopScores();
}

// ===== Draw grid & player =====
function drawGrid() {
  stroke(200);
  noFill();
  for (let x=0; x<COLS; x++){
    for (let y=0; y<ROWS; y++){
      rect(x*cellSize, y*cellSize, cellSize, cellSize);
    }
  }
}

function drawPlayer() {
  fill(60,140,255);
  noStroke();
  ellipse(playerX*cellSize + cellSize/2, playerY*cellSize + cellSize/2, cellSize*0.7);
}

// ===== HUD =====
function drawHUD() {
  fill(0);
  textSize(16);
  textAlign(LEFT, TOP);
  text(`Score: ${score}`, 8, ROWS*cellSize + 6);
  text(`Highscore: ${highScore}`, 130, ROWS*cellSize + 6);
  text(`CO₂: ${co2Level}`, 320, ROWS*cellSize + 6);
}

// ===== Top 10 scores sidebar =====
function drawTopScores() {
  fill(0);
  textSize(14);
  textAlign(LEFT, TOP);
  text("Top 10 Scores:", COLS*cellSize + 10, 10);
  for (let i=0; i<topScores.length; i++){
    text(`${i+1}. ${topScores[i]}`, COLS*cellSize + 10, 30 + i*20);
  }
}

// ===== Buttons =====
function createActionButtons() {
  const actions = [
    { label:'🚗 Auto', move:-1, pts:-8, co2:+2 },
    { label:'✈️ Vliegtuig', move:-1, pts:-8, co2:+3 },
    { label:'🚲 Fiets', move:+1, pts:+5, co2:-1 },
    { label:'🚶 Wandelen', move:+1, pts:+5, co2:-1 }
  ];

  const y = ROWS*cellSize + 40;
  let x = 10;
  actions.forEach(a=>{
    const b = createButton(a.label);
    b.class('actionBtn');
    b.position(x,y);
    b.mousePressed(()=>performAction(a.move,a.pts,a.co2));
    x += 110;
  });
}

// ===== Movement & scoring =====
function performAction(moveDir, ptsChange, co2Change){
  if (moveDir>0) moveForward(1); else moveBack(1);

  score += ptsChange;
  co2Level = constrain(co2Level + co2Change, 0, 5);

  if (score>highScore) highScore = score;

  saveState();
  sendCO2Level();
  checkEnd();
}

function moveForward(steps){
  for (let s=0; s<steps; s++){
    playerX++;
    if (playerX >= COLS){
      playerX = 0;
      playerY++;
      if (playerY >= ROWS) playerY = ROWS-1;
    }
  }
}

function moveBack(steps){
  for (let s=0; s<steps; s++){
    playerX--;
    if (playerX<0){
      playerX = COLS-1;
      playerY--;
      if (playerY<0) playerY=0;
    }
  }
}

// ===== Check end =====
function checkEnd(){
  if (playerX===COLS-1 && playerY===ROWS-1){
    // voeg score toe aan topScores
    topScores.push(score);
    topScores.sort((a,b)=>b-a);
    if (topScores.length>10) topScores.length = 10;
    localStorage.setItem('topScores', JSON.stringify(topScores));

    alert(`🎉 Einde grid! Score: ${score}`);

    // reset game
    score = 0;
    co2Level = 0;
    playerX = 0;
    playerY = 0;
    saveState();
    updateStatus();
    sendCO2Level();
  }
}

// ===== LocalStorage =====
function saveState(){
  localStorage.setItem('gameState', JSON.stringify({
    playerX, playerY, score, highScore, co2Level
  }));
}

function loadState(){
  try {
    const s = JSON.parse(localStorage.getItem('gameState')||'{}');
    if (s.playerX!==undefined) playerX = s.playerX;
    if (s.playerY!==undefined) playerY = s.playerY;
    if (s.score!==undefined) score = s.score;
    if (s.highScore!==undefined) highScore = s.highScore;
    if (s.co2Level!==undefined) co2Level = s.co2Level;
  } catch(e){}
}

function updateStatus(){
  statusEl.textContent = port && port.writable ? 'Status: verbonden' : 'Status: niet verbonden';
}

// ===== Serial =====
async function connectSerial(){
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: BAUD_RATE });
    writer = port.writable.getWriter();
    connectBtn.hide();
    updateStatus();
  } catch(err){
    console.error(err);
    alert('Kan niet verbinden: '+err);
  }
}

async function sendCO2Level(){
  if (!writer) return;
  try {
    const text = co2Level+'\n';
    await writer.write(new TextEncoder().encode(text));
  } catch(err){
    console.error(err);
  }
}
