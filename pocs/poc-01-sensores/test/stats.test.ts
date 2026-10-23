import { describe, expect, it } from "vitest";
import { IntervalTracker, percentile, summarize } from "../src/shared/stats";

describe("stats", () => {
  it("percentile p95 de 1..100", () => {
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });

  it("summarize vazio", () => expect(summarize([])).toEqual({ n: 0, mean: 0, max: 0, p95: 0 }));

  it("IntervalTracker mede média, máximo e Hz", () => {
    const tr = new IntervalTracker();
    [0, 16, 32, 48, 148].forEach((t) => tr.push(t));
    const s = tr.stats();
    expect(s.n).toBe(4);
    expect(s.mean).toBe(37);
    expect(s.max).toBe(100);
    expect(s.hz).toBeCloseTo(1000 / 37);
  });

  it("IntervalTracker respeita o tamanho da janela", () => {
    const tr = new IntervalTracker(3);
    [0, 10, 20, 30, 130].forEach((t) => tr.push(t));
    expect(tr.stats().n).toBe(3);
  });
});
