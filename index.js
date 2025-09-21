const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");
const chartCanvas = document.getElementById('chart');
const chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;

canvas.width = innerWidth;
canvas.height = innerHeight;
if (chartCanvas && chartCtx) {
  // デバイスピクセル比対応
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cssW = chartCanvas.width;
  const cssH = chartCanvas.height;
  chartCanvas.style.width = cssW + 'px';
  chartCanvas.style.height = cssH + 'px';
  chartCanvas.width = Math.floor(cssW * dpr);
  chartCanvas.height = Math.floor(cssH * dpr);
  chartCtx.scale(dpr, dpr);
}

// SIRモデル設定（Step 1）
const SIR_CONFIG = {
  populationN: 2000,            // 個体数（現状維持）
  infectionRadius: 15,        // 感染判定半径（今は未使用、Step 4で使用）
  beta: 0.35,                 // 感染率（今は未使用、Step 4で使用）
  gamma: 0.125,               // 回復率（今は未使用、Step 5で使用）
  initialInfected: 100,       // 初期感染者数（今は未使用、Step 2で反映）
  agentRadius: 10,            // 各エージェントの半径（固定）
  fatality: 0.02,             // 致死率（表示計算用）
  colors: {                   // 状態に応じた色
    S: "hsl(210 80% 60%)",   // Susceptible: 青
    I: "hsl(0 80% 60%)",     // Infectious: 赤
    R: "hsl(120 60% 45%)"    // Recovered: 緑
  }
};

