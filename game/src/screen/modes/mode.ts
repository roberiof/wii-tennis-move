import type * as THREE from "three";
import type { GameMode, Hand } from "../../shared/messages";
import type { Character } from "../character";
import type { TennisBall } from "../physics";
import type { Point2, Point3, ShotResult } from "../shot";

/** Quique da bola; `half` diz em que metade caiu (jogador em z > 0). */
export interface BounceEvent extends Point2 {
  half: "player" | "far";
  /** Quiques desde o último golpe, contando este. */
  count: number;
}

/** Painel do Treino com alvos (a tela desenha; null = esconder). */
export interface LessonView {
  /** 0-based. */
  index: number;
  total: number;
  title: string;
  hint: string;
  hits: number;
  attempts: number;
  goal: number;
  /** Resultado da última tentativa. */
  last: { text: string; ok: boolean } | null;
  /** Treino concluído: acertos e tentativas de cada lição. */
  summary: { title: string; hits: number; attempts: number }[] | null;
}

/** O que um modo recebe da cena. */
export interface ModeContext {
  scene: THREE.Scene;
  ball: TennisBall;
  player: Character;
  feedback(text: string, color?: string): void;
  setRally(n: number): void;
  /** Bola nova chegando ao jogador: libera um novo acerto no ShotResolver. */
  newBall(): void;
  /** Mão do jogador (da calibração). */
  hand(): Hand;
  showLesson(v: LessonView | null): void;
}

export interface Mode {
  readonly id: GameMode;
  start(): void;
  /** Chamado a cada frame, depois da física. `now` no relógio do jogo (screen/clock), em ms; `prev` = bola no frame anterior. */
  update(dt: number, now: number, prev: Point3): void;
  onShot(r: ShotResult): void;
  onBounce(b: BounceEvent): void;
  onNet(): void;
  /** Atalho de teste: pula para a próxima etapa do modo (lição seguinte, no treino). */
  next?(): void;
  /** Remove da cena o que o modo criou. */
  stop(): void;
}

export type ModeFactory = (ctx: ModeContext) => Mode;
