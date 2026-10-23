import type { SampleTuple } from "../shared/messages";

/**
 * Desenha colunas de `buf` como linhas, nos últimos `windowMs` ms.
 * Escala vertical simétrica pelo maior valor absoluto visível, para o zero ficar no meio.
 */
export function drawSeries(
  canvas: HTMLCanvasElement,
  buf: SampleTuple[],
  cols: number[],
  colors: string[],
  windowMs: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#8884";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  if (buf.length < 2) return;

  const tEnd = buf[buf.length - 1][0];
  const tStart = tEnd - windowMs;
  let maxAbs = 1;
  for (const s of buf) for (const c of cols) if (Number.isFinite(s[c])) maxAbs = Math.max(maxAbs, Math.abs(s[c]));

  const x = (t: number) => ((t - tStart) / windowMs) * w;
  const y = (v: number) => h / 2 - (v / maxAbs) * (h / 2 - 4 * dpr);

  ctx.lineWidth = 1.5 * dpr;
  cols.forEach((c, i) => {
    ctx.strokeStyle = colors[i];
    ctx.beginPath();
    let started = false;
    for (const s of buf) {
      if (s[0] < tStart || !Number.isFinite(s[c])) continue;
      if (started) ctx.lineTo(x(s[0]), y(s[c]));
      else ctx.moveTo(x(s[0]), y(s[c]));
      started = true;
    }
    ctx.stroke();
  });

  ctx.fillStyle = "#888";
  ctx.font = `${11 * dpr}px system-ui, sans-serif`;
  ctx.fillText(`±${maxAbs.toFixed(0)}`, 4 * dpr, 12 * dpr);
}
