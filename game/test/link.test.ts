import { describe, expect, it, vi } from "vitest";
import { airconsoleScreenLink, route } from "../src/net/link";
import type { ControllerMessage, SwingMessage } from "../src/shared/messages";

const swing: SwingMessage = { type: "swing", power: 0.5, side: 1, peak: 900, calibrated: true, t: 1000 };

// Só o que o link usa do AirConsole.
function fakeAc() {
  return { onMessage: (_from: number, _data: unknown) => {}, message: vi.fn() };
}

describe("route", () => {
  it("despacha por type, com o remetente", () => {
    const onSwing = vi.fn();
    const onMode = vi.fn();
    const dispatch = route<ControllerMessage>({ swing: onSwing, mode: onMode });
    dispatch(3, swing);
    dispatch(4, { type: "mode", mode: "wall" });
    expect(onSwing).toHaveBeenCalledWith(3, swing);
    expect(onMode).toHaveBeenCalledWith(4, { type: "mode", mode: "wall" });
  });

  it("ignora dados sem type, nulos ou sem handler", () => {
    const onSwing = vi.fn();
    const dispatch = route<ControllerMessage>({ swing: onSwing });
    expect(() => {
      dispatch(1, null);
      dispatch(1, undefined);
      dispatch(1, "swing");
      dispatch(1, { power: 1 });
      dispatch(1, { type: "calib", step: "done", hand: "right" });
    }).not.toThrow();
    expect(onSwing).not.toHaveBeenCalled();
  });
});

describe("airconsoleScreenLink", () => {
  it("entrega swing e as outras mensagens registradas depois", () => {
    const ac = fakeAc();
    const link = airconsoleScreenLink(ac as unknown as AirConsole);
    const onSwing = vi.fn();
    const onCalib = vi.fn();
    link.onSwing(onSwing);
    link.on({ calib: onCalib });
    ac.onMessage(2, swing);
    ac.onMessage(2, { type: "calib", step: "strong", hand: "left" });
    expect(onSwing).toHaveBeenCalledWith(2, swing);
    expect(onCalib).toHaveBeenCalledWith(2, { type: "calib", step: "strong", hand: "left" });
  });

  it("send manda para o device indicado", () => {
    const ac = fakeAc();
    const link = airconsoleScreenLink(ac as unknown as AirConsole);
    link.send(5, { type: "hit", timing: "early", sideOk: true });
    expect(ac.message).toHaveBeenCalledWith(5, { type: "hit", timing: "early", sideOk: true });
  });
});
