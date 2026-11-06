import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Hand, Timing } from "../src/shared/messages";
import { aimShot, playableShot, TennisBall } from "../src/screen/physics";
import { buildShot, preferredSide, shotPower, standX, type Point3, type ShotResult } from "../src/screen/shot";
import { TUNING } from "../src/screen/tuning";
import type { Character } from "../src/screen/character";
import type { ModeContext } from "../src/screen/modes/mode";
import {
  approachColor, attemptText, createTargetsMode, insideTarget, lessons, NEXT_BALL_MS, offsetText, powerText, SUMMARY_MS,
  TIMING_COLOR,
} from "../src/screen/modes/targets";

const OFFSET: Record<Timing, number> = { early: -200, "on-time": 0, late: 150 };

/** Bola da máquina até a linha de contato (60 Hz): ponto de contato. */
function machineContact(feedX: number): Point3 {
  const ball = new TennisBall();
  const from = { x: 0, y: 1.1, z: TUNING.machineZ };
  ball.launch(from, playableShot(from, TUNING.machineSpeed, () => feedX), "machine");
  for (let i = 0; i < 600; i++) {
    const prev = { x: ball.x, y: ball.y, z: ball.z };
    ball.update(1 / 60);
    if (ball.z >= TUNING.contactZ) {
      const f = (TUNING.contactZ - prev.z) / (ball.z - prev.z);
      return { x: prev.x + f * (ball.x - prev.x), y: prev.y + f * (ball.y - prev.y), z: TUNING.contactZ };
    }
  }
  throw new Error("a bola da máquina não chegou");
}

/** Golpe do lado em que o jogador se posicionou, saindo do contato; devolve o primeiro quique. */
function strike(contact: Point3, timing: Timing, power: number, hand: Hand) {
  const side = preferredSide(contact.x, hand);
  const shot = buildShot(OFFSET[timing], contact, side, power, standX(contact.x, side, hand), hand);
  const ball = new TennisBall();
  ball.launch(contact, aimShot(contact, shot.target, shotPower(shot.power, shot.sideOk).hSpeed, TUNING.netClearance), "player");
  for (let i = 0; i < 600; i++) {
    const step = ball.update(1 / 60);
    if (step.netHit) throw new Error("rede");
    if (step.bounce) return { shot, bounce: step.bounce };
  }
  throw new Error("não quicou");
}

describe("lições: o golpe pedido acerta o alvo (simulação de ponta a ponta)", () => {
  // [lição, timing, força, deve acertar]
  const cases: [number, Timing, number, boolean][] = [
    // No tempo (faixa central): qualquer força; adiantado/atrasado erram
    [0, "on-time", 0, true], [0, "on-time", 0.5, true], [0, "on-time", 0.85, true], [0, "on-time", 1, true],
    [0, "early", 0.5, false], [0, "late", 0.5, false],
    // Bola curta (área até a linha de saque): força até ~0,37, e no tempo
    [1, "on-time", 0, true], [1, "on-time", 0.15, true], [1, "on-time", 0.33, true],
    [1, "on-time", 0.45, false], [1, "on-time", 0.6, false], [1, "early", 0.15, false],
    [2, "on-time", 0.85, true], [2, "on-time", 1, true], [2, "on-time", 0.5, false],
    // Cruzada e paralela (faixa): qualquer força, só a direção conta
    [3, "early", 0, true], [3, "early", 0.5, true], [3, "early", 0.85, true], [3, "early", 1, true],
    [3, "late", 0.5, false], [3, "on-time", 0.5, false], [3, "on-time", 1, false],
    [4, "late", 0, true], [4, "late", 0.5, true], [4, "late", 0.85, true], [4, "late", 1, true],
    [4, "early", 0.5, false], [4, "on-time", 0.5, false], [4, "on-time", 0.1, false],
  ];
  for (const hand of ["right", "left"] as const) {
    for (const [i, timing, power, ok] of cases) {
      it(`${hand}: lição ${i + 1}, ${timing}, força ${power} → ${ok ? "acerta" : "erra"}`, () => {
        const l = lessons(hand)[i];
        const { bounce } = strike(machineContact(l.feedX), timing, power, hand);
        expect(insideTarget(bounce, l)).toBe(ok);
      });
    }
  }

  it("cruzada e paralela: a máquina manda a bola do lado do forehand", () => {
    expect(machineContact(lessons("right")[3].feedX).x).toBeGreaterThan(TUNING.centerContactX);
    expect(machineContact(lessons("left")[3].feedX).x).toBeLessThan(-TUNING.centerContactX);
  });
});

