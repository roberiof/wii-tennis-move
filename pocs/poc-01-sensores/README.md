# POC 01 — Sensores e latência

- **Estado:** não iniciado
- **Semana:** S1
- **Decide:** [ADR 0003](../../docs/decisoes/0003-airconsole-condicionado-ao-poc.md) — AirConsole ou plano B

## Pergunta

Os sensores do celular, via AirConsole (ou alternativa própria), são bons o bastante para detectar um swing de tênis?

## Premissas testadas

P1, P2, P5, P6, P7, P8, P10 (ver [`docs/04-premissas.md`](../../docs/04-premissas.md)). P4 (efeito) não está no escopo original; a revisão das premissas sugere gravar os gestos de efeito na etapa 1.

## Escopo

Fora do escopo: Three.js, física, regras, arte. Só sensores, transporte e detecção.

### Etapa 1 — Sinal bruto via AirConsole

- Projeto Vite + TypeScript gerando `screen.html` e `controller.html` na raiz.
- Controller: `new AirConsole({ device_motion: 16, synchronize_time: true })`, logar cada `onDeviceMotion` com `performance.now()`, e mandar lotes para a tela.
- Screen: gráfico ao vivo de `alpha, beta, gamma` e de `x, y, z`, mais a taxa medida (amostras/s) e o intervalo médio e máximo entre amostras.
- Responder: qual é a taxa real? Os valores de `alpha, beta, gamma` se comportam como ângulo (variam devagar, limitados a ±180°) ou como velocidade (zero com o celular parado, picos de centenas no swing)?

### Etapa 2 — `devicemotion` nativo dentro do controller

- Na mesma página, tentar `window.addEventListener('devicemotion', …)` direto (com `DeviceMotionEvent.requestPermission()` num toque, no iOS) e comparar taxa e dados com a Etapa 1.

### Etapa 3 — Baseline sem AirConsole (plano B)

- Servidor Node mínimo com WebSocket (`ws` ou Socket.IO) com uma sala, uma página de controle e uma de tela.
- Controle via HTTPS (ngrok ou cloudflared) usando `rotationRate` do `DeviceMotionEvent`.
- Mesma visualização da Etapa 1, para comparar.

### Etapa 4 — Detector de swing + latência

- Detector no controle: pico de magnitude de rotação acima de um limiar → evento `{ power, side, t }`. `side` pelo sinal do eixo dominante.
- Latência: carimbar `t` com `getServerTime()` (AirConsole) ou com relógio sincronizado por ping (plano B), e medir o atraso até a tela.
- Na tela: contador de swings, força e lado detectados, latência média e p95.

Referência inicial de detector, vinda do documento de contexto (limiares são chutes, ajustar com os dados da Etapa 1). Ele assume `rotationRate` em graus/s; se o AirConsole entregar ângulos, derivar a velocidade pela diferença entre amostras:

```ts
type Swing = { power: number; dir: 1 | -1; t: number };

export function createSwingDetector(onSwing: (s: Swing) => void) {
  let inSwing = false, peak = 0, peakAxis = 0, last = 0;
  return (r: { alpha: number; beta: number; gamma: number }, now: number) => {
    const mag = Math.hypot(r.alpha, r.beta, r.gamma);
    if (mag > 400 && now - last > 300) {
      inSwing = true;
      if (mag > peak) { peak = mag; peakAxis = r.alpha; }
    } else if (inSwing && mag < 200) {
      onSwing({ power: Math.min(peak / 1500, 1), dir: peakAxis >= 0 ? 1 : -1, t: now });
      inSwing = false; peak = 0; last = now;
    }
  };
}
```

Pontos a revisar nessa referência (ver observações de P1 e P2):
- `t` é carimbado no fim do swing (quando a magnitude cai), não no pico.
- O sinal vem sempre de `alpha`, não do eixo dominante descrito na etapa 4.

## Critérios de sucesso

Propostos, ajustar com o time.

| Critério | Meta proposta | Base |
|---|---|---|
| Taxa de amostras | Intervalo ≤ ~20 ms (≥ ~8 amostras num swing de ~200 ms) | Inferência; validar com o gráfico |
| Natureza dos dados | Velocidade de rotação, ou ângulo com resolução suficiente para derivar | — |
| Latência swing → tela | < 100 ms | Recomendação da doc do AirConsole |
| Sentido forehand/backhand | Distinguível na grande maioria das tentativas | Inferência |
| Aparelhos | Pelo menos 1 iPhone e 1 Android | — |

**Decisão no fim do POC:** se o AirConsole passar, ele é a camada de conexão. Se não passar, plano B (servidor próprio). Em qualquer caso, a conexão fica atrás de uma interface própria (`sendSwing` / `onSwing`), para a troca ser barata.

## Como rodar

[a definir — preencher quando o código existir]

## Resultados

> Preencher conforme [`pocs/README.md`](../README.md#como-registrar-resultados). Separar **medido** de **inferência**.

### Aparelhos testados

| Aparelho | Sistema | Navegador / app | Rede |
|---|---|---|---|
| | | | |

### Etapa 1 — Sinal bruto via AirConsole

- Medido:
- Inferência:

### Etapa 2 — `devicemotion` nativo no controller

- Medido:
- Inferência:

### Etapa 3 — Plano B

- Medido:
- Inferência:

### Etapa 4 — Detector e latência

- Medido:
- Inferência:

### Critérios

| Critério | Meta | Resultado | Passou? |
|---|---|---|---|
| Taxa de amostras | ≤ ~20 ms | | |
| Natureza dos dados | Velocidade ou ângulo derivável | | |
| Latência swing → tela | < 100 ms | | |
| Sentido forehand/backhand | Grande maioria | | |
| Aparelhos | ≥ 1 iPhone e 1 Android | | |

### Decisão

[a definir] — atualizar o [ADR 0003](../../docs/decisoes/0003-airconsole-condicionado-ao-poc.md) e as premissas afetadas.
