// Textos da calibração, usados no celular e na tela do PC (o jogador lê no PC sem mexer o celular).

import type { CalibStep } from "./messages";

export const CALIB_TEXT: Record<Exclude<CalibStep, "done">, { n: number; title: string; hint: string }> = {
  hand: { n: 1, title: "Você joga com qual mão?", hint: "Escolha Destro ou Canhoto no celular." },
  forehand: { n: 2, title: "Faça um FOREHAND", hint: "O golpe do lado da sua mão, como numa raquetada normal." },
  backhand: { n: 3, title: "Faça um BACKHAND", hint: "O golpe do outro lado do corpo, com as costas da mão para a frente." },
  strong: { n: 4, title: "Forehand FORTE", hint: "O mais forte que você vai usar no jogo." },
  weak: { n: 5, title: "Forehand FRACO", hint: "Um toque leve, mas ainda uma raquetada." },
};

export const CALIB_TOTAL = 5;

export const STEP_LABEL: Record<CalibStep, string> = {
  hand: "Mão",
  forehand: "Forehand",
  backhand: "Backhand",
  strong: "Forte",
  weak: "Fraco",
  done: "Calibração",
};

export const REGISTERED_TEXT: Record<CalibStep, string> = {
  hand: "Mão registrada",
  forehand: "Forehand registrado",
  backhand: "Backhand registrado",
  strong: "Forte registrado",
  weak: "Fraco registrado",
  done: "Calibração concluída",
};

export const RETRY_HINT: Record<"power" | "side" | "inconsistent", string> = {
  power: "Forte e fraco ficaram parecidos. Capriche na diferença: forehand FORTE de novo.",
  side: "Esse backhand ficou parecido com o forehand e foi descartado. Faça do outro lado do corpo.",
  inconsistent: "Um golpe saiu diferente dos outros e foi descartado. Repita mais um, do mesmo jeito.",
};

/** " (2 de 3)" nos passos com repetição. */
export function repText(rep: number | null, reps: number): string {
  return rep === null ? "" : ` (${rep} de ${reps})`;
}

/** Título do passo, com a repetição quando houver. */
export function calibTitle(step: Exclude<CalibStep, "done">, rep: number | null, reps: number): string {
  return CALIB_TEXT[step].title + repText(rep, reps);
}

/** Pedido de troca de posição durante o destaque de preparação, por passo seguinte. */
export const PREP_TEXT: Partial<Record<CalibStep, string>> = {
  backhand: "Posicione-se para o BACKHAND",
  strong: "Volte para a posição de FOREHAND",
};

/**
 * Linha de estado dos passos de swing.
 * `go`: no PC, o celular pediu a largada; no celular, o PC confirmou.
 * `prep`: destaque de preparação; mostra o pedido de troca de posição do passo `step`.
 */
export function statusText(
  holding: boolean, registered: CalibStep | null, go: boolean, prep = false, step?: CalibStep,
  registeredRep: number | null = null, reps = 0,
): string {
  if (holding) {
    const done = registered ? `✓ ${REGISTERED_TEXT[registered]}${repText(registeredRep, reps)}` : "";
    const parts = [done, prep && step ? PREP_TEXT[step] ?? "" : ""];
    return parts.filter(Boolean).join(" · ");
  }
  return go ? "Agora!" : "Segure o celular parado…";
}
