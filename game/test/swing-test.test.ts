import { describe, expect, it } from "vitest";
import { CALIB } from "../src/controller/calibration";
import {
  chooseStroke, feedTestMotion, feedTestSwing, resetTally, startSwingTest, type SwingTestState,
} from "../src/controller/swing-test";
import { tallyText, totalTally } from "../src/shared/test-text";

/** Fica parado a partir de `t` até armar. */
const arm = (s: SwingTestState, t: number) => feedTestMotion(feedTestMotion(s, 10, t), 10, t + CALIB.stillMs);

describe("modo de teste", () => {
  it("sem série escolhida não arma nem conta", () => {
    let s = arm(startSwingTest(), 0);
    expect(s.armedAt).toBeNull();
    s = feedTestSwing(s, { t: 5000, rotation: 1 });
    expect(s.tally.forehand.swings).toBe(0);
  });

  it("conta acertos contra o golpe declarado", () => {
    let s = chooseStroke(startSwingTest(), 1);
    s = feedTestSwing(arm(s, 0), { t: 1000, rotation: 1 });
    s = feedTestSwing(arm(s, 2000), { t: 3000, rotation: -1 });
    s = feedTestSwing(arm(s, 4000), { t: 5000, rotation: 1 });
    expect(s.tally.forehand).toEqual({ swings: 3, rotationHits: 2 });
    expect(s.tally.backhand.swings).toBe(0);
  });

  it("série de backhand conta no placar de backhand", () => {
    let s = chooseStroke(startSwingTest(), -1);
    s = feedTestSwing(arm(s, 0), { t: 1000, rotation: -1 });
    expect(s.tally.backhand).toEqual({ swings: 1, rotationHits: 1 });
  });

  it("precisa ficar parado antes de cada golpe (a volta do braço não conta)", () => {
    let s = chooseStroke(startSwingTest(), 1);
    s = feedTestSwing(arm(s, 0), { t: 1000, rotation: 1 });
    s = feedTestSwing(s, { t: 1300, rotation: -1 }); // volta do braço, sem ter parado
    expect(s.tally.forehand.swings).toBe(1);
  });

  it("movimento no meio da espera reinicia a contagem", () => {
    let s = chooseStroke(startSwingTest(), 1);
    s = feedTestMotion(s, 10, 0);
    s = feedTestMotion(s, CALIB.stillMax + 1, 300);
    s = feedTestMotion(s, 10, 400);
    s = feedTestMotion(s, 10, 400 + CALIB.stillMs - 1);
    expect(s.armedAt).toBeNull();
  });

  it("trocar de série mantém o placar; zerar limpa", () => {
    let s = chooseStroke(startSwingTest(), 1);
    s = feedTestSwing(arm(s, 0), { t: 1000, rotation: 1 });
    s = chooseStroke(s, -1);
    expect(s).toMatchObject({ stroke: -1, armedAt: null });
    expect(s.tally.forehand.swings).toBe(1);
    expect(resetTally(s).tally.forehand.swings).toBe(0);
  });
});

describe("textos do teste", () => {
  it("formata o placar", () => {
    expect(tallyText({ swings: 0, rotationHits: 0 })).toBe("nenhum golpe ainda");
    expect(tallyText({ swings: 20, rotationHits: 14 })).toBe("rotação 14 de 20 (70%)");
  });

  it("soma as séries", () => {
    const a = { swings: 10, rotationHits: 7 };
    expect(totalTally(a, a)).toEqual({ swings: 20, rotationHits: 14 });
  });
});
