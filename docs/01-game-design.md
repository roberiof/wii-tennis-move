# 01 — Game design

Estado: **decidido em alto nível**. Detalhes de detecção dependem do POC 01 (ver [`04-premissas.md`](04-premissas.md)).

## Conceito

Tênis no navegador do PC. **O celular é a raquete**: o jogador faz o gesto de raquetada e os sensores do celular viram o golpe. O jogo inteiro acontece na tela do PC.

## Controles

| Elemento | Como é lido | Premissa |
|---|---|---|
| **Acerto** | Timing do swing em relação à passagem da bola pela zona do jogador | P1, P8, P9 |
| **Direção** | Timing: adiantado = cruzada, atrasado = paralela | P3 |
| **Força** | Velocidade (intensidade) do swing | P1 |
| **Efeito** | Componente vertical do swing (topspin, slice, lob) | P4 |
| **Lado** (forehand/backhand) | Sentido da rotação, opostos nos dois golpes | P2 |
| **Movimento** | Automático: o personagem corre sozinho até a bola | P11 |

**Lado — modo híbrido:** golpe do lado errado sai fraco e alto. **Plano B:** lado automático (o jogo escolhe).

> Divergência: o slide 3 do acompanhamento diz que forehand/backhand mudam o lado da jogada (como direção). Este documento segue o documento de contexto. Ver [`00-contexto.md`](00-contexto.md#divergências-conhecidas-entre-fontes).

### Efeitos (slide 4)

| Efeito | Gesto | Resultado na bola |
|---|---|---|
| Topspin | Swing de baixo para cima | Cai rápido e quica alto |
| Slice | Swing de cima para baixo | Vem baixa e mais lenta |
| Lob | Swing suave para cima | Sobe e passa por cima do adversário |

### Tela do celular

Mínima: **cor do jogador** e **botão de recentralizar**.

## O que é um swing

Um arco rápido de braço e pulso com o celular seguro como raquete. Para o sensor, **espera-se** (P1, inferência) que apareça como um pico curto de velocidade de rotação + pico de aceleração.

O celular não sabe a própria posição. O jogo só detecta: **houve raquetada, com esta intensidade e neste sentido.**

## Fluxo do golpe

O PC é a única fonte da verdade. O celular detecta o swing localmente e envia **um evento por golpe**:

```ts
{ power, effect, side, t }
```

Não envia o sensor bruto (P5). Detalhes em [`02-plano-de-projeto.md`](02-plano-de-projeto.md#arquitetura).

## Calibração

Feita na entrada, por jogador:

1. **Um forehand** — grava o sentido da rotação. Cobre canhotos.
2. **Um swing forte e um fraco** — ajusta os limiares de força ao aparelho.

## Modos

Todos usam o mesmo sistema de golpe.

| Modo | Como funciona |
|---|---|
| **Partida rápida** | Single contra a CPU, ou 1v1 com tela dividida |
| **Treino com alvos** | Alvos na quadra; acertar com a força e a direção certas. Serve de tutorial |
| **Paredão** | Rebater contra a parede enquanto a bola acelera; objetivo: bater o recorde |
| **Torneio** | Chave contra 3 ou 4 CPUs com estilos diferentes: sacador, defensor, jogador de rede |

- Formato da partida: curto, [a definir].
- Conexão por QR code ou código de sala.

## Tela

- **Single:** tela inteira, câmera atrás do jogador, contra a CPU.
- **1v1:** tela dividida, P1 à esquerda e P2 à direita (P13). Cada um vê a quadra de trás do seu personagem. Placar compartilhado no centro.

## Em aberto

- Formato e duração da partida.
- Regras de pontuação simplificadas ou completas: [a definir].
- Comportamento exato do modo híbrido de lado (quanto "fraco e alto"): [a definir].
- Saque: como é feito com o celular: [a definir].
