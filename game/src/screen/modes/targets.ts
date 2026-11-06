// Treino com alvos: uma máquina do lado de lá lança bolas; o jogador tenta quicar a bola no alvo da lição.
// Acerto = primeiro quique dentro do anel. hitsToAdvance acertos passam de lição; depois da 5ª, resumo e recomeço.

import * as THREE from "three";
import type { Hand, Timing } from "../../shared/messages";
import { playableShot, type TennisBall } from "../physics";
import { handSign, timingIfSwungNow, type Point2, type ShotResult } from "../shot";
import { TUNING } from "../tuning";
import type { LessonView, Mode, ModeContext } from "./mode";

/** Pausa entre o fim de uma tentativa e a próxima bola (ms). */
export const NEXT_BALL_MS = 1500;
/** Tempo do resumo ao concluir o treino, antes de recomeçar (ms). */
export const SUMMARY_MS = 6000;

export interface Lesson {
  title: string;
  hint: string;
  /** Centro do alvo. */
  ring: Point2;
  /** Raio do anel; na faixa, meia largura em x. */
  radius: number;
  /** Alvo em faixa lateral: limites em z (near = lado da rede). Sem isto, é um anel. */
  lane?: { near: number; far: number };
  /** x do quique da bola da máquina. */
  feedX: number;
}

/**
 * Lições, na ordem. Os alvos ficam onde shot.pickTarget manda o golpe pedido:
 * força → profundidade; adiantado = cruzada, atrasado = paralela (a máquina manda a bola do lado do forehand).
 * Faixas (lições 1, 4 e 5) ensinam direção, sem cobrar força; a área curta (2) e o anel (3) cobram força.
 */
export function lessons(hand: Hand): Lesson[] {
  const fh = handSign(hand); // lado do forehand em x
  const side = TUNING.machineSideX * fh;
  const r = TUNING.targetRadius;
  const lane = { near: TUNING.laneNearZ, far: TUNING.laneFarZ };
  const laneZ = (lane.near + lane.far) / 2;
  const short = { near: TUNING.shortNearZ, far: TUNING.shortFarZ };
  const w = TUNING.laneHalfWidth;
  const cw = TUNING.centerHalfWidth;
  return [
    { title: "No tempo", hint: "Bata com a bola VERDE (no tempo): ela vai para o centro. Qualquer força", ring: { x: 0, z: laneZ }, radius: cw, lane, feedX: 0 },
    { title: "Bola curta", hint: "Golpe FRACO com a bola VERDE (no tempo): ela cai antes da linha de saque", ring: { x: 0, z: (short.near + short.far) / 2 }, radius: cw, lane: short, feedX: 0 },
    { title: "Bola funda", hint: "Golpe FORTE com a bola VERDE (no tempo): ela cai perto do fundo", ring: { x: 0, z: -10 }, radius: r, feedX: 0 },
    { title: "Cruzada", hint: "Bata com a bola AZUL (adiantado), antes de ela chegar: vai na diagonal. Qualquer força", ring: { x: -fh * TUNING.crossX, z: laneZ }, radius: w, lane, feedX: side },
    { title: "Paralela", hint: "Bata com a bola LARANJA (atrasado), deixando ela chegar: vai reta, pelo mesmo lado. Qualquer força", ring: { x: fh * TUNING.crossX, z: laneZ }, radius: w, lane, feedX: side },
  ];
}

const TIMING_TEXT: Record<Timing, string> = { early: "Adiantado", "on-time": "No tempo", late: "Atrasado" };

/** Cor da bola que vem da máquina: o timing que o swing teria se fosse agora (fora da janela, cor normal). */
export const TIMING_COLOR: Record<Timing, number> = { early: 0x2f8cff, "on-time": 0x00d66b, late: 0xff7a1a };

export function approachColor(ball: Pick<TennisBall, "z" | "vz" | "lastHitter">): number | null {
  if (ball.lastHitter !== "machine") return null;
  const t = timingIfSwungNow(ball.z, ball.vz);
  return t ? TIMING_COLOR[t] : null;
}

export function powerText(power: number): string {
  return power < 0.35 ? "Fraco" : power < 0.7 ? "Médio" : "Forte";
}

const meters = (v: number) => `${v.toFixed(1).replace(".", ",")} m`;

/**
 * Onde a bola caiu em relação ao alvo, do ponto de vista do jogador (x > 0 = direita; z mais negativo = mais funda).
 * Anel: em relação ao centro. Faixa: lateral em relação ao centro; profundidade só se caiu antes ou depois dela.
 */
