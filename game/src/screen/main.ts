import * as THREE from "three";
import { createCourt } from "./court";
import { Character } from "./character";
import { TennisBall } from "./physics";
import type { SwingMessage } from "../shared/messages";

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

// CPU (Verde clássico do MSN Messenger)
const cpu = new Character({ color: 0x72d600, isCpu: true });
cpu.group.position.set(0, 0, -9.5);
cpu.group.rotation.y = Math.PI; // Olhando de frente para o jogador
scene.add(cpu.group);

// --- Estado do Jogo ---
let rallyCount = 0;
let bestRally = 0;
let lastHitTime = 0;
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

// Inicia com um saque
ball.serve(true);

// Buffer de swing: se o jogador balançar um pouco antes, fica armado por 400ms
let pendingSwing: { power: number; side: 1 | -1; expiresAt: number } | null = null;

// --- Conexão AirConsole ---
let ac: AirConsole | null = null;
try {
  ac = new AirConsole({ synchronize_time: true });
  ac.onReady = (code) => {
    const codeEl = document.getElementById("room-code");
    if (codeEl) codeEl.textContent = code;
  };

  ac.onMessage = (_from, data) => {
    const msg = data as SwingMessage;
    if (msg && msg.type === "swing") {
      registerPlayerSwing(msg.power || 0.8, msg.side || 1);
    }
  };
} catch (e) {
  console.warn("AirConsole não carregado ou fora do ambiente de simulador:", e);
}

// Registra a tentativa de golpe do jogador
function registerPlayerSwing(power: number, side: 1 | -1) {
  const now = performance.now();
  player.triggerSwing(side);

  // Tenta acertar imediatamente
  if (!executePlayerHit(power, side)) {
    // Se a bola ainda estiver chegando, arma o buffer por 400ms para acertar assim que entrar no raio
    pendingSwing = { power, side, expiresAt: now + 400 };
  }
}

// Execução real do acerto com raio generoso estilo arcade
function executePlayerHit(power: number, side: 1 | -1): boolean {
  const now = performance.now();
  if (now - lastHitTime < 220) return false;

  // Raio generoso: se a bola estiver no campo do jogador (z de 2.0 a 13.5), vindo pra cá
  const inPlayerCourt = ball.z >= 2.0 && ball.z <= 13.5;
  const isApproaching = ball.vz > -2.0; // vindo ou acabou de cruzar
  const distToPlayer = Math.hypot(ball.x - player.group.position.x, ball.z - player.group.position.z);

  // Acerta se estiver no campo do jogador ou dentro de um raio de 4.8m do jogador
  if ((inPlayerCourt && isApproaching) || distToPlayer < 4.8) {
    lastHitTime = now;
    pendingSwing = null;

    // Desloca o boneco suavemente para o lado da bola na hora da batida
    const offset = side > 0 ? -0.55 : 0.55;
    player.group.position.x = ball.x + offset;

    // Mira e direção baseada no timing (adiantado = cruzada, atrasado = paralela)
    let targetX = (Math.random() - 0.5) * 3.0;
    if (ball.z < 8.0) {
      // Adiantado: bola cruzada rápida
      targetX = side > 0 ? 3.5 : -3.5;
    } else if (ball.z > 10.2) {
      // Atrasado: paralela
      targetX = side > 0 ? -3.0 : 3.0;
    }

    ball.hit(power, side, "player", targetX);
    rallyCount++;
    if (rallyCount > bestRally) bestRally = rallyCount;
    rallyEl.textContent = String(rallyCount);

    const powerPct = Math.round(power * 100);
    const strokeName = side > 0 ? "FOREHAND" : "BACKHAND";
    showFeedback(`🎾 ${strokeName}! ${powerPct}%`, "#00f0ff");

    if (ac) ac.vibrate(70);
    return true;
  }
  return false;
}

