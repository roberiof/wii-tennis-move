import { describe, expect, it } from "vitest";
import {
  bestSimilarity, CALIB, chooseHand, confirmGo, currentRep, detectorParamsFor, feedMotion, feedSwing, margin,
  parseProfile, powerFor, profileOf, redoPrevious, sideFor, similarity, startCalibration, undoTarget,
  unit, worstSample, type CalibState, type CalibrationProfile,
} from "../src/controller/calibration";
import { DEFAULT_PARAMS } from "../src/controller/detector";
import type { Rotation } from "../src/controller/rotation";
import { calibTitle, statusText } from "../src/shared/calib-text";

// Caso que o método antigo (sinal do eixo dominante) erra: o forehand gira mais em alpha (+) e o backhand
// mais em gamma (+). Os dois têm sinal positivo no eixo dominante, mas apontam para direções diferentes.
const FH: Rotation = { alpha: 800, beta: 0, gamma: 300 };
const BH: Rotation = { alpha: 100, beta: 0, gamma: 900 };
// Um segundo jeito de dar backhand, bem diferente do primeiro (ainda longe do forehand).
const BH_ALT: Rotation = { alpha: -700, beta: 300, gamma: 100 };
const OPPOSITE: Rotation = { alpha: -800, beta: 0, gamma: -300 }; // volta do braço após um forehand
// Variações naturais de cada golpe.
const FH_VARIANTS: Rotation[] = [FH, { alpha: 900, beta: 120, gamma: 250 }, { alpha: 700, beta: -80, gamma: 380 }];
const BH_VARIANTS: Rotation[] = [BH, { alpha: 200, beta: 100, gamma: 850 }, BH_ALT]; // backhand que varia

const H = CALIB.registeredHoldMs;
const P = CALIB.prepHoldMs;
const N = CALIB.templateReps;
const sw = (dir: Rotation, peak: number, t: number) => ({ dir, peak, t });
const units = (ds: Rotation[]) => ds.map((d) => unit(d)!);

/** A partir de `t` (destaque já encerrado): fica parado, pede a largada e o PC confirma. */
function arm(s: CalibState, t: number): CalibState {
  s = feedMotion(s, 10, t); // encerra o destaque
  s = feedMotion(s, 10, t); // começa a contar parado
  s = feedMotion(s, 10, t + CALIB.stillMs); // pede a largada
  return confirmGo(s, s.goId, t + CALIB.stillMs + 50); // PC mostrou "Agora!"
}

/** Arma a partir de `from` e faz o swing logo depois; devolve [estado, instante do swing]. */
function step(s: CalibState, from: number, dir: Rotation, peak = 900): [CalibState, number] {
  const t = from + CALIB.stillMs + 100;
  return [feedSwing(arm(s, from), sw(dir, peak, t)), t];
}

/** Uma sequência de golpes de molde; o primeiro arma em `from`, os seguintes após o destaque curto. */
function steps(s: CalibState, from: number, dirs: Rotation[]): [CalibState, number] {
  let t = from - H;
  for (const d of dirs) [s, t] = step(s, t + H, d);
  return [s, t];
}

/** Mão em t = 0, 3 forehands e 3 backhands registrados; devolve o estado no passo "forte" e o instante livre. */
function atStrong(): [CalibState, number] {
  let s = chooseHand(startCalibration(), "right", 0);
  let t: number;
  [s, t] = steps(s, H, FH_VARIANTS);
  [s, t] = steps(s, t + P, BH_VARIANTS); // troca de posição: destaque de preparação
  return [s, t + P];
}