export function offsetText(bounce: Point2, lesson: Lesson): string {
  const { ring, lane } = lesson;
  const dx = bounce.x - ring.x;
  const dz = !lane ? bounce.z - ring.z : bounce.z > lane.near ? bounce.z - lane.near : bounce.z < lane.far ? bounce.z - lane.far : 0;
  const parts: string[] = [];
  if (Math.abs(dx) >= 0.3) parts.push(`${meters(Math.abs(dx))} à ${dx > 0 ? "direita" : "esquerda"}`);
  if (Math.abs(dz) >= 0.3) parts.push(`${meters(Math.abs(dz))} ${dz < 0 ? "longa" : "curta"}`);
  return parts.join(" · ") || "quase no centro";
}

export function insideTarget(bounce: Point2, lesson: Lesson): boolean {
  const { ring, radius, lane } = lesson;
  if (lane) return Math.abs(bounce.x - ring.x) <= radius && bounce.z <= lane.near && bounce.z >= lane.far;
  return Math.hypot(bounce.x - ring.x, bounce.z - ring.z) <= radius;
}

/** Texto da tentativa: "Atrasado · Forte · 2,1 m à direita". */
export function attemptText(shot: ShotResult, bounce: Point2, lesson: Lesson): string {
  const parts = [TIMING_TEXT[shot.timing], powerText(shot.power)];
  if (!shot.sideOk) parts.push("Lado errado");
  parts.push(insideTarget(bounce, lesson) ? "NO ALVO!" : offsetText(bounce, lesson));
  return parts.join(" · ");
}

const TARGET_COLOR = 0xff9f1c;
const TARGET_HIT_COLOR = 0x2bff88;

/** Plano deitado no chão. */
function floorMesh(geo: THREE.BufferGeometry, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  return m;
}

/** Retângulo no chão (preenchimento + 4 bordas de 0,15 m), em metros, centrado na origem. */
function buildLane(halfWidth: number, length: number, fillMat: THREE.Material, borderMat: THREE.Material) {
  const W = 2 * halfWidth;
  const L = length;
  const e = 0.15;
  const lane = new THREE.Group();
  lane.add(floorMesh(new THREE.PlaneGeometry(W, L), fillMat, 0.018));
  for (const [w, l, x, z] of [[e, L, -(W - e) / 2, 0], [e, L, (W - e) / 2, 0], [W, e, 0, -(L - e) / 2], [W, e, 0, (L - e) / 2]]) {
    const b = floorMesh(new THREE.PlaneGeometry(w, l), borderMat, 0.022);
    b.position.x = x;
    b.position.z = z;
    lane.add(b);
  }
  return lane;
}

/** Anel (raio 1, escalado pelo raio da lição) e suporte da faixa (refeita por lição), com a mesma borda; marca do quique. */
function createTargets() {
  const borderMat = new THREE.MeshBasicMaterial({ color: TARGET_COLOR, side: THREE.DoubleSide });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.3, side: THREE.DoubleSide });

  const ring = new THREE.Group();
  ring.add(floorMesh(new THREE.CircleGeometry(1, 64), fillMat, 0.018), floorMesh(new THREE.RingGeometry(0.85, 1, 64), borderMat, 0.022));

  const lane = new THREE.Group();
  /** Troca o retângulo pelo do tamanho da lição. */
  const setLane = (halfWidth: number, length: number) => {
    for (const c of [...lane.children]) {
      lane.remove(c);
      c.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    lane.add(buildLane(halfWidth, length, fillMat, borderMat));
  };

  const mark = floorMesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.026);
  mark.visible = false;
  return { ring, lane, setLane, borderMat, mark };
}

function createMachine() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x8fd8ff, roughness: 0.25, metalness: 0.2 }),
  );
  body.position.y = 0.45;
  body.castShadow = true;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20),
    new THREE.MeshStandardMaterial({ color: 0x0b4566, roughness: 0.4 }),
  );
  barrel.rotation.x = Math.PI / 2 - 0.35;
  barrel.position.set(0, 1.0, 0.25);
  group.add(body, barrel);
  group.position.set(0, 0, TUNING.machineZ - 0.4);
  return group;
}

function stopped(ball: TennisBall): boolean {
  return ball.y <= ball.radius + 0.01 && Math.abs(ball.vy) < 0.2 && Math.hypot(ball.vx, ball.vz) < 1;
}

interface Score {
  hits: number;
  attempts: number;
}

