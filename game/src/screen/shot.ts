import type { Hand, Side, Timing } from "../shared/messages";
import { TUNING } from "./tuning";

export interface Point2 {
  x: number;
  z: number;
}

export interface Point3 extends Point2 {
  y: number;
}

/** Golpe aceito pela tela (dentro da janela). Swing fora da janela não gera ShotResult. */
export interface ShotResult {
  /** t_swing − t_contato, em ms (negativo = adiantado). */
  offsetMs: number;
  timing: Timing;
  /** Lado recebido do celular. */
  side: Side;
  /** Lado aceito: recebido == esperado pela posição da bola, ou leitura incerta (benefício da dúvida). */
  sideOk: boolean;
  /** Lado recebido era o errado, mas a leitura foi incerta e o golpe não foi punido. */
  sideDoubt: boolean;
  /** Margem de confiança do lado recebida do celular (undefined = teclado ou sem calibração). */
  sideMargin?: number;
  /** Força recebida, 0..1 (antes da penalidade de lado errado). */
  power: number;
  /** Onde a bola cruzou a linha de contato (decide o lado esperado e a cruzada/paralela). */
  contact: Point3;
  /** Onde a bola deve quicar. */
  target: Point2;
}

// --- Resolução do golpe (valores em screen/tuning.ts) ---

/** 1 = destro (forehand do lado +x), -1 = canhoto. */
export function handSign(hand: Hand): Side {
  return hand === "right" ? 1 : -1;
}

/** Offset (ms) → adiantado / no tempo / atrasado. */
export function classifyTiming(offsetMs: number): Timing {
  if (offsetMs < -TUNING.earlyMs) return "early";
  if (offsetMs > TUNING.lateMs) return "late";
  return "on-time";
}

/**
 * Timing que um swing feito agora teria, para a bola em `z` vindo com `vz` (> 0) para o jogador; null = fora da janela.
 * Previsão em linha reta até a linha de contato (um quique no caminho muda vz em 8%: erro pequeno).
 */
export function timingIfSwungNow(z: number, vz: number): Timing | null {
  if (vz <= 0) return null;
  const offsetMs = ((z - TUNING.contactZ) / vz) * 1000;
  if (offsetMs < -TUNING.windowEarlyMs || offsetMs > TUNING.windowLateMs) return null;
  return classifyTiming(offsetMs);
}

/** Golpe que a posição da bola pede: bola do lado da mão = forehand. */
export function expectedSide(ballX: number, playerX: number, hand: Hand): Side {
  return (ballX - playerX) * handSign(hand) >= 0 ? 1 : -1;
}

/** Movimento automático: de que lado o jogador se posiciona para uma bola que chega em `ballX`. */
export function preferredSide(ballX: number, hand: Hand): Side {
  return ballX * handSign(hand) < -TUNING.backhandX ? -1 : 1;
}

/** x em que o jogador fica para a bola passar a `reach` do corpo, do lado do golpe `side`. */
export function standX(ballX: number, side: Side, hand: Hand): number {
  return ballX - handSign(hand) * side * TUNING.reach;
}

/**
 * Onde a bola deve quicar.
 * Força → profundidade. Timing → lateral: no tempo = centro; adiantado = cruzada (lado oposto ao do contato);
 * atrasado = paralela (mesmo lado). Contato no centro: o lado do contato é o do golpe (forehand de destro = +x).
 */
export function pickTarget(timing: Timing, power: number, contactX: number, side: Side, hand: Hand): Point2 {
  const z = -(TUNING.depthBase + TUNING.depthPerPower * power);
  if (timing === "on-time") return { x: 0, z };
  const contactSide = Math.abs(contactX) >= TUNING.centerContactX ? Math.sign(contactX) : handSign(hand) * side;
  return { x: (timing === "early" ? -1 : 1) * contactSide * TUNING.crossX, z };
}

/** Força efetiva e velocidade horizontal, com a penalidade de lado errado. */
export function shotPower(power: number, sideOk: boolean): { power: number; hSpeed: number } {
  const p = sideOk ? power : power * TUNING.wrongSidePower;
  const hSpeed = TUNING.speedBase + TUNING.speedPerPower * p;
  return { power: p, hSpeed: sideOk ? hSpeed : hSpeed / TUNING.wrongSideFlight };
}

