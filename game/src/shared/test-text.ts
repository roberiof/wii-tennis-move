// Textos do modo de teste, usados no celular e no overlay do PC.

import type { TestTally } from "./messages";

const pct = (hits: number, n: number) => (n ? ` (${Math.round((hits / n) * 100)}%)` : "");

/** "rotação 14 de 20 (70%)" */
export function tallyText(t: TestTally): string {
  if (t.swings === 0) return "nenhum golpe ainda";
  return `rotação ${t.rotationHits} de ${t.swings}${pct(t.rotationHits, t.swings)}`;
}

/** Soma das duas séries, para a taxa geral. */
export function totalTally(a: TestTally, b: TestTally): TestTally {
  return { swings: a.swings + b.swings, rotationHits: a.rotationHits + b.rotationHits };
}
