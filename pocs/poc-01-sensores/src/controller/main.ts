import type { NativeState, PlayerAssign, RotationMode, SampleBatchPart, SampleTuple, Source } from "../shared/messages";
import { IntervalTracker } from "../shared/stats";
import { airconsoleSender } from "../net/swing";
import { createSwingDetector, DEFAULT_PARAMS, type DetectedSwing, type DetectorParams } from "./detector";
import { createRateDeriver, type Rotation } from "./rotation";

const BATCH_MS = 100;
const MAX_PENDING = 300;
const DM_KEY = "poc01.dm";
const FH_KEY = "poc01.forehandSign";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// O intervalo do device_motion é opção do construtor: trocar exige recarregar.
function readDm(): number {
  const q = Number(new URLSearchParams(location.search).get("dm"));
  if (q > 0) return q;
  const s = Number(store(DM_KEY));
  return s > 0 ? s : 16;
}

const dm = readDm();
const ac = new AirConsole({ device_motion: dm, synchronize_time: true });
const sender = airconsoleSender(ac);
let ready = false;

interface SourceState {
  tracker: IntervalTracker;
  pending: SampleTuple[];
  count: number;
}
const sources: Record<Source, SourceState> = {
  airconsole: { tracker: new IntervalTracker(), pending: [], count: 0 },
  native: { tracker: new IntervalTracker(), pending: [], count: 0 },
};

let nativeState: NativeState = "off";
let detSource: Source = "airconsole";
// Padrão "derived": no primeiro teste em celular (16/out/2026) o alpha do AirConsole saltou entre ~0 e ~359,
// como ângulo. Inferência, a confirmar no roteiro do README (P7).
let detMode: RotationMode = "derived";
let params: DetectorParams = { ...DEFAULT_PARAMS };
let swingCount = 0;

// Calibração: o sinal do eixo dominante num forehand. Cobre canhotos e a pegada do aparelho.
let forehandSign: 1 | -1 | null = (() => {
  const v = store(FH_KEY);
  return v === "1" ? 1 : v === "-1" ? -1 : null;
})();
let calibrating = false;
let calibratingAt = 0;
let calibTimer: number | null = null;

let derive = createRateDeriver();
let detect = createSwingDetector(params, onSwing);

function resetDetector(): void {
  derive = createRateDeriver();
  detect = createSwingDetector(params, onSwing);
}

function onSwing(d: DetectedSwing): void {
  if (calibrating) {
    // Ignora micro-movimentos causados pelo impacto do dedo ao apertar o botão de calibrar
    if (d.t < calibratingAt + 350) return;
    forehandSign = d.side;
    calibrating = false;
    if (calibTimer !== null) {
      window.clearTimeout(calibTimer);
      calibTimer = null;
    }
    store(FH_KEY, String(d.side));
    renderCalib();
  }
  const calibrated = forehandSign !== null;
  const side = calibrated ? ((d.side * forehandSign!) as 1 | -1) : d.side;

  swingCount++;
  renderSwing(d.power, side, calibrated);
  if (!ready) return;
  const nowServer = ac.getServerTime();
  const t = nowServer - (performance.now() - d.t); // instante do pico no relógio do servidor
  sender.sendSwing({ type: "swing", source: detSource, mode: detMode, ...d, side, calibrated, t, emittedAt: nowServer });
}

function handleSample(src: Source, s: SampleTuple): void {
  const st = sources[src];
  st.tracker.push(s[0]);
  st.count++;
  st.pending.push(s);
  if (st.pending.length > MAX_PENDING) st.pending.shift();

  if (src !== detSource) return;
  let rot: Rotation | null = { alpha: s[4], beta: s[5], gamma: s[6] };
  // rotationRate do sensor nativo já é velocidade; só a fonte AirConsole pode precisar de derivada.
  if (src === "airconsole" && detMode === "derived") rot = derive(rot, s[0]);
  if (rot && Number.isFinite(rot.alpha)) detect(rot, s[0]);
}

ac.onReady = () => {
  ready = true;
  $("conn").textContent = `conectado · device ${ac.getDeviceId()}`;
  sendStatus();
};

ac.onMessage = (_from, data) => {
  const m = data as PlayerAssign;
  if (m?.type !== "player") return;
  document.documentElement.style.setProperty("--player", m.color);
  $("name").textContent = `Jogador ${m.index + 1}`;
};

ac.onDeviceMotion = (d) => {
  handleSample("airconsole", [performance.now(), d.x, d.y, d.z, d.alpha, d.beta, d.gamma]);
};

function sendStatus(): void {
  if (ready) ac.message(AirConsole.SCREEN, { type: "status", dm, native: nativeState });
}

function flush(): void {
  if (!ready) return;
  const parts: SampleBatchPart[] = [];
  for (const src of Object.keys(sources) as Source[]) {
    const st = sources[src];
    if (st.pending.length === 0) continue;
    parts.push({ source: src, samples: st.pending, stats: st.tracker.stats() });
    st.pending = [];
  }
  if (parts.length) ac.message(AirConsole.SCREEN, { type: "samples", sentAt: ac.getServerTime(), parts });
}
setInterval(flush, BATCH_MS);

