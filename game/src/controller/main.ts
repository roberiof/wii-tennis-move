import type { SwingMessage } from "../shared/messages";

// --- Utilitários de Rotação e Velocidade ---
function angleDelta(a: number, b: number): number {
  return ((((b - a + 180) % 360) + 360) % 360) - 180;
}

interface Rotation {
  alpha: number;
  beta: number;
  gamma: number;
}

let prevRot: Rotation | null = null;
let prevT = 0;

function deriveAngularVelocity(r: Rotation, t: number): Rotation | null {
  const p = prevRot;
  const dt = (t - prevT) / 1000;
  prevRot = { ...r };
  prevT = t;
  if (!p || dt <= 0.002 || dt > 0.5) return null; // Protege contra saltos irreais de dt
  return {
    alpha: angleDelta(p.alpha, r.alpha) / dt,
    beta: angleDelta(p.beta, r.beta) / dt,
    gamma: angleDelta(p.gamma, r.gamma) / dt,
  };
}

// --- Detector de Swing Estável ---
interface SwingParams {
  start: number;
  end: number;
  refractory: number;
  maxPeak: number;
  timeout: number;
}

const params: SwingParams = {
  start: 380,
  end: 180,
  refractory: 260,
  maxPeak: 1400,
  timeout: 550,
};

let inSwing = false;
let swingStart = 0;
let peak = 0;
let peakT = 0;
let peakSide: 1 | -1 = 1;
let lastEnd = -Infinity;

let isLefty = false; // Alternador destro / canhoto

// Elementos da UI
const statusLabel = document.getElementById("status-label")!;
const lastSwingLabel = document.getElementById("last-swing")!;
const powerBar = document.getElementById("power-bar")!;
const racketGlow = document.getElementById("racket-glow")!;
const racketIcon = document.getElementById("racket-icon")!;
const handBtn = document.getElementById("hand-btn")!;

handBtn.addEventListener("click", () => {
  isLefty = !isLefty;
  handBtn.textContent = isLefty ? "Modo: Canhoto" : "Modo: Destro";
});

// --- Inicialização do AirConsole ---
const ac = new AirConsole({ device_motion: 16, synchronize_time: true });

ac.onReady = (code) => {
  statusLabel.textContent = `Conectado · Sala ${code}`;
  statusLabel.style.background = "rgba(40, 200, 100, 0.4)";
};

function onSwingDetected(power: number, side: 1 | -1, t: number) {
  const adjustedSide = (isLefty ? -side : side) as 1 | -1;
  const powerPct = Math.round(power * 100);
  const strokeName = adjustedSide > 0 ? "Forehand" : "Backhand";

  // Feedback na tela do celular
  lastSwingLabel.textContent = `${strokeName}! Força: ${powerPct}%`;
  powerBar.style.width = `${powerPct}%`;

  racketGlow.style.transform = "scale(1.2)";
  racketIcon.style.transform = `rotate(${adjustedSide * 35}deg) scale(1.15)`;
  setTimeout(() => {
    racketGlow.style.transform = "scale(1)";
    racketIcon.style.transform = "rotate(0deg) scale(1)";
  }, 220);

  // Envia evento de golpe para o PC
  const msg: SwingMessage = {
    type: "swing",
    power,
    side: adjustedSide,
    t,
  };
  ac.message(AirConsole.SCREEN, msg);
}

// Leitura contínua dos sensores do AirConsole
ac.onDeviceMotion = (d) => {
  const now = performance.now();
  const vel = deriveAngularVelocity({ alpha: d.alpha, beta: d.beta, gamma: d.gamma }, now);
  if (!vel || !Number.isFinite(vel.alpha)) return;

  const mag = Math.hypot(vel.alpha, vel.beta, vel.gamma);

  if (!inSwing) {
    if (mag > params.start && now - lastEnd > params.refractory) {
      inSwing = true;
      swingStart = now;
      peak = 0;
    } else {
      return;
    }
  }

  if (mag > peak) {
    peak = mag;
    peakT = now;
    // O sinal de alpha/gamma determina se o movimento foi forehand ou backhand
    const dominant = Math.abs(vel.alpha) > Math.abs(vel.gamma) ? vel.alpha : vel.gamma;
    peakSide = dominant >= 0 ? 1 : -1;
  }

  const isTimeout = now - swingStart > params.timeout;

  if (mag < params.end || isTimeout) {
    const power = Math.min(peak / params.maxPeak, 1.0);
    onSwingDetected(power, peakSide, peakT);
    inSwing = false;
    lastEnd = now;
  }
};
