// Portado de pocs/poc-01-sensores/src/controller/detector.ts; padrões = parâmetros usados no jogo na S2.

import type { Side } from "../shared/messages";
import type { Rotation } from "./rotation";

export type Axis = "alpha" | "beta" | "gamma";

export interface DetectorParams {
  /** Magnitude (°/s) que inicia o swing. */
  start: number;
  /** Magnitude (°/s) abaixo da qual o swing termina. */
  end: number;
  /** Pausa mínima (ms) entre swings. */
  refractory: number;
  /** Magnitude que corresponde a power = 1 (sem calibração). */
  maxPeak: number;
  /** Duração máxima (ms) de um swing antes de forçar o término (evita travar em inSwing). */
  timeout: number;
  /**
   * Janela (ms) após o fim de um swing em que um swing de sentido oposto é descartado:
   * a volta do braço. Inferência (não medida): a volta gira no sentido contrário ao golpe.
   */
  reverseLockout: number;
}

export const DEFAULT_PARAMS: DetectorParams = {
  start: 380,
  end: 180,
  refractory: 260,
  maxPeak: 1400,
  timeout: 550,
  reverseLockout: 600,
};

export interface DetectedSwing {
  /** peak / maxPeak, limitado a 1. Com calibração, a força vem de calibration.powerFor. */
  power: number;
  /** Sinal bruto do eixo dominante no pico. */
  side: Side;
  /**
   * Soma das velocidades de rotação (°/s) de todas as amostras do swing: aponta para o eixo e o sentido
   * em que o celular girou. Usada para classificar forehand/backhand pelos golpes calibrados.
   */
  dir: Rotation;
  peak: number;
  axis: Axis;
  /** Instante do pico, no relógio de `now` (performance.now() no celular). */
  t: number;
}

const AXES: Axis[] = ["alpha", "beta", "gamma"];

/**
 * Detector de pico de rotação: `t` é o instante do pico; `side` é o sinal do eixo dominante no pico.
 * Swing de sentido oposto ao anterior, começando até `reverseLockout` ms depois dele, é descartado.
 */
export function createSwingDetector(params: DetectorParams, onSwing: (s: DetectedSwing) => void) {
  let inSwing = false;
  let swingStart = 0;
  let peak = 0;
  let peakT = 0;
  let peakAxis: Axis = "alpha";
  let peakSign: Side = 1;
  let lastEnd = -Infinity;
  let lastSide: Side | null = null;
  let dir: Rotation = { alpha: 0, beta: 0, gamma: 0 };

  return (r: Rotation, now: number): void => {
    const mag = Math.hypot(r.alpha, r.beta, r.gamma);

    if (!inSwing) {
      if (mag > params.start && now - lastEnd > params.refractory) {
        inSwing = true;
        swingStart = now;
        peak = 0;
        dir = { alpha: 0, beta: 0, gamma: 0 };
      } else {
        return;
      }
    }

    dir.alpha += r.alpha;
    dir.beta += r.beta;
    dir.gamma += r.gamma;

    if (mag > peak) {
      peak = mag;
      peakT = now;
      peakAxis = AXES.reduce((best, a) => (Math.abs(r[a]) > Math.abs(r[best]) ? a : best));
      peakSign = r[peakAxis] >= 0 ? 1 : -1;
    }

    if (mag < params.end || now - swingStart > params.timeout) {
      inSwing = false;
      const isReturn = lastSide !== null && peakSign !== lastSide && swingStart - lastEnd < params.reverseLockout;
      if (isReturn) return; // não conta como swing nem renova as janelas
      onSwing({ power: Math.min(peak / params.maxPeak, 1), side: peakSign, dir, peak, axis: peakAxis, t: peakT });
      lastEnd = now;
      lastSide = peakSign;
    }
  };
}
