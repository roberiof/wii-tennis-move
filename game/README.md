# Jogo — Wii Tennis Move

Implementação principal do jogo de tênis no navegador. O PC renderiza a cena 3D e a física, enquanto o celular de cada jogador atua como raquete via sensores de movimento integrados à API do AirConsole.

## Estado atual (S3)

A **S3** entregou o golpe completo, a calibração e os modos Parede e Treino com alvos. Os valores do golpe são **iniciais**: foram ajustados em playtest de 1 jogador, sem medição (ver [`docs/01-game-design.md`](../docs/01-game-design.md) e [`docs/04-premissas.md`](../docs/04-premissas.md)).

### Fluxo
O celular conduz: **calibração → menu → modo**. O PC espelha a fase (painel de calibração, painel "Escolha o modo"). Na S3 há um jogador: o primeiro celular que se conecta controla; os outros são ignorados até a S5.

### Modos
| Modo | Como funciona |
|---|---|
| **Parede** (modo livre) | Parede atrás da quadra adversária; a bola volta jogável (passa a rede e chega na altura da raquete). O rally acaba com dois quiques do seu lado, bola na rede, por cima/fora da parede ou parada |
| **Treino com alvos** | Máquina de bolas e 5 lições: No tempo, Bola curta, Bola funda, Cruzada, Paralela. 3 acertos passam de lição; no fim, resumo de acertos/tentativas. A bola muda de cor conforme o timing (azul = adiantado, verde = no tempo, laranja = atrasado) |
| **Rally CPU (demo)** | A CPU da S2, que não erra. Vira a CPU básica na S4 |

### Golpe
- **Timing:** o celular manda o instante do pico do swing no relógio do servidor (`getServerTime()`); a tela compara com o instante em que a bola cruza a linha de contato. Janela de −350 a +250 ms.
- **Direção:** adiantado = cruzada, no tempo = centro, atrasado = paralela. A tela mira o quique (`aimShot`).
- **Força:** pico de rotação mapeado pela calibração → profundidade e velocidade.
- **Lado:** comparação com os moldes da calibração (3 forehands, 3 backhands). Lado errado sai fraco e alto; leitura incerta não é punida (benefício da dúvida).
- **Régua de timing:** depois de cada golpe, mostra onde ele caiu (cedo · no tempo · tarde).

### Celular
Telas de calibração, menu (Parede, Treino com alvos, Rally CPU, Testar golpes, Recalibrar), jogo e **teste de golpes** (séries declaradas de forehand/backhand com placar de acerto do lado, para medir a classificação). O perfil fica salvo no celular.

### Controles no PC (depuração)
| Tecla | Ação |
|---|---|
| `ESPAÇO` / `Z` | Forehand / backhand forte; com `OPTION/ALT` = médio; com `SHIFT` = fraco. Clique = forehand forte |
| `1` `2` `3` | Parede · Treino com alvos · Rally CPU |
| `ESC` | Menu |
| `N` | Próxima lição (treino) |
| `D` | Overlay de depuração (offset, latência, força, lado esperado × recebido) |

### Base da S2 (mantida)
Quadra 3D, física própria da bola (gravidade, quique, rede), personagens Frutiger Aero e movimento automático até a bola (P11).

## Estrutura de arquivos

| Arquivo / Pasta | Descrição |
|---|---|
| `screen.html` / `controller.html` | Tela do PC e tela do celular |
| `src/shared/` | Contratos de mensagens e textos compartilhados (calibração, teste) |
| `src/net/link.ts` | Interface de conexão do ADR 0003 (`sendSwing` / `onSwing`) sobre o AirConsole |
| `src/controller/rotation.ts`, `detector.ts` | Velocidade de rotação derivada dos ângulos e detector de pico do swing |
| `src/controller/calibration.ts` | Calibração (mão, moldes, força) e leitura do golpe no jogo |
| `src/controller/swing-test.ts` | Modo de teste de golpes |
| `src/screen/main.ts` | Cena, golpe do jogador e aplicação do estado |
| `src/screen/game.ts` | Estado do jogo (`calib → menu → playing`) e o lugar do jogador |
| `src/screen/shot.ts` | Resolução do golpe: timing, direção, força, lado |
| `src/screen/tuning.ts` | **Todos os valores ajustáveis** do golpe e dos modos |
| `src/screen/physics.ts` | Física da bola, mira (`aimShot`), parede |
| `src/screen/modes/` | `wall.ts`, `targets.ts`, `cpu-demo.ts` e a interface `mode.ts` |
| `src/screen/clock.ts`, `debug.ts`, `timing-bar.ts` | Relógio do servidor, overlay de depuração, régua de timing |
| `src/screen/court.ts`, `character.ts` | Quadra e personagem |
| `test/` | Testes (vitest) |

## Testes

```bash
cd game
npm test          # vitest
npm run typecheck
```

## Como Rodar

1. **Instalar dependências (uma vez):**
   ```bash
   cd game
   npm install
   ```

2. **Iniciar servidor e túnel** (dois terminais em `game/`, abertos durante o teste):
   - **Terminal 1:** `npm start` (typecheck + build + preview na porta **4174**). Pronto quando aparecer `Local: http://localhost:4174/`.
   - **Terminal 2:** `npm run tunnel` (túnel HTTPS do cloudflared para a 4174, via HTTP/2). Copiar a URL `https://<nome>.trycloudflare.com` impressa.

3. **Abrir no PC:**
   Acessar no navegador, com `https://` e a barra final depois de `#debug:`, e clicar em **load debug**:
   `https://www.airconsole.com/simulator/#debug:https://<SEU_TUNEL>.trycloudflare.com/`

4. **Conectar no Celular:**
   Abrir `airconsole.com` no Chrome mobile e inserir o código de sala exibido na tela do PC. O celular pode estar em qualquer rede; nunca usar `localhost` nele.

### Por que HTTP/2 no túnel

Por padrão o `cloudflared` usa QUIC (UDP, porta 7844). Em 4/nov/2026, numa rede com UDP bloqueado, o túnel não conectou (`failed to dial to edge with quic`), e o pre-check do próprio `cloudflared` indicou `UDP Connectivity FAIL` e `TCP Connectivity PASS`. Com `--protocol http2` (TCP 443) conectou. O script já usa HTTP/2 para funcionar nas duas situações.

### Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Túnel responde 502 / simulador não carrega o jogo | O servidor não está na 4174. Conferir o Terminal 1 |
| `Port 4174 is already in use` | Já há um servidor rodando (talvez de outra sessão). `lsof -i :4174` para achar o processo |
| "Endereço não encontrado" logo após criar o túnel | Esperar alguns segundos (DNS) e recarregar |
| A tela parou de carregar | O túnel caiu. Reiniciar `npm run tunnel` e usar a **nova** URL, que muda a cada execução |
| Simulador abre outro jogo | Faltou `https://` ou a barra final depois de `#debug:` |
| Celular conectado, mas nada acontece no PC | Na S3 só o primeiro controle conectado controla. No simulador, pode ser o controle virtual 1: mexer nele confirma |
