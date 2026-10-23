# 00 — Contexto

Visão consolidada do projeto. Fontes: documento de handoff do POC (`CONTEXTO_POC_WII_MOVE.md`, não versionado; conteúdo distribuído por `docs/`) e os slides em [`slides/`](slides/).

## Projeto

- Cadeira de **Jogos Digitais**, UFPE/CIn, semestre **2026.2**.
- Prazo: restam **~8 semanas** (contadas a partir do acompanhamento; data exata de entrega `[a definir]`).
- O jogo roda **no navegador do PC**. O controle é o **celular** de cada jogador.
- O time domina **TypeScript/JavaScript**.

## Equipe (5 integrantes)

| Nome | Papel |
|---|---|
| Antonio Robério Barreto Oliveira Filho | [a definir] |
| Eric Bezerra Londres Barreto | [a definir] |
| Gabriel Ayres | [a definir] |
| Mateus Henrique Ataide de Lima | [a definir] |
| Toni Cabral Amorim | [a definir] |

A proposta original (2 de outubro de 2026) citava equipe de quatro; o acompanhamento e o projeto atual já contam com a formação oficial de cinco integrantes com a entrada de Toni Cabral Amorim.

## Histórico

1. **Proposta (2/out/2026)** — [`slides/2026-10-02-proposta.pdf`](slides/2026-10-02-proposta.pdf). "Wii Move" como nome provisório: dois minijogos no PC controlados pelo celular (Flight Simulator e Fruit Ninja), um jogador por vez, nove semanas.
2. **Feedback do professor**:
   - Focar em **um** jogo, em vez de dois minijogos.
   - Sugeriu a plataforma **AirConsole**.
   - Citou um tênis de referência, "Smoots Air Tennis". **Não conseguimos confirmar** que esse jogo existe.
3. **Acompanhamento** — [`slides/acompanhamento.pdf`](slides/acompanhamento.pdf). Resposta à crítica: um jogo de tênis com o celular como raquete; single contra CPU e multiplayer 1v1 com tela dividida. Mantido da proposta: jogo no navegador do PC, conexão por QR code ou código de sala, calibração.
4. **Renomeação (12/out/2026)** — o projeto passa a se chamar **Wii Tennis Move** (repositório `wii-tennis-move`). Os slides da proposta e do acompanhamento ainda usam o nome anterior, "Wii Move".

## Persona

Lucas, 21 anos, universitário (persona fictícia). Quer partidas curtas entre os estudos, regras fáceis e desafios para repetir; joga casuais como Fruit Ninja; tem celular e notebook, mas não tem controle; compara pontuações com os amigos. No acompanhamento: continua jogando sozinho e agora também desafia um amigo, no mesmo notebook, cada um com seu celular, sem instalar nada.

Implicações para o projeto: conexão simples, instruções visuais, comandos responsivos.

## Onde estamos

- Jogo decidido em alto nível ([`01-game-design.md`](01-game-design.md), [ADR 0001](decisoes/0001-um-jogo-tenis.md), [ADR 0002](decisoes/0002-celular-como-raquete-por-movimento.md)).
- Stack e plataforma de conexão **condicionadas ao POC 01** ([ADR 0003](decisoes/0003-airconsole-condicionado-ao-poc.md)).
- A maior incerteza é técnica: se os sensores do celular, entregues pelo AirConsole ou pelo navegador, são bons o bastante para detectar um swing. Ver [`04-premissas.md`](04-premissas.md).

## Divergências conhecidas entre fontes

Registradas para o time resolver; não foram decididas aqui.

| Tema | Slides do acompanhamento | Documento de contexto | Situação |
|---|---|---|---|
| O que define a direção da jogada | "Direção: forehand ou backhand mudam o lado da jogada" | Direção pelo **timing** (adiantado = cruzada, atrasado = paralela); forehand/backhand definem o **lado** do golpe | [a definir] — `01-game-design.md` segue o documento de contexto |
| Entrega da S1 | Conexão celular ↔ PC (sala, QR code) e detector de swing em 2 a 3 celulares | POC 01: sensores e latência, com decisão AirConsole ou plano B | [a definir] — o plano segue o documento de contexto |
| Formato da partida | "Curto, [a definir]" | Não especificado | [a definir] |

