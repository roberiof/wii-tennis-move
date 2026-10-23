import { describe, expect, it } from "vitest";
import { angleDelta, createRateDeriver } from "../src/controller/rotation";

describe("angleDelta", () => {
  it("diferença simples", () => expect(angleDelta(10, 30)).toBe(20));
  it("cruza +180 → -180", () => expect(angleDelta(170, -170)).toBe(20));
  it("cruza -180 → +180", () => expect(angleDelta(-170, 170)).toBe(-20));
  it("cruza 360 → 0 (alpha)", () => expect(angleDelta(350, 10)).toBe(20));
});

describe("createRateDeriver", () => {
  it("retorna null na primeira amostra", () => {
    expect(createRateDeriver()({ alpha: 0, beta: 0, gamma: 0 }, 0)).toBeNull();
  });

  it("converte variação de ângulo em °/s", () => {
    const derive = createRateDeriver();
    derive({ alpha: 0, beta: 175, gamma: 0 }, 0);
    const r = derive({ alpha: 10, beta: -175, gamma: 0 }, 100);
    expect(r?.alpha).toBeCloseTo(100);
    expect(r?.beta).toBeCloseTo(100);
    expect(r?.gamma).toBeCloseTo(0);
  });

  it("ignora amostra sem avanço de tempo", () => {
    const derive = createRateDeriver();
    derive({ alpha: 0, beta: 0, gamma: 0 }, 50);
    expect(derive({ alpha: 10, beta: 0, gamma: 0 }, 50)).toBeNull();
  });
});
