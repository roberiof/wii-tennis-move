# ADR 0003 — AirConsole condicionado ao POC 01

- **Status:** condicionada — aguarda resultado do [POC 01](../../pocs/poc-01-sensores/README.md)
- **Registrada em:** 2026-10-12

## Contexto

O professor sugeriu o AirConsole. Ele resolve conexão, código de sala, sensores e relógio sincronizado sem servidor próprio (ver [`../03-airconsole.md`](../03-airconsole.md)). Mas o SDK não lê o sensor: só repassa o que a plataforma envia, e não está verificado com que frequência nem se `alpha, beta, gamma` são velocidade ou ângulo. A API antiga recomendava 100 ms entre amostras, possivelmente pouco para um swing.

## Decisão

- Usar o AirConsole como camada de conexão e sensores **se** passar nos critérios do POC 01 (taxa de amostras, natureza dos dados, latência, distinção de lado, iPhone e Android).
- Se não passar, **plano B**: servidor Node com WebSocket (Socket.IO), hospedado em São Paulo, e controle por HTTPS com `DeviceMotionEvent`.
- Em qualquer caso, a conexão fica atrás de uma interface própria (`sendSwing` / `onSwing`) desde o início.

## Alternativas consideradas

- **Adotar o AirConsole sem testar** — arrisca descobrir na S3 que o sensor não serve.
- **Ir direto para o plano B** — perde sala, código, simulador e relógio prontos; ignora a sugestão do professor sem dado que justifique.
- **AirConsole para conexão + `devicemotion` nativo no controller** — testado na etapa 2 do POC; depende de o navegador liberar o sensor dentro do iframe.

## Consequências

- A S1 é dedicada ao POC e termina com esta decisão. Ao concluir, atualizar este ADR para `aceita` (com o caminho escolhido) ou abrir um novo ADR que o substitua.
- A interface `sendSwing` / `onSwing` é obrigatória mesmo se o AirConsole passar, para manter o plano B barato (risco de dependência do serviço na demo).
- Se o AirConsole for adotado: tratar anúncios da versão gratuita (`onAdShow`) e testes em rede da universidade com túnel.