describe("fluxo da calibração", () => {
  it("mão → 3 forehands → 3 backhands → forte → fraco → done", () => {
    let s = chooseHand(startCalibration(), "left", 0);
    let t: number;
    expect(currentRep(s)).toBe(1);
    [s, t] = step(s, H, FH_VARIANTS[0]);
    expect(s).toMatchObject({ step: "forehand", registered: "forehand", registeredRep: 1, holdUntil: t + H, prep: false });
    expect(currentRep(s)).toBe(2);
    [s, t] = steps(s, t + H, FH_VARIANTS.slice(1));
    expect(s).toMatchObject({ step: "backhand", registered: "forehand", registeredRep: N, prep: true, holdUntil: t + P });
    expect(currentRep(s)).toBe(1);
    [s, t] = steps(s, t + P, BH_VARIANTS);
    expect(s).toMatchObject({ step: "strong", registered: "backhand", registeredRep: N, prep: true });
    [s, t] = step(s, t + P, FH, 1600);
    expect(s).toMatchObject({ step: "weak", registered: "strong", prep: false });
    [s] = step(s, t + H, FH, 600);
    expect(s.step).toBe("done");
    const p = profileOf(s)!;
    expect(p).toMatchObject({ hand: "left", strongPeak: 1600, weakPeak: 600 });
    // Os 3 golpes de cada lado ficam guardados separados (sem média).
    expect(p.forehand).toEqual(units(FH_VARIANTS));
    expect(p.backhand).toEqual(units(BH_VARIANTS));
  });

  it("swing antes de escolher a mão não avança", () => {
    expect(feedSwing(startCalibration(), sw(FH, 900, 5000)).step).toBe("hand");
  });

  it("golpe sem rotação mensurável não é gravado", () => {
    const s = arm(chooseHand(startCalibration(), "right", 0), H);
    expect(feedSwing(s, sw({ alpha: 0, beta: 0, gamma: 0 }, 900, s.armedAt! + 10)).forehand).toHaveLength(0);
  });
});

describe("forehands", () => {
  it("o forehand destoante é descartado e repetido", () => {
    let s = chooseHand(startCalibration(), "right", 0);
    let t: number;
    [s, t] = steps(s, H, [FH_VARIANTS[0], BH, FH_VARIANTS[1]]); // o 2º saiu "de backhand"
    expect(s).toMatchObject({ step: "forehand", retry: "inconsistent", registered: null });
    expect(s.forehand).toHaveLength(N - 1);
    expect(currentRep(s)).toBe(N);
    [s] = step(s, t + H, FH_VARIANTS[2]);
    expect(s).toMatchObject({ step: "backhand", retry: null });
  });

  it("worstSample aponta o mais diferente da média dos outros", () => {
    expect(worstSample(units([FH, BH, FH_VARIANTS[1]])).index).toBe(1);
    expect(worstSample(units(FH_VARIANTS)).similarity).toBeGreaterThan(CALIB.minConsistency);
  });
});

describe("backhands", () => {
  it("podem variar entre si (dois jeitos de bater são aceitos)", () => {
    const [s] = atStrong();
    expect(s.backhand).toHaveLength(N);
    expect(similarity(unit(BH)!, unit(BH_ALT)!)).toBeLessThan(CALIB.minConsistency); // variam muito
  });

  it("um backhand parecido com os forehands é descartado na hora e repetido", () => {
    let s = chooseHand(startCalibration(), "right", 0);
    let t: number;
    [s, t] = steps(s, H, FH_VARIANTS);
    [s, t] = step(s, t + P, BH);
    [s, t] = step(s, t + H, { alpha: 780, beta: 50, gamma: 320 }); // quase igual a um forehand
    // Já está na posição de backhand: destaque curto, sem preparação.
    expect(s).toMatchObject({ step: "backhand", retry: "side", registered: null, prep: false, holdUntil: t + H });
    expect(s.backhand).toHaveLength(1);
    expect(currentRep(s)).toBe(2);
  });
});

describe("destaque e tempo para trocar de posição", () => {
  it("não conta tempo parado durante o destaque; ao fim, prep volta a false", () => {
    let [s, t] = steps(chooseHand(startCalibration(), "right", 0), H, FH_VARIANTS);
    s = feedMotion(s, 10, t + P - 1);
    expect(s).toMatchObject({ prep: true, stillSince: null });
    s = feedMotion(s, 10, t + P);
    expect(s).toMatchObject({ prep: false, holdUntil: null });
  });

  it("textos: repetição no título e no registrado; pedido de troca de posição", () => {
    expect(calibTitle("forehand", 2, 3)).toBe("Faça um FOREHAND (2 de 3)");
    expect(calibTitle("strong", null, 3)).toBe("Forehand FORTE");
    expect(statusText(true, "forehand", false, false, "forehand", 1, 3)).toBe("✓ Forehand registrado (1 de 3)");
    expect(statusText(true, "forehand", false, true, "backhand", 3, 3))
      .toBe("✓ Forehand registrado (3 de 3) · Posicione-se para o BACKHAND");
    expect(statusText(false, null, true)).toBe("Agora!");
  });
});

