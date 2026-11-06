import { describe, expect, it } from "vitest";
import {
  buildShot, classifyTiming, expectedSide, pickTarget, preferredSide, ShotResolver, shotPower, standX,
  type SwingInput,
} from "../src/screen/shot";
import { TUNING } from "../src/screen/tuning";

const swingAt = (t: number, side: 1 | -1 = 1): SwingInput => ({ t, power: 0.7, side, deviceId: 1, arrivedAt: t + 80 });

describe("classifyTiming", () => {
  it("faixas: adiantado / no tempo / atrasado", () => {
    expect(classifyTiming(-TUNING.earlyMs - 1)).toBe("early");
    expect(classifyTiming(-TUNING.earlyMs)).toBe("on-time");
    expect(classifyTiming(0)).toBe("on-time");
    expect(classifyTiming(TUNING.lateMs)).toBe("on-time");
    expect(classifyTiming(TUNING.lateMs + 1)).toBe("late");
  });
});

describe("lado", () => {
  it("destro: bola à direita do corpo = forehand; canhoto espelha", () => {
    expect(expectedSide(2, 1, "right")).toBe(1);
    expect(expectedSide(0, 1, "right")).toBe(-1);
    expect(expectedSide(2, 1, "left")).toBe(-1);
    expect(expectedSide(0, 1, "left")).toBe(1);
  });

  it("movimento automático: backhand só para bola bem do lado do backhand", () => {
    expect(preferredSide(0, "right")).toBe(1);
    expect(preferredSide(-0.9, "right")).toBe(1);
    expect(preferredSide(-2, "right")).toBe(-1);
    expect(preferredSide(2, "left")).toBe(-1);
  });

  it("standX deixa a bola do lado do golpe planejado", () => {
    for (const hand of ["right", "left"] as const) {
      for (const side of [1, -1] as const) {
        const x = standX(1.2, side, hand);
        expect(expectedSide(1.2, x, hand)).toBe(side);
        expect(Math.abs(1.2 - x)).toBeCloseTo(TUNING.reach);
      }
    }
  });
});

describe("pickTarget", () => {
  it("força define a profundidade", () => {
    expect(pickTarget("on-time", 0, 0, 1, "right").z).toBeCloseTo(-TUNING.depthBase);
    expect(pickTarget("on-time", 1, 0, 1, "right").z).toBeCloseTo(-(TUNING.depthBase + TUNING.depthPerPower));
  });

  it("no tempo vai ao centro", () => {
    expect(pickTarget("on-time", 0.5, 3, 1, "right").x).toBe(0);
  });

  it("adiantado = cruzada (lado oposto ao contato); atrasado = paralela", () => {
    expect(pickTarget("early", 0.5, 3, 1, "right").x).toBe(-TUNING.crossX);
    expect(pickTarget("late", 0.5, 3, 1, "right").x).toBe(TUNING.crossX);
    expect(pickTarget("early", 0.5, -3, -1, "right").x).toBe(TUNING.crossX);
    expect(pickTarget("late", 0.5, -3, -1, "right").x).toBe(-TUNING.crossX);
  });

  it("contato no centro: forehand de destro adiantado puxa para a esquerda", () => {
    expect(pickTarget("early", 0.5, 0.2, 1, "right").x).toBe(-TUNING.crossX);
    expect(pickTarget("early", 0.5, 0.2, -1, "right").x).toBe(TUNING.crossX);
    expect(pickTarget("early", 0.5, 0.2, 1, "left").x).toBe(TUNING.crossX);
  });
});

describe("lado errado (híbrido)", () => {
  it("metade da força e voo mais lento", () => {
    const ok = shotPower(0.8, true);
    const bad = shotPower(0.8, false);
    expect(bad.power).toBeCloseTo(0.8 * TUNING.wrongSidePower);
    expect(bad.hSpeed).toBeCloseTo((TUNING.speedBase + TUNING.speedPerPower * 0.4) / TUNING.wrongSideFlight);
    expect(ok.hSpeed).toBeCloseTo(TUNING.speedBase + TUNING.speedPerPower * 0.8);
  });

  it("buildShot aplica a penalidade no alvo, mas guarda a força recebida", () => {
    const contact = { x: 2, y: 1, z: TUNING.contactZ };
    const wrong = buildShot(0, contact, -1, 0.8, 1, "right"); // bola à direita, mas backhand
    expect(wrong.sideOk).toBe(false);
    expect(wrong.power).toBe(0.8);
    expect(wrong.target.z).toBeCloseTo(-(TUNING.depthBase + TUNING.depthPerPower * 0.4));
    const right = buildShot(0, contact, 1, 0.8, 1, "right");
    expect(right.sideOk).toBe(true);
    expect(right.target.z).toBeCloseTo(-(TUNING.depthBase + TUNING.depthPerPower * 0.8));
  });
});

