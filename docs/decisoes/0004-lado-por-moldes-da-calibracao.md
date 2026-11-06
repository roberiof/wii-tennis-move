# ADR 0004 — Lado (forehand/backhand) lido por moldes da calibração

- **Status:** aceita (S3)
- **Registrada em:** 2026-11-06
- **Revê:** o detalhe "sentido da rotação decide o lado" do [ADR 0002](0002-celular-como-raquete-por-movimento.md)

## Contexto

O ADR 0002 previa o lado pelo sentido da rotação (sinal do eixo dominante), com calibração de um forehand. No playtest da S3, essa leitura confundiu forehand e backhand durante o jogo. Para comparar alternativas, a S3 criou um **modo de teste** no celular: o jogador declara a série (forehand ou backhand), fica parado entre golpes e o celular conta quantos golpes foram classificados como o lado declarado.

Medições (1 pessoa, iPhone 16, 5–6/nov/2026; ver P2 em [`../04-premissas.md`](../04-premissas.md)):

| Versão | Forehand | Backhand | Total |
|---|---|---|---|
| 1 molde por lado | 21/22 (95%) | 16/22 (73%) | 37/44 (84%) |
| Pose da mão antes do golpe | 22/22 | 5/22 (23%) | 27/44 (61%) |
| 3 moldes por lado, o mais parecido (duas rodadas somadas) | 41/43 (95%) | 38/43 (88%) | 79/86 (92%) |

## Decisão

- A calibração grava **3 forehands e 3 backhands**. Cada molde é a direção do giro do golpe (soma dos vetores de velocidade angular ao longo do swing, normalizada).
- No jogo, o lado é o do **molde mais parecido** (cosseno), entre os 6.
- Descartes na calibração: um forehand que destoe dos outros dois (cosseno < 0,6 com a média deles) e um backhand parecido demais com algum forehand (cosseno ≥ 0,8) são repetidos.
- O celular envia a **margem** (semelhança com o forehand mais parecido − com o backhand mais parecido). Com abs(margem) < 0,3, a tela não pune "lado errado" (benefício da dúvida).
- Valores iniciais, em `game/src/controller/calibration.ts` e `game/src/screen/tuning.ts`.

## Alternativas consideradas

- **1 molde por lado:** 84%; backhand em 73%.
- **Média dos 3 golpes por lado:** pior na impressão do jogador (~50%); não medida com o modo de teste.
- **Pose da mão antes do golpe:** 61%, viciada em "forehand". Descartada.
- **Lado automático** (plano B do ADR 0002): continua disponível se a leitura não se sustentar em outros aparelhos.

## Consequências

- A calibração ficou mais longa: mão, 3 forehands, 3 backhands, forte e fraco, com pausas para ficar parado e trocar de posição.
- O backhand é o lado mais fraco (88%). O efeito do benefício da dúvida não foi medido.
- Falta medir em Android e com mais pessoas. A diferença entre 73% e 86% (1ª rodada) no backhand é tendência (p ≈ 0,26, n = 22), não prova.
