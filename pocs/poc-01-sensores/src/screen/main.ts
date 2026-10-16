import { PLAYER_COLORS, type ControllerStatus, type IntervalStats, type PlayerAssign, type SampleTuple, type Source, type SwingEvent } from "../shared/messages";
import { summarize } from "../shared/stats";
import { airconsoleReceiver } from "../net/swing";
import { drawSeries } from "./chart";
import { downloadText, toCsv, type Cell } from "./csv";
import { createDemo } from "./demo";

const WINDOW_MS = 3000;
const MAX_LAT = 500;
const ROT_COLORS = ["#d33", "#2a2", "#36c"]; // alpha, beta, gamma
const ACC_COLORS = ["#e80", "#909", "#088"]; // x, y, z

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface SourceView {
  buf: SampleTuple[];
  stats: IntervalStats | null;
  /** Atraso dos lotes: getServerTime() na tela - sentAt. */
  batchLat: number[];
}

interface Device {
  id: number;
  connected: boolean;
  status: ControllerStatus | null;
  show: Source;
  sources: Record<Source, SourceView>;
  swings: SwingEvent[];
  /** Pico do swing → chegada na tela (inclui a descida do swing até o detector disparar). */
  lat: number[];
  /** Envio do evento → chegada na tela (só rede). */
  netLat: number[];
  el: { root: HTMLElement; rot: HTMLCanvasElement; acc: HTMLCanvasElement; info: HTMLElement; title: HTMLElement };
}

const ac = new AirConsole({ synchronize_time: true });
let ready = false;
const devices = new Map<number, Device>();

// --- Modo demo x medição ---
const demo = createDemo($("demoView"));
let measuring = false;
$("toggle").addEventListener("click", () => {
  measuring = !measuring;
  $("measureView").hidden = !measuring;
  $("demoView").hidden = measuring;
  $("toggle").textContent = measuring ? "Demo" : "Medição";
  demo.setVisible(!measuring);
});

// Número e cor do jogador, por ordem de chegada; um controle que recarrega mantém os seus.
const playerIndex = new Map<number, number>();
function assignPlayer(id: number): void {
  let index = playerIndex.get(id);
  if (index === undefined) {
    index = playerIndex.size;
    playerIndex.set(id, index);
  }
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
  demo.addPlayer(id, index, color);
  if (ready) ac.message(id, { type: "player", index, color } satisfies PlayerAssign);
}

const now = () => (ready ? ac.getServerTime() : NaN);
const pushCapped = (arr: number[], v: number) => {
  if (!Number.isFinite(v)) return;
  arr.push(v);
  if (arr.length > MAX_LAT) arr.shift();
};

// --- Gravação ---
const CSV_HEADER = ["kind", "label", "device", "source", "t_local_ms", "x", "y", "z", "alpha", "beta", "gamma",
  "power", "side", "peak", "axis", "mode", "t_server", "latency_ms", "net_latency_ms"];
let recording = false;
const rows: Cell[][] = [];
const label = () => $<HTMLInputElement>("label").value.trim() || "sem-rotulo";

$("rec").addEventListener("click", () => {
  recording = !recording;
  $("rec").textContent = recording ? "■ parar" : "● gravar";
  $("rec").classList.toggle("rec", recording);
});
$("export").addEventListener("click", () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadText(`poc01-${stamp}.csv`, toCsv(CSV_HEADER, rows));
});
$("reset").addEventListener("click", () => {
  rows.length = 0;
  for (const d of devices.values()) {
    d.swings = [];
    d.lat = [];
    d.netLat = [];
    for (const s of Object.values(d.sources)) s.batchLat = [];
  }
});

// --- Dispositivos ---
function ensureDevice(id: number): Device {
  let d = devices.get(id);
  if (d) {
    if (!d.connected) assignPlayer(id);
    d.connected = true;
    return d;
  }
  assignPlayer(id);
  if (devices.size === 0) $("devices").innerHTML = "";
  const root = document.createElement("div");
  root.className = "dev";
  root.innerHTML = `
    <h2><span class="title"></span>
      <select class="show"><option value="airconsole">mostrar: AirConsole</option><option value="native">mostrar: nativo</option></select>
    </h2>
    <div class="legend"><span style="color:${ROT_COLORS[0]}">alpha</span><span style="color:${ROT_COLORS[1]}">beta</span><span style="color:${ROT_COLORS[2]}">gamma</span></div>
    <canvas class="rot"></canvas>
    <div class="legend"><span style="color:${ACC_COLORS[0]}">x</span><span style="color:${ACC_COLORS[1]}">y</span><span style="color:${ACC_COLORS[2]}">z</span></div>
    <canvas class="acc"></canvas>
    <div class="info"></div>`;
  $("devices").appendChild(root);
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const view = (): SourceView => ({ buf: [], stats: null, batchLat: [] });
  d = {
    id, connected: true, status: null, show: "airconsole",
    sources: { airconsole: view(), native: view() },
    swings: [], lat: [], netLat: [],
    el: { root, rot: q("canvas.rot"), acc: q("canvas.acc"), info: q(".info"), title: q(".title") },
  };
  const dev = d;
  q<HTMLSelectElement>("select.show").addEventListener("change", (e) => {
    dev.show = (e.target as HTMLSelectElement).value as Source;
  });
  devices.set(id, d);
  return d;
}

ac.onReady = (code) => {
  ready = true;
  $("code").textContent = `código AirConsole: ${code ?? "—"}`;
  demo.setCode(code ?? "—");
};
// onConnect também dispara quando um controle recarrega: reenvia número e cor.
ac.onConnect = (id) => {
  if (devices.has(id)) assignPlayer(id);
  ensureDevice(id);
};
ac.onDisconnect = (id) => {
  const d = devices.get(id);
  if (d) d.connected = false;
  demo.removePlayer(id);
};

