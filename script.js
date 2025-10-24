// ===== CONFIG =====
const BAUD_RATE = 9600;
const COLS = 12;
const ROWS = 12;

// ===== Game vars =====
let cellSize = 40;
let playerX = 0;
let playerY = 0;
let score = 0;
let highScore = 0;
let co2Level = 0;
let playerIcon = "🙂"; // standaard icoon

// ===== Serial vars =====
let port = null;
let writer = null;

// DOM
let connectBtn, statusEl;

// Top 10 scores
let topScores = [];

// ===== p5 setup =====
function setup() {
  const canvasWidth = COLS * cellSize + 150;
  const canvasHeight = ROWS * cellSize + 120;
  createCanvas(canvasWidth, canvasHeight).parent(document.body);
  textFont('sans-serif');

  loadState();
  topScores = JSON.parse(localStorage.getItem('topScores') || '[]');

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

// ===== Grid & player =====
function drawGrid() {
  stroke(200);
  noFill();
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      rect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

function drawPlayer() {
  textAlign(CENTER, CENTER);
  textSize(cellSize * 0.7);
  text(playerIcon, playerX * cellSize + cellSize / 2, playerY * cellSize + cellSize / 2);
}

// ===== HUD =====
function drawHUD() {
  fill(0);
  textSize(16);
  textAlign(LEFT, TOP);
  text(`Score: ${score}`, 8, ROWS * cellSize + 6);
  text(`Highscore: ${highScore}`, 130, ROWS * cellSize + 6);
  text(`CO₂-niveau: ${co2Level}`, 320, ROWS * cellSize + 6);
}

// ===== Top 10 scores =====
function drawTopScores() {
  fill(0);
  textSize(14);
  textAlign(LEFT, TOP);
  text("Top 10 Scores:", COLS * cellSize + 10, 10);
  for (let i = 0; i < topScores.length; i++) {
    text(`${i + 1}. ${topScores[i]}`, COLS * cellSize + 10, 30 + i * 20);
  }
}

// ===== Buttons =====
function createActionButtons() {
  const actions = [
    { label: '🚗 Auto', move: -1, pts: -5, co2: +2, icon: '🚗' },
    { label: '✈️ Vliegtuig', move: -2, pts: -8, co2: +3, icon: '✈️' },
    { label: '🚲 Fiets', move: +5, pts: +5, co2: -2, icon: '🚲' },
    { label: '🚶 Wandelen', move: +5, pts: +5, co2: -2, icon: '🚶' },
    { label: '🚆 Trein', move: +1, pts: +2, co2: -1, icon: '🚆' },
    { label: '🚌 Bus', move: +1, pts: +2, co2: -1, icon: '🚌' },
    { label: '🏍️ Motor/scooter', move: -1, pts: -5, co2: +1, icon: '🏍️' },
  ];

  const container = createDiv();
  container.id('buttonContainer');
  container.style('display', 'flex');
  container.style('justify-content', 'center');
  container.style('flex-wrap', 'wrap');
  container.style('gap', '12px');
  container.style('margin-top', '20px');
  container.style('position', 'relative');

  actions.forEach(a => {
    const b = createButton(a.label);
    b.class('actionBtn');
    b.mousePressed(() => {
      playerIcon = a.icon; // verander icoon
      performAction(a.move, a.pts, a.co2); // score en co2 veranderen automatisch
    });
    b.parent(container);
  });
}

// ===== Movement & scoring =====
function performAction(moveDir, ptsChange, co2Change) {
  if (moveDir > 0) moveForward(moveDir);        // gebruik het aantal stappen positief
  else moveBack(Math.abs(moveDir));            // gebruik het aantal stappen negatief

  score += ptsChange;
  co2Level = constrain(co2Level + co2Change, 0, 5);

  if (score > highScore) highScore = score;

  saveState();
  sendCO2Level();
  checkEnd();
}

function moveForward(steps) {
  for (let s = 0; s < steps; s++) {
    playerX++;
    if (playerX >= COLS) {
      playerX = 0;
      playerY++;
      if (playerY >= ROWS) playerY = ROWS - 1;
    }
  }
}

function moveBack(steps) {
  for (let s = 0; s < steps; s++) {
    playerX--;
    if (playerX < 0) {
      playerX = COLS - 1;
      playerY--;
      if (playerY < 0) playerY = 0;
    }
  }
}

// ===== End check =====
function checkEnd() {
  if (playerX === COLS - 1 && playerY === ROWS - 1) {
    topScores.push(score);
    topScores.sort((a, b) => b - a);
    if (topScores.length > 10) topScores.length = 10;
    localStorage.setItem('topScores', JSON.stringify(topScores));

    alert(`🎉 Einde grid! Score: ${score}`);

    score = 0;
    co2Level = 0;
    playerX = 0;
    playerY = 0;
    playerIcon = "🙂";
    saveState();
    updateStatus();
    sendCO2Level();
  }
}

// ===== LocalStorage =====
function saveState() {
  localStorage.setItem('gameState', JSON.stringify({
    playerX, playerY, score, highScore, co2Level, playerIcon
  }));
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('gameState') || '{}');
    if (s.playerX !== undefined) playerX = s.playerX;
    if (s.playerY !== undefined) playerY = s.playerY;
    if (s.score !== undefined) score = s.score;
    if (s.highScore !== undefined) highScore = s.highScore;
    if (s.co2Level !== undefined) co2Level = s.co2Level;
    if (s.playerIcon !== undefined) playerIcon = s.playerIcon;
  } catch (e) { }
}

function updateStatus() {
  statusEl.textContent = port && port.writable ? 'Status: verbonden' : 'Status: niet verbonden';
}

// ===== Serial =====
async function connectSerial() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: BAUD_RATE });
    writer = port.writable.getWriter();
    connectBtn.hide();
    updateStatus();
  } catch (err) {
    console.error(err);
    alert('Kan niet verbinden: ' + err);
  }
}

async function sendCO2Level() {
  if (!writer) return;
  try {
    const text = co2Level + '\n';
    await writer.write(new TextEncoder().encode(text));
  } catch (err) {
    console.error(err);
  }
}
