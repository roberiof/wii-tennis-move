# Wii Tennis Move

Tênis no navegador. **O celular é a raquete.**

Projeto da cadeira de Jogos Digitais, UFPE/CIn, semestre 2026.2. O jogo roda no navegador do PC; cada jogador usa o próprio celular como raquete, e os sensores do celular transformam o gesto em golpe.

## Equipe

- Antonio Robério Barreto Oliveira Filho
- Eric Bezerra Londres Barreto
- Gabriel Ayres
- Mateus Henrique Ataide de Lima
- Tony [sobrenome a definir]

## Estado atual

Fase de **POC de sensores** (`pocs/poc-01-sensores/`). O jogo ainda não começou. A adoção do AirConsole depende do resultado do POC (ver [ADR 0003](docs/decisoes/0003-airconsole-condicionado-ao-poc.md)).

## Como navegar

| Pasta / arquivo | Conteúdo |
|---|---|
| [`docs/00-contexto.md`](docs/00-contexto.md) | Visão consolidada: projeto, equipe, prazo, feedback do professor |
| [`docs/01-game-design.md`](docs/01-game-design.md) | Conceito, controles, swing, modos, calibração |
| [`docs/02-plano-de-projeto.md`](docs/02-plano-de-projeto.md) | Stack, arquitetura, cronograma, riscos |
| [`docs/03-airconsole.md`](docs/03-airconsole.md) | Pesquisa sobre o AirConsole: verificado x não verificado |
| [`docs/04-premissas.md`](docs/04-premissas.md) | Premissas P1–P14 com status e como validar |
| [`docs/decisoes/`](docs/decisoes/) | Registros de decisão (ADR) |
| [`docs/slides/`](docs/slides/) | Apresentações da cadeira |
| [`pocs/`](pocs/) | Provas de conceito, uma pasta por POC |
| [`game/`](game/) | O jogo (começa depois do POC 01) |
| [`CLAUDE.md`](CLAUDE.md) | Instruções para agentes de IA que trabalham no repositório |

## Uso de IA

O time usa agentes de IA no desenvolvimento. Este repositório é a fonte de contexto deles: toda decisão, premissa e resultado de POC deve estar registrado em `docs/` ou no README do POC, não só em conversas.
