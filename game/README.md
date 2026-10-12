# Jogo

Ainda não começou. O código do jogo entra aqui **depois do POC 01** ([`pocs/poc-01-sensores/`](../pocs/poc-01-sensores/)), quando a camada de conexão (AirConsole ou plano B) estiver decidida no [ADR 0003](../docs/decisoes/0003-airconsole-condicionado-ao-poc.md).

Estrutura prevista (ver [`docs/02-plano-de-projeto.md`](../docs/02-plano-de-projeto.md#arquitetura)):

| Pasta | Conteúdo |
|---|---|
| `screen/` | Cena, física, regras, CPU, modos |
| `controller/` | Detector, calibração, UI mínima |
| `shared/` | Tipos das mensagens |
| `net/` | Interface de conexão (`sendSwing` / `onSwing`) |