/** Leitura do lado incerta demais para punir (teclado e celular sem calibração são sempre "certos"). */
export function sideInDoubt(sideMargin: number | undefined): boolean {
  return sideMargin !== undefined && Math.abs(sideMargin) < TUNING.sideDoubtMargin;
}

/** Monta o ShotResult de um acerto. */
export function buildShot(
  offsetMs: number, contact: Point3, side: Side, power: number, playerX: number, hand: Hand, sideMargin?: number,
): ShotResult {
  const timing = classifyTiming(offsetMs);
  const matches = side === expectedSide(contact.x, playerX, hand);
  const sideDoubt = !matches && sideInDoubt(sideMargin);
  const sideOk = matches || sideDoubt;
  // Na dúvida, a bola sai como golpe do lado certo (cruzada/paralela pelo lado esperado).
  const effectiveSide = sideDoubt ? ((-side) as Side) : side;
  const target = pickTarget(timing, shotPower(power, sideOk).power, contact.x, effectiveSide, hand);
  return { offsetMs, timing, side, sideOk, sideDoubt, sideMargin, power, contact, target };
}

export interface SwingInput {
  /** Instante do pico, no relógio do jogo (screen/clock). */
  t: number;
  power: number;
  side: Side;
  /** null = teclado/mouse. */
  deviceId: number | null;
  /** Quando chegou à tela, no mesmo relógio (para medir a latência). */
  arrivedAt: number;
  /** Confiança do lado, vinda do celular calibrado (undefined = teclado ou sem calibração). */
  sideMargin?: number;
}

export type Resolution =
  | { kind: "hit"; swing: SwingInput; offsetMs: number; contact: Point3 }
  | { kind: "miss"; swing: SwingInput; offsetMs: number; reason: "early" | "late" };

interface Sample extends Point3 {
  t: number;
}

/**
 * Decide se um swing acerta a bola que vem para o jogador, comparando o `t` do swing com o instante
 * em que a bola cruza a linha de contato. Uma resolução de acerto por bola.
 * - Swing antes do cruzamento: fica pendente (o mais recente vale) e é avaliado no cruzamento.
 * - Swing depois do cruzamento: avaliado na chegada.
 * - Erro (cedo ou tarde demais) não encerra a bola: outro swing ainda pode acertar.
 */
export class ShotResolver {
  private contact: { t: number; point: Point3 } | null = null;
  private pending: SwingInput | null = null;
  private done = false;

  constructor(private readonly contactZ = TUNING.contactZ) {}

  /** Nova bola vindo para o jogador (saque ou golpe do outro lado). */
  newBall(): void {
    this.contact = null;
    this.pending = null;
    this.done = false;
  }

  /** A cada frame, com a posição antes e depois do passo de física. `incoming` = bola vem para o jogador. */
  frame(prev: Sample, cur: Sample, incoming: boolean): Resolution | null {
    if (!incoming || this.done || this.contact) return null;
    if (!(prev.z < this.contactZ && cur.z >= this.contactZ)) return null;
    const f = (this.contactZ - prev.z) / (cur.z - prev.z);
    const lerp = (a: number, b: number) => a + f * (b - a);
    this.contact = { t: lerp(prev.t, cur.t), point: { x: lerp(prev.x, cur.x), y: lerp(prev.y, cur.y), z: this.contactZ } };
    const p = this.pending;
    this.pending = null;
    return p ? this.evaluate(p) : null;
  }

  /** Swing recebido. Retorna null se ficou pendente ou se não há bola vindo. */
  swing(s: SwingInput, incoming: boolean): Resolution | null {
    if (!incoming || this.done) return null;
    if (!this.contact) {
      this.pending = s;
      return null;
    }
    return this.evaluate(s);
  }

  private evaluate(s: SwingInput): Resolution {
    const c = this.contact!;
    const offsetMs = s.t - c.t;
    if (offsetMs < -TUNING.windowEarlyMs) return { kind: "miss", swing: s, offsetMs, reason: "early" };
    if (offsetMs > TUNING.windowLateMs) return { kind: "miss", swing: s, offsetMs, reason: "late" };
    this.done = true;
    return { kind: "hit", swing: s, offsetMs, contact: c.point };
  }
}
