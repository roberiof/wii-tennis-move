// Contrato entre controller (celular) e screen (PC).

/** 1 = forehand, -1 = backhand. */
export type Side = 1 | -1;
export type Hand = "right" | "left";
export type Timing = "early" | "on-time" | "late";
export type GameMode = "wall" | "targets" | "cpu-demo";
export type CalibStep = "hand" | "forehand" | "backhand" | "strong" | "weak" | "done";
export type Phase = "calib" | "menu" | "playing";

// --- Controle → tela ---

export interface SwingMessage {
  type: "swing";
  /** 0..1, já pelo mapeamento da calibração quando `calibrated`. */
  power: number;
  /** Com calibração: forehand/backhand. Sem calibração: sinal bruto do eixo dominante. */
  side: Side;
  /** Magnitude de rotação no pico (°/s). */
  peak: number;
  calibrated: boolean;
  /** getServerTime() estimado no instante do pico. */
  t: number;
  /**
   * Confiança do lado (só com calibração): semelhança com o molde de forehand mais parecido − com o de backhand
   * mais parecido, de −2 a 2. Perto de 0 = leitura incerta; a tela não pune "lado errado" nesses casos.
   */
  sideMargin?: number;
}

/**
 * Passo atual da calibração no celular; a tela espelha. `hand` é null até ser escolhida.
 * Largada: o celular detecta que o jogador ficou parado (`still`), a tela mostra "Agora!" e confirma
 * com `calib-go`; só então o celular aceita o swing. Assim o PC nunca mostra instrução atrasada.
 */
export interface CalibMessage {
  type: "calib";
  step: CalibStep;
  hand: Hand | null;
  /** Destacando o passo recém-registrado; a espera parada ainda não começou. */
  holding: boolean;
  /** O destaque é de preparação: o jogador está trocando de posição (forehand ↔ backhand). */
  prep: boolean;
  /** Nos passos de molde (forehand/backhand): repetição pedida agora (1-based) e total; null nos demais. */
  rep: number | null;
  reps: number;
  /** Jogador ficou parado: a tela deve mostrar "Agora!" e confirmar com `calib-go`. */
  still: boolean;
  /** Identifica o pedido de largada; a confirmação devolve o mesmo valor. */
  goId: number;
  /** Passo gravado por último, para o "✓", e qual repetição dele (null fora dos moldes). */
  registered: CalibStep | null;
  registeredRep: number | null;
  /**
   * Refazendo: "power" = forte e fraco próximos demais; "side" = um backhand parecido demais com os forehands
   * (descartado); "inconsistent" = um forehand destoou dos outros e foi descartado.
   */
  retry: "power" | "side" | "inconsistent" | null;
}

/** Escolha no menu do celular; "menu" volta ao menu. */
export interface ModeMessage {
  type: "mode";
  mode: GameMode | "menu";
}

/** Acertos do modo de teste para um golpe declarado. */
export interface TestTally {
  /** Golpes contados nesta série. */
  swings: number;
  /** Quantos a leitura pela rotação classificou como o golpe declarado. */
  rotationHits: number;
}

/** Modo de teste (celular): golpe declarado, se está pronto para o próximo e o placar. A tela só mostra. */
export interface TestMessage {
  type: "test";
  /** Golpe da série atual (null = nenhuma série escolhida; o modo de teste foi fechado se `active` for false). */
  stroke: Side | null;
  active: boolean;
  armed: boolean;
  tally: { forehand: TestTally; backhand: TestTally };
}

export type ControllerMessage = SwingMessage | CalibMessage | ModeMessage | TestMessage;

// --- Tela → controle ---

/** Fase do jogo, para o celular mostrar a tela certa. */
export interface StateMessage {
  type: "state";
  phase: Phase;
  mode: GameMode | null;
}

/** Golpe aceito pela tela; o celular vibra e mostra o timing. */
export interface HitMessage {
  type: "hit";
  timing: Timing;
  sideOk: boolean;
}

export interface PlayerAssignMessage {
  type: "player";
  index: number;
  color: string;
}

/** A tela já mostra "Agora!" para o pedido `goId`: o celular pode aceitar o swing. */
export interface CalibGoMessage {
  type: "calib-go";
  goId: number;
}

export type ScreenMessage = StateMessage | HitMessage | CalibGoMessage | PlayerAssignMessage;
