const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const c = canvas?.getContext("2d") as CanvasRenderingContext2D;
const chartCanvas = document.getElementById(
  "chart",
) as HTMLCanvasElement;
const chartCtx = chartCanvas
  ? chartCanvas.getContext("2d") as CanvasRenderingContext2D
  : null;

canvas.width = innerWidth;
canvas.height = innerHeight;

if (chartCanvas && chartCtx) {
  // デバイスピクセル比対応
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cssW = chartCanvas.width;
  const cssH = chartCanvas.height;
  chartCanvas.style.width = cssW + "px";
  chartCanvas.style.height = cssH + "px";
  chartCanvas.width = Math.floor(cssW * dpr);
  chartCanvas.height = Math.floor(cssH * dpr);
  chartCtx.scale(dpr, dpr);
}

// SIRモデル設定（Step 1）
const SIR_CONFIG = {
  populationN: 2000, // 個体数（現状維持）
  infectionRadius: 15, // 感染判定半径（今は未使用、Step 4で使用）
  beta: 0.35, // 感染率（今は未使用、Step 4で使用）
  gamma: 0.125, // 回復率（今は未使用、Step 5で使用）
  initialInfected: 100, // 初期感染者数（今は未使用、Step 2で反映）
  agentRadius: 10, // 各エージェントの半径（固定）
  fatality: 0.02, // 致死率（表示計算用）
  colors: { // 状態に応じた色
    S: "hsl(210 80% 60%)", // Susceptible: 青
    I: "hsl(0 80% 60%)", // Infectious: 赤
    R: "hsl(120 60% 45%)", // Recovered: 緑
  },
};

type SirState = "S" | "I" | "R";

interface Vector2 {
  x: number;
  y: number;
}

class Agent {
  x: number;
  y: number;
  radius: number;
  color: string;
  velocity: Vector2;
  state: SirState;
  infectedAt: number | null;

