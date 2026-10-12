# ADR 0001 — Um jogo só: tênis

- **Status:** aceita
- **Registrada em:** 2026-10-12

## Contexto

A proposta de 2/out/2026 tinha dois minijogos (Flight Simulator e Fruit Ninja), um jogador por vez. O professor pediu foco em **um** jogo e citou um tênis de referência no AirConsole ("Smoots Air Tennis", não confirmado).

## Decisão

Fazer um único jogo: **tênis no navegador do PC, com o celular como raquete**. Single contra CPU e multiplayer 1v1 com tela dividida, em quatro modos que compartilham o mesmo sistema de golpe.

## Alternativas consideradas

- **Manter os dois minijogos** — contraria o feedback do professor.
- **Ficar com um dos dois minijogos** (avião ou frutas) — [a definir]: as fontes não registram por que foram descartados em favor do tênis.

## Consequências

- Mantido da proposta: jogo no navegador do PC, conexão por QR code ou código de sala, calibração.
- A profundidade vem do mesmo gesto lido com mais detalhe (força, lado, efeito), não de conteúdo novo.
- O jogo depende de detectar um swing pelo sensor — risco técnico maior que inclinar o celular (usado nos minijogos). Ver [ADR 0002](0002-celular-como-raquete-por-movimento.md).
