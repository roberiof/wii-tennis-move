// Modo de teste: o jogador declara uma série (só forehands ou só backhands) e o celular conta quantos golpes
// a leitura do lado acertou. Serve para comparar versões com números, não no olho.
// Entre golpes, espera o jogador ficar parado (como na calibração), para não contar a volta do braço.

import type { Side, TestTally } from "../shared/messages";
import { CALIB } from "./calibration";

export interface SwingTestState {
  /** Golpe declarado da série atual (null = nenhuma). */
  stroke: Side | null;
  /** Desde quando o celular está parado (null = se mexendo). */
  stillSince: number | null;
  /** Pronto para contar o próximo golpe desde este instante (null = esperando ficar parado). */
  armedAt: number | null;
  tally: { forehand: TestTally; backhand: TestTally };
}

const emptyTally = (): TestTally => ({ swings: 0, rotationHits: 0 });

export function startSwingTest(): SwingTestState {
  return { stroke: null, stillSince: null, armedAt: null, tally: { forehand: emptyTally(), backhand: emptyTally() } };
}

/** Começa (ou troca de) série; o placar continua. */
export function chooseStroke(s: SwingTestState, stroke: Side): SwingTestState {
  return { ...s, stroke, stillSince: null, armedAt: null };
}

export function resetTally(s: SwingTestState): SwingTestState {
  return { ...s, tally: { forehand: emptyTally(), backhand: emptyTally() } };
}

/** Magnitude de rotação (°/s) de cada amostra: arma após CALIB.stillMs parado. */
export function feedTestMotion(s: SwingTestState, mag: number, now: number): SwingTestState {
  if (s.stroke === null || s.armedAt !== null) return s;
  if (mag > CALIB.stillMax) return s.stillSince === null ? s : { ...s, stillSince: null };
  if (s.stillSince === null) return { ...s, stillSince: now };
  return now - s.stillSince >= CALIB.stillMs ? { ...s, armedAt: now } : s;
}

/** Conta um golpe: lado lido pela rotação contra o golpe declarado. */
export function feedTestSwing(s: SwingTestState, swing: { t: number; rotation: Side }): SwingTestState {
  if (s.stroke === null || s.armedAt === null || swing.t < s.armedAt) return s;
  const key = s.stroke > 0 ? "forehand" : "backhand";
  const t = s.tally[key];
  const next: TestTally = {
    swings: t.swings + 1,
    rotationHits: t.rotationHits + (swing.rotation === s.stroke ? 1 : 0),
  };
  return { ...s, stillSince: null, armedAt: null, tally: { ...s.tally, [key]: next } };
}
