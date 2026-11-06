import { describe, expect, it } from "vitest";
import { aimShot, GRAVITY, NET_HEIGHT, TennisBall } from "../src/screen/physics";
import type { Point2, Point3 } from "../src/screen/shot";
import { TUNING } from "../src/screen/tuning";

/** Simula a bola real a 60 Hz até o primeiro quique; guarda a menor altura ao cruzar a rede. */
function flyToBounce(from: Point3, target: Point2, hSpeed: number) {
  const ball = new TennisBall();
  ball.launch(from, aimShot(from, target, hSpeed, TUNING.netClearance), "player");
  let netY: number | null = null;
  for (let i = 0; i < 600; i++) {
    const prevZ = ball.z;
    const prevY = ball.y;
    const step = ball.update(1 / 60);
    if (prevZ > 0 && ball.z <= 0) netY = prevY + (prevZ / (prevZ - ball.z)) * (ball.y - prevY);
    if (step.netHit) return { bounce: null, netY, netHit: true };
    if (step.bounce) return { bounce: step.bounce, netY, netHit: false };
  }
  throw new Error("a bola não quicou");
}

const contact: Point3 = { x: 1.5, y: 1.0, z: TUNING.contactZ };

describe("aimShot + TennisBall", () => {
  for (const power of [0, 0.2, 0.6, 1]) {
    for (const x of [-3.5, 0, 3.5]) {
      it(`power ${power}, alvo x ${x}: quica a até 0,15 m do alvo e passa a rede`, () => {
        const target = { x, z: -(TUNING.depthBase + TUNING.depthPerPower * power) };
        const r = flyToBounce(contact, target, TUNING.speedBase + TUNING.speedPerPower * power);
        expect(r.netHit).toBe(false);
        expect(Math.hypot(r.bounce!.x - target.x, r.bounce!.z - target.z)).toBeLessThan(0.15);
        expect(r.netY!).toBeGreaterThan(NET_HEIGHT);
      });
    }
  }

  it("contato baixo: alonga o voo para passar a rede com folga", () => {
    const low: Point3 = { x: 0, y: 0.2, z: TUNING.contactZ };
    const target = { x: 0, z: -4 };
    const r = flyToBounce(low, target, 21);
    expect(r.netY!).toBeGreaterThanOrEqual(NET_HEIGHT + TUNING.netClearance - 0.05);
    expect(Math.hypot(r.bounce!.x - target.x, r.bounce!.z - target.z)).toBeLessThan(0.15);
  });

  it("partindo de trás da linha de contato (golpe atrasado) ainda cai no alvo", () => {
    const behind: Point3 = { x: 2.5, y: 0.6, z: 12 };
    const target = { x: 3.5, z: -9 };
    const r = flyToBounce(behind, target, 18);
    expect(Math.hypot(r.bounce!.x - target.x, r.bounce!.z - target.z)).toBeLessThan(0.15);
  });
});

describe("TennisBall.update", () => {
  it("queda livre bate com a fórmula exata em qualquer passo", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      const ball = new TennisBall();
      ball.launch({ x: 0, y: 5, z: 0 }, { vx: 0, vy: 2, vz: 0 }, "player");
      const steps = Math.round(0.5 / dt);
      for (let i = 0; i < steps; i++) ball.update(dt);
      const t = steps * dt;
      expect(ball.y).toBeCloseTo(5 + 2 * t + 0.5 * GRAVITY * t * t, 6);
    }
  });

  it("bola na rede é rebatida para trás", () => {
    const ball = new TennisBall();
    ball.launch({ x: 0, y: 0.5, z: 2 }, { vx: 0, vy: 0, vz: -10 }, "player");
    let net = false;
    for (let i = 0; i < 30 && !net; i++) net = ball.update(1 / 60).netHit;
    expect(net).toBe(true);
    expect(ball.vz).toBeGreaterThan(0);
  });
});
