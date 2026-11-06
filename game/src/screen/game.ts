// Estado do jogo na tela: calib → menu → playing(mode). Funções puras; screen/main.ts aplica as transições.
// O celular conduz (calibração e escolha de modo); as teclas 1, 2, 3 e Esc são atalhos de depuração no PC.

import type { GameMode, Phase } from "../shared/messages";

export type GameState = { phase: "calib" } | { phase: "menu" } | { phase: "playing"; mode: GameMode };

export type GameEvent =
  /** Passo de calibração vindo do celular (`done` = terminou ou o celular já tinha perfil). */
  | { type: "calib"; done: boolean }
  /** Escolha no menu do celular. */
  | { type: "mode"; mode: GameMode | "menu" }
  /** Atalho do teclado no PC (ignorado durante a calibração). */
  | { type: "key"; mode: GameMode | "menu" }
  /** O celular que controla saiu. */
  | { type: "left" };

export const INITIAL: GameState = { phase: "menu" };

const toMode = (mode: GameMode | "menu"): GameState => (mode === "menu" ? { phase: "menu" } : { phase: "playing", mode });

export function reduce(s: GameState, e: GameEvent): GameState {
  switch (e.type) {
    case "calib":
      if (!e.done) return s.phase === "calib" ? s : { phase: "calib" };
      // Fim da calibração → menu. "done" fora da calibração (celular com perfil ao conectar) não muda nada.
      return s.phase === "calib" ? { phase: "menu" } : s;
    case "mode":
      return toMode(e.mode);
    case "key":
      return s.phase === "calib" ? s : toMode(e.mode);
    case "left":
      return s.phase === "calib" ? { phase: "menu" } : s;
  }
}

export const modeOf = (s: GameState): GameMode | null => (s.phase === "playing" ? s.mode : null);
export const phaseOf = (s: GameState): Phase => s.phase;

export function sameState(a: GameState, b: GameState): boolean {
  return a.phase === b.phase && modeOf(a) === modeOf(b);
}

/**
 * S3 tem um jogador: o primeiro celular que aparece (conexão ou mensagem) controla; os outros são ignorados.
 * Se ele sair, o próximo que aparecer assume.
 */
export class Seat {
  owner: number | null = null;

  /** true se `id` controla o jogador (ocupa o lugar se estiver livre). */
  claim(id: number): boolean {
    if (this.owner === null) this.owner = id;
    return this.owner === id;
  }

  /** true se quem saiu era o dono. */
  release(id: number): boolean {
    if (this.owner !== id) return false;
    this.owner = null;
    return true;
  }
}