describe("espera parada e largada pelo PC", () => {
  it("parado o bastante gera um pedido de largada, mas ainda não aceita swing", () => {
    let s = chooseHand(startCalibration(), "right", 0);
    s = feedMotion(feedMotion(s, 10, H), 10, H);
    s = feedMotion(s, 10, H + CALIB.stillMs - 1);
    expect(s.stillAt).toBeNull();
    s = feedMotion(s, 10, H + CALIB.stillMs);
    expect(s).toMatchObject({ stillAt: H + CALIB.stillMs, goId: 1, armedAt: null });
    expect(feedSwing(s, sw(FH, 900, H + CALIB.stillMs + 10)).forehand).toHaveLength(0);
  });

  it("movimento no meio da espera reinicia a contagem", () => {
    let s = chooseHand(startCalibration(), "right", 0);
    s = feedMotion(feedMotion(s, 10, H), 10, H);
    s = feedMotion(s, CALIB.stillMax + 1, H + 400); // mexeu
    s = feedMotion(s, 10, H + 500);
    s = feedMotion(s, 10, H + 500 + CALIB.stillMs - 1);
    expect(s.stillAt).toBeNull();
    s = feedMotion(s, 10, H + 500 + CALIB.stillMs);
    expect(s.stillAt).not.toBeNull();
  });

  it("confirmação de outro pedido não arma", () => {
    let s = chooseHand(startCalibration(), "right", 0);
    s = feedMotion(feedMotion(feedMotion(s, 10, H), 10, H), 10, H + CALIB.stillMs);
    expect(confirmGo(s, s.goId - 1, 5000).armedAt).toBeNull();
    expect(confirmGo(s, s.goId, 5000).armedAt).toBe(5000);
  });

  it("swing com pico antes da confirmação não conta", () => {
    const s = arm(chooseHand(startCalibration(), "right", 0), H);
    expect(feedSwing(s, sw(FH, 900, s.armedAt! - 1)).forehand).toHaveLength(0);
  });

  it("cada golpe de molde precisa de nova largada", () => {
    const [s, t] = step(chooseHand(startCalibration(), "right", 0), H, FH);
    expect(feedSwing(s, sw(FH, 900, t + 200)).forehand).toHaveLength(1);
  });
});

describe("forte e fraco só aceitam forehand", () => {
  it("golpe parecido com um backhand ou a volta do braço é ignorado", () => {
    const [s0, t] = atStrong();
    const s = arm(s0, t);
    const swingT = s.armedAt! + 10;
    expect(feedSwing(s, sw(BH, 1600, swingT)).step).toBe("strong");
    expect(feedSwing(s, sw(BH_ALT, 1600, swingT)).step).toBe("strong");
    expect(feedSwing(s, sw(OPPOSITE, 1600, swingT)).step).toBe("strong");
    expect(feedSwing(s, sw(FH, 1600, swingT)).step).toBe("weak");
  });

  it("refaz forte e fraco se ficarem próximos demais", () => {
    let [s, t] = atStrong();
    [s, t] = step(s, t, FH, 1000);
    [s, t] = step(s, t + H, FH, 800); // 1000 < 1,4 × 800
    expect(s).toMatchObject({ step: "strong", retry: "power", strongPeak: null, registered: null, holdUntil: t + H });
    expect(profileOf(s)).toBeNull();
  });
});

describe("refazer", () => {
  it("dentro do molde, desfaz só o último golpe", () => {
    let [s] = steps(chooseHand(startCalibration(), "right", 0), H, FH_VARIANTS.slice(0, 2));
    expect(undoTarget(s)).toEqual({ step: "forehand", rep: 2 });
    s = redoPrevious(s);
    expect(s.forehand).toHaveLength(1);
    expect(currentRep(s)).toBe(2);
  });

  it("no início do backhand, desfaz o 3º forehand", () => {
    const [s0] = steps(chooseHand(startCalibration(), "right", 0), H, FH_VARIANTS);
    expect(undoTarget(s0)).toEqual({ step: "forehand", rep: N });
    const s = redoPrevious(s0);
    expect(s.step).toBe("forehand");
    expect(s.forehand).toHaveLength(N - 1);
  });

  it("no forte, desfaz o 3º backhand", () => {
    const s = redoPrevious(atStrong()[0]);
    expect(s.step).toBe("backhand");
    expect(s.backhand).toHaveLength(N - 1);
    expect(s.forehand).toHaveLength(N);
  });

  it("no fraco, desfaz o forte", () => {
    let [s, t] = atStrong();
    [s] = step(s, t, FH, 1500);
    s = redoPrevious(s);
    expect(s).toMatchObject({ step: "strong", strongPeak: null, holdUntil: null, armedAt: null, registered: null });
  });

  it("no 1º forehand, volta à escolha da mão, sem reaproveitar goId", () => {
    const before = arm(chooseHand(startCalibration(), "right", 0), H);
    expect(undoTarget(before)).toEqual({ step: "hand", rep: null });
    const s = redoPrevious(before);
    expect(s.step).toBe("hand");
    expect(s.goId).toBe(before.goId);
  });

  it("na escolha da mão não faz nada", () => {
    const s = startCalibration();
    expect(undoTarget(s)).toBeNull();
    expect(redoPrevious(s)).toBe(s);
  });
});

