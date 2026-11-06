// Calibração por jogador (01-game-design.md): mão; 3 forehands e 3 backhands guardados separados (moldes de
// direção da rotação); um forehand forte e um fraco (força). Funções puras; a UI fica em controller/main.ts.
// Classificação: o lado do molde mais parecido entre os 6 (vizinho mais próximo), para cobrir golpes que variam.
// Valores são iniciais, a ajustar no playtest.

import type { CalibStep, Hand, Side } from "../shared/messages";
import { DEFAULT_PARAMS, type DetectorParams } from "./detector";
import type { Rotation } from "./rotation";

export const CALIB = {
  /** Limiar de início do detector durante a calibração (°/s): o swing fraco precisa disparar. */
  calibStart: 250,
  /** Faixa do limiar de início no jogo, calculado como startFactor × pico fraco. */
  minStart: 250,
  maxStart: 380,
  startFactor: 0.7,
  /** Forte precisa ser pelo menos isto × fraco. */
  minRatio: 1.4,
  /** Golpes guardados por lado (forehand e backhand). */
  templateReps: 3,
  /**
   * Forehands: cada um precisa parecer com a média dos outros (cosseno acima disto, 0,6 ≈ até 53°); o mais
   * destoante abaixo disso é descartado e repetido. Protege contra um golpe gravado por engano. Valor inicial.
   */
  minConsistency: 0.6,
  /**
   * Backhands: um backhand com cosseno a partir disto (0,8 ≈ menos de 37°) com algum forehand é tratado como
   * forehand feito por engano e repetido. Os backhands podem variar entre si e ficar razoavelmente perto de um
   * forehand: o vizinho mais próximo resolve. Valor inicial, não medido.
   */
  maxBackhandSimilarity: 0.8,
  /** "Parado": rotação abaixo disto (°/s), sem interrupção, por stillMs. Valor inicial, não medido. */
  stillMax: 80,
  stillMs: 600,
  /** Tempo (ms) de destaque do passo registrado antes de começar a esperar o jogador parar. */
  registeredHoldMs: 1000,
  /** Destaque mais longo quando o jogador precisa trocar de posição (forehand ↔ backhand). Valor inicial. */
  prepHoldMs: 2500,
  /** Força atribuída ao swing fraco calibrado, e o piso para swings mais fracos que ele. */
  weakPower: 0.2,
  powerFloor: 0.05,
};

/** Direção de rotação de um golpe (vetor unitário em alpha/beta/gamma). */
export type Direction = Rotation;

export interface CalibrationProfile {
  hand: Hand;
  /** Moldes: direção da rotação de cada forehand e de cada backhand calibrados (guardados separados). */
  forehand: Direction[];
  backhand: Direction[];
  strongPeak: number;
  weakPeak: number;
}

/**
 * Por que algo está sendo refeito: "power" = forte e fraco próximos demais; "side" = um backhand parecido demais
 * com os forehands (descartado); "inconsistent" = um forehand destoou dos outros e foi descartado.
 */
export type RetryReason = "power" | "side" | "inconsistent";

export interface CalibState {
  step: CalibStep;
  hand: Hand | null;
  /** Golpes já gravados de cada lado (direções unitárias). */
  forehand: Direction[];
  backhand: Direction[];
  strongPeak: number | null;
  weakPeak: number | null;
  /** Até quando destacar o passo registrado (null = sem destaque). A espera parada só começa depois. */
  holdUntil: number | null;
  /** O destaque atual é de preparação: o jogador está trocando de posição (forehand ↔ backhand). */
  prep: boolean;
  /** Desde quando o celular está parado (null = se mexendo). */
  stillSince: number | null;
  /** Quando ficou parado o bastante (null = ainda não); aguardando a confirmação do PC. */
  stillAt: number | null;
  /** Pedido de largada atual; a confirmação do PC precisa trazer o mesmo valor. */
  goId: number;
  /** Quando o PC confirmou "Agora!" (null = não confirmado). Swings com pico antes disto são ignorados. */
  armedAt: number | null;
  /** Passo gravado por último, para o "✓", e qual repetição dele (null fora dos moldes). */
  registered: CalibStep | null;
  registeredRep: number | null;
  retry: RetryReason | null;
}

