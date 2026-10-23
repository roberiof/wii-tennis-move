// Contrato entre controller (celular) e screen (PC).

export type Source = "airconsole" | "native";
export type RotationMode = "raw" | "derived";
export type Axis = "alpha" | "beta" | "gamma";

/** [t_local_ms, x, y, z, alpha, beta, gamma] — tupla para reduzir o tamanho do lote. */
export type SampleTuple = [number, number, number, number, number, number, number];

export interface IntervalStats {
  n: number;
  mean: number;
  max: number;
  p95: number;
  hz: number;
}

export interface SampleBatchPart {
  source: Source;
  samples: SampleTuple[];
  /** Intervalo entre amostras medido no celular com performance.now(). */
  stats: IntervalStats;
}

/** Um lote por envio, com todas as fontes ativas, para não dobrar o número de mensagens. */
export interface SampleBatch {
  type: "samples";
  /** getServerTime() no envio do lote. */
  sentAt: number;
  parts: SampleBatchPart[];
}

export interface SwingEvent {
  type: "swing";
  source: Source;
  mode: RotationMode;
  /** 0..1 */
  power: number;
  /** Com calibração: 1 = forehand, -1 = backhand. Sem calibração: sinal bruto do eixo dominante. */
  side: 1 | -1;
  calibrated: boolean;
  /** Magnitude de rotação no pico (°/s, se a fonte for velocidade). */
  peak: number;
  axis: Axis;
  /** getServerTime() estimado no instante do pico. */
  t: number;
  /** getServerTime() quando o evento saiu do celular. */
  emittedAt: number;
}

export type NativeState = "off" | "waiting" | "on" | "blocked" | "denied" | "unsupported";

export interface ControllerStatus {
  type: "status";
  dm: number;
  native: NativeState;
}

export type ControllerMessage = SampleBatch | SwingEvent | ControllerStatus;

/** Tela → controle: número e cor do jogador. */
export interface PlayerAssign {
  type: "player";
  index: number;
  color: string;
}

export const PLAYER_COLORS = ["#ff5a5f", "#3ec1ff", "#ffd23f", "#7bd389", "#c77dff", "#ff9f1c"];
