# POC 01 — Sensores e latência

- **Estado:** em andamento — plano A (Etapas 1, 2 e 4, AirConsole) implementado; falta medir em aparelhos. Etapa 3 (plano B) não iniciada.
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

Plano A (AirConsole). Requer Node 24 (testado com v24.16.0) e o `cloudflared`.

### Preparar (uma vez por máquina)

```bash
brew install cloudflared      # macOS; outros sistemas: ver a documentação da Cloudflare
cd pocs/poc-01-sensores
npm install
npm test                      # opcional: testes do detector, da rotação derivada e das estatísticas
```

### Testar (toda vez)

São dois terminais, ambos em `pocs/poc-01-sensores`, que ficam abertos durante o teste.

1. **Terminal 1, servidor:**
   ```bash
   npm start                  # typecheck + build + vite preview na porta 4173
   ```
   Pronto quando aparecer `Local: http://localhost:4173/`.
2. **Terminal 2, túnel HTTPS:**
   ```bash
   npm run tunnel             # cloudflared apontando para a porta 4173
   ```
   Copiar a URL impressa, no formato `https://<nome>.trycloudflare.com`.
3. **No PC:** abrir o simulador com a URL do túnel no fim, incluindo `https://` e a barra final:
   ```
   https://www.airconsole.com/simulator/#debug:https://<nome>.trycloudflare.com/
   ```
   Clicar em **load debug**. O simulador mostra a tela (modo Demo) e dois controles virtuais, que não têm sensor real.