describe("ShotResolver", () => {
  const cz = TUNING.contactZ;
  // Bola cruza a linha de contato entre t = 1000 e t = 1016, exatamente na metade (t = 1008).
  const before = { x: 1, y: 1, z: cz - 0.1, t: 1000 };
  const after = { x: 1.2, y: 0.8, z: cz + 0.1, t: 1016 };

  it("swing antes do cruzamento fica pendente e é avaliado no cruzamento", () => {
    const r = new ShotResolver();
    expect(r.swing(swingAt(900), true)).toBeNull();
    const res = r.frame(before, after, true);
    expect(res).toMatchObject({ kind: "hit", offsetMs: 900 - 1008 });
    if (res?.kind === "hit") {
      expect(res.contact.x).toBeCloseTo(1.1);
      expect(res.contact.z).toBe(cz);
    }
  });

  it("swing depois do cruzamento é avaliado na chegada", () => {
    const r = new ShotResolver();
    expect(r.frame(before, after, true)).toBeNull();
    expect(r.swing(swingAt(1100), true)).toMatchObject({ kind: "hit", offsetMs: 92 });
  });

  it("cedo ou tarde demais é erro, e a bola continua valendo", () => {
    const r = new ShotResolver();
    r.swing(swingAt(1008 - TUNING.windowEarlyMs - 1), true);
    expect(r.frame(before, after, true)).toMatchObject({ kind: "miss", reason: "early" });
    expect(r.swing(swingAt(1008 + TUNING.windowLateMs + 1), true)).toMatchObject({ kind: "miss", reason: "late" });
    expect(r.swing(swingAt(1050), true)).toMatchObject({ kind: "hit" });
  });

  it("o swing pendente mais recente é o que vale", () => {
    const r = new ShotResolver();
    r.swing(swingAt(500), true);
    r.swing(swingAt(950), true);
    expect(r.frame(before, after, true)).toMatchObject({ kind: "hit", offsetMs: -58 });
  });

  it("um acerto por bola; newBall libera a próxima", () => {
    const r = new ShotResolver();
    r.frame(before, after, true);
    expect(r.swing(swingAt(1000), true)?.kind).toBe("hit");
    expect(r.swing(swingAt(1010), true)).toBeNull();
    r.newBall();
    expect(r.swing(swingAt(2000), true)).toBeNull(); // pendente da nova bola
  });

  it("bola indo embora não aceita swing nem registra cruzamento", () => {
    const r = new ShotResolver();
    expect(r.swing(swingAt(1000), false)).toBeNull();
    expect(r.frame(before, after, false)).toBeNull();
    expect(r.swing(swingAt(1000), true)).toBeNull(); // ainda sem cruzamento: pendente
  });
});

describe("benefício da dúvida no lado", () => {
  const contact = { x: 2, y: 1, z: TUNING.contactZ }; // bola à direita do jogador destro (x = 1): forehand
  it("lado errado com margem pequena não é punido e sai como golpe do lado certo", () => {
    const s = buildShot(-200, contact, -1, 0.8, 1, "right", -(TUNING.sideDoubtMargin - 0.01));
    expect(s).toMatchObject({ sideOk: true, sideDoubt: true });
    expect(s.target).toEqual(buildShot(-200, contact, 1, 0.8, 1, "right").target);
  });

  it("lado errado com margem grande é punido", () => {
    expect(buildShot(0, contact, -1, 0.8, 1, "right", -0.9)).toMatchObject({ sideOk: false, sideDoubt: false });
  });

  it("sem margem (teclado ou sem calibração) vale o lado recebido", () => {
    expect(buildShot(0, contact, -1, 0.8, 1, "right")).toMatchObject({ sideOk: false, sideDoubt: false });
  });

  it("lado certo nunca é marcado como dúvida", () => {
    expect(buildShot(0, contact, 1, 0.8, 1, "right", 0.05)).toMatchObject({ sideOk: true, sideDoubt: false });
  });
});
