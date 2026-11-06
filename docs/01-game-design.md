# 01 — Game design

Estado: **decidido em alto nível**; golpe, calibração, Parede e Treino com alvos implementados na S3 com **valores iniciais** (ver [`04-premissas.md`](04-premissas.md)).

## Conceito

Tênis no navegador do PC. **O celular é a raquete**: o jogador faz o gesto de raquetada e os sensores do celular viram o golpe. O jogo inteiro acontece na tela do PC.

## Controles

| Elemento | Como é lido | Premissa |
|---|---|---|
| **Acerto** | Instante do pico do swing (relógio do servidor) comparado ao instante em que a bola cruza a linha de contato | P1, P8, P9 |
| **Direção** | Timing: adiantado = cruzada, no tempo = centro, atrasado = paralela | P3 |
| **Força** | Pico de rotação do swing, mapeado pela calibração → profundidade e velocidade | P1 |
| **Efeito** | Componente vertical do swing (topspin, slice, lob) | P4 |
| **Lado** (forehand/backhand) | Direção do giro comparada com os moldes da calibração (golpe mais parecido) | P2 |
| **Movimento** | Automático: o personagem corre sozinho até a bola | P11 |

**Lado — modo híbrido:** golpe do lado errado sai fraco e alto (força × 0,5, tempo de voo × 1,4; valor inicial, S3). Quando o celular não tem certeza do lado, a tela não pune (benefício da dúvida). **Plano B:** lado automático (o jogo escolhe).

### Valores iniciais do golpe (S3)

Nenhum foi medido: são pontos de partida, ajustados em playtest de 1 jogador. Ficam em `game/src/screen/tuning.ts`.

| Elemento | Valor |
|---|---|
| Janela de acerto | −350 a +250 ms em relação ao instante em que a bola cruza a linha de contato (negativo = antes) |
| Faixas de timing | Adiantado < −120 ms · no tempo de −120 a +80 ms · atrasado > +80 ms |
| Cruzada / paralela | Alvo a 3,5 m do centro: cruzada para o lado oposto ao do contato, paralela pelo mesmo lado. Contato perto do centro (abs(x) < 1 m): vale o lado do golpe (forehand de destro adiantado puxa para a esquerda) |
| Profundidade | Quique a 4 + 6,5 × força metros da rede (fraco: 4 m; forte: 10,5 m, antes da linha de fundo) |
| Velocidade | 12 + 9 × força m/s |
| Lado errado | Força × 0,5 e tempo de voo × 1,4 |
| Benefício da dúvida | Margem do lado (semelhança com o forehand mais parecido − com o backhand mais parecido, de −2 a 2) abaixo de 0,3 em módulo |

> Divergência: o slide 3 do acompanhamento diz que forehand/backhand mudam o lado da jogada (como direção). Este documento segue o documento de contexto. Ver [`00-contexto.md`](00-contexto.md#divergências-conhecidas-entre-fontes).

### Efeitos (slide 4)

| Efeito | Gesto | Resultado na bola |
|---|---|---|
| Topspin | Swing de baixo para cima | Cai rápido e quica alto |
| Slice | Swing de cima para baixo | Vem baixa e mais lenta |
| Lob | Swing suave para cima | Sobe e passa por cima do adversário |

### Tela do celular

S3: calibração, menu (Parede, Treino com alvos, Rally CPU (demo), Testar golpes, Recalibrar) e jogo (força e timing do último golpe; Menu e Recalibrar). O celular vibra no acerto.

Cor do jogador: [a definir] (S5). Botão de recentralizar: não implementado na S3.

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

Feita na entrada, por jogador, conduzida pelo celular e espelhada no PC (implementada na S3):

1. **Mão** — destro ou canhoto.
2. **3 forehands** — moldes da direção do giro. Se um destoar muito dos outros, é descartado e repetido.
3. **3 backhands** — com uma pausa para trocar de posição. Um backhand parecido demais com algum forehand é descartado e repetido.
4. **Um forehand forte e um fraco** — limiares de força do aparelho. Se o forte não for ao menos 1,4 × o fraco, refaz.

Antes de cada golpe o jogador fica parado; o PC mostra "Agora!" e só então o golpe conta (evita contar a volta do braço). O perfil fica salvo no celular.

No jogo: força = 0,2 + 0,8 × (pico − fraco) / (forte − fraco), entre 0,05 e 1; o swing só dispara acima de 70% do pico fraco (limitado a 250–380 °/s). Valores iniciais.

## Modos

Todos usam o mesmo sistema de golpe.

| Modo | Como funciona |
|---|---|
| **Partida rápida** | Single contra a CPU, ou 1v1 com tela dividida |
| **Treino com alvos** | Alvos na quadra; acertar com a força e a direção certas. Serve de tutorial |
| **Paredão** | Rebater contra a parede enquanto a bola acelera; objetivo: bater o recorde |
| **Torneio** | Chave contra 3 ou 4 CPUs com estilos diferentes: sacador, defensor, jogador de rede |

Estado na S3:

- **Parede** (modo livre): parede atrás da quadra adversária; a bola volta passando a rede e chegando na altura da raquete. O rally acaba com dois quiques do lado do jogador, bola na rede, por cima ou fora da parede, ou parada. Recorde e aceleração ficam para o Paredão (S4).
- **Treino com alvos**: uma máquina de bolas e 5 lições, 3 acertos por lição:
  1. No tempo: faixa central, qualquer força.
  2. Bola curta: área central até a linha de saque, golpe fraco.
  3. Bola funda: anel de 1,2 m perto do fundo, golpe forte.
  4. Cruzada: faixa lateral, adiantado, qualquer força.
  5. Paralela: faixa lateral, atrasado, qualquer força.

  A bola muda de cor conforme o timing que o golpe teria (azul = adiantado, verde = no tempo, laranja = atrasado), e uma régua mostra onde caiu cada golpe.
- **Rally CPU (demo)**: a CPU da S2, que não erra; vira a CPU básica na S4.

- Formato da partida: curto, [a definir].
- Conexão por QR code ou código de sala.

## Tela

- **Single:** tela inteira, câmera atrás do jogador, contra a CPU.
- **1v1:** tela dividida, P1 à esquerda e P2 à direita (P13). Cada um vê a quadra de trás do seu personagem. Placar compartilhado no centro.

## Em aberto

- Formato e duração da partida.
- Regras de pontuação simplificadas ou completas: [a definir].
- Curva da força: no playtest da S3 (1 jogador), a força média foi difícil de alcançar (o golpe normal saía "Forte"). Ajuste da curva ou da calibração: [a definir].
- Saque: como é feito com o celular: [a definir].