class Life {
  constructor(x, y, radius, color, velocity) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
    // SIR状態（Step 1）
    this.state = 'S';
    this.infectedAt = null;
  }

  draw() {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    // 状態に応じた色で描画（Step 1）
    c.fillStyle = SIR_CONFIG.colors[this.state] || this.color;
    c.fill();
  }

  update() {
    // 位置を更新
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // 周期境界条件（半径込み）
    if (this.x < -this.radius) this.x = canvas.width + this.radius;//左端
    if (this.x > canvas.width + this.radius) this.x = -this.radius;//右端
    if (this.y < -this.radius) this.y = canvas.height + this.radius;//上端
    if (this.y > canvas.height + this.radius) this.y = -this.radius;//下端

    // 描画
    this.draw();
  }
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomVelocity(minSpeed, maxSpeed) {
  const angle = Math.random() * Math.PI * 2;
  const speed = randomBetween(minSpeed, maxSpeed);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

// トーラス（周期境界）での距離二乗
function distanceSquaredTorus(ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  let dy = Math.abs(ay - by);
  dx = Math.min(dx, canvas.width - dx);
  dy = Math.min(dy, canvas.height - dy);
  return dx * dx + dy * dy;
}

// Step 6: S/I/Rカウント表示用のHUD
function drawHUD(sCount, iCount, rCount, timeSec) {
  const sText = `S: ${sCount}`;
  const iText = `I: ${iCount}`;
  const rText = `R: ${rCount}`;
  const tText = `t=${timeSec.toFixed(1)}s`;
  const sep = '  ';

  const fullText = `${sText}${sep}${iText}${sep}${rText}${sep}${tText}`;

  c.save();
  c.font = '14px sans-serif';
  c.textBaseline = 'top';
  const padding = 8;
  const x = 8;
  const y = 8;
  const textWidth = c.measureText(fullText).width;
  const textHeight = 16;
  c.fillStyle = 'rgba(0, 0, 0, 0.5)';
  c.fillRect(x - padding / 2, y - padding / 2, textWidth + padding, textHeight + padding);

  let cursorX = x;
  c.fillStyle = SIR_CONFIG.colors.S;
  c.fillText(sText, cursorX, y);
  cursorX += c.measureText(`${sText}${sep}`).width;

  c.fillStyle = SIR_CONFIG.colors.I;
  c.fillText(iText, cursorX, y);
  cursorX += c.measureText(`${iText}${sep}`).width;

  c.fillStyle = SIR_CONFIG.colors.R;
  c.fillText(rText, cursorX, y);
  cursorX += c.measureText(`${rText}${sep}`).width;

  c.fillStyle = '#ffffff';
  c.fillText(tText, cursorX, y);
  c.restore();
}

let lives = [];

// 入力UIと連携して個体群を再生成
function createPopulation() {
  const arr = Array.from({ length: SIR_CONFIG.populationN }, (_, i) => {
    const radius = SIR_CONFIG.agentRadius;
    const x = randomBetween(radius, canvas.width - radius);
    const y = randomBetween(radius, canvas.height - radius);
    const isInfected = i < Math.min(SIR_CONFIG.initialInfected, SIR_CONFIG.populationN);
    const color = isInfected ? SIR_CONFIG.colors.I : SIR_CONFIG.colors.S;
    const velocity = randomVelocity(0.5, 2.0);
    const life = new Life(x, y, radius, color, velocity);
    if (isInfected) {
      life.state = 'I';
      life.infectedAt = 0;
    }
    return life;
  });
  return arr;
}

function resetSimulation(params) {
  if (params) {
    if (typeof params.populationN === 'number' && isFinite(params.populationN) && params.populationN > 0) {
      SIR_CONFIG.populationN = Math.floor(params.populationN);
    }
    if (typeof params.beta === 'number' && isFinite(params.beta) && params.beta >= 0) {
      SIR_CONFIG.beta = params.beta;
    }
    if (typeof params.gamma === 'number' && isFinite(params.gamma) && params.gamma >= 0) {
      SIR_CONFIG.gamma = params.gamma;
    }
    if (typeof params.initialInfected === 'number' && isFinite(params.initialInfected) && params.initialInfected >= 0) {
      SIR_CONFIG.initialInfected = Math.floor(Math.min(params.initialInfected, SIR_CONFIG.populationN));
    }
    if (typeof params.fatality === 'number' && isFinite(params.fatality) && params.fatality >= 0) {
      SIR_CONFIG.fatality = Math.max(0, Math.min(1, params.fatality));
    }
  }
  // 時間をリセット
  __simLastTs = null;
  __simTimeSec = 0;
  __history = [];
  // 個体群を再生成
  lives = createPopulation();
}

function initControls() {
  const popNEl = document.getElementById('popN');
  const betaEl = document.getElementById('beta');
  const gammaEl = document.getElementById('gamma');
  const initIEl = document.getElementById('initI');
  const fatalityEl = document.getElementById('fatality');
  const applyBtn = document.getElementById('apply-btn');
  if (!popNEl || !betaEl || !gammaEl || !initIEl || !fatalityEl || !applyBtn) return;

  // 現在値を反映
  popNEl.value = String(SIR_CONFIG.populationN);
  betaEl.value = String(SIR_CONFIG.beta);
  gammaEl.value = String(SIR_CONFIG.gamma);
  initIEl.value = String(SIR_CONFIG.initialInfected);
  fatalityEl.value = String(SIR_CONFIG.fatality);

  applyBtn.addEventListener('click', () => {
    const next = {
      populationN: parseInt(popNEl.value, 10),
      beta: parseFloat(betaEl.value),
      gamma: parseFloat(gammaEl.value),
      initialInfected: parseInt(initIEl.value, 10),
      fatality: parseFloat(fatalityEl.value)
    };
    resetSimulation(next);
  });
}

let __simLastTs = null;   // 直前のタイムスタンプ（ms）
let __simTimeSec = 0;     // 経過シミュレーション時間（秒）
let __history = [];       // {t,s,i,r} の配列
const __historyMax = 3600; // 最大点数

function animate(ts) {
  if (__simLastTs == null) {
    __simLastTs = ts;
  }
  const dt = Math.max(0, (ts - __simLastTs) / 1000); // 秒
  __simLastTs = ts;
  __simTimeSec += dt;

  c.clearRect(0, 0, canvas.width, canvas.height);

  lives.forEach((live) => {
    live.update();
  });

  // Step 4: 感染判定（フレーム末に一括更新）
  if (dt > 0) {
    const toInfect = new Set();
    const r = SIR_CONFIG.infectionRadius;
    const r2 = r * r;
    const pInfect = 1 - Math.exp(-SIR_CONFIG.beta * dt);
    const toRecover = new Set();
    const pRecover = 1 - Math.exp(-SIR_CONFIG.gamma * dt);

    for (let i = 0; i < lives.length; i++) {
      if (lives[i].state !== 'I') continue;
      const ix = lives[i].x;
      const iy = lives[i].y;
      // 回復判定
      if (Math.random() < pRecover) {
        toRecover.add(i); // 回復判定
      }
      for (let j = 0; j < lives.length; j++) {
        if (lives[j].state !== 'S') continue;
        const d2 = distanceSquaredTorus(ix, iy, lives[j].x, lives[j].y);
        if (d2 <= r2) {
          if (Math.random() < pInfect) toInfect.add(j); // 感染判定
        }
      }
    }

    toInfect.forEach((idx) => {
      const agent = lives[idx];
      agent.state = 'I';
      agent.infectedAt = __simTimeSec;
    });

    toRecover.forEach((idx) => {
      const agent = lives[idx];
      agent.state = 'R';
      // 色はdraw()で状態から決まるためここでの色代入は不要
    });
  }

  // Step 6: 現在のS/I/Rを集計してHUD表示
  {
    let s = 0, i = 0, r = 0;
    for (let k = 0; k < lives.length; k++) {
      const st = lives[k].state;
      if (st === 'S') s++; else if (st === 'I') i++; else if (st === 'R') r++;
    }
    drawHUD(s, i, r, __simTimeSec);

    // 履歴に追記
    __history.push({ t: __simTimeSec, s, i, r });
    if (__history.length > __historyMax) __history.shift(); // 履歴の長さを最大値に保つ
    if (chartCtx) drawChart(__history);

    // 累積指標の表示（右下）
    const metricsEl = document.getElementById('metrics');
    if (metricsEl) {
      const cumulativeInfected = SIR_CONFIG.populationN - s;
      const cumulativeDeaths = Math.round(cumulativeInfected * SIR_CONFIG.fatality);
      metricsEl.textContent = `S/I/R 時系列 | 累積感染者: ${cumulativeInfected} | 累積死亡者(致死率${(SIR_CONFIG.fatality*100).toFixed(1)}%): ${cumulativeDeaths}`;
    }
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
// 初期化
initControls();
resetSimulation();

// 時系列チャートの描画
function drawChart(history) {
  if (!chartCtx || !chartCanvas) return;
  const w = chartCanvas.clientWidth;
  const h = chartCanvas.clientHeight;
  chartCtx.clearRect(0, 0, w, h);
  chartCtx.save();
  chartCtx.translate(0.5, 0.5);

  // 軸と枠
  chartCtx.strokeStyle = 'rgba(255,255,255,0.4)';
  chartCtx.strokeRect(0, 0, w - 1, h - 1);

  if (history.length === 0) { chartCtx.restore(); return; }

  // yスケール: 0..N
  const n = SIR_CONFIG.populationN;
  const padL = 6, padR = 6, padT = 4, padB = 4;//左、右、上、下のパディング
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = (idx) => padL + (idx / Math.max(1, __historyMax - 1)) * plotW;
  const y = (val) => padT + (1 - val / n) * plotH;

  const series = [
    { key: 's', color: SIR_CONFIG.colors.S },
    { key: 'i', color: SIR_CONFIG.colors.I },
    { key: 'r', color: SIR_CONFIG.colors.R }
  ];

  for (const { key, color } of series) {
    chartCtx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = x(i);
      const py = y(history[i][key]);
      if (i === 0) chartCtx.moveTo(px, py); else chartCtx.lineTo(px, py);
    }
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 1.5;
    chartCtx.stroke();
  }

  chartCtx.restore();
}