export function createTargetsMode(ctx: ModeContext): Mode {
  const { ball } = ctx;
  const target = createTargets();
  const machine = createMachine();
  let list = lessons(ctx.hand());
  let index = 0;
  let scores: Score[] = list.map(() => ({ hits: 0, attempts: 0 }));
  let last: LessonView["last"] = null;
  let summary: LessonView["summary"] = null;
  /** Golpe do jogador em voo, esperando o primeiro quique. */
  let shot: ShotResult | null = null;
  /** Tentativa encerrada; próxima bola agendada. */
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hitFlash = 0;

  const lesson = () => list[index];

  function render() {
    const l = lesson();
    const s = scores[index];
    ctx.showLesson({
      index, total: list.length, title: l.title, hint: l.hint,
      hits: s.hits, attempts: s.attempts, goal: TUNING.hitsToAdvance, last, summary,
    });
  }

  function placeTarget() {
    const l = lesson();
    target.ring.visible = !l.lane;
    target.lane.visible = !!l.lane;
    if (l.lane) {
      target.setLane(l.radius, l.lane.near - l.lane.far);
      target.lane.position.set(l.ring.x, 0, l.ring.z);
    } else {
      target.ring.position.set(l.ring.x, 0, l.ring.z);
      target.ring.scale.set(l.radius, 1, l.radius);
    }
  }

  function feed() {
    timer = null;
    shot = null;
    target.mark.visible = false;
    const l = lesson();
    const from = { x: 0, y: 1.1, z: TUNING.machineZ };
    ball.launch(from, playableShot(from, TUNING.machineSpeed, () => l.feedX), "machine");
    ctx.newBall();
  }

  function startLesson(i: number) {
    index = i;
    last = null;
    placeTarget();
    render();
  }

  function schedule(fn: () => void, ms: number) {
    timer = setTimeout(fn, ms);
  }

  /** Fecha a tentativa; com hitsToAdvance acertos, passa de lição (ou conclui o treino). */
  function resolve(text: string, ok: boolean, bounce: Point2 | null) {
    if (timer) return;
    const s = scores[index];
    s.attempts++;
    if (ok) {
      s.hits++;
      hitFlash = 1;
    }
    last = { text, ok };
    if (bounce) {
      target.mark.position.set(bounce.x, 0.026, bounce.z);
      target.mark.visible = true;
    }
    render();
    ctx.feedback(ok ? "NO ALVO!" : "FORA DO ALVO", ok ? "#2bff88" : "#ff7a45");
    if (s.hits < TUNING.hitsToAdvance) return schedule(feed, NEXT_BALL_MS);
    if (index + 1 < list.length) {
      return schedule(() => {
        startLesson(index + 1);
        feed();
      }, NEXT_BALL_MS);
    }
    schedule(() => {
      summary = list.map((l, i) => ({ title: l.title, ...scores[i] }));
      render();
      ctx.feedback("TREINO CONCLUÍDO!", "#2bff88");
      schedule(restart, SUMMARY_MS);
    }, NEXT_BALL_MS);
  }

  function restart() {
    list = lessons(ctx.hand());
    scores = list.map(() => ({ hits: 0, attempts: 0 }));
    summary = null;
    startLesson(0);
    feed();
  }

  return {
    id: "targets",
    start() {
      ctx.scene.add(target.ring, target.lane, target.mark, machine);
      ctx.setRally(0);
      restart();
    },
    update(dt) {
      hitFlash = Math.max(0, hitFlash - dt);
      target.borderMat.color.setHex(hitFlash > 0 ? TARGET_HIT_COLOR : TARGET_COLOR);
      ball.setColor(approachColor(ball));
      if (timer) return;
      if (ball.lastHitter === "machine" && (ball.z > 15 || Math.abs(ball.x) > 8 || stopped(ball))) {
        resolve("A bola passou", false, null);
      }
    },
    onShot(r) {
      if (!timer) shot = r;
    },
    onBounce(b) {
      if (timer) return;
      if (ball.lastHitter === "player" && b.half === "far" && b.count === 1 && shot) {
        resolve(attemptText(shot, b, lesson()), insideTarget(b, lesson()), b);
      } else if (ball.lastHitter === "machine" && b.half === "player" && b.count >= 2) {
        resolve("A bola passou", false, null);
      }
    },
    onNet() {
      if (ball.lastHitter === "player") resolve("Na rede", false, null);
    },
    next() {
      if (timer) clearTimeout(timer);
      timer = null;
      summary = null;
      startLesson((index + 1) % list.length);
      feed();
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      ctx.scene.remove(target.ring, target.lane, target.mark, machine);
      ball.setColor(null);
      ctx.showLesson(null);
    },
  };
}
