import * as THREE from "three";
import { createCourt } from "./court";
import { Character } from "./character";
import { aimShot, TennisBall } from "./physics";
import type { CalibMessage, GameMode, Hand, Side, Timing } from "../shared/messages";
import { airconsoleScreenLink, type ScreenLink } from "../net/link";
import { buildShot, handSign, preferredSide, ShotResolver, shotPower, standX, type Resolution, type SwingInput } from "./shot";
import { TUNING } from "./tuning";
import { createClock } from "./clock";
import { createDebugPanel } from "./debug";
import { CALIB_TEXT, CALIB_TOTAL, calibTitle, REGISTERED_TEXT, repText, RETRY_HINT, statusText } from "../shared/calib-text";
import type { LessonView, Mode, ModeContext, ModeFactory } from "./modes/mode";
import { createWallMode } from "./modes/wall";
import { createTargetsMode } from "./modes/targets";
import { createCpuDemoMode } from "./modes/cpu-demo";
import { createTimingBar } from "./timing-bar";
import { INITIAL, modeOf, reduce, sameState, Seat, type GameEvent, type GameState } from "./game";

// --- Inicialização da Cena e Renderizador Three.js ---
const container = document.getElementById("canvas-container")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd6f0ff); // Céu Frutiger Aero azul bebê límpido
scene.fog = new THREE.FogExp2(0xd6f0ff, 0.015);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(0, 5.8, 17.5);
camera.lookAt(0, 1.2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// --- Iluminação Frutiger Aero (Brilhante e Solar) ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4488bb, 0.85);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
dirLight.position.set(12, 22, 14);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
const d = 16;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// --- Elementos do Jogo ---
const court = createCourt();
scene.add(court);

const ball = new TennisBall();
scene.add(ball.mesh);
scene.add(ball.shadow);

// Jogador 1 (Azul/Ciano clássico do MSN / Windows Live Messenger)
const player = new Character({ color: 0x00c3ff });
player.group.position.set(0, 0, 9.5);
scene.add(player.group);

// --- HUD ---
let bestRally = 0;
const rallyEl = document.getElementById("rally-score")!;
const feedbackEl = document.getElementById("hit-feedback")!;

function showFeedback(text: string, color = "#00e1ff") {
  feedbackEl.textContent = text;
  feedbackEl.style.color = color;
  feedbackEl.style.transform = "scale(1.25)";
  feedbackEl.style.opacity = "1";
  setTimeout(() => {
    feedbackEl.style.transform = "scale(1)";
    feedbackEl.style.opacity = "0";
  }, 800);
}

function setRally(n: number) {
  rallyEl.textContent = String(n);
  if (n > bestRally) bestRally = n;
}

/** Mão do jogador, informada pela calibração (destro até lá). */
let playerHand: Hand = "right";

const resolver = new ShotResolver();

// --- Conexão AirConsole ---
let ac: AirConsole | null = null;
let link: ScreenLink | null = null;
try {
  ac = new AirConsole({ synchronize_time: true });
} catch (e) {
  console.warn("AirConsole não carregado ou fora do ambiente de simulador:", e);
}
const clock = createClock(ac);
// Overlay de depuração (tecla D)
const debug = createDebugPanel(document.getElementById("debug-panel")!, clock);
const timingBar = createTimingBar(document.getElementById("timing-bar")!);

/** S3: um jogador. O primeiro celular controla; os outros são ignorados até a S5. */
const seat = new Seat();

if (ac) {
  ac.onReady = (code) => {
    const codeEl = document.getElementById("room-code");
    if (codeEl) codeEl.textContent = code;
    clock.setReady(); // a partir daqui, relógio do servidor (o mesmo do `t` do celular)
    resolver.newBall();
  };
  // onConnect também dispara quando o controle recarrega: reenvia o estado para ele mostrar a tela certa.
  ac.onConnect = (id) => {
    if (seat.claim(id)) sendState();
    renderMenuStatus();
  };
  ac.onDisconnect = (id) => {
    if (seat.release(id)) dispatch({ type: "left" });
    renderMenuStatus();
  };

  const l = airconsoleScreenLink(ac);
  link = l;
  l.onSwing((from, msg) => {
    if (!seat.claim(from)) return;
    registerPlayerSwing({ t: msg.t, power: msg.power, side: msg.side, deviceId: from, arrivedAt: clock.now(), sideMargin: msg.sideMargin });
  });
  l.on({
    calib: (from, m) => {
      if (!seat.claim(from)) return;
      renderMenuStatus();
      if (m.hand) playerHand = m.hand;
      renderCalib(m);
      dispatch({ type: "calib", done: m.step === "done" });
      // Largada: o "Agora!" já está na tela; só agora o celular passa a aceitar o swing.
      // Confirmação repetida é inofensiva (o celular ignora), então não precisa de controle de duplicata.
      if (m.still) l.send(from, { type: "calib-go", goId: m.goId });
    },
    test: (from, m) => {
      if (seat.claim(from)) debug.test(m);
    },
    mode: (from, m) => {
      if (!seat.claim(from)) return;
      renderMenuStatus();
      dispatch({ type: "mode", mode: m.mode });
    },
  });
}

// --- Painéis (calibração, menu, treino) ---
const calibPanel = document.getElementById("calib-panel")!;
const menuPanel = document.getElementById("menu-panel")!;

function renderCalib(m: CalibMessage) {
  if (m.step === "done") return;
  const txt = CALIB_TEXT[m.step];
  const swingStep = m.step !== "hand";
  const ready = document.getElementById("calib-ready")!;
  document.getElementById("calib-count")!.textContent = `Calibração · passo ${txt.n} de ${CALIB_TOTAL}`;
  document.getElementById("calib-title")!.textContent = calibTitle(m.step, m.rep, m.reps);
  document.getElementById("calib-hint")!.textContent = m.retry ? RETRY_HINT[m.retry] : txt.hint;
  ready.textContent = swingStep ? statusText(m.holding, m.registered, m.still, m.prep, m.step, m.registeredRep, m.reps) : "";
  ready.classList.toggle("armed", m.still || (m.holding && m.registered !== null));
  document.getElementById("calib-registered")!.textContent =
    !m.holding && m.registered ? `✓ ${REGISTERED_TEXT[m.registered]}${repText(m.registeredRep, m.reps)}` : "";
}

function renderMenuStatus() {
  document.getElementById("menu-status")!.textContent = seat.owner === null
    ? "Entre pelo celular em airconsole.com com o código da sala"
    : "Celular conectado";
}

const lessonEl = document.getElementById("lesson-panel")!;
function renderLesson(v: LessonView | null) {
  lessonEl.classList.toggle("visible", v !== null);
  if (!v) return;
  const el = (id: string) => document.getElementById(id)!;
  el("lesson-count").textContent = v.summary ? "Treino concluído" : `Treino · lição ${v.index + 1} de ${v.total}`;
  el("lesson-title").textContent = v.summary ? "Resultado" : v.title;
  el("lesson-hint").textContent = v.summary
    ? v.summary.map((s, i) => `${i + 1}. ${s.title}: ${s.hits} de ${s.attempts}`).join("\n")
    : v.hint;
  el("lesson-score").textContent = v.summary ? "Recomeçando em instantes…" : `Acertos ${v.hits} de ${v.goal} · tentativas ${v.attempts}`;
  const last = el("lesson-last");
  last.textContent = v.summary || !v.last ? "" : v.last.text;
  last.classList.toggle("ok", !!v.last?.ok);
}

// --- Estado do jogo (screen/game.ts) e modos ---
const MODES: Record<GameMode, ModeFactory> = { wall: createWallMode, targets: createTargetsMode, "cpu-demo": createCpuDemoMode };

const modeContext: ModeContext = {
  scene, ball, player,
  feedback: showFeedback,
  setRally,
  newBall: () => resolver.newBall(),
  hand: () => playerHand,
  showLesson: renderLesson,
};

let state: GameState = INITIAL;
/** Modo em jogo (só na fase playing). */
let active: Mode | null = null;

function sendState() {
  if (link && seat.owner !== null) link.send(seat.owner, { type: "state", phase: state.phase, mode: modeOf(state) });
}

function dispatch(e: GameEvent) {
  const next = reduce(state, e);
  // Escolher de novo o modo em jogo recomeça o modo.
  const restart = (e.type === "mode" || e.type === "key") && next.phase === "playing";
  if (sameState(state, next) && !restart) return;
  state = next;
  applyState();
  sendState();
}

/** Entra no estado atual: troca o modo e mostra o painel da fase. */
function applyState() {
  active?.stop();
  active = null;
  resolver.newBall(); // descarta swing pendente do modo anterior
  setRally(0);
  calibPanel.classList.toggle("visible", state.phase === "calib");
  menuPanel.classList.toggle("visible", state.phase === "menu");
  ball.mesh.visible = ball.shadow.visible = state.phase === "playing";
  if (state.phase === "playing") {
    active = MODES[state.mode](modeContext);
    active.start();
  }
}

applyState();
renderMenuStatus();

// --- Golpe do jogador ---
const TIMING_LABEL: Record<Timing, string> = { early: "ADIANTADO", "on-time": "NO TEMPO", late: "ATRASADO" };

/** Bola vindo para o jogador (só ela pode ser rebatida). */
const incoming = () => ball.lastHitter !== "player";

function registerPlayerSwing(swing: SwingInput) {
  if (!active) return; // fora do jogo (calibração ou menu), golpes são ignorados
  player.triggerSwing((swing.side * handSign(playerHand)) as Side); // lado do mundo, para a animação
  debug.swing(swing);
  handleResolution(resolver.swing(swing, incoming()));
}

function handleResolution(res: Resolution | null) {
  if (!res || !active) return;
  if (res.kind === "miss") {
    showFeedback(res.reason === "early" ? "CEDO DEMAIS" : "TARDE DEMAIS", "#ff7a45");
    timingBar.show(res.offsetMs, res.reason);
    debug.miss(res);
    return;
  }
  const shot = buildShot(
    res.offsetMs, res.contact, res.swing.side, res.swing.power, player.group.position.x, playerHand, res.swing.sideMargin,
  );
  timingBar.show(res.offsetMs, null);
  // Sai de onde a bola está agora (num golpe atrasado, já passou da linha de contato) e mira o alvo.
  const from = { x: ball.x, y: ball.y, z: ball.z };
  ball.launch(from, aimShot(from, shot.target, shotPower(shot.power, shot.sideOk).hSpeed, TUNING.netClearance), "player");
  active.onShot(shot);

  const stroke = shot.side > 0 ? "FOREHAND" : "BACKHAND";
  const pct = Math.round(shot.power * 100);
  if (shot.sideOk) showFeedback(`🎾 ${TIMING_LABEL[shot.timing]} · ${stroke} ${pct}%`, "#00f0ff");
  else showFeedback(`${TIMING_LABEL[shot.timing]} · LADO ERRADO`, "#ffb020");

  if (res.swing.deviceId !== null) link?.send(res.swing.deviceId, { type: "hit", timing: shot.timing, sideOk: shot.sideOk });
  debug.hit(shot);
}

// Teclado (Espaço = Forehand, Z = Backhand; sozinho = forte, com Option/Alt = médio, com Shift = fraco),
// 1/2/3 = modo, Esc = menu, N = próxima lição, D = depuração; clique = forehand forte
const keyboardPower = (e?: KeyboardEvent) => (e?.shiftKey ? 0.15 : e?.altKey ? 0.5 : 0.85);
const keyboardSwing = (side: Side, e?: KeyboardEvent): SwingInput =>
  ({ t: clock.now(), power: keyboardPower(e), side, deviceId: null, arrivedAt: clock.now() });
const KEY_MODE: Record<string, GameMode | "menu"> = { Digit1: "wall", Digit2: "targets", Digit3: "cpu-demo", Escape: "menu" };

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    registerPlayerSwing(keyboardSwing(1, e));
  } else if (e.code === "KeyZ") {
    e.preventDefault();
    registerPlayerSwing(keyboardSwing(-1, e));
  } else if (e.code === "KeyD") {
    debug.toggle();
  } else if (e.code in KEY_MODE) {
    dispatch({ type: "key", mode: KEY_MODE[e.code] });
  } else if (e.code === "KeyN") {
    active?.next?.();
  }
});

