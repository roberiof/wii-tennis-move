// Interface de conexão do ADR 0003: o jogo só conhece sendSwing / onSwing (e as demais mensagens tipadas).
// Implementação sobre AirConsole; o plano B implementaria as mesmas interfaces sobre WebSocket.

import type { ControllerMessage, ScreenMessage, SwingMessage } from "../shared/messages";

type Msg = { type: string };
export type Handlers<M extends Msg> = {
  [K in M["type"]]?: (from: number, m: Extract<M, { type: K }>) => void;
};

/** Cria um onMessage que despacha por `type`; ignora dados sem `type` ou sem handler. */
export function route<M extends Msg>(handlers: Handlers<M>): (from: number, data: unknown) => void {
  return (from, data) => {
    const type = (data as Msg | null)?.type;
    if (typeof type !== "string") return;
    const h = handlers[type as M["type"]] as ((from: number, m: M) => void) | undefined;
    h?.(from, data as M);
  };
}

/** Lado da tela: recebe dos celulares, envia para um celular. */
export interface ScreenLink {
  onSwing(cb: (deviceId: number, s: SwingMessage) => void): void;
  on(handlers: Omit<Handlers<ControllerMessage>, "swing">): void;
  send(deviceId: number, m: ScreenMessage): void;
}

/** Lado do celular: envia para a tela, recebe dela. */
export interface ControllerLink {
  sendSwing(s: SwingMessage): void;
  send(m: Exclude<ControllerMessage, SwingMessage>): void;
  on(handlers: Handlers<ScreenMessage>): void;
}

export function airconsoleScreenLink(ac: AirConsole): ScreenLink {
  const handlers: Handlers<ControllerMessage> = {};
  ac.onMessage = route(handlers);
  return {
    onSwing: (cb) => { handlers.swing = cb; },
    on: (h) => { Object.assign(handlers, h); },
    send: (deviceId, m) => ac.message(deviceId, m),
  };
}

export function airconsoleControllerLink(ac: AirConsole): ControllerLink {
  const handlers: Handlers<ScreenMessage> = {};
  ac.onMessage = route(handlers);
  return {
    sendSwing: (s) => ac.message(AirConsole.SCREEN, s),
    send: (m) => ac.message(AirConsole.SCREEN, m),
    on: (h) => { Object.assign(handlers, h); },
  };
}
