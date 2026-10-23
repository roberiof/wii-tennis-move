# Jogo — Wii Tennis Move

Implementação principal do jogo de tênis no navegador. O PC renderiza a cena 3D e a física, enquanto o celular de cada jogador atua como raquete via sensores de movimento integrados à API do AirConsole.

## Estado Atual (Entrega S2)

A entrega da **Semana 2 (S2)** está implementada:
- **Quadra 3D Oficial:** Piso interno e externo com linhas de demarcação oficiais e rede 3D com postes metálicos e malha translúcida ([`src/screen/court.ts`](src/screen/court.ts)).
- **Física da Bola 3D Própria:** Gravidade arcade, quique com restituição e atrito, colisão com a rede e sombra projetada dinâmica ([`src/screen/physics.ts`](src/screen/physics.ts)).
- **Personagens Frutiger Aero (Estilo Windows Live Messenger / WLM 2012):** 
  - Corpo arredondado em gota e cabeça esférica perfeitamente lisa e flutuante, sem membros ou feições faciais ([`src/screen/character.ts`](src/screen/character.ts)).
  - Material translúcido, glossy com alto *clearcoat* e brilho característico do estilo Frutiger Aero.
  - Raquete 3D estilizada flutuando ao lado do corpo com animação de arco de rotação durante o golpe.
- **Movimento Automático:** O jogador e a CPU correm sozinhos até a bola ("personagem corre sozinho até a bola", premissa P11), antecipando a trajetória e inclinando o corpo no sentido do movimento.
- **Rebatida Generosa (Estilo Wii Sports):**
  - Janela de acerto ampla e buffer de entrada (400 ms) para evitar falsos negativos por jitter de rede.
  - Direção definida por timing (adiantado = cruzada, atrasado = paralela).
  - Suporte a teclado no PC (`ESPAÇO` para Forehand, `Z` para Backhand, ou clique do mouse) para depuração sem celular.
- **Controle Mobile Limpo ([`controller.html`](controller.html)):**
  - Leitura contínua dos sensores via `onDeviceMotion` com rotação angular derivada.
  - Interface estável sem botões suscetíveis a bloqueio de iframe do navegador.
  - Feedback visual de força e vibração háptica (`vibrate`).

## Estrutura de Arquivos

| Arquivo / Pasta | Descrição |
|---|---|
| `screen.html` | Tela principal do jogo (PC) com Three.js e UI overlay |
| `controller.html` | Tela da raquete do jogador (Mobile) |
| `src/screen/court.ts` | Construção da quadra 3D e rede |
| `src/screen/character.ts` | Modelo do personagem WLM Frutiger Aero e animações |
| `src/screen/physics.ts` | Física da bola de tênis (gravidade, quique, rede) |
| `src/screen/main.ts` | Loop do jogo, IA da CPU, rebatidas e câmera dinâmica |
| `src/controller/main.ts` | Processamento dos sensores no celular e envio do swing |
| `src/shared/messages.ts` | Contratos tipados de mensagens entre controller e tela |

## Como Rodar

1. **Instalar dependências (uma vez):**
   ```bash
   cd game
   npm install
   ```

2. **Iniciar servidor e túnel:**
   - **Terminal 1:** `npm start` (inicia o preview na porta 4173)
   - **Terminal 2:** `npm run tunnel` (inicia o túnel HTTPS do cloudflared)

3. **Abrir no PC:**
   Acessar no navegador:
   `https://www.airconsole.com/simulator/#debug:https://<SEU_TUNEL>.trycloudflare.com/`

4. **Conectar no Celular:**
   Abrir `airconsole.com` no Chrome mobile e inserir o código de sala exibido na tela do PC.