  constructor(
    x: number,
    y: number,
    radius: number,
    color: string,
    velocity: Vector2,
  ) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
    this.state = "S";
    this.infectedAt = null;
  }

  draw(): void {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    c.fillStyle = SIR_CONFIG.colors[this.state] || this.color;
    c.fill();
  }

  update() {
    // 位置を更新
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // 周期境界条件（半径込み）
    if (this.x < -this.radius) this.x = canvas.width + this.radius; //左端
    if (this.x > canvas.width + this.radius) this.x = -this.radius; //右端
    if (this.y < -this.radius) this.y = canvas.height + this.radius; //上端
    if (this.y > canvas.height + this.radius) this.y = -this.radius; //下端

    // 描画
    this.draw();
  }
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomVelocity(minSpeed: number, maxSpeed: number): Vector2 {
  const angle = Math.random() * Math.PI * 2;
  const speed = randomBetween(minSpeed, maxSpeed);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

// トーラス（周期境界）での距離二乗
function distanceSquaredTorus(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  let dx = Math.abs(ax - bx);
  let dy = Math.abs(ay - by);
  dx = Math.min(dx, canvas.width - dx);
  dy = Math.min(dy, canvas.height - dy);
  return dx * dx + dy * dy;
}

// Step 6: S/I/Rカウント表示用のHUD
function drawHUD(
  sCount: number,
  iCount: number,
  rCount: number,
  timeSec: number,
): void {
  const sText = `S: ${sCount}`;
  const iText = `I: ${iCount}`;
  const rText = `R: ${rCount}`;
  const tText = `t=${timeSec.toFixed(1)}s`;
  const sep = "  ";

  const fullText = `${sText}${sep}${iText}${sep}${rText}${sep}${tText}`;

  c.save();
  c.font = "14px sans-serif";
  c.textBaseline = "top";
  const padding = 8;
  const x = 8;
  const y = 8;
  const textWidth = c.measureText(fullText).width;
  const textHeight = 16;
  c.fillStyle = "rgba(0, 0, 0, 0.5)";
  c.fillRect(
    x - padding / 2,
    y - padding / 2,
    textWidth + padding,
    textHeight + padding,
  );

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

  c.fillStyle = "#ffffff";
  c.fillText(tText, cursorX, y);
  c.restore();
}

let agents: Agent[] = [];

// 入力UIと連携して個体群を再生成
function createPopulation(): Agent[] {
  const arr = Array.from({ length: SIR_CONFIG.populationN }, (_, i) => {
    const radius = SIR_CONFIG.agentRadius;
    const x = randomBetween(radius, canvas.width - radius);
    const y = randomBetween(radius, canvas.height - radius);
    const isInfected =
      i < Math.min(SIR_CONFIG.initialInfected, SIR_CONFIG.populationN);
    const color = isInfected ? SIR_CONFIG.colors.I : SIR_CONFIG.colors.S;
    const velocity = randomVelocity(0.5, 2.0);
    const agent = new Agent(x, y, radius, color, velocity);
    if (isInfected) {
      agent.state = "I";
      agent.infectedAt = 0;
    }
    return agent;
  });
  return arr;
}

function resetSimulation(
  params: {
    populationN: number;
    beta: number;
    gamma: number;
    initialInfected: number;
    fatality: number;
  } | undefined,
) {
  if (params) {
    if (
      typeof params.populationN === "number" && isFinite(params.populationN) &&
      params.populationN > 0
    ) {
      SIR_CONFIG.populationN = Math.floor(params.populationN);
    }
    if (
      typeof params.beta === "number" && isFinite(params.beta) &&
      params.beta >= 0
    ) {
      SIR_CONFIG.beta = params.beta;
    }
    if (
      typeof params.gamma === "number" && isFinite(params.gamma) &&
      params.gamma >= 0
    ) {
      SIR_CONFIG.gamma = params.gamma;
    }
    if (
      typeof params.initialInfected === "number" &&
      isFinite(params.initialInfected) && params.initialInfected >= 0
    ) {
      SIR_CONFIG.initialInfected = Math.floor(
        Math.min(params.initialInfected, SIR_CONFIG.populationN),
      );
    }
    if (
      typeof params.fatality === "number" && isFinite(params.fatality) &&
      params.fatality >= 0
    ) {
      SIR_CONFIG.fatality = Math.max(0, Math.min(1, params.fatality));
    }
  }
  // 時間をリセット
  __simLastTs = null;
  __simTimeSec = 0;
  __history = [];
  // 個体群を再生成
  agents = createPopulation();
}

function initControls() {
  const popNEl = document.getElementById("popN") as HTMLInputElement;
  const betaEl = document.getElementById("beta") as HTMLInputElement;
  const gammaEl = document.getElementById("gamma") as HTMLInputElement;
  const initIEl = document.getElementById("initI") as HTMLInputElement;
  const fatalityEl = document.getElementById("fatality") as HTMLInputElement;
  const applyBtn = document.getElementById("apply-btn") as HTMLButtonElement;
  if (!popNEl || !betaEl || !gammaEl || !initIEl || !fatalityEl || !applyBtn) {
    return;
  }

  // 現在値を反映
  popNEl.value = String(SIR_CONFIG.populationN);
  betaEl.value = String(SIR_CONFIG.beta);
  gammaEl.value = String(SIR_CONFIG.gamma);
  initIEl.value = String(SIR_CONFIG.initialInfected);
  fatalityEl.value = String(SIR_CONFIG.fatality);

  applyBtn.addEventListener("click", () => {
    const next = {
      populationN: parseInt(popNEl.value, 10),
      beta: parseFloat(betaEl.value),
      gamma: parseFloat(gammaEl.value),
      initialInfected: parseInt(initIEl.value, 10),
      fatality: parseFloat(fatalityEl.value),
    };
    resetSimulation(next);
  });
}

let __simLastTs: number | null = null; // 直前のタイムスタンプ（ms）
let __simTimeSec = 0; // 経過シミュレーション時間（秒）
let __history: { t: number; s: number; i: number; r: number }[] = []; // {t,s,i,r} の配列
const __historyMax = 3600; // 最大点数

function animate(ts: number) {
  if (__simLastTs == null) {
    __simLastTs = ts;
  }
  const dt = Math.max(0, (ts - __simLastTs) / 1000); // 秒
  __simLastTs = ts;
  __simTimeSec += dt;

  c.clearRect(0, 0, canvas.width, canvas.height);

  agents.forEach((agent) => {
    agent.update();
  });

  // Step 4: 感染判定（フレーム末に一括更新）
  if (dt > 0) {
    const toInfect = new Set<number>();
    const r = SIR_CONFIG.infectionRadius;
    const r2 = r * r;
    const pInfect = 1 - Math.exp(-SIR_CONFIG.beta * dt);
    const toRecover = new Set<number>();
    const pRecover = 1 - Math.exp(-SIR_CONFIG.gamma * dt);

    for (let i = 0; i < agents.length; i++) {
      if (agents?.[i]?.state !== "I") continue;
      const ix = agents?.[i]?.x;
      const iy = agents?.[i]?.y;
      // 回復判定
      if (Math.random() < pRecover) {
        toRecover.add(i); // 回復判定
      }
      for (let j = 0; j < agents.length; j++) {
        if (agents?.[j]?.state !== "S") continue;
        const jx = agents?.[j]?.x;
        const jy = agents?.[j]?.y;
        if (!ix || !iy || !jx || !jy) continue;
        const d2 = distanceSquaredTorus(ix, iy, jx, jy);
        if (d2 <= r2) {
          if (Math.random() < pInfect) toInfect.add(j); // 感染判定
        }
      }
    }

    toInfect.forEach((idx: number) => {
      const agent = agents[idx];
      if (!agent) return;
      agent.state = "I";
      agent.infectedAt = __simTimeSec;
    });

    toRecover.forEach((idx) => {
      const agent = agents[idx];
      if (!agent) return;
      agent.state = "R";
    });
  }

  {
    let s = 0, i = 0, r = 0;
    for (let k = 0; k < agents.length; k++) {
      const st = agents[k]?.state;
      if (st === "S") s++;
      else if (st === "I") i++;
      else if (st === "R") r++;
    }
    drawHUD(s, i, r, __simTimeSec);

    // 履歴に追記
    __history.push({ t: __simTimeSec, s, i, r });
    if (__history.length > __historyMax) __history.shift(); // 履歴の長さを最大値に保つ
    if (chartCtx) drawChart(__history);

    // 累積指標の表示（右下）
    const metricsEl = document.getElementById("metrics");
    if (metricsEl) {
      const cumulativeInfected = SIR_CONFIG.populationN - s;
      const cumulativeDeaths = Math.round(
        cumulativeInfected * SIR_CONFIG.fatality,
      );
      metricsEl.textContent =
        `S/I/R 時系列 | 累積感染者: ${cumulativeInfected} | 累積死亡者(致死率${
          (SIR_CONFIG.fatality * 100).toFixed(1)
        }%): ${cumulativeDeaths}`;
    }
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
// 初期化
initControls();
resetSimulation(undefined);

// 時系列チャートの描画
function drawChart(history: { t: number; s: number; i: number; r: number }[]) {
  if (!chartCtx || !chartCanvas) return;
  const w = chartCanvas.clientWidth;
  const h = chartCanvas.clientHeight;
  chartCtx.clearRect(0, 0, w, h);
  chartCtx.save();
  chartCtx.translate(0.5, 0.5);

  // 軸と枠
  chartCtx.strokeStyle = "rgba(255,255,255,0.4)";
  chartCtx.strokeRect(0, 0, w - 1, h - 1);

  if (history.length === 0) {
    chartCtx.restore();
    return;
  }

  // yスケール: 0..N
  const n = SIR_CONFIG.populationN;
  const padL = 6, padR = 6, padT = 4, padB = 4; //左、右、上、下のパディング
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = (idx: number) =>
    padL + (idx / Math.max(1, __historyMax - 1)) * plotW;
  const y = (val: number) => padT + (1 - val / n) * plotH;

  const series: { key: "s" | "i" | "r"; color: string }[] = [
    { key: "s", color: SIR_CONFIG.colors.S },
    { key: "i", color: SIR_CONFIG.colors.I },
    { key: "r", color: SIR_CONFIG.colors.R },
  ];

  for (const { key, color } of series) {
    chartCtx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = x(i);
      const py = y(history[i]?.[key] || 0);
      if (i === 0) chartCtx.moveTo(px, py);
      else chartCtx.lineTo(px, py);
    }
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 1.5;
    chartCtx.stroke();
  }

  chartCtx.restore();
}
