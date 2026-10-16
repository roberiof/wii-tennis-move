// Se o AirConsole entregar alpha/beta/gamma como ângulo, a velocidade sai da diferença entre amostras.

export interface Rotation {
  alpha: number;
  beta: number;
  gamma: number;
}

/** Menor diferença angular b - a, em graus, no intervalo [-180, 180). */
export function angleDelta(a: number, b: number): number {
  return ((((b - a + 180) % 360) + 360) % 360) - 180;
}

/**
 * Converte ângulos em velocidade (°/s). Retorna null na primeira amostra ou se o tempo não avançou.
 * Limite: a 10 Hz, um giro de mais de 180° entre amostras fica ambíguo (ver P7).
 */
export function createRateDeriver() {
  let prev: Rotation | null = null;
  let prevT = 0;
  return (r: Rotation, t: number): Rotation | null => {
    const p = prev;
    const dt = (t - prevT) / 1000;
    prev = { ...r };
    prevT = t;
    if (!p || dt <= 0) return null;
    return {
      alpha: angleDelta(p.alpha, r.alpha) / dt,
      beta: angleDelta(p.beta, r.beta) / dt,
      gamma: angleDelta(p.gamma, r.gamma) / dt,
    };
  };
}