// --- Direções ---

/** Vetor unitário; null se o golpe não teve rotação mensurável. */
export function unit(v: Rotation): Direction | null {
  const n = Math.hypot(v.alpha, v.beta, v.gamma);
  if (!(n > 1e-6)) return null;
  return { alpha: v.alpha / n, beta: v.beta / n, gamma: v.gamma / n };
}

/** Cosseno entre duas direções unitárias (1 = iguais, -1 = opostas). */
export function similarity(a: Direction, b: Direction): number {
  return a.alpha * b.alpha + a.beta * b.beta + a.gamma * b.gamma;
}

/** Direção média (unitária) de várias direções; null se se anularem. */
export function meanDirection(ds: Direction[]): Direction | null {
  const sum = ds.reduce((acc, d) => ({ alpha: acc.alpha + d.alpha, beta: acc.beta + d.beta, gamma: acc.gamma + d.gamma }), {
    alpha: 0, beta: 0, gamma: 0,
  });
  return unit(sum);
}

/** Semelhança com o molde mais parecido da lista (-Infinity se vazia). */
export function bestSimilarity(d: Direction, templates: Direction[]): number {
  return templates.reduce((best, t) => Math.max(best, similarity(d, t)), -Infinity);
}

/** O golpe que menos se parece com a média dos demais, e quanto ele se parece. */
export function worstSample(ds: Direction[]): { index: number; similarity: number } {
  let worst = { index: 0, similarity: Infinity };
  ds.forEach((d, i) => {
    const others = meanDirection(ds.filter((_, j) => j !== i));
    const sim = others ? similarity(d, others) : -1;
    if (sim < worst.similarity) worst = { index: i, similarity: sim };
  });
  return worst;
}

/**
 * Margem = semelhança com o forehand mais parecido − com o backhand mais parecido
 * (positiva = forehand; perto de 0 = incerto).
 */
export function margin(dir: Rotation, forehand: Direction[], backhand: Direction[]): number {
  const d = unit(dir);
  return d ? bestSimilarity(d, forehand) - bestSimilarity(d, backhand) : 0;
}

/** Forehand (1) ou backhand (-1): o lado do molde mais parecido (vizinho mais próximo). */
export function classify(dir: Rotation, forehand: Direction[], backhand: Direction[]): Side {
  return margin(dir, forehand, backhand) >= 0 ? 1 : -1;
}

// --- Passos ---

/** Passo anterior, para quando o passo atual ainda não gravou nada. */
const PREVIOUS_STEP: Partial<Record<CalibStep, CalibStep>> = {
  forehand: "hand",
  backhand: "forehand",
  strong: "backhand",
  weak: "strong",
};

/**
 * Novo passo: destaca o anterior até `holdFrom + duração` (ou sem destaque) e zera a largada.
 * `prep`: destaque longo, para o jogador trocar de posição antes de ficar parado.
 */
function nextStep(holdFrom: number | null, prep = false) {
  return {
    holdUntil: holdFrom === null ? null : holdFrom + (prep ? CALIB.prepHoldMs : CALIB.registeredHoldMs),
    prep: holdFrom !== null && prep,
    stillSince: null,
    stillAt: null,
    armedAt: null,
  };
}

export function startCalibration(goId = 0): CalibState {
  return {
    step: "hand", hand: null, forehand: [], backhand: [], strongPeak: null, weakPeak: null,
    ...nextStep(null), goId, registered: null, registeredRep: null, retry: null,
  };
}

/** Qual repetição o passo atual está pedindo (1-based), nos passos de molde; null nos demais. */
export function currentRep(s: CalibState): number | null {
  if (s.step === "forehand") return s.forehand.length + 1;
  if (s.step === "backhand") return s.backhand.length + 1;
  return null;
}

export function chooseHand(s: CalibState, hand: Hand, now: number): CalibState {
  if (s.step !== "hand") return s;
  return { ...s, hand, step: "forehand", ...nextStep(now), registered: "hand", registeredRep: null };
}

/**
 * Alimenta com a magnitude de rotação (°/s) de cada amostra: encerra o destaque e, depois de stillMs
 * parado, faz um pedido de largada (stillAt, novo goId) para o PC confirmar.
 */
