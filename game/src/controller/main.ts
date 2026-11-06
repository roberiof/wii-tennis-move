import type { CalibStep, GameMode, Side, Timing } from "../shared/messages";
import { airconsoleControllerLink } from "../net/link";
import { createRateDeriver } from "./rotation";
import { chooseStroke, feedTestMotion, feedTestSwing, resetTally, startSwingTest } from "./swing-test";
import { tallyText } from "../shared/test-text";
import { createSwingDetector, type DetectedSwing } from "./detector";
import {
  CALIB, chooseHand, confirmGo, currentRep, detectorParamsFor, feedMotion, feedSwing, parseProfile, powerFor,
  profileOf, redoPrevious, sideFor, startCalibration, undoTarget, type CalibrationProfile, type CalibState,
} from "./calibration";
import {
  CALIB_TEXT, CALIB_TOTAL, calibTitle, REGISTERED_TEXT, repText, RETRY_HINT, STEP_LABEL, statusText,
} from "../shared/calib-text";

// v6: perfis anteriores (moldes de um golpe, ou média de três) são descartados.
const PROFILE_KEY = "wtm.calibration.v6";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// --- Estado ---
type View = "calib" | "menu" | "play" | "test";
let view: View = "calib";
let profile: CalibrationProfile | null = parseProfile(store(PROFILE_KEY));
let calib: CalibState | null = null;
let test = startSwingTest();
let ready = false;

const ac = new AirConsole({ device_motion: 16, synchronize_time: true });
const link = airconsoleControllerLink(ac);

// --- Sensor → detector ---
let derive = createRateDeriver();
let detect = createSwingDetector(detectorParamsFor(profile), onSwing);

function resetDetector(): void {
  derive = createRateDeriver();
  detect = createSwingDetector(detectorParamsFor(profile, calib !== null), onSwing);
}

ac.onDeviceMotion = (d) => {
  const now = performance.now();
  const vel = derive({ alpha: d.alpha, beta: d.beta, gamma: d.gamma }, now);
  if (!vel || !Number.isFinite(vel.alpha)) return;
  if (calib) {
    // Fim do destaque e espera parada; ao ficar parado, pede a largada ao PC (renderCalib → sendCalib).
    const before = calibKey(calib);
    calib = feedMotion(calib, Math.hypot(vel.alpha, vel.beta, vel.gamma), now);
    if (calibKey(calib) !== before) renderCalib();
  }
  if (view === "test") {
    // Espera parada entre os golpes do teste.
    const wasArmed = test.armedAt !== null;
    test = feedTestMotion(test, Math.hypot(vel.alpha, vel.beta, vel.gamma), now);
    if (test.armedAt !== null && !wasArmed) renderTest();
  }
  detect(vel, now);
};

function onSwing(d: DetectedSwing): void {
  if (calib) return onCalibSwing(d);
  if (view === "test") return onTestSwing(d);
  if (view !== "play") return; // no menu, swing não vai para a tela

  const power = profile ? powerFor(d.peak, profile) : d.power;
  // Lado pelo molde mais parecido; a margem (só depuração) diz o quanto o celular tem certeza.
  const classified = profile ? sideFor(d.dir, profile) : null;
  const side = classified ? classified.side : d.side;
  renderSwing(power, side);
  if (!ready) return;
  // Instante do pico no relógio do servidor, o mesmo que a tela usa (getServerTime).
  const t = ac.getServerTime() - (performance.now() - d.t);
  link.sendSwing({
    type: "swing", power, side, peak: d.peak, calibrated: profile !== null, t, sideMargin: classified?.margin,
  });
}

// --- Calibração ---
function beginCalibration(): void {
  calib = startCalibration();
  resetDetector();
  show("calib");
  renderCalib();
}

function onCalibSwing(d: DetectedSwing): void {
  if (!calib) return;
  const before = calib;
  calib = feedSwing(calib, d);
  if (calib === before) return; // ignorado: não estava pronto ou sentido oposto
  pulse($("calib-glow"));
  if (calib.step === "done") return finishCalibration(profileOf(calib));
  renderCalib();
}

