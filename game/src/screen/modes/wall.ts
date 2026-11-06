// Modo Parede (modo livre): o jogador bate contra uma parede atrás da quadra adversária e a bola volta.
// Fim do rally: dois quiques do lado do jogador, bola na rede, por cima/fora da parede ou bola parada.

import * as THREE from "three";
import { BALL_RADIUS, wallCrossing, wallReturn, WALL_CONTACT_Z, type TennisBall } from "../physics";
import { TUNING } from "../tuning";
import type { Mode, ModeContext } from "./mode";

/** Pausa entre o fim de um rally e a próxima bola (ms). */
export const NEXT_BALL_MS = 1300;
/** Velocidade de chegada simulada para a bola nova: sai da parede com a volta mais lenta. */
const FEED_VZ = -TUNING.wallMinSpeed / TUNING.wallRestitution;

function createWallMesh() {
  const group = new THREE.Group();
  const w = TUNING.wallHalfWidth * 2;
  const h = TUNING.wallHeight;
  const depth = 0.3;
  const z = TUNING.wallZ - depth / 2;

  const material = new THREE.MeshStandardMaterial({
    color: 0xe9f7ff, roughness: 0.4, metalness: 0.05, emissive: 0x00c3ff, emissiveIntensity: 0,
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
  wall.position.set(0, h / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Faixa no topo, para o limite "por cima" ficar visível
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.12, depth + 0.05),
    new THREE.MeshStandardMaterial({ color: 0x00a8e8, roughness: 0.3 }),
  );
  band.position.set(0, h, z);
  group.add(band);
  return { group, material };
}

function stopped(ball: TennisBall): boolean {
  return ball.y <= BALL_RADIUS + 0.01 && Math.abs(ball.vy) < 0.2 && Math.hypot(ball.vx, ball.vz) < 1;
}

export function createWallMode(ctx: ModeContext): Mode {
  const { ball } = ctx;
  const mesh = createWallMesh();
  let rally = 0;
  let ending: ReturnType<typeof setTimeout> | null = null;
  let flash = 0;

  /** Bola nova: sai da parede em direção ao jogador. */
  function feed() {
    const from = { x: (Math.random() - 0.5) * 3, y: 1.2, z: WALL_CONTACT_Z };
    ball.launch(from, wallReturn(from, { vx: 0, vy: 0, vz: FEED_VZ }), "wall");
    ctx.newBall();
  }

  function end(text: string) {
    if (ending) return;
    ctx.feedback(rally > 0 ? `${text} · RALLY ${rally}` : text, "#ff7a45");
    ending = setTimeout(() => {
      ending = null;
      rally = 0;
      ctx.setRally(0);
      feed();
    }, NEXT_BALL_MS);
  }

  return {
    id: "wall",
    start() {
      ctx.scene.add(mesh.group);
      rally = 0;
      ctx.setRally(0);
      feed();
    },
    update(dt, _now, prev) {
      flash = Math.max(0, flash - dt * 3);
      mesh.material.emissiveIntensity = flash * 0.6;
      if (ending) return;

      const hit = wallCrossing(prev, ball);
      if (hit) {
        if (!hit.inside) return end(hit.point.y > TUNING.wallHeight ? "POR CIMA DA PAREDE" : "FORA");
        ball.launch(hit.point, wallReturn(hit.point, ball), "wall");
        ctx.newBall();
        flash = 1;
        return;
      }
      if (Math.abs(ball.x) > 8 || ball.z > 15) return end("FORA");
      if (stopped(ball)) end("BOLA PAROU");
    },
    onShot() {
      if (ending) return;
      rally++;
      ctx.setRally(rally);
    },
    onBounce(b) {
      if (b.half === "player" && b.count >= 2 && ball.lastHitter === "wall") end("DOIS QUIQUES");
    },
    onNet() {
      end("NA REDE");
    },
    stop() {
      if (ending) clearTimeout(ending);
      ending = null;
      ctx.scene.remove(mesh.group);
    },
  };
}