const receiver = airconsoleReceiver(ac, {
  samples: (id, m) => {
    const d = ensureDevice(id);
    const arrival = now();
    for (const part of m.parts) {
      const v = d.sources[part.source];
      // JSON transforma NaN em null; volta para NaN.
      const samples = part.samples.map((s) => s.map((x) => (x === null ? NaN : x)) as SampleTuple);
      v.buf.push(...samples);
      const cut = v.buf[v.buf.length - 1][0] - WINDOW_MS;
      while (v.buf.length && v.buf[0][0] < cut) v.buf.shift();
      v.stats = part.stats;
      pushCapped(v.batchLat, arrival - m.sentAt);
      if (recording) {
        for (const s of samples) rows.push(["sample", label(), id, part.source, ...s]);
      }
    }
  },
  status: (id, m) => {
    ensureDevice(id).status = m;
  },
});

receiver.onSwing((id, s) => {
  const d = ensureDevice(id);
  const arrival = now();
  const lat = arrival - s.t;
  const netLat = arrival - s.emittedAt;
  pushCapped(d.lat, lat);
  pushCapped(d.netLat, netLat);
  d.swings.unshift(s);
  if (d.swings.length > 8) d.swings.pop();
  demo.swing(id, s, lat);
  if (recording) {
    rows.push(["swing", label(), id, s.source, null, null, null, null, null, null, null,
      s.power, s.side, s.peak, s.axis, s.mode, s.t, lat, netLat]);
  }
});

// --- Render ---
const fmt = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : "—");

function rangeRow(buf: SampleTuple[], col: number): string {
  let min = Infinity, max = -Infinity;
  for (const s of buf) if (Number.isFinite(s[col])) { min = Math.min(min, s[col]); max = Math.max(max, s[col]); }
  return Number.isFinite(min) ? `${fmt(min, 0)} … ${fmt(max, 0)}` : "—";
}

function renderInfo(d: Device): void {
  d.el.root.classList.toggle("dead", !d.connected);
  const st = d.status;
  d.el.title.textContent = `controle ${d.id}${st ? ` · device_motion ${st.dm} ms · nativo: ${st.native}` : ""}`;

  const srcRows = (Object.keys(d.sources) as Source[]).map((src) => {
    const v = d.sources[src];
    const s = v.stats;
    const bl = summarize(v.batchLat);
    return `<tr><td>${src}</td><td>${s ? fmt(s.hz) : "—"}</td><td>${s ? fmt(s.mean) : "—"}</td>
      <td>${s ? fmt(s.max, 0) : "—"}</td><td>${s ? fmt(s.p95, 0) : "—"}</td><td>${s?.n ?? 0}</td>
      <td>${rangeRow(v.buf, 4)}</td><td>${rangeRow(v.buf, 5)}</td><td>${rangeRow(v.buf, 6)}</td>
      <td>${bl.n ? fmt(bl.mean, 0) : "—"}</td></tr>`;
  }).join("");

  const lat = summarize(d.lat);
  const net = summarize(d.netLat);
  const swings = d.swings.map((s) =>
    `<tr><td>${s.source}/${s.mode}</td><td>${fmt(s.power, 2)}</td><td>${s.side > 0 ? "+" : "−"}</td><td>${s.axis}</td><td>${fmt(s.peak, 0)}</td></tr>`,
  ).join("");

  d.el.info.innerHTML = `
    <table>
      <thead><tr><th>fonte</th><th>Hz</th><th>média ms</th><th>máx ms</th><th>p95 ms</th><th>n</th>
        <th>alpha min…máx</th><th>beta min…máx</th><th>gamma min…máx</th><th>atraso lote ms</th></tr></thead>
      <tbody>${srcRows}</tbody>
    </table>
    <table>
      <thead><tr><th>latência (n=${lat.n})</th><th>média ms</th><th>p95 ms</th><th>máx ms</th></tr></thead>
      <tbody>
        <tr><td>pico do swing → tela</td><td>${lat.n ? fmt(lat.mean, 0) : "—"}</td><td>${lat.n ? fmt(lat.p95, 0) : "—"}</td><td>${lat.n ? fmt(lat.max, 0) : "—"}</td></tr>
        <tr><td>envio do evento → tela</td><td>${net.n ? fmt(net.mean, 0) : "—"}</td><td>${net.n ? fmt(net.p95, 0) : "—"}</td><td>${net.n ? fmt(net.max, 0) : "—"}</td></tr>
      </tbody>
    </table>
    <table>
      <thead><tr><th>últimos swings</th><th>força</th><th>lado</th><th>eixo</th><th>pico</th></tr></thead>
      <tbody>${swings || `<tr><td colspan="5" class="muted">nenhum</td></tr>`}</tbody>
    </table>`;
}

setInterval(() => {
  if (!measuring) return;
  for (const d of devices.values()) renderInfo(d);
  $("recInfo").textContent = `${rows.length} linhas${recording ? ` · gravando "${label()}"` : ""}`;
}, 250);

function frame(now: number): void {
  demo.frame(now);
  if (measuring) for (const d of devices.values()) {
    const buf = d.sources[d.show].buf;
    drawSeries(d.el.rot, buf, [4, 5, 6], ROT_COLORS, WINDOW_MS);
    drawSeries(d.el.acc, buf, [1, 2, 3], ACC_COLORS, WINDOW_MS);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
