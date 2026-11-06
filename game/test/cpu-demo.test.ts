import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TennisBall } from "../src/screen/physics";
import type { Character } from "../src/screen/character";
import type { ModeContext } from "../src/screen/modes/mode";
import { createCpuDemoMode, RESET_MS } from "../src/screen/modes/cpu-demo";

describe("modo Rally CPU (demo)", () => {
  let ctx: ModeContext & { setRally: ReturnType<typeof vi.fn>; newBall: ReturnType<typeof vi.fn> };
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

  it("start: CPU em cena e saque; stop remove a CPU", () => {
    const m = createCpuDemoMode(ctx);
    m.start();
    expect(ctx.scene.children.length).toBe(1);
    expect(ctx.newBall).toHaveBeenCalledTimes(1);
    m.stop();
    expect(ctx.scene.children.length).toBe(0);
  });

  it("CPU rebate a bola que chega na zona dela (uma vez só)", () => {
    const m = createCpuDemoMode(ctx);
    m.start();
    ctx.ball.launch({ x: 0, y: 1, z: -8 }, { vx: 0, vy: 0, vz: -10 }, "player");
    m.update(1 / 60, 0, { x: 0, y: 1, z: -7.8 });
    m.update(1 / 60, 0, { x: 0, y: 1, z: -7.9 });
    vi.advanceTimersByTime(100);
    expect(ctx.ball.lastHitter).toBe("cpu");
    expect(ctx.ball.vz).toBeGreaterThan(0);
    expect(ctx.newBall).toHaveBeenCalledTimes(2);
  });

  it("conta o rally; bola fora zera e saca de novo", () => {
    const m = createCpuDemoMode(ctx);
    m.start();
    m.onShot({} as never);
    m.onShot({} as never);
    expect(ctx.setRally).toHaveBeenLastCalledWith(2);
    ctx.ball.launch({ x: 9, y: 1, z: 5 }, { vx: 5, vy: 0, vz: 0 }, "player");
    m.update(1 / 60, 0, { x: 9, y: 1, z: 5 });
    vi.advanceTimersByTime(RESET_MS);
    expect(ctx.setRally).toHaveBeenLastCalledWith(0);
    expect(ctx.newBall).toHaveBeenCalledTimes(2);
  });

  it("stop cancela o saque agendado", () => {
    const m = createCpuDemoMode(ctx);
    m.start();
    ctx.ball.launch({ x: 9, y: 1, z: 5 }, { vx: 5, vy: 0, vz: 0 }, "player");
    m.update(1 / 60, 0, { x: 9, y: 1, z: 5 });
    m.stop();
    vi.advanceTimersByTime(RESET_MS);
    expect(ctx.newBall).toHaveBeenCalledTimes(1);
  });
});
