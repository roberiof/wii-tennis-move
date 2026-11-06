// Rally CPU (demo): a CPU da S2, que nunca erra, do outro lado da rede. Comportamento igual ao de antes da etapa 6;
// o golpe do jogador passa pela resolução nova (timing, direção, força). Vira a "CPU básica" na S4.

import { Character } from "../character";
import type { Mode, ModeContext } from "./mode";

/** Pausa entre o fim do ponto e o próximo saque (ms). */
export const RESET_MS = 1300;
/** Atraso entre o swing da CPU e a bola sair (ms), para casar com a animação. */
const CPU_HIT_DELAY_MS = 70;

export function createCpuDemoMode(ctx: ModeContext): Mode {
  const { ball } = ctx;
  const cpu = new Character({ color: 0x72d600, isCpu: true }); // verde clássico do MSN Messenger
  cpu.group.position.set(0, 0, -9.5);
  cpu.group.rotation.y = Math.PI; // de frente para o jogador
  let rally = 0;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  let hitTimer: ReturnType<typeof setTimeout> | null = null;

  function serve(fromPlayer: boolean) {
    ball.serve(fromPlayer);
    ctx.newBall();
  }

  return {
    id: "cpu-demo",
    start() {
      ctx.scene.add(cpu.group);
      rally = 0;
      ctx.setRally(0);
      serve(true);
    },
    update(dt) {
      // CPU corre até onde a bola vai chegar no campo dela e rebate na zona de golpe
      if (ball.vz < 0) {
        const t = Math.max(0.05, (ball.z - -9.0) / Math.max(1, -ball.vz));
        cpu.setTargetPosition(Math.max(-4.8, Math.min(4.8, ball.x + ball.vx * t)), -9.2);
        if (ball.z <= -7.5 && ball.y < 2.8 && ball.lastHitter === "player" && hitTimer === null) {
          cpu.triggerSwing(Math.random() > 0.5 ? 1 : -1);
          hitTimer = setTimeout(() => {
            hitTimer = null;
            if (ball.lastHitter === "player" && ball.z < -6.8) {
              ball.hit(0.72 + Math.random() * 0.25, 1, "cpu");
              ctx.newBall();
              ctx.feedback("RALLY!", "#72ff00");
            }
          }, CPU_HIT_DELAY_MS);
        }
      } else {
        cpu.setTargetPosition(0, -9.5);
      }
      cpu.update(dt);

      // Fim do ponto: fora, dois quiques ou bola parada → novo saque
      const out = Math.abs(ball.x) > 8.0 || Math.abs(ball.z) > 15.0;
      const dead = ball.bounceCount >= 2 ||
        (ball.y <= ball.radius + 0.01 && Math.abs(ball.vy) < 0.2 && Math.abs(ball.vz) < 1.0);
      if ((out || dead) && resetTimer === null) {
        resetTimer = setTimeout(() => {
          resetTimer = null;
          rally = 0;
          ctx.setRally(0);
          serve(ball.lastHitter === "cpu");
        }, RESET_MS);
      }
    },
    onShot() {
      rally++;
      ctx.setRally(rally);
    },
    onBounce() {},
    onNet() {
      ctx.feedback("NA REDE!", "#ff4444");
    },
    stop() {
      for (const t of [resetTimer, hitTimer]) if (t) clearTimeout(t);
      resetTimer = hitTimer = null;
      ctx.scene.remove(cpu.group);
    },
  };
}
