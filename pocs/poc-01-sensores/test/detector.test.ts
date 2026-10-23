import { describe, expect, it } from "vitest";
import { createSwingDetector, DEFAULT_PARAMS, type DetectedSwing } from "../src/controller/detector";

// Swing sintético: rampa até o pico e descida, uma amostra a cada `dt` ms.
function feed(detect: (r: { alpha: number; beta: number; gamma: number }, t: number) => void,
  profile: number[], axis: "alpha" | "beta" | "gamma", t0 = 0, dt = 16) {
  profile.forEach((v, i) => detect({ alpha: 0, beta: 0, gamma: 0, [axis]: v }, t0 + i * dt));
}

const SWING = [0, 100, 500, 900, 1200, 800, 300, 100, 0];

describe("createSwingDetector", () => {
  it("carimba t no pico, não na descida", () => {
    const out: DetectedSwing[] = [];
    feed(createSwingDetector(DEFAULT_PARAMS, (s) => out.push(s)), SWING, "alpha");
    expect(out).toHaveLength(1);
    expect(out[0].t).toBe(4 * 16);
    expect(out[0].peak).toBe(1200);
    expect(out[0].power).toBeCloseTo(1200 / 1500);
  });

  it("usa o sinal do eixo dominante para o lado", () => {
    const out: DetectedSwing[] = [];
    feed(createSwingDetector(DEFAULT_PARAMS, (s) => out.push(s)), SWING.map((v) => -v), "gamma");
    expect(out[0].axis).toBe("gamma");
    expect(out[0].side).toBe(-1);
  });

  it("ignora movimentos abaixo do limiar", () => {
    const out: DetectedSwing[] = [];
    feed(createSwingDetector(DEFAULT_PARAMS, (s) => out.push(s)), [0, 150, 350, 150, 0], "beta");
    expect(out).toHaveLength(0);
  });

  it("respeita a pausa entre swings", () => {
    const out: DetectedSwing[] = [];
    const detect = createSwingDetector(DEFAULT_PARAMS, (s) => out.push(s));
    feed(detect, SWING, "alpha", 0);
    feed(detect, SWING, "alpha", 200); // começa logo após o fim: dentro dos 300 ms
    feed(detect, SWING, "alpha", 1000);
    expect(out).toHaveLength(2);
  });

  it("limita power a 1", () => {
    const out: DetectedSwing[] = [];
    feed(createSwingDetector(DEFAULT_PARAMS, (s) => out.push(s)), [0, 3000, 0], "alpha");
    expect(out[0].power).toBe(1);
  });

  it("finaliza o swing se estourar o timeout mesmo sem descer abaixo do limiar final", () => {
    const out: DetectedSwing[] = [];
    const detect = createSwingDetector({ ...DEFAULT_PARAMS, timeout: 200 }, (s) => out.push(s));
    // Começa swing em t=0
    detect({ alpha: 500, beta: 0, gamma: 0 }, 0);
    // Permanece alto sem cair abaixo de end (200) até t=250ms (> timeout de 200ms)
    detect({ alpha: 800, beta: 0, gamma: 0 }, 100);
    detect({ alpha: 300, beta: 0, gamma: 0 }, 250);
    expect(out).toHaveLength(1);
    expect(out[0].peak).toBe(800);
  });
});
