# Wii Tennis Move

Tênis no navegador. **O celular é a raquete.**

Projeto da cadeira de Jogos Digitais, UFPE/CIn, semestre 2026.2. O jogo roda no navegador do PC; cada jogador usa o próprio celular como raquete, e os sensores do celular transformam o gesto em golpe.

## Equipe (5 integrantes)

- Antonio Robério Barreto Oliveira Filho
- Eric Bezerra Londres Barreto
- Gabriel Ayres
- Mateus Henrique Ataide de Lima
- Toni Cabral Amorim

## Estado atual

- **POC 01 (Sensores e Latência):** Validado em Android real (Samsung Galaxy A54). O AirConsole entrega leitura 1:1 de forehand/backhand com velocidade derivada; corrigidos bugs de timeout do detector e instabilidade com sensores nativos em iframes ([`pocs/poc-01-sensores/`](pocs/poc-01-sensores/)).
- **Jogo — Entrega S2 Concluída ([`game/`](game/)):** Quadra 3D oficial, física da bola (gravidade, quique, rede), personagens Frutiger Aero inspirados no avatar clássico do Windows Live Messenger (WLM 2012) com raquete flutuante, movimento automático até a bola e rebatidas estilo arcade com buffer de entrada.

## Como navegar

| Pasta / arquivo | Conteúdo |
|---|---|
| [`game/`](game/) | O jogo em Three.js (S2 concluída: quadra, física, personagens Frutiger Aero e IA) |
| [`pocs/poc-01-sensores/`](pocs/poc-01-sensores/) | Prova de conceito de sensores e latência com resultados de medição |
| [`docs/00-contexto.md`](docs/00-contexto.md) | Visão consolidada: projeto, equipe, prazo, feedback do professor |
| [`docs/01-game-design.md`](docs/01-game-design.md) | Conceito, controles, swing, modos, calibração |
| [`docs/02-plano-de-projeto.md`](docs/02-plano-de-projeto.md) | Stack, arquitetura, cronograma, riscos |
| [`docs/03-airconsole.md`](docs/03-airconsole.md) | Pesquisa sobre o AirConsole: verificado x não verificado |
| [`docs/04-premissas.md`](docs/04-premissas.md) | Premissas P1–P14 com status e como validar |
| [`docs/decisoes/`](docs/decisoes/) | Registros de decisão (ADR) |
| [`docs/slides/`](docs/slides/) | Apresentações da cadeira |
| [`CLAUDE.md`](CLAUDE.md) | Instruções para agentes de IA que trabalham no repositório |

## Uso de IA

O time usa agentes de IA no desenvolvimento. Este repositório é a fonte de contexto deles: toda decisão, premissa e resultado de POC deve estar registrado em `docs/` ou no README do POC, não só em conversas.

