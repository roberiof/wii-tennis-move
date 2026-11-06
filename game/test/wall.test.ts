import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NET_HEIGHT, TennisBall, WALL_CONTACT_Z, wallCrossing, wallReturn, type Velocity } from "../src/screen/physics";
import type { Point3 } from "../src/screen/shot";
import { TUNING } from "../src/screen/tuning";
import type { Character } from "../src/screen/character";
import { createWallMode, NEXT_BALL_MS } from "../src/screen/modes/wall";
import type { ModeContext } from "../src/screen/modes/mode";

/** Simula a volta a 60 Hz: menor altura na rede, primeiro quique e altura ao cruzar a linha de contato. */
function flyBack(from: Point3, v: Velocity) {
  const ball = new TennisBall();
  ball.launch(from, v, "wall");
  let netY: number | null = null;
  let bounce: { x: number; z: number } | null = null;
  for (let i = 0; i < 600; i++) {
    const prev = { y: ball.y, z: ball.z };
    const step = ball.update(1 / 60);
    if (step.netHit) throw new Error("bateu na rede");
    if (prev.z < 0 && ball.z >= 0) netY = prev.y + (-prev.z / (ball.z - prev.z)) * (ball.y - prev.y);
    if (step.bounce && !bounce) bounce = step.bounce;
    if (prev.z < TUNING.contactZ && ball.z >= TUNING.contactZ) {
      const contactY = prev.y + ((TUNING.contactZ - prev.z) / (ball.z - prev.z)) * (ball.y - prev.y);
      return { netY: netY!, bounce, contactY, bounces: ball.bounceCount };
    }
  }
  throw new Error("a bola não chegou à linha de contato");
}

describe("wallCrossing", () => {
  it("acha o ponto exato e se a bola acertou a parede", () => {
    const prev = { x: 1, y: 2, z: WALL_CONTACT_Z + 0.1 };
    const cur = { x: 1.2, y: 1.8, z: WALL_CONTACT_Z - 0.1 };
    const c = wallCrossing(prev, cur)!;
    expect(c.point.x).toBeCloseTo(1.1);
    expect(c.point.y).toBeCloseTo(1.9);
    expect(c.point.z).toBe(WALL_CONTACT_Z);
    expect(c.inside).toBe(true);
  });

  it("por cima ou fora da largura não volta", () => {
    const at = (x: number, y: number) =>
      wallCrossing({ x, y, z: WALL_CONTACT_Z + 0.1 }, { x, y, z: WALL_CONTACT_Z - 0.1 })!.inside;
    expect(at(0, TUNING.wallHeight + 0.2)).toBe(false);
    expect(at(TUNING.wallHalfWidth + 0.2, 1)).toBe(false);
  });

  it("só conta a bola indo para a parede", () => {
    expect(wallCrossing({ x: 0, y: 1, z: WALL_CONTACT_Z - 0.1 }, { x: 0, y: 1, z: WALL_CONTACT_Z + 0.1 })).toBeNull();
    expect(wallCrossing({ x: 0, y: 1, z: -5 }, { x: 0, y: 1, z: -5.2 })).toBeNull();
  });
});

describe("wallReturn", () => {
  const hit: Point3 = { x: 0, y: 1.5, z: WALL_CONTACT_Z };

  it("velocidade em z: reflexão com restituição, limitada à faixa jogável", () => {
    // Dentro da faixa: 18 × 0,75 = 13,5 (sem aumento de voo pela rede, vz sai exata)
    expect(wallReturn(hit, { vx: 0, vy: 0, vz: -18 }).vz).toBeCloseTo(18 * TUNING.wallRestitution, 1);
    expect(wallReturn(hit, { vx: 0, vy: 0, vz: -40 }).vz).toBeLessThanOrEqual(TUNING.wallMaxSpeed + 1e-9);
    expect(wallReturn(hit, { vx: 0, vy: 0, vz: -4 }).vz).toBeGreaterThanOrEqual(TUNING.wallMinSpeed * 0.8);
  });

  for (const vz of [-6, -12, -21]) {
    for (const y of [0.3, 1.5, 3.5]) {
      it(`chegada ${-vz} m/s a ${y} m: passa a rede, quica do lado do jogador e chega rebatível`, () => {
        const from = { ...hit, y };
        const r = flyBack(from, wallReturn(from, { vx: 0, vy: -1, vz }));
        expect(r.netY).toBeGreaterThan(NET_HEIGHT);
        expect(r.bounces).toBe(1);
        expect(r.bounce!.z).toBeGreaterThanOrEqual(TUNING.wallBounceMinZ - 0.15);
        expect(r.bounce!.z).toBeLessThanOrEqual(TUNING.wallBounceMaxZ + 0.15);
        expect(r.contactY).toBeGreaterThan(0.4);
        expect(r.contactY).toBeLessThan(1.8);
      });
    }
  }

  it("lateral: mantém o sentido amortecido e não sai do alcance", () => {
    const right = wallReturn({ ...hit, x: 2 }, { vx: 3, vy: 0, vz: -15 });
    expect(right.vx).toBeGreaterThan(0);
    const r = flyBack({ ...hit, x: 5 }, wallReturn({ ...hit, x: 5 }, { vx: 20, vy: 0, vz: -15 }));
    expect(Math.abs(r.bounce!.x)).toBeLessThanOrEqual(TUNING.wallReturnMaxX + 0.15);
  });
});