// Teclado (Espaço = Forehand, Z = Backhand) e Clique no PC
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    registerPlayerSwing(0.85, 1);
  } else if (e.code === "KeyZ") {
    e.preventDefault();
    registerPlayerSwing(0.85, -1);
  }
});

window.addEventListener("pointerdown", () => {
  registerPlayerSwing(0.85, 1);
});

// --- Loop Principal com Animação e Física ---
let lastTime = performance.now();
let resetTimer: number | null = null;

function animate(currentTime: number) {
  requestAnimationFrame(animate);

  const dt = Math.min((currentTime - lastTime) / 1000, 0.05); // máx 50ms por frame
  lastTime = currentTime;

  // 1. Atualiza Física da Bola
  const physicsResult = ball.update(dt);
  if (physicsResult.netHit) {
    showFeedback("NA REDE!", "#ff4444");
  }

  // 2. Se houver swing pendente no buffer, tenta executar agora
  if (pendingSwing) {
    if (currentTime > pendingSwing.expiresAt) {
      pendingSwing = null;
    } else {
      executePlayerHit(pendingSwing.power, pendingSwing.side);
    }
  }

  // 3. IA / Movimento Automático dos Personagens ("corre sozinho até a bola")
  // A) Jogador: corre automaticamente para a trajetória da bola no seu campo
  if (ball.vz > 0) {
    // Bola vindo para o jogador: estima onde a bola vai cruzar a linha z = 9.2
    const timeToArrive = Math.max(0.05, (9.2 - ball.z) / Math.max(1, ball.vz));
    const predictedX = Math.max(-4.8, Math.min(4.8, ball.x + ball.vx * timeToArrive));
    const racketOffset = (ball.x > player.group.position.x) ? -0.45 : 0.45;
    player.setTargetPosition(predictedX + racketOffset, 9.3);
  } else {
    // Bola indo embora: volta suavemente para o centro da quadra
    player.setTargetPosition(0, 9.5);
  }

  // B) CPU: corre automaticamente até a bola no campo adversário
  if (ball.vz < 0) {
    // Bola indo para a CPU (z negativo)
    const timeToArriveCpu = Math.max(0.05, (ball.z - (-9.0)) / Math.max(1, -ball.vz));
    const predictedXCpu = Math.max(-4.8, Math.min(4.8, ball.x + ball.vx * timeToArriveCpu));
    cpu.setTargetPosition(predictedXCpu, -9.2);

    // CPU rebate quando a bola chega na zona dela
    if (ball.z <= -7.5 && ball.y < 2.8 && ball.lastHitter === "player") {
      cpu.triggerSwing(Math.random() > 0.5 ? 1 : -1);
      setTimeout(() => {
        if (ball.lastHitter === "player" && ball.z < -6.8) {
          ball.hit(0.72 + Math.random() * 0.25, 1, "cpu");
          showFeedback("RALLY!", "#72ff00");
        }
      }, 70);
    }
  } else {
    // CPU volta para o centro
    cpu.setTargetPosition(0, -9.5);
  }

  // 4. Atualiza os Personagens (animações e corrida)
  player.update(dt);
  cpu.update(dt);

  // 5. Detecção de Ponto / Fora / Bola Parada (com saque automático)
  const isOutOfBounds = Math.abs(ball.x) > 8.0 || Math.abs(ball.z) > 15.0;
  const isDeadBall = ball.bounceCount >= 2 || (ball.y <= ball.radius + 0.01 && Math.abs(ball.vy) < 0.2 && Math.abs(ball.vz) < 1.0);

  if ((isOutOfBounds || isDeadBall) && resetTimer === null) {
    resetTimer = window.setTimeout(() => {
      rallyCount = 0;
      rallyEl.textContent = "0";
      ball.serve(ball.lastHitter === "cpu");
      resetTimer = null;
    }, 1300);
  }

  // 6. Câmera Dinâmica (acompanha o jogador sutilmente)
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