4. **No celular** (pode estar em qualquer rede): abrir airconsole.com, tocar em entrar e digitar o código que aparece na tela do simulador.
5. **No celular:** tocar em "Calibrar" e fazer um forehand. No iPhone, tocar também em "Ativar sensor do celular" e permitir.
6. Para medir, clicar em **Medição** no canto inferior direito da tela e seguir o [roteiro](#roteiro-de-medição-por-aparelho).
7. Para encerrar, `Ctrl+C` nos dois terminais.

Se algo der errado:

| Sintoma | O que fazer |
|---|---|
| O simulador abre o Pong ou outro jogo | A URL não tem `https://` ou a barra final depois de `#debug:` |
| "Endereço não encontrado" logo após criar o túnel | Esperar alguns segundos (DNS) e recarregar |
| A tela não carrega mais | O túnel ou o servidor caiu. Reiniciar os dois e usar a **nova** URL, que muda a cada `npm run tunnel` |
| `Port 4173 is already in use` | Já existe um servidor rodando. Fechar o outro terminal ou rodar `lsof -i :4173` para achar o processo |
| `Blocked request. This host is not allowed` | O host do túnel não é `*.trycloudflare.com`. Incluir o host em `allowedHosts` no `vite.config.ts` |

Outros comandos:

```bash
npm run dev        # Vite com HMR na porta 5173 (não usar dentro do simulador; ver observações)
npm run build      # só typecheck + build
npm run typecheck
```

### Observações

- O caminho por IP local em `http` (`http://http.airconsole.com/simulator/#debug:http://<IP>:5173/`) não funcionou no Chrome 155 (16/out/2026): o iframe do jogo não carregou. A hipótese é bloqueio do navegador a um site público carregando endereço da rede local; não foi confirmada. Por isso o teste usa túnel HTTPS.
- A URL do túnel muda a cada vez que o `cloudflared` reinicia.
- Logo após criar o túnel, o DNS pode levar alguns segundos. Se o navegador disser que o endereço não existe, esperar e recarregar.
- Com `npm run dev` por IP local, o simulador ficou conectando e desconectando. Não confirmamos se a causa foi o HMR ou o mesmo bloqueio de rede local. Por precaução, o teste usa `vite preview`, que não tem HMR.
- HTTPS também é necessário para o sensor nativo no iPhone (Etapa 2).
- Erros de Sentry e Google Analytics no console vêm do AirConsole bloqueado pelo bloqueador de anúncios e não afetam o POC.

### O que o app mostra

A tela do PC tem dois modos. O botão no canto inferior direito alterna entre eles.

- **Demo (padrão), para apresentar:**
  - código da sala em destaque e um cartão por jogador, com cor, golpes, último golpe, força e latência média;
  - uma quadra ilustrativa: cada swing lança uma bola, com altura e velocidade pela força e lado pelo golpe calibrado.
  - A quadra **não** é a física do jogo, que é da S2.
- **Celular (controller):**
  - cor e número do jogador, contador de golpes, último golpe e barra de força;
  - **calibração:** tocar em "Calibrar" e fazer um forehand. O sinal do eixo dominante nesse golpe passa a significar forehand, e o oposto, backhand. Fica salvo no aparelho;
  - "Ativar sensor do celular": ativa o `devicemotion` nativo (Etapa 2, com permissão no iOS). Se chegarem dados, o detector passa a usar essa fonte;
  - "Avançado: medição": taxa por fonte, `device_motion` (16/33/50/100 ms, recarrega a página), fonte e modo do detector, limiares.
  - O modo padrão para a fonte AirConsole é "derivada de ângulo". Ver a observação preliminar em Resultados.
- **PC, modo Medição, por controle:**
  - gráficos de `alpha/beta/gamma` e `x/y/z` dos últimos 3 s;
  - por fonte: Hz, intervalo médio, máximo e p95 (medidos no celular), faixa min…máx de `alpha/beta/gamma` e atraso dos lotes;
  - latência dos swings, "pico → tela" e "envio → tela", com média, p95 e máximo;
  - últimos swings com força, lado, eixo e pico.
- **Gravação:** escolher um rótulo, clicar em gravar e depois em "Exportar CSV". Salvar o CSV em `resultados/`.

### Roteiro de medição (por aparelho)

1. **Parado 10 s** (rótulo `parado`). Se `alpha/beta/gamma` ficarem perto de 0, são velocidade; se ficarem constantes e diferentes de 0, são ângulo (P7).
2. **Giro rápido** (`giro`). Velocidade dá picos de centenas de °/s; ângulo fica limitado a ±180°.
3. **10 forehands e 10 backhands** (`forehand`, `backhand`). Conferir se o lado inverte e anotar a taxa de acerto (P2). Fazer com pelo menos 2 pessoas.
4. **Swings fortes e fracos** (`forte`, `fraco`), para ver se a força separa (P1).
5. **Gestos de efeito** (`topspin`, `slice`, `lob`, `neutro`), gravados só para análise (P4).
6. **Repetir com `device_motion` 16, 50 e 100 ms** e anotar Hz, máximo e p95 de cada um (P6).
7. **Ativar o sensor nativo** e comparar com o AirConsole (Etapa 2).
8. **Anotar a latência** (média e p95) com o detector ligado (P8).

Se os dados forem ângulo, trocar "Rotação" para "derivada de ângulo" no celular antes dos passos 3 e 4.

### Estrutura

| Arquivo | Conteúdo |
|---|---|
| `screen.html`, `src/screen/` | Tela do PC: gráficos, estatísticas, latência, gravação CSV |
| `controller.html`, `src/controller/` | Celular: leitura AirConsole e nativa, detector, envio em lotes |
| `src/controller/detector.ts` | Detector de swing. Corrige a referência: `t` no pico e lado pelo eixo dominante |
| `src/controller/rotation.ts` | Velocidade derivada de ângulos, com volta em ±180° |
| `src/shared/` | Contrato de mensagens e estatística de intervalos |
| `src/net/swing.ts` | Interface `sendSwing` / `onSwing` (ADR 0003) sobre AirConsole |
| `src/airconsole.d.ts` | Tipos mínimos da API 1.11.0 |

### Limitações conhecidas

- O intervalo é medido com `performance.now()` na chegada do callback, não no instante da leitura do sensor.
- A latência "pico → tela" depende da sincronização do `getServerTime()`, cuja precisão não foi medida.
- O detector só envia o evento quando a magnitude cai abaixo do limiar de fim. A latência "pico → tela" inclui esse tempo; a "envio → tela" é só rede.

## Resultados

> Preencher conforme [`pocs/README.md`](../README.md#como-registrar-resultados). Separar **medido** de **inferência**.

### Aparelhos testados

| Aparelho | Sistema | Navegador / app | Rede |
|---|---|---|---|
| | | | |

### Etapa 1 — Sinal bruto via AirConsole

- Medido:
  - **Observação preliminar, 16/out/2026.** Não segue o roteiro; aparelho e navegador `[a definir]`.
  - Num celular real via túnel HTTPS, com `device_motion: 16`, o gráfico de `alpha` saltou em degraus entre ~0 e ~359 enquanto o celular era girado. `beta` e `gamma` variaram devagar e com pouca amplitude. O acelerômetro chegou a ±14.
  - No simulador do AirConsole (controles virtuais, sem sensor), o `onDeviceMotion` foi chamado a 62,5 Hz: intervalo médio 16,0 ms, máximo 22 a 25 ms, p95 18 ms, n = 500. Os campos vieram sem valores numéricos.
- Inferência:
  - Os saltos 0 ↔ 359 indicam que `alpha/beta/gamma` do AirConsole são **ângulos de orientação**, não velocidade de rotação (P7). Falta confirmar com o passo "parado 10 s" do roteiro.
  - A taxa do simulador não vale como medida de celular.

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
