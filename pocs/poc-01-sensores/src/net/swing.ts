// Interface de conexão do ADR 0003: o jogo só conhece sendSwing / onSwing.
// Aqui, implementação sobre AirConsole; o plano B implementa a mesma interface sobre WebSocket.

import type { ControllerMessage, SwingEvent } from "../shared/messages";

export interface SwingSender {
  sendSwing(s: SwingEvent): void;
}

export interface SwingReceiver {
  onSwing(cb: (deviceId: number, s: SwingEvent) => void): void;
}

export function airconsoleSender(ac: AirConsole): SwingSender {
  return { sendSwing: (s) => ac.message(AirConsole.SCREEN, s) };
}

type Handlers = { [K in ControllerMessage["type"]]?: (deviceId: number, m: Extract<ControllerMessage, { type: K }>) => void };

/** Roteia o onMessage único do AirConsole por tipo de mensagem. */
export function airconsoleReceiver(ac: AirConsole, handlers: Omit<Handlers, "swing"> = {}): SwingReceiver {
  let swingCb: ((deviceId: number, s: SwingEvent) => void) | null = null;
  ac.onMessage = (deviceId, data) => {
    const m = data as ControllerMessage;
    if (m?.type === "swing") swingCb?.(deviceId, m);
    else if (m?.type === "samples") handlers.samples?.(deviceId, m);
    else if (m?.type === "status") handlers.status?.(deviceId, m);
  };
  return { onSwing: (cb) => { swingCb = cb; } };
}
