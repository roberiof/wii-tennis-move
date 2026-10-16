import type { IntervalStats } from "./messages";

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

export function summarize(values: number[]): { n: number; mean: number; max: number; p95: number } {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, max: 0, p95: 0 };
  let sum = 0;
  let max = -Infinity;
  for (const v of values) {
    sum += v;
    if (v > max) max = v;
  }
  return { n, mean: sum / n, max, p95: percentile(values, 95) };
}

/** Intervalos entre amostras numa janela móvel das últimas `size` amostras. */
export class IntervalTracker {
  private intervals: number[] = [];
  private last: number | null = null;

  constructor(private size = 500) {}

  push(t: number): void {
    if (this.last !== null) {
      this.intervals.push(t - this.last);
      if (this.intervals.length > this.size) this.intervals.shift();
    }
    this.last = t;
  }

  stats(): IntervalStats {
    const s = summarize(this.intervals);
    return { ...s, hz: s.mean > 0 ? 1000 / s.mean : 0 };
  }

  reset(): void {
    this.intervals = [];
    this.last = null;
  }
}
