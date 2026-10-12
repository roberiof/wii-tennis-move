# 03 — AirConsole: pesquisa

Estado da pesquisa no momento do handoff. **Verificado** = lido na documentação ou no código-fonte listados abaixo. **Não verificado** = o POC 01 precisa responder. Nada aqui foi medido pelo time ainda.

## Fontes

- [developers.airconsole.com](https://developers.airconsole.com/)
- [API JS v1.11.0](https://airconsole.github.io/airconsole-api/)
- [Testing your game](https://developers.airconsole.com/testing-your-game)
- [Best practices](https://developers.airconsole.com/best-practices)
- [Best Practices for Web Games on AirConsole](https://developers.airconsole.com/best-practices-for-web-games-on-airconsole)
- [Código-fonte da API](https://github.com/AirConsole/airconsole-api/)

## Verificado

| Tema | O que a doc diz |
|---|---|
| Estrutura do jogo | Um jogo AirConsole é um `screen.html` (PC) e um `controller.html` (celular) na raiz da URL do jogo, trocando mensagens com `message(device_id, data)` / `onMessage` |
| Sensores | Opção `device_motion` (intervalo em ms) no construtor → `onDeviceMotion(data)` com `data.x, y, z` (acelerômetro) e `data.alpha, beta, gamma` (giroscópio). Só nos controles. A doc recomenda esse método porque alguns navegadores bloqueiam sensores dentro do iframe do jogo |
| Relógio | `synchronize_time: true` no construtor + `getServerTime()` após `onReady` |
| Jogadores | `setActivePlayers(n)` + `convertDeviceIdToPlayerNumber`. Nunca usar `device_id` como número de jogador |
| Feedback e recordes | `vibrate(ms)` no controle. `storeHighScore` / `requestHighScores` existem |
| Latência | A doc pede latência de input < 100 ms e recomenda timestamps e compensação de lag para input sensível a tempo |
| Simulador | `http://http.airconsole.com/simulator/#debug:<IP_LOCAL>` (http) ou `https://www.airconsole.com/simulator/#debug:<URL_HTTPS>`. Mostra a tela e dois controles |
| Celular real | Entra pelo código em airconsole.com. No celular, nunca usar `localhost` |
| Rede da universidade | Com isolamento de clientes, a doc recomenda ngrok ou Cloudflare Tunnel |
| Custo | Gratuito para desenvolver. A versão gratuita para jogadores tem anúncios; `onAdShow` existe (pausar som nele) |

## Não verificado (o POC 01 precisa responder)

| Pergunta | Por que importa | Etapa do POC |
|---|---|---|
| Frequência real do `onDeviceMotion` | O SDK **não lê o sensor**: só repassa ao `onDeviceMotion` o que a plataforma envia por `postMessage`. A frequência é decidida pela plataforma e não aparece no código público | 1 |
| Intervalos menores que 100 ms são respeitados? | A API v1.3.0 documentava **100 ms** como valor recomendado (10 Hz), possivelmente pouco para um swing de frações de segundo. Não sabemos se 16 ms é respeitado | 1 |
| Significado de `alpha, beta, gamma` | Ângulo de orientação ou velocidade de rotação (graus/s)? Decidido pela plataforma, não aparece no código público | 1 |
| `devicemotion` nativo dentro do iframe do controle | Funciona no app e no navegador, em iOS e Android? | 2 |
| Latência real celular → PC | Meta da doc é < 100 ms; não medido | 4 |

## Inferência a confirmar no POC

- **Caminho do script da API.** A doc cita `https://www.airconsole.com/api/airconsole-1.11.0.js` como padrão de nome de versões anteriores e `airconsole-latest.js` em exemplos. Verificar qual carrega.

## Não confirmado

- "Smoots Air Tennis", citado pelo professor como referência de tênis no AirConsole: não conseguimos confirmar que existe.
