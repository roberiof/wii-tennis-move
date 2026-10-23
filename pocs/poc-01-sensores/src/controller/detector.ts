import type { Axis } from "../shared/messages";
import type { Rotation } from "./rotation";

export interface DetectorParams {
  /** Magnitude (°/s) que inicia o swing. */
  start: number;
  /** Magnitude (°/s) abaixo da qual o swing termina. */
  end: number;
  /** Pausa mínima (ms) entre swings. */
  refractory: number;
  /** Magnitude que corresponde a power = 1. */
  maxPeak: number;
}

export const DEFAULT_PARAMS: DetectorParams = { start: 400, end: 200, refractory: 300, maxPeak: 1500 };

export interface DetectedSwing {
  power: number;
  side: 1 | -1;
  peak: number;
  axis: Axis;
  /** Instante do pico, no relógio de `now`. */
  t: number;
}

const AXES: Axis[] = ["alpha", "beta", "gamma"];

/**
 * Detector de pico de rotação. Diferenças em relação à referência do README:
 * - `t` é o instante do pico, não o da descida;
 * - `side` é o sinal do eixo dominante no pico, não sempre de `alpha`.
 */
export function createSwingDetector(params: DetectorParams, onSwing: (s: DetectedSwing) => void) {
  let inSwing = false;
  let peak = 0;
  let peakT = 0;
  let peakAxis: Axis = "alpha";
  let peakSign: 1 | -1 = 1;
  let lastEnd = -Infinity;

  return (r: Rotation, now: number): void => {
    const mag = Math.hypot(r.alpha, r.beta, r.gamma);

    if (!inSwing) {
      if (mag > params.start && now - lastEnd > params.refractory) {
        inSwing = true;
        peak = 0;
      } else {
        return;
      }
    }

    if (mag > peak) {
      peak = mag;
      peakT = now;
      peakAxis = AXES.reduce((best, a) => (Math.abs(r[a]) > Math.abs(r[best]) ? a : best));
      peakSign = r[peakAxis] >= 0 ? 1 : -1;
    }

    if (mag < params.end) {
      onSwing({ power: Math.min(peak / params.maxPeak, 1), side: peakSign, peak, axis: peakAxis, t: peakT });
      inSwing = false;
      lastEnd = now;
    }
  };
}
