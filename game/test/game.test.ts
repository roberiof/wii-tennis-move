import { describe, expect, it } from "vitest";
import { INITIAL, modeOf, reduce, sameState, Seat, type GameState } from "../src/screen/game";

const playing = (mode: "wall" | "targets" | "cpu-demo"): GameState => ({ phase: "playing", mode });

describe("estado do jogo", () => {
  it("começa no menu", () => {
    expect(INITIAL).toEqual({ phase: "menu" });
  });

  it("calibração: entra a qualquer momento e termina no menu", () => {
    expect(reduce(INITIAL, { type: "calib", done: false })).toEqual({ phase: "calib" });
    expect(reduce(playing("wall"), { type: "calib", done: false })).toEqual({ phase: "calib" }); // Recalibrar
    expect(reduce({ phase: "calib" }, { type: "calib", done: true })).toEqual({ phase: "menu" });
  });

  it("'done' fora da calibração (celular que já tinha perfil) não tira ninguém do jogo", () => {
    expect(reduce(playing("targets"), { type: "calib", done: true })).toEqual(playing("targets"));
    expect(reduce(INITIAL, { type: "calib", done: true })).toEqual(INITIAL);
  });

  it("menu do celular escolhe o modo e volta ao menu", () => {
    const s = reduce(INITIAL, { type: "mode", mode: "wall" });
    expect(s).toEqual(playing("wall"));
    expect(reduce(s, { type: "mode", mode: "cpu-demo" })).toEqual(playing("cpu-demo"));
    expect(reduce(s, { type: "mode", mode: "menu" })).toEqual(INITIAL);
  });

  it("atalhos do teclado valem fora da calibração", () => {
    expect(reduce(INITIAL, { type: "key", mode: "targets" })).toEqual(playing("targets"));
    expect(reduce(playing("targets"), { type: "key", mode: "menu" })).toEqual(INITIAL);
    expect(reduce({ phase: "calib" }, { type: "key", mode: "wall" })).toEqual({ phase: "calib" });
  });

  it("celular saiu no meio da calibração: volta ao menu; jogando, o jogo continua", () => {
    expect(reduce({ phase: "calib" }, { type: "left" })).toEqual(INITIAL);
    expect(reduce(playing("wall"), { type: "left" })).toEqual(playing("wall"));
  });

  it("modeOf / sameState", () => {
    expect(modeOf(playing("wall"))).toBe("wall");
    expect(modeOf(INITIAL)).toBeNull();
    expect(sameState(playing("wall"), playing("wall"))).toBe(true);
    expect(sameState(playing("wall"), playing("targets"))).toBe(false);
  });
});

describe("um jogador (Seat)", () => {
  it("o primeiro celular controla; os outros são ignorados", () => {
    const seat = new Seat();
    expect(seat.claim(5)).toBe(true);
    expect(seat.claim(7)).toBe(false);
    expect(seat.claim(5)).toBe(true);
  });

  it("quando o dono sai, o próximo que aparecer assume", () => {
    const seat = new Seat();
    seat.claim(5);
    expect(seat.release(7)).toBe(false);
    expect(seat.release(5)).toBe(true);
    expect(seat.claim(7)).toBe(true);
    expect(seat.claim(5)).toBe(false);
  });
});