window.addEventListener("pointerdown", () => {
  registerPlayerSwing(keyboardSwing(1));
});

// --- Loop Principal com Animação e Física ---
let lastTime = performance.now();

function animate(currentTime: number) {
  requestAnimationFrame(animate);

  const dt = Math.min((currentTime - lastTime) / 1000, 0.05); // máx 50ms por frame
  lastTime = currentTime;

  // Fora do jogo (calibração ou menu): bola parada; o jogador só volta ao centro e respira.
  if (!active) {
    player.setTargetPosition(0, 9.5);
    player.update(dt);
    renderer.render(scene, camera);
    return;
  }

  // 1. Física da bola; o resolver registra o instante em que ela cruza a linha de contato
  const prev = { x: ball.x, y: ball.y, z: ball.z, t: clock.now() - dt * 1000 };
  const physicsResult = ball.update(dt);
  const cur = { x: ball.x, y: ball.y, z: ball.z, t: clock.now() };
  if (physicsResult.netHit) active.onNet();
  if (physicsResult.bounce) {
    active.onBounce({ ...physicsResult.bounce, half: physicsResult.bounce.z > 0 ? "player" : "far", count: ball.bounceCount });
    if (ball.lastHitter === "player" && ball.bounceCount === 1) debug.bounce(physicsResult.bounce);
  }

  // 2. Swing pendente é avaliado quando a bola cruza a linha de contato
  handleResolution(resolver.frame(prev, cur, incoming()));

  // 3. Jogador corre sozinho para onde a bola vai cruzar a linha de contato, deixando-a do lado do golpe
  if (incoming() && ball.vz > 0) {
    const timeToArrive = Math.max(0.05, (TUNING.contactZ - ball.z) / Math.max(1, ball.vz));
    const predictedX = Math.max(-4.8, Math.min(4.8, ball.x + ball.vx * timeToArrive));
    const side = preferredSide(predictedX, playerHand);
    player.setTargetPosition(standX(predictedX, side, playerHand), TUNING.contactZ);
  } else {
    // Bola indo embora: volta suavemente para o centro da quadra
    player.setTargetPosition(0, 9.5);
  }

  // 4. O modo cuida do outro lado (parede, máquina ou CPU) e do fim do rally/tentativa.
  //    `active` pode ter mudado no meio do frame (troca de modo num callback); por isso o ?.
  active?.update(dt, clock.now(), prev);

  // 5. Animações e câmera (acompanha o jogador sutilmente)
  player.update(dt);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.group.position.x * 0.45, 0.05);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Redimensionamento de janela
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
