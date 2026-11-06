// Overlay de depuração da tela (tecla D): timing, latência e onde a bola caiu em relação ao alvo.
// A latência é chegada na tela − t do pico, as duas no relógio do servidor; só vale para golpes do celular.

import type { Clock } from "./clock";
import type { TestMessage } from "../shared/messages";
import { tallyText, totalTally } from "../shared/test-text";
import type { Point2, Resolution, ShotResult, SwingInput } from "./shot";

const SIDE = (s: number) => (s > 0 ? "forehand" : "backhand");
const ms = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)} ms`;
const m = (v: number) => v.toFixed(2);

export function createDebugPanel(el: HTMLElement, clock: Clock) {
  let visible = false;
  let swing = "—";
  let latency = "—";
  let result = "—";
  let side = "—";
  let target: Point2 | null = null;
  let bounce = "—";
  let testLines: string[] = [];

  function render() {
    if (!visible) return;
    el.innerHTML = [
      `<b>DEPURAÇÃO</b> (D fecha) · relógio: ${clock.synced ? "servidor" : "local"}`,
      `swing: ${swing}`,
      `latência: ${latency}`,
      `resultado: ${result}`,
      `lado: ${side}`,
      `alvo: ${target ? `x ${m(target.x)} · z ${m(target.z)}` : "—"}`,
      `quique: ${bounce}`,
      ...testLines,
    ].join("<br>");
  }

  return {
    /** Placar do modo de teste do celular; abre o overlay quando o teste começa. */
    test(t: TestMessage) {
      if (!t.active) {
        testLines = [];
        render();
        return;
      }
      const serie = t.stroke === null ? "escolha a série no celular" : `série ${SIDE(t.stroke).toUpperCase()}`;
      const status = t.stroke === null ? "" : t.armed ? " · Agora!" : " · segure parado…";
      testLines = [
        "",
        `<b>TESTE DE GOLPES</b> · ${serie}${status}`,
        `forehand: ${tallyText(t.tally.forehand)}`,
        `backhand: ${tallyText(t.tally.backhand)}`,
        `total: ${tallyText(totalTally(t.tally.forehand, t.tally.backhand))}`,
      ];
      if (!visible) this.toggle();
      else render();
    },
    toggle() {
      visible = !visible;
      el.classList.toggle("visible", visible);
      render();
    },
    swing(s: SwingInput) {
      const conf = s.sideMargin === undefined ? "" : ` (margem ${s.sideMargin >= 0 ? "+" : ""}${s.sideMargin.toFixed(2)})`;
      swing = `${SIDE(s.side)}${conf} · força ${Math.round(s.power * 100)}% · ${s.deviceId === null ? "teclado" : `celular ${s.deviceId}`}`;
      latency = s.deviceId !== null && clock.synced ? `${Math.round(s.arrivedAt - s.t)} ms` : "— (teclado ou sem relógio do servidor)";
      result = "aguardando a bola…";
      render();
    },
    miss(r: Extract<Resolution, { kind: "miss" }>) {
      result = `ERROU: ${r.reason === "early" ? "cedo" : "tarde"} demais (${ms(r.offsetMs)})`;
      render();
    },
    hit(shot: ShotResult) {
      result = `acerto · ${shot.timing} (${ms(shot.offsetMs)}) · contato x ${m(shot.contact.x)}`;
      const expected = shot.sideOk && !shot.sideDoubt ? shot.side : -shot.side;
      const verdict = shot.sideDoubt ? "✓ (na dúvida, aceito)" : shot.sideOk ? "✓" : "✗ (lado errado)";
      side = `${SIDE(shot.side)} · esperado ${SIDE(expected)} ${verdict}`;
      target = shot.target;
      bounce = "…";
      render();
    },
    bounce(b: Point2) {
      const err = target ? ` · erro ${m(Math.hypot(b.x - target.x, b.z - target.z))} m` : "";
      bounce = `x ${m(b.x)} · z ${m(b.z)}${err}`;
      render();
    },
  };
}