function finishCalibration(p: CalibrationProfile | null): void {
  profile = p;
  if (p) store(PROFILE_KEY, JSON.stringify(p));
  calib = null;
  resetDetector();
  sendCalib();
  show("menu");
}

/** Só o que muda a tela; evita reenviar a cada amostra. */
function calibKey(c: CalibState): string {
  return `${c.step}|${c.holdUntil === null}|${c.stillAt !== null}|${c.armedAt !== null}`;
}

function renderCalib(): void {
  if (!calib || calib.step === "done") return;
  const txt = CALIB_TEXT[calib.step];
  const swingStep = calib.step !== "hand";
  const reps = CALIB.templateReps;
  $("calib-count").textContent = `Calibração · passo ${txt.n} de ${CALIB_TOTAL}`;
  $("calib-title").textContent = calibTitle(calib.step, currentRep(calib), reps);
  $("calib-hint").textContent = calib.retry ? RETRY_HINT[calib.retry] : swingStep ? "Siga as instruções na tela do PC." : "";
  const holding = calib.holdUntil !== null;
  const go = calib.armedAt !== null; // só depois de o PC confirmar que mostrou "Agora!"
  $("calib-ready").textContent = swingStep
    ? statusText(holding, calib.registered, go, calib.prep, calib.step, calib.registeredRep, reps)
    : "";
  $("calib-ready").classList.toggle("armed", go || (holding && calib.registered !== null));
  $("calib-registered").textContent =
    !holding && calib.registered ? `✓ ${REGISTERED_TEXT[calib.registered]}${repText(calib.registeredRep, reps)}` : "";
  $("hand-row").style.display = swingStep ? "none" : "flex";
  const undo = undoTarget(calib);
  $("calib-redo").style.display = undo ? "inline-block" : "none";
  if (undo) $("calib-redo").textContent = `Refazer: ${STEP_LABEL[undo.step]}${undo.rep ? ` ${undo.rep}` : ""}`;
  sendCalib();
}

function sendCalib(): void {
  if (!ready) return;
  link.send({
    type: "calib",
    step: calib?.step ?? "done",
    hand: calib?.hand ?? profile?.hand ?? null,
    holding: calib?.holdUntil != null,
    prep: calib?.prep ?? false,
    rep: calib ? currentRep(calib) : null,
    reps: CALIB.templateReps,
    still: calib?.stillAt != null,
    goId: calib?.goId ?? 0,
    registered: calib?.registered ?? null,
    registeredRep: calib?.registeredRep ?? null,
    retry: calib?.retry ?? null,
  });
}

for (const [id, hand] of [["hand-right", "right"], ["hand-left", "left"]] as const) {
  $(id).addEventListener("click", () => {
    if (!calib) return;
    calib = chooseHand(calib, hand, performance.now());
    renderCalib();
  });
}

$("calib-redo").addEventListener("click", () => {
  if (!calib) return;
  calib = redoPrevious(calib);
  renderCalib();
});

// Sem sensor (ex.: simulador) não dá para calibrar: segue com os parâmetros padrão.
$("calib-skip").addEventListener("click", () => finishCalibration(profile));

// --- Menu e jogo ---
function show(v: View): void {
  const leavingTest = view === "test" && v !== "test";
  view = v;
  for (const name of ["calib", "menu", "play", "test"] as const) {
    $(`view-${name}`).classList.toggle("active", name === v);
  }
  if (leavingTest) sendTest(false);
}

function chooseMode(mode: GameMode | "menu"): void {
  if (ready) link.send({ type: "mode", mode });
  show(mode === "menu" ? "menu" : "play");
}

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => chooseMode(b.dataset.mode as GameMode)),
);
document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((b) =>
  b.addEventListener("click", () => {
    const action = b.dataset.action;
    if (action === "menu") chooseMode("menu");
    else if (action === "test") openTest();
    else if (action === "test-reset") {
      test = resetTally(test);
      renderTest();
    } else beginCalibration();
  }),
);

