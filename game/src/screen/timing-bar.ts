// Régua de timing: depois de cada golpe, mostra onde ele caiu na janela (cedo · no tempo · tarde).

import { TUNING } from "./tuning";

/** Posição (0..1) do offset na régua, que vai de −windowEarlyMs a +windowLateMs; fora da janela fica na ponta. */
export function barFraction(offsetMs: number): number {
  const f = (offsetMs + TUNING.windowEarlyMs) / (TUNING.windowEarlyMs + TUNING.windowLateMs);
  return Math.min(1, Math.max(0, f));
}

/** "+120 ms" / "−40 ms" / "0 ms". */
export function offsetLabel(offsetMs: number): string {
  const ms = Math.round(offsetMs);
  return `${ms > 0 ? "+" : ms < 0 ? "−" : ""}${Math.abs(ms)} ms`;
}

const VISIBLE_MS = 2500;

export function createTimingBar(root: HTMLElement) {
  const [early, onTime, late] = Array.from(root.querySelectorAll<HTMLElement>(".tb-band"));
  // Larguras proporcionais às faixas reais
  early.style.flexGrow = String(TUNING.windowEarlyMs - TUNING.earlyMs);
  onTime.style.flexGrow = String(TUNING.earlyMs + TUNING.lateMs);
  late.style.flexGrow = String(TUNING.windowLateMs - TUNING.lateMs);
  const marker = root.querySelector<HTMLElement>(".tb-marker")!;
  const label = root.querySelector<HTMLElement>(".tb-label")!;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    /** `miss`: golpe fora da janela (a bola não foi rebatida). */
    show(offsetMs: number, miss: "early" | "late" | null) {
      marker.style.left = `${barFraction(offsetMs) * 100}%`;
      marker.classList.toggle("miss", miss !== null);
      label.textContent = miss === "early" ? `cedo demais (${offsetLabel(offsetMs)})`
        : miss === "late" ? `tarde demais (${offsetLabel(offsetMs)})` : offsetLabel(offsetMs);
      root.classList.add("visible");
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => root.classList.remove("visible"), VISIBLE_MS);
    },
  };
}
