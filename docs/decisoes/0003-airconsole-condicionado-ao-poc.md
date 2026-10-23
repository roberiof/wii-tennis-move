# ADR 0003 — AirConsole condicionado ao POC 01

- **Status:** aceita — validada com sucesso no POC 01 e adotada na S2
- **Registrada em:** 2026-10-12
- **Atualizada em:** 2026-10-22

## Contexto

O professor sugeriu o AirConsole. Ele resolve conexão, código de sala, sensores e relógio sincronizado sem servidor próprio (ver [`../03-airconsole.md`](../03-airconsole.md)). O POC 01 foi executado para medir a viabilidade real em celulares Android e iOS.

## Decisão

- **Adotar o AirConsole** como camada de conexão e transporte de eventos para o jogo.
- **Implementação do Detector no Controle:** Utilizar `onDeviceMotion` com `device_motion: 16` e rotação derivada (`angleDelta / dt`). O detector opera localmente no celular e emite apenas o evento pontual `{ type: "swing", power, side, t }` para a tela.
- **Observações Técnicas:**
  - Descartada a Etapa 2 (sensores nativos em iframe no Chrome Android), devido a restrições de *Permissions-Policy* do navegador.
  - O detector inclui proteção de timeout (600 ms) para nunca travar em `inSwing = true`.
  - A interface `sendSwing` / `onSwing` continua mantida para desacoplamento.

## Consequências

- O jogo principal foi implementado em `game/` utilizando a API do AirConsole.
- Elimina a necessidade de hospedar e gerenciar servidores WebSocket próprios durante o semestre.