// --- Modo de teste ---
function openTest(): void {
  test = { ...startSwingTest(), tally: test.tally }; // sem série escolhida; placar mantido até "Zerar"
  show("test");
  renderTest();
}

document.querySelectorAll<HTMLButtonElement>("[data-stroke]").forEach((b) =>
  b.addEventListener("click", () => {
    if (!profile) return;
    test = chooseStroke(test, Number(b.dataset.stroke) as Side);
    renderTest();
  }),
);

function onTestSwing(d: DetectedSwing): void {
  if (!profile) return;
  const before = test;
  test = feedTestSwing(test, { t: d.t, rotation: sideFor(d.dir, profile).side });
  if (test === before) return; // não estava pronto: não conta
  pulse($("racket-glow"));
  renderTest();
}

function renderTest(): void {
  const stroke = test.stroke;
  $("test-title").textContent = !profile
    ? "Calibre primeiro"
    : stroke === null ? "Escolha a série" : `Série ${stroke > 0 ? "FOREHAND" : "BACKHAND"}`;
  $("test-hint").textContent = !profile
    ? "O teste compara os golpes com a sua calibração. Use Recalibrar no menu."
    : "Toque na série e faça só aquele golpe, parando entre um e outro.";
  $("test-ready").textContent = stroke === null ? "" : test.armedAt !== null ? "Agora!" : "Segure o celular parado…";
  $("test-ready").classList.toggle("armed", test.armedAt !== null);
  $("test-fh").textContent = `Forehand: ${tallyText(test.tally.forehand)}`;
  $("test-bh").textContent = `Backhand: ${tallyText(test.tally.backhand)}`;
  sendTest(true);
}

function sendTest(active: boolean): void {
  if (!ready) return;
  link.send({ type: "test", active, stroke: test.stroke, armed: test.armedAt !== null, tally: test.tally });
}

const TIMING_TEXT: Record<Timing, string> = { early: "Adiantado", "on-time": "No tempo!", late: "Atrasado" };

function renderSwing(power: number, side: Side): void {
  const pct = Math.round(power * 100);
  $("last-swing").textContent = `${side > 0 ? "Forehand" : "Backhand"} · Força ${pct}%`;
  $("power-bar").style.width = `${pct}%`;
  $("timing-label").textContent = "";
  $("racket-icon").style.transform = `rotate(${side * 35}deg) scale(1.15)`;
  setTimeout(() => { $("racket-icon").style.transform = "rotate(0deg) scale(1)"; }, 220);
  pulse($("racket-glow"));
}

function pulse(el: HTMLElement): void {
  el.style.transform = "scale(1.2)";
  setTimeout(() => { el.style.transform = "scale(1)"; }, 220);
}

// --- Mensagens da tela ---
link.on({
  "calib-go": (_from, m) => {
    if (!calib) return;
    const before = calibKey(calib);
    calib = confirmGo(calib, m.goId, performance.now());
    if (calibKey(calib) !== before) renderCalib();
  },
  hit: (_from, m) => {
    ac.vibrate(70);
    $("timing-label").textContent = TIMING_TEXT[m.timing] + (m.sideOk ? "" : " · lado errado");
  },
  state: (_from, m) => {
    if (calib || view === "test") return; // calibrando ou testando golpes: o celular conduz
    if (m.phase === "menu") show("menu");
    else if (m.phase === "playing") show("play");
  },
});

ac.onReady = (code) => {
  ready = true;
  const status = $("status-label");
  status.textContent = `Conectado · Sala ${code}`;
  status.style.background = "rgba(40, 200, 100, 0.4)";
  if (calib) renderCalib();
  else sendCalib();
};

// --- Início: sem perfil salvo, calibra; com perfil, vai ao menu ---
if (profile) show("menu");
else beginCalibration();