const profile: CalibrationProfile = {
  hand: "right", forehand: units(FH_VARIANTS), backhand: units(BH_VARIANTS), strongPeak: 1500, weakPeak: 500,
};

describe("classificação pelo molde mais parecido (vizinho mais próximo)", () => {
  it("separa forehand e backhand mesmo com o mesmo sinal no eixo dominante", () => {
    expect(sideFor(FH, profile).side).toBe(1);
    expect(sideFor(BH, profile).side).toBe(-1);
    expect(sideFor({ alpha: 1300, beta: 150, gamma: 350 }, profile).side).toBe(1);
    expect(sideFor({ alpha: 250, beta: -100, gamma: 1200 }, profile).side).toBe(-1);
  });

  it("reconhece os dois jeitos de dar backhand", () => {
    expect(sideFor({ alpha: -650, beta: 350, gamma: 150 }, profile).side).toBe(-1); // perto do BH_ALT
    expect(sideFor({ alpha: 150, beta: 50, gamma: 880 }, profile).side).toBe(-1); // perto do BH
  });

  it("a margem é positiva no forehand típico e perto de 0 nos golpes ambíguos", () => {
    // 1 − semelhança do forehand com o backhand mais próximo (os moldes variam, então não chega a 2).
    expect(sideFor(FH, profile).margin).toBeGreaterThan(0.3);
    const between = { alpha: (FH.alpha + BH.alpha) / 2, beta: 0, gamma: (FH.gamma + BH.gamma) / 2 };
    expect(Math.abs(margin(between, profile.forehand, profile.backhand))).toBeLessThan(0.2);
  });

  it("bestSimilarity pega o molde mais parecido", () => {
    expect(bestSimilarity(unit(BH_ALT)!, profile.backhand)).toBeCloseTo(1);
    expect(bestSimilarity(unit(FH)!, [])).toBe(-Infinity);
  });
});

describe("uso do perfil", () => {
  it("força: fraco → 0,2, forte → 1, piso e teto", () => {
    expect(powerFor(500, profile)).toBeCloseTo(0.2);
    expect(powerFor(1500, profile)).toBeCloseTo(1);
    expect(powerFor(1000, profile)).toBeCloseTo(0.6);
    expect(powerFor(100, profile)).toBe(CALIB.powerFloor);
    expect(powerFor(3000, profile)).toBe(1);
  });

  it("limiar de início: 70% do fraco, entre 250 e 380", () => {
    expect(detectorParamsFor(profile).start).toBe(350);
    expect(detectorParamsFor({ ...profile, weakPeak: 200 }).start).toBe(250);
    expect(detectorParamsFor({ ...profile, weakPeak: 900 }).start).toBe(380);
    expect(detectorParamsFor(profile).maxPeak).toBe(1500);
  });

  it("calibrando usa limiar baixo; sem perfil usa o padrão", () => {
    expect(detectorParamsFor(null, true).start).toBe(CALIB.calibStart);
    expect(detectorParamsFor(null)).toEqual(DEFAULT_PARAMS);
  });
});

describe("parseProfile", () => {
  it("aceita perfil válido", () => expect(parseProfile(JSON.stringify(profile))).toEqual(profile));
  it("rejeita lixo, perfis antigos, moldes parecidos e razão inválida", () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile("{")).toBeNull();
    expect(parseProfile(JSON.stringify({ hand: "right", forehandSign: 1, strongPeak: 1500, weakPeak: 500 }))).toBeNull();
    // perfil de molde único (versões anteriores)
    expect(parseProfile(JSON.stringify({ ...profile, forehand: unit(FH), backhand: unit(BH) }))).toBeNull();
    expect(parseProfile(JSON.stringify({ ...profile, backhand: profile.forehand }))).toBeNull();
    expect(parseProfile(JSON.stringify({ ...profile, forehand: [FH, FH, FH] }))).toBeNull(); // não unitários
    expect(parseProfile(JSON.stringify({ ...profile, strongPeak: 600 }))).toBeNull();
  });
});