describe("textos da tentativa", () => {
  it("força em três faixas", () => {
    expect(powerText(0.2)).toBe("Fraco");
    expect(powerText(0.5)).toBe("Médio");
    expect(powerText(0.9)).toBe("Forte");
  });

  it("onde caiu, do ponto de vista do jogador", () => {
    const ring = { ...lessons("right")[2], ring: { x: 0, z: -7 } }; // anel (bola funda), centro deslocado
    expect(offsetText({ x: 2.1, z: -7 }, ring)).toBe("2,1 m à direita");
    expect(offsetText({ x: -1, z: -8.5 }, ring)).toBe("1,0 m à esquerda · 1,5 m longa");
    expect(offsetText({ x: 0.1, z: -5 }, ring)).toBe("2,0 m curta");
  });

  it("faixa: profundidade só conta fora dela", () => {
    const lane = lessons("right")[3]; // cruzada de destro: x = −3,5
    expect(offsetText({ x: 0, z: -7 }, lane)).toBe("3,5 m à direita");
    expect(offsetText({ x: -3.5, z: TUNING.laneNearZ + 1 }, lane)).toBe("1,0 m curta");
    expect(insideTarget({ x: -3.5 + TUNING.laneHalfWidth - 0.05, z: TUNING.laneFarZ + 0.1 }, lane)).toBe(true);
    expect(insideTarget({ x: -3.5, z: TUNING.laneFarZ - 0.1 }, lane)).toBe(false);
  });

  it("monta timing · força · resultado", () => {
    const l = lessons("right")[2];
    const shot = { timing: "late", power: 0.9, sideOk: true } as ShotResult;
    expect(attemptText(shot, { x: 3, z: l.ring.z }, l)).toBe("Atrasado · Forte · 3,0 m à direita");
    expect(attemptText({ ...shot, sideOk: false }, l.ring, l)).toBe("Atrasado · Forte · Lado errado · NO ALVO!");
  });
});

describe("cor da bola (timing se batesse agora)", () => {
  const vz = 13;
  const at = (offsetMs: number) => ({ z: TUNING.contactZ + (offsetMs / 1000) * vz, vz, lastHitter: "machine" as const });
  it("azul adiantado, verde no tempo, laranja atrasado; fora da janela, cor normal", () => {
    expect(approachColor(at(-TUNING.windowEarlyMs - 20))).toBeNull();
    expect(approachColor(at(-200))).toBe(TIMING_COLOR.early);
    expect(approachColor(at(0))).toBe(TIMING_COLOR["on-time"]);
    expect(approachColor(at(150))).toBe(TIMING_COLOR.late);
    expect(approachColor(at(TUNING.windowLateMs + 20))).toBeNull();
  });
  it("só a bola da máquina vindo para o jogador", () => {
    expect(approachColor({ ...at(0), lastHitter: "player" })).toBeNull();
    expect(approachColor({ ...at(0), vz: -vz })).toBeNull();
  });
});

describe("modo Treino com alvos", () => {
  let ctx: ModeContext & { feedback: ReturnType<typeof vi.fn>; showLesson: ReturnType<typeof vi.fn>; newBall: ReturnType<typeof vi.fn> };
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

  const view = () => ctx.showLesson.mock.lastCall![0];
  const shot = { timing: "on-time", power: 0.5, sideOk: true } as ShotResult;

  /** Golpe do jogador que quica em `at` do lado de lá. */
  function attempt(m: ReturnType<typeof createTargetsMode>, at: { x: number; z: number }) {
    ctx.ball.lastHitter = "player";
    m.onShot(shot);
    m.onBounce({ ...at, half: "far", count: 1 });
    vi.advanceTimersByTime(NEXT_BALL_MS);
  }

  it("start: máquina lança para o jogador e mostra a lição 1", () => {
    const m = createTargetsMode(ctx);
    m.start();
    expect(ctx.ball.lastHitter).toBe("machine");
    expect(ctx.ball.vz).toBeGreaterThan(0);
    expect(ctx.newBall).toHaveBeenCalledTimes(1);
    expect(view()).toMatchObject({ index: 0, hits: 0, attempts: 0, summary: null });
    m.stop();
    expect(ctx.scene.children.length).toBe(0);
    expect(ctx.showLesson).toHaveBeenLastCalledWith(null);
  });

  it("conta acerto e erro; com 3 acertos passa de lição", () => {
    const m = createTargetsMode(ctx);
    m.start();
    const ring = lessons("right")[0].ring;
    attempt(m, { x: ring.x + 3, z: ring.z });
    expect(view()).toMatchObject({ index: 0, hits: 0, attempts: 1, last: { ok: false } });
    for (let i = 0; i < 3; i++) attempt(m, ring);
    expect(view()).toMatchObject({ index: 1, hits: 0, attempts: 0, last: null });
    expect(ctx.newBall).toHaveBeenCalledTimes(5);
  });

  it("bola que passa, rede e quique sem golpe contam como tentativa errada", () => {
    const m = createTargetsMode(ctx);
    m.start();
    m.onBounce({ x: 0, z: 7, half: "player", count: 1 }); // quique normal da máquina
    expect(view().attempts).toBe(0);
    m.onBounce({ x: 0, z: 13, half: "player", count: 2 });
    expect(view()).toMatchObject({ attempts: 1, last: { text: "A bola passou", ok: false } });
    vi.advanceTimersByTime(NEXT_BALL_MS);
    ctx.ball.lastHitter = "player";
    m.onNet();
    expect(view()).toMatchObject({ attempts: 2, last: { text: "Na rede" } });
  });

  it("ao fim da lição 5 mostra o resumo e recomeça", () => {
    const m = createTargetsMode(ctx);
    m.start();
    for (const l of lessons("right")) for (let i = 0; i < 3; i++) attempt(m, l.ring);
    expect(view().summary).toHaveLength(5);
    expect(view().summary![4]).toMatchObject({ title: "Paralela", hits: 3, attempts: 3 });
    vi.advanceTimersByTime(SUMMARY_MS);
    expect(view()).toMatchObject({ index: 0, hits: 0, summary: null });
  });

  it("N pula para a próxima lição", () => {
    const m = createTargetsMode(ctx);
    m.start();
    m.next!();
    expect(view().index).toBe(1);
  });
});
