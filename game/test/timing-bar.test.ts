import { describe, expect, it } from "vitest";
import { barFraction, offsetLabel } from "../src/screen/timing-bar";
import { TUNING } from "../src/screen/tuning";

describe("régua de timing", () => {
  const total = TUNING.windowEarlyMs + TUNING.windowLateMs;
  it("posição proporcional na janela, presa nas pontas", () => {
    expect(barFraction(-TUNING.windowEarlyMs)).toBe(0);
    expect(barFraction(0)).toBeCloseTo(TUNING.windowEarlyMs / total);
    expect(barFraction(TUNING.windowLateMs)).toBe(1);
    expect(barFraction(-2000)).toBe(0);
    expect(barFraction(2000)).toBe(1);
  });
  it("rótulo com sinal", () => {
    expect(offsetLabel(120.4)).toBe("+120 ms");
    expect(offsetLabel(-40)).toBe("−40 ms");
    expect(offsetLabel(0)).toBe("0 ms");
  });
});