describe("modo Parede", () => {
  let ctx: ModeContext & { feedback: ReturnType<typeof vi.fn>; setRally: ReturnType<typeof vi.fn>; newBall: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    vi.useFakeTimers();
    ctx = {
      scene: new THREE.Scene(),
      ball: new TennisBall(),
      player: {} as Character,
      feedback: vi.fn(),
      setRally: vi.fn(),
      newBall: vi.fn(),
      hand: () => "right",
      showLesson: vi.fn(),
    };
  });
  afterEach(() => vi.useRealTimers());

  const shot = {} as Parameters<ReturnType<typeof createWallMode>["onShot"]>[0];

  it("start: põe a parede na cena e lança a bola para o jogador", () => {
    const m = createWallMode(ctx);
    m.start();
    expect(ctx.scene.children.length).toBe(1);
    expect(ctx.ball.lastHitter).toBe("wall");
    expect(ctx.ball.vz).toBeGreaterThan(0);
    expect(ctx.newBall).toHaveBeenCalledTimes(1);
    m.stop();
    expect(ctx.scene.children.length).toBe(0);
  });

  it("bola que chega à parede volta e libera novo acerto", () => {
    const m = createWallMode(ctx);
    m.start();
    ctx.ball.launch({ x: 0, y: 1, z: WALL_CONTACT_Z - 0.1 }, { vx: 0, vy: 0, vz: -15 }, "player");
    m.update(1 / 60, 0, { x: 0, y: 1, z: WALL_CONTACT_Z + 0.15 });
    expect(ctx.ball.lastHitter).toBe("wall");
    expect(ctx.ball.vz).toBeGreaterThan(0);
    expect(ctx.newBall).toHaveBeenCalledTimes(2);
  });

  it("conta o rally e encerra com dois quiques do lado do jogador; depois vem bola nova", () => {
    const m = createWallMode(ctx);
    m.start();
    m.onShot(shot);
    m.onShot(shot);
    expect(ctx.setRally).toHaveBeenLastCalledWith(2);
    m.onBounce({ x: 0, z: 6, half: "player", count: 1 }); // quique normal da volta
    expect(ctx.feedback).not.toHaveBeenCalled();
    m.onBounce({ x: 0, z: 12, half: "player", count: 2 });
    expect(ctx.feedback).toHaveBeenCalledWith("DOIS QUIQUES · RALLY 2", expect.any(String));
    vi.advanceTimersByTime(NEXT_BALL_MS);
    expect(ctx.setRally).toHaveBeenLastCalledWith(0);
    expect(ctx.newBall).toHaveBeenCalledTimes(2);
  });

  it("quiques do lado de lá não encerram (a bola segue para a parede)", () => {
    const m = createWallMode(ctx);
    m.start();
    ctx.ball.lastHitter = "player";
    m.onBounce({ x: 0, z: -6, half: "far", count: 1 });
    m.onBounce({ x: 0, z: -10, half: "far", count: 2 });
    expect(ctx.feedback).not.toHaveBeenCalled();
  });

  it("rede e bola por cima da parede encerram uma vez só", () => {
    const m = createWallMode(ctx);
    m.start();
    m.onNet();
    m.onNet();
    expect(ctx.feedback).toHaveBeenCalledTimes(1);
    expect(ctx.feedback).toHaveBeenCalledWith("NA REDE", expect.any(String));
    vi.advanceTimersByTime(NEXT_BALL_MS);

    const y = TUNING.wallHeight + 0.5;
    ctx.ball.launch({ x: 0, y, z: WALL_CONTACT_Z - 0.1 }, { vx: 0, vy: 0, vz: -15 }, "player");
    m.update(1 / 60, 0, { x: 0, y, z: WALL_CONTACT_Z + 0.15 });
    expect(ctx.feedback).toHaveBeenLastCalledWith("POR CIMA DA PAREDE", expect.any(String));
  });
});
