// Modo demo: mostra cada swing detectado como uma bola lançada numa quadra ilustrativa.
// A trajetória é só visual (altura e velocidade pela força, lado pelo golpe); a física do jogo é da S2.

import type { SwingEvent } from "../shared/messages";

interface Player {
  id: number;
  index: number;
  color: string;
  swings: number;
  lat: number[];
  swingAnim: number; // instante do último golpe (para animar a raquete)
  lastSide: 1 | -1;
  card: HTMLElement;
}

interface Ball {
  color: string;
  u0: number; v0: number; u1: number; v1: number;
  t0: number; dur: number; peak: number;
}

interface Flash {
  text: string;
  color: string;
  t0: number;
}

const BALL_LIFE = 2200;
const FLASH_MS = 1100;

export function createDemo(root: HTMLElement) {
  root.innerHTML = `
    <div class="demo-head">
      <div>
        <div class="demo-brand">Wii Tennis Move</div>
        <div class="demo-sub">O celular é a raquete</div>
      </div>
      <div class="demo-code">
        <div class="demo-code-label">Entre em <b>airconsole.com</b> e digite</div>
        <div class="demo-code-value" data-code>— — —</div>
      </div>
    </div>
    <div class="demo-body">
      <div class="demo-court-wrap"><canvas class="demo-court"></canvas>
        <div class="demo-lobby" data-lobby>Aguardando jogadores…<br><small>Cada jogador usa o próprio celular como raquete</small></div>
      </div>
      <div class="demo-players" data-players></div>
    </div>
    <div class="demo-foot">Protótipo S1 · conexão celular ↔ PC e detector de swing · quadra ilustrativa (física na S2)</div>`;

  const canvas = root.querySelector("canvas") as HTMLCanvasElement;
  const playersEl = root.querySelector("[data-players]") as HTMLElement;
  const lobby = root.querySelector("[data-lobby]") as HTMLElement;
  const players = new Map<number, Player>();
  let balls: Ball[] = [];
  let flashes: Flash[] = [];
  let visible = true;

  function cardHtml(p: Player): string {
    const avg = p.lat.length ? Math.round(p.lat.reduce((a, b) => a + b, 0) / p.lat.length) : null;
    return `
      <div class="pc-head"><span class="pc-dot" style="background:${p.color}"></span>Jogador ${p.index + 1}</div>
      <div class="pc-row"><span>Golpes</span><b>${p.swings}</b></div>
      <div class="pc-last" data-last>${p.swings ? "" : "Faça uma raquetada"}</div>
      <div class="pc-bar"><div class="pc-fill" data-fill style="background:${p.color}"></div></div>
      <div class="pc-row pc-small"><span>Latência média</span><span>${avg === null ? "—" : `${avg} ms`}</span></div>`;
  }

  function addPlayer(id: number, index: number, color: string): void {
    let p = players.get(id);
    if (!p) {
      const card = document.createElement("div");
      card.className = "pc";
      p = { id, index, color, swings: 0, lat: [], swingAnim: -Infinity, lastSide: 1, card };
      players.set(id, p);
      playersEl.appendChild(card);
    }
    p.card.classList.remove("pc-off");
    p.card.innerHTML = cardHtml(p);
    lobby.style.display = "none";
  }

  function removePlayer(id: number): void {
    players.get(id)?.card.classList.add("pc-off");
  }

  function swing(id: number, s: SwingEvent, latencyMs: number): void {
    const p = players.get(id);
    if (!p) return;
    p.swings++;
    if (Number.isFinite(latencyMs)) {
      p.lat.push(latencyMs);
      if (p.lat.length > 50) p.lat.shift();
    }
    p.swingAnim = performance.now();
    p.lastSide = s.side;

    const stroke = s.calibrated ? (s.side > 0 ? "FOREHAND" : "BACKHAND") : "GOLPE";
    const pct = Math.round(s.power * 100);
    p.card.innerHTML = cardHtml(p);
    (p.card.querySelector("[data-last]") as HTMLElement).textContent = `${stroke} · ${pct}%`;
    (p.card.querySelector("[data-fill]") as HTMLElement).style.width = `${pct}%`;
    p.card.classList.remove("pc-hit");
    void p.card.offsetWidth; // reinicia a animação CSS
    p.card.classList.add("pc-hit");

    const lane = laneU(p);
    const target = s.calibrated ? s.side * 0.5 : 0;
    balls.push({
      color: p.color,
      u0: lane, v0: 0.04,
      u1: target + (Math.random() - 0.5) * 0.25, v1: 0.62 + 0.3 * s.power,
      t0: performance.now(),
      dur: 1100 - 550 * s.power,
      peak: 0.12 + 0.25 * s.power,
    });
    flashes.push({ text: `${stroke} ${pct}%`, color: p.color, t0: performance.now() });
  }

  // Jogadores lado a lado no fundo da quadra.
  function laneU(p: Player): number {
    const n = Math.max(players.size, 1);
    return n === 1 ? 0 : -0.6 + (1.2 * p.index) / (n - 1 || 1);
  }

  // --- Desenho da quadra em perspectiva ---
  // u ∈ [-1, 1] atravessa a quadra; v ∈ [0, 1] vai do fundo perto (0) ao fundo longe (1).
  function project(w: number, h: number, u: number, v: number, alt = 0) {
    const yNear = h * 0.9, yFar = h * 0.14;
    const wNear = w * 0.8, wFar = w * 0.36;
    const k = v; // perspectiva linear, suficiente para ilustrar
    const half = (wNear + (wFar - wNear) * k) / 2;
    const scale = half / (wNear / 2);
    return { x: w / 2 + u * half, y: yNear + (yFar - yNear) * k - alt * h * scale, s: scale };
  }

  function draw(now: number): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    const P = (u: number, v: number, alt = 0) => project(w, h, u, v, alt);
    const poly = (pts: { x: number; y: number }[]) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };

    // Piso externo e quadra
    poly([P(-1.25, -0.06), P(1.25, -0.06), P(1.25, 1.06), P(-1.25, 1.06)]);
    ctx.fillStyle = "#1f6f4a";
    ctx.fill();
    poly([P(-1, 0), P(1, 0), P(1, 1), P(-1, 1)]);
    ctx.fillStyle = "#2d7dd2";
    ctx.fill();

    // Linhas
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2 * dpr;
    const line = (u0: number, v0: number, u1: number, v1: number) => {
      const a = P(u0, v0), b = P(u1, v1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    poly([P(-1, 0), P(1, 0), P(1, 1), P(-1, 1)]); ctx.stroke();
    line(-0.75, 0, -0.75, 1); line(0.75, 0, 0.75, 1);
    line(-0.75, 0.23, 0.75, 0.23); line(-0.75, 0.77, 0.75, 0.77);
    line(0, 0.23, 0, 0.77);

    // Bolas atrás da rede (lado longe) antes da rede; as do lado perto depois.
    const ballStates = balls.map((b) => ballState(b, now)).filter((s): s is NonNullable<typeof s> => s !== null);
    for (const s of ballStates) if (s.v > 0.5) drawBall(ctx, P, s, dpr);

    // Rede
    const nl = P(-1.08, 0.5), nr = P(1.08, 0.5), nlt = P(-1.08, 0.5, 0.06), nrt = P(1.08, 0.5, 0.06);
    ctx.fillStyle = "rgba(20,20,20,0.35)";
    poly([nl, nr, nrt, nlt]); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath(); ctx.moveTo(nlt.x, nlt.y); ctx.lineTo(nrt.x, nrt.y); ctx.stroke();

    for (const s of ballStates) if (s.v <= 0.5) drawBall(ctx, P, s, dpr);

    // Jogadores no fundo perto
    for (const p of players.values()) {
      if (p.card.classList.contains("pc-off")) continue;
      const base = P(laneU(p), -0.02);
      const r = 14 * dpr;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.ellipse(base.x, base.y + 4 * dpr, r * 1.3, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(base.x, base.y - r, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${12 * dpr}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(p.index + 1), base.x, base.y - r);
      // Raquete: gira rápido no golpe
      const k = Math.min((now - p.swingAnim) / 250, 1);
      const angle = p.lastSide * (-1.9 + 2.6 * easeOut(k));
      const len = 30 * dpr;
      const hx = base.x + Math.cos(angle - Math.PI / 2) * len * 0.5;
      const hy = base.y - r + Math.sin(angle - Math.PI / 2) * len * 0.5;
      const tx = base.x + Math.cos(angle - Math.PI / 2) * len * 1.4;
      const ty = base.y - r + Math.sin(angle - Math.PI / 2) * len * 1.4;
      ctx.strokeStyle = "#ddd"; ctx.lineWidth = 3 * dpr;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.lineWidth = 3 * dpr;
      ctx.beginPath(); ctx.ellipse(tx, ty, 8 * dpr, 11 * dpr, angle, 0, Math.PI * 2); ctx.stroke();
    }

    // Aviso do golpe mais recente (um por vez, para não empilhar)
    const f = flashes[flashes.length - 1];
    if (f && now - f.t0 < FLASH_MS) {
      const k = (now - f.t0) / FLASH_MS;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = f.color;
      ctx.font = `800 ${(30 + 10 * (1 - k)) * dpr}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 5 * dpr;
      const y = h * 0.08 - k * 12 * dpr;
      ctx.strokeText(f.text, w / 2, y);
      ctx.fillText(f.text, w / 2, y);
      ctx.globalAlpha = 1;
    }
    flashes = f ? [f] : [];

    balls = balls.filter((b) => now - b.t0 < b.dur + BALL_LIFE);
  }

  return {
    setCode(code: string) {
      (root.querySelector("[data-code]") as HTMLElement).textContent = code;
    },
    addPlayer,
    removePlayer,
    swing,
    setVisible(v: boolean) { visible = v; },
    frame(now: number) { if (visible) draw(now); },
  };
}

function easeOut(k: number): number {
  return 1 - (1 - k) ** 3;
}

// Voo até o quique, depois um quique baixo e some.
function ballState(b: Ball, now: number) {
  const t = now - b.t0;
  if (t < b.dur) {
    const k = t / b.dur;
    return { u: b.u0 + (b.u1 - b.u0) * k, v: b.v0 + (b.v1 - b.v0) * k, alt: b.peak * 4 * k * (1 - k), alpha: 1, color: b.color };
  }
  const t2 = t - b.dur;
  const bounce = 450;
  if (t2 > BALL_LIFE) return null;
  const k = Math.min(t2 / bounce, 1);
  const du = (b.u1 - b.u0) * 0.15, dv = 0.12;
  return {
    u: b.u1 + du * k,
    v: Math.min(b.v1 + dv * k, 1.05),
    alt: k < 1 ? b.peak * 0.3 * 4 * k * (1 - k) : 0,
    alpha: Math.max(0, 1 - t2 / BALL_LIFE),
    color: b.color,
  };
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  P: (u: number, v: number, alt?: number) => { x: number; y: number; s: number },
  s: { u: number; v: number; alt: number; alpha: number; color: string },
  dpr: number,
): void {
  const ground = P(s.u, s.v);
  const air = P(s.u, s.v, s.alt);
  const r = 9 * dpr * ground.s;
  ctx.globalAlpha = s.alpha * 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(ground.x, ground.y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = s.alpha;
  ctx.fillStyle = "#e8ff3a";
  ctx.beginPath(); ctx.arc(air.x, air.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = s.color; ctx.lineWidth = 2.5 * dpr;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