export function feedMotion(s: CalibState, mag: number, now: number): CalibState {
  if (s.step === "hand" || s.step === "done") return s;
  if (s.holdUntil !== null) return now >= s.holdUntil ? { ...s, holdUntil: null, prep: false } : s;
  if (s.stillAt !== null) return s;
  if (mag > CALIB.stillMax) return s.stillSince === null ? s : { ...s, stillSince: null };
  if (s.stillSince === null) return { ...s, stillSince: now };
  return now - s.stillSince >= CALIB.stillMs ? { ...s, stillAt: now, goId: s.goId + 1 } : s;
}

/** O PC mostrou "Agora!" para o pedido `goId`; confirmações atrasadas ou de outro pedido são ignoradas. */
export function confirmGo(s: CalibState, goId: number, now: number): CalibState {
  if (s.stillAt === null || s.armedAt !== null || goId !== s.goId) return s;
  return { ...s, armedAt: now };
}

const N = () => CALIB.templateReps;

function feedForehand(s: CalibState, d: Direction, t: number): CalibState {
  const samples = [...s.forehand, d];
  if (samples.length < N()) {
    return { ...s, forehand: samples, ...nextStep(t), registered: "forehand", registeredRep: samples.length, retry: null };
  }
  // Completo: o forehand mais destoante, se destoar demais, é descartado e repetido.
  const worst = worstSample(samples);
  if (worst.similarity < CALIB.minConsistency) {
    const kept = samples.filter((_, i) => i !== worst.index);
    return { ...s, forehand: kept, ...nextStep(t), registered: null, registeredRep: null, retry: "inconsistent" };
  }
  // Próximo passo é o backhand: tempo para trocar de posição.
  return {
    ...s, forehand: samples, step: "backhand", ...nextStep(t, true),
    registered: "forehand", registeredRep: samples.length, retry: null,
  };
}

function feedBackhand(s: CalibState, d: Direction, t: number): CalibState {
  // Parece forehand: descartado, repete este backhand (já na posição, sem preparação).
  if (bestSimilarity(d, s.forehand) >= CALIB.maxBackhandSimilarity) {
    return { ...s, ...nextStep(t), registered: null, registeredRep: null, retry: "side" };
  }
  const samples = [...s.backhand, d];
  if (samples.length < N()) {
    return { ...s, backhand: samples, ...nextStep(t), registered: "backhand", registeredRep: samples.length, retry: null };
  }
  // Próximo passo é forehand forte: tempo para voltar à posição de forehand.
  return {
    ...s, backhand: samples, step: "strong", ...nextStep(t, true),
    registered: "backhand", registeredRep: samples.length, retry: null,
  };
}

export function feedSwing(s: CalibState, swing: { dir: Rotation; peak: number; t: number }): CalibState {
  if (s.armedAt === null || swing.t < s.armedAt) return s;
  if (s.step === "forehand" || s.step === "backhand") {
    const d = unit(swing.dir);
    if (!d) return s;
    return s.step === "forehand" ? feedForehand(s, d, swing.t) : feedBackhand(s, d, swing.t);
  }
  if (s.step !== "strong" && s.step !== "weak") return s;

  // Forte e fraco são forehands: o que se parece com um backhand (ex.: volta do braço) não conta.
  if (classify(swing.dir, s.forehand, s.backhand) !== 1) return s;
  const next = nextStep(swing.t);
  if (s.step === "strong") {
    return { ...s, strongPeak: swing.peak, step: "weak", ...next, registered: "strong", registeredRep: null, retry: null };
  }
  if (s.strongPeak !== null && s.strongPeak >= CALIB.minRatio * swing.peak) {
    return { ...s, weakPeak: swing.peak, step: "done", ...next, registered: "weak", registeredRep: null, retry: null };
  }
  return { ...s, strongPeak: null, step: "strong", ...next, registered: null, registeredRep: null, retry: "power" };
}

/**
 * O que "refazer" desfaz: o último golpe gravado (passo e repetição), ou a escolha da mão.
 * null quando não há nada para desfazer.
 */