// --- Etapa 2: devicemotion nativo dentro do iframe do controller ---

const srcSel = $<HTMLSelectElement>("detSource");

function setNative(s: NativeState): void {
  nativeState = s;
  $("nativeState").textContent = {
    off: "Lê o giroscópio direto do navegador (Etapa 2).",
    waiting: "Aguardando o sensor…",
    on: "Sensor do celular ativo — usado no detector.",
    blocked: "Nenhum dado em 2 s: o navegador bloqueou o sensor. Seguimos com o AirConsole.",
    denied: "Permissão negada. Seguimos com o AirConsole.",
    unsupported: "Este navegador não tem o sensor. Seguimos com o AirConsole.",
  }[s];
  if (s === "on") {
    // Velocidade de rotação direta: preferível à derivada de ângulo para achar o pico.
    detSource = "native";
    srcSel.value = "native";
    resetDetector();
    $("native").textContent = "Sensor do celular ativo";
  } else if (s === "blocked" || s === "denied" || s === "unsupported") {
    // Garante fallback seguro de volta para o AirConsole
    detSource = "airconsole";
    srcSel.value = "airconsole";
    resetDetector();
    $("native").textContent = "Ativar sensor do celular";
    window.removeEventListener("devicemotion", onNativeMotion);
  }
  sendStatus();
}

function onNativeMotion(e: DeviceMotionEvent): void {
  const a = e.accelerationIncludingGravity;
  const r = e.rotationRate;
  if (nativeState !== "on" && r && r.alpha !== null) setNative("on");
  handleSample("native", [
    performance.now(),
    a?.x ?? NaN, a?.y ?? NaN, a?.z ?? NaN,
    r?.alpha ?? NaN, r?.beta ?? NaN, r?.gamma ?? NaN,
  ]);
}

$("native").addEventListener("click", async () => {
  if (nativeState === "on" || nativeState === "waiting") return;
  if (typeof DeviceMotionEvent === "undefined") return setNative("unsupported");
  // iOS: a permissão só pode ser pedida dentro de um toque do usuário.
  const req = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (req) {
    try {
      if ((await req()) !== "granted") return setNative("denied");
    } catch {
      return setNative("denied");
    }
  }
  window.addEventListener("devicemotion", onNativeMotion);
  setNative("waiting");
  setTimeout(() => { if (nativeState === "waiting") setNative("blocked"); }, 2000);
});

// --- Calibração ---

function renderCalib(): void {
  $("calib").textContent = calibrating ? "Faça um forehand agora…" : forehandSign !== null ? "Recalibrar forehand" : "Calibrar: faça um forehand";
  $("calibState").textContent = forehandSign !== null
    ? "Calibrado: forehand e backhand reconhecidos."
    : "Sem calibração: o lado do golpe ainda não é reconhecido.";
}

$("calib").addEventListener("click", () => {
  if (calibrating) {
    // Clique adicional cancela a calibração
    calibrating = false;
    if (calibTimer !== null) {
      window.clearTimeout(calibTimer);
      calibTimer = null;
    }
    renderCalib();
    return;
  }
  calibrating = true;
  calibratingAt = performance.now();
  renderCalib();

  if (calibTimer !== null) window.clearTimeout(calibTimer);
  calibTimer = window.setTimeout(() => {
    if (calibrating) {
      calibrating = false;
      calibTimer = null;
      renderCalib();
    }
  }, 8000); // 8s de timeout se o jogador não bater
});
renderCalib();

// --- Configuração avançada ---

const dmSel = $<HTMLSelectElement>("dm");
dmSel.value = String(dm);
dmSel.addEventListener("change", () => {
  store(DM_KEY, dmSel.value);
  location.reload();
});

srcSel.addEventListener("change", () => { detSource = srcSel.value as Source; resetDetector(); });
const modeSel = $<HTMLSelectElement>("detMode");
modeSel.value = detMode;
modeSel.addEventListener("change", () => { detMode = modeSel.value as RotationMode; resetDetector(); });

const numInputs: [string, keyof DetectorParams][] = [["pStart", "start"], ["pEnd", "end"], ["pMax", "maxPeak"]];
for (const [id, key] of numInputs) {
  const el = $<HTMLInputElement>(id);
  el.value = String(params[key]);
  el.addEventListener("change", () => {
    const v = Number(el.value);
    if (v > 0) { params = { ...params, [key]: v }; resetDetector(); }
  });
}

// --- UI ---

function renderSwing(power: number, side: 1 | -1, calibrated: boolean): void {
  $("count").textContent = String(swingCount);
  const stroke = calibrated ? (side > 0 ? "Forehand" : "Backhand") : "Golpe";
  $("last").textContent = `${stroke} · ${Math.round(power * 100)}%`;
  $("powerFill").style.width = `${Math.round(power * 100)}%`;
}

setInterval(() => {
  $("rates").innerHTML = (Object.keys(sources) as Source[])
    .map((src) => {
      const s = sources[src].tracker.stats();
      return `<tr><td>${src}</td><td>${s.hz.toFixed(1)}</td><td>${s.mean.toFixed(1)}</td><td>${s.max.toFixed(0)}</td><td>${s.p95.toFixed(0)}</td></tr>`;
    })
    .join("");
}, 500);
