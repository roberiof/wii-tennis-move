# ADR 0002 — Celular como raquete, lido por movimento

- **Status:** aceita (conceito). Detalhes de detecção condicionados ao POC 01.
- **Registrada em:** 2026-10-12

## Contexto

No tênis, o jogador precisa sentir que rebate a bola. O celular tem acelerômetro e giroscópio, mas não sabe a própria posição no espaço. A persona (Lucas) não tem controle e quer começar rápido.

## Decisão

- O jogador segura o celular como raquete e faz o gesto. O swing é detectado **no próprio celular** como um pico de rotação + aceleração.
- O celular envia **um evento por golpe** (`{ power, effect, side, t }`), não o sensor bruto. O PC é a única fonte da verdade.
- Timing decide acerto e direção; intensidade decide força; componente vertical decide efeito; sentido da rotação decide o lado (com lado automático como plano B).
- O personagem corre sozinho até a bola.
- Tela do celular mínima: cor do jogador e botão de recentralizar.
- Calibração por jogador na entrada.

## Alternativas consideradas

- **Botões na tela do celular** — mais confiável, mas perde a proposta do jogo (celular como raquete).
- **Enviar o sensor bruto e detectar no PC** — facilita depurar e ajustar, mas aumenta tráfego e sensibilidade a jitter. Ver P5.
- **Ler direção pelo ângulo do pulso** — descartado em favor do timing (P3); o celular não tem referência absoluta de direção.
- **Jogador controla o movimento do personagem** — exigiria um segundo canal de input. Ver P11.

## Consequências

- Depende de P1, P2, P4, P6 e P7 (ver [`../04-premissas.md`](../04-premissas.md)). Se o sensor não der conta, os primeiros cortes são: efeito (P4) e lado por rotação (P2 → lado automático).
- Exige contrato de mensagem compartilhado (`shared/`) entre tela e controle.
- Limiares variam por aparelho, daí a calibração.