export function undoTarget(s: CalibState): { step: CalibStep; rep: number | null } | null {
  if (s.step === "forehand" && s.forehand.length) return { step: "forehand", rep: s.forehand.length };
  if (s.step === "backhand" && s.backhand.length) return { step: "backhand", rep: s.backhand.length };
  const prev = PREVIOUS_STEP[s.step];
  if (!prev) return null;
  if (prev === "forehand") return { step: prev, rep: s.forehand.length };
  if (prev === "backhand") return { step: prev, rep: s.backhand.length };
  return { step: prev, rep: null };
}

/** Desfaz o último golpe gravado (ou volta à escolha da mão) e pede de novo. */
export function redoPrevious(s: CalibState): CalibState {
  const target = undoTarget(s);
  if (!target) return s;
  const base = { ...nextStep(null), registered: null, registeredRep: null, retry: null };
  switch (target.step) {
    case "hand":
      return startCalibration(s.goId);
    case "forehand":
      return { ...s, ...base, step: "forehand", forehand: s.forehand.slice(0, -1) };
    case "backhand":
      return { ...s, ...base, step: "backhand", backhand: s.backhand.slice(0, -1) };
    case "strong":
      return { ...s, ...base, step: "strong", strongPeak: null };
    default:
      return s;
  }
}

export function profileOf(s: CalibState): CalibrationProfile | null {
  const { hand, forehand, backhand, strongPeak, weakPeak } = s;
  if (s.step !== "done" || !hand || forehand.length !== N() || backhand.length !== N()) return null;
  if (strongPeak === null || weakPeak === null) return null;
  return { hand, forehand, backhand, strongPeak, weakPeak };
}

// --- Uso do perfil no jogo ---

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Parâmetros do detector: calibrando, sem perfil ou com perfil. */
export function detectorParamsFor(profile: CalibrationProfile | null, calibrating = false): DetectorParams {
  if (calibrating) return { ...DEFAULT_PARAMS, start: CALIB.calibStart };
  if (!profile) return { ...DEFAULT_PARAMS };
  return {
    ...DEFAULT_PARAMS,
    start: clamp(CALIB.startFactor * profile.weakPeak, CALIB.minStart, CALIB.maxStart),
    maxPeak: profile.strongPeak,
  };
}

/** Fraco calibrado → 0,2; forte calibrado → 1; abaixo do fraco, até o piso. */
export function powerFor(peak: number, p: CalibrationProfile): number {
  const span = p.strongPeak - p.weakPeak;
  return clamp(CALIB.weakPower + (1 - CALIB.weakPower) * (peak - p.weakPeak) / span, CALIB.powerFloor, 1);
}

/** Direção do golpe → lado (forehand 1 / backhand -1) e margem de confiança, pelos moldes calibrados. */
export function sideFor(dir: Rotation, p: CalibrationProfile): { side: Side; margin: number } {
  const m = margin(dir, p.forehand, p.backhand);
  return { side: m >= 0 ? 1 : -1, margin: m };
}

function isDirection(v: unknown): v is Direction {
  const d = v as Partial<Direction> | null;
  if (!d || ![d.alpha, d.beta, d.gamma].every((x) => typeof x === "number" && Number.isFinite(x))) return false;
  return Math.abs(Math.hypot(d.alpha!, d.beta!, d.gamma!) - 1) < 1e-3;
}

const isTemplates = (v: unknown): v is Direction[] => Array.isArray(v) && v.length === N() && v.every(isDirection);

/** Valida um perfil lido do armazenamento local. */
export function parseProfile(json: string | null): CalibrationProfile | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<CalibrationProfile>;
    const ok =
      (p.hand === "right" || p.hand === "left") &&
      isTemplates(p.forehand) && isTemplates(p.backhand) &&
      p.backhand.every((b) => bestSimilarity(b, p.forehand as Direction[]) < CALIB.maxBackhandSimilarity) &&
      typeof p.strongPeak === "number" && typeof p.weakPeak === "number" &&
      p.weakPeak > 0 && p.strongPeak >= CALIB.minRatio * p.weakPeak;
    return ok ? (p as CalibrationProfile) : null;
  } catch {
    return null;
  }
}
