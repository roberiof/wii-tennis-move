// O AirConsole entrega alpha/beta/gamma como ângulo (P7); a velocidade sai da diferença entre amostras.
// Portado de pocs/poc-01-sensores/src/controller/rotation.ts, com as guardas de dt do jogo (S2).

export interface Rotation {
  alpha: number;
  beta: number;
  gamma: number;
}

/** Menor diferença angular b - a, em graus, no intervalo [-180, 180). */
export function angleDelta(a: number, b: number): number {
  return ((((b - a + 180) % 360) + 360) % 360) - 180;
}

/** dt (s) fora desta faixa não gera velocidade: amostra duplicada ou buraco no fluxo. */
const MIN_DT = 0.002;
const MAX_DT = 0.5;

/** Converte ângulos em velocidade (°/s). Retorna null na primeira amostra e quando o dt é implausível. */
export function createRateDeriver() {
  let prev: Rotation | null = null;
  let prevT = 0;
  return (r: Rotation, t: number): Rotation | null => {
    const p = prev;
    const dt = (t - prevT) / 1000;
    prev = { ...r };
    prevT = t;
    if (!p || dt <= MIN_DT || dt > MAX_DT) return null;
    return {
      alpha: angleDelta(p.alpha, r.alpha) / dt,
      beta: angleDelta(p.beta, r.beta) / dt,
      gamma: angleDelta(p.gamma, r.gamma) / dt,
    };
  };
}
