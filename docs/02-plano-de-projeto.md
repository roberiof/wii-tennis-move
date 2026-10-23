# 02 — Plano de projeto

## Stack

Proposta: AirConsole para conexão e sensores, Three.js para o jogo, tudo em TypeScript com Vite. Sem servidor próprio. **Adoção do AirConsole condicionada ao POC 01** ([ADR 0003](decisoes/0003-airconsole-condicionado-ao-poc.md)).

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript | Domínio do time |
| Build | Vite, gerando `screen.html` e `controller.html` na raiz | O AirConsole carrega esses dois arquivos da URL do jogo |
| Conexão e sensores | API JS do AirConsole | Conexão, código de sala e sensores prontos |
| Render | Three.js | Câmera atrás do jogador e altura da bola (lob) pedem 3D; tela dividida com viewport/scissor |
| Física | Própria: gravidade, quique, rede | Física de uma bola só; engine seria excesso |
| Controle | TS puro | UI mínima |
| Tipos compartilhados | Pasta `shared` | Tela e controle falam o mesmo contrato |
| Testes em rede | ngrok ou Cloudflare Tunnel | Recomendado pela doc do AirConsole para redes com isolamento (universidade) |

Versões de bibliotecas: [a definir] — fixar no `package.json` quando o código começar.

### Plano B sem AirConsole

Servidor Node com WebSocket (Socket.IO) hospedado em São Paulo e controle servido por HTTPS usando `DeviceMotionEvent`. A lógica do jogo não muda.

A conexão fica atrás de uma **interface própria** (`sendSwing` / `onSwing`) desde o início, para a troca ser barata.

### Em aberto

- Alguém do time tem experiência com Three.js? Se não, avaliar 2D com perspectiva falsa (a física continua 3D).
- Hospedagem do plano B (provedor): [a definir].

## Arquitetura

A tela (PC) roda o jogo e decide tudo. Cada celular detecta o próprio swing e envia **um evento por golpe**.

### Fluxo de um golpe

1. O controle recebe `onDeviceMotion` no intervalo configurado.
2. O detector local encontra o pico de rotação e aceleração e calcula força, efeito e lado.
3. O controle envia `{ type: "swing", power, effect, side, t }` para a tela, com `t` vindo de `getServerTime()`.
4. A tela compara `t` com a passagem da bola pela zona do jogador e resolve o acerto com janela generosa.
5. A tela atualiza a física e, no acerto, manda `vibrate` para aquele celular.

```
Celular (controller)                         PC (screen)
  onDeviceMotion ─▶ detector ─▶ sendSwing ──▶ onSwing ─▶ resolve acerto (t x bola)
                                                 │
                         vibrate ◀───────────────┘ (no acerto)
```

### Pastas previstas do jogo

| Pasta | Conteúdo |
|---|---|
| `screen/` | Cena, física, regras, CPU, modos |
| `controller/` | Detector, calibração, UI mínima |
| `shared/` | Tipos das mensagens |
| `net/` | Interface de conexão (`sendSwing` / `onSwing`), implementações AirConsole e plano B |

### Calibração

Na entrada: um forehand (grava o sentido da rotação) e um swing forte e um fraco (limiares do aparelho).

## Cronograma (8 semanas)

Datas de início e fim de cada semana: [a definir].

| Semana | Entrega | Critério de pronto | Responsáveis |
|---|---|---|---|
| S1 | POC 01: sensores e latência (AirConsole e plano B) | Swing aparece na tela com força; latência medida; decisão AirConsole ou plano B | [a definir] |
| S2 | Quadra, bola e física; personagem corre sozinho até a bola | Bola quica e passa a rede de forma crível | [a definir] |
| S3 | Golpe completo (timing, força, direção, lado); calibração; Treino com alvos | Troca de bola contra a parede; alvos acertáveis | [a definir] |
| S4 | Regras e placar; CPU básica; Paredão com recorde | Partida single completa; primeiro teste com colegas | [a definir] |
| S5 | Multiplayer 1v1 com tela dividida | Duas pessoas jogam uma partida inteira | [a definir] |
| S6 | Efeitos (topspin, slice, lob); Torneio | Efeito perceptível; chave do torneio jogável | [a definir] |
| S7 | Arte, sons, instruções; testes com jogadores e celulares | Pessoa de fora joga sem explicação verbal | [a definir] |
| S8 | Correções, documentação, demo | Demo roda do início ao fim; reserva para imprevistos | [a definir] |

> O slide 10 do acompanhamento descreve a S1 como "conexão celular ↔ PC (sala, QR code) e detector de swing em 2 a 3 celulares". Este plano trata a S1 como o POC 01; sala e QR code entram quando a camada de conexão for decidida.

## Riscos

| Risco | Como reduzimos |
|---|---|
| Intervalo do `device_motion` longo demais para o pico do swing | Medir no POC; plano B se insuficiente |
| Dados de giroscópio são ângulos, não velocidade | Derivar pela diferença entre amostras |
| Latência alta na rede da universidade | `getServerTime()`, bola lenta, janela generosa; ngrok |
| Limiares diferentes entre celulares | Calibração por jogador; testar iPhone e Android |
| Sentido forehand/backhand não confiável | Lado automático |
| Dependência do serviço do AirConsole na demo | Plano B atrás da mesma interface |
| Anúncios da versão gratuita na demo | Testar; pausar som em `onAdShow` |

Riscos adicionais levantados na revisão das premissas (ver [`04-premissas.md`](04-premissas.md)): escopo das 8 semanas (P14) e leitura de efeito pelo sensor (P4).

## Referências

- https://developers.airconsole.com/
- https://airconsole.github.io/airconsole-api/
- https://developers.airconsole.com/testing-your-game
- https://developers.airconsole.com/best-practices
- https://developers.airconsole.com/best-practices-for-web-games-on-airconsole
- https://github.com/AirConsole/airconsole-api/

