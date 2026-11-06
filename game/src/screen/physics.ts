import * as THREE from "three";
import type { Point2, Point3 } from "./shot";
import { TUNING } from "./tuning";

export const GRAVITY = -11.5; // m/s² (um pouco mais ágil para sensação de arcade de tênis)
export const BALL_RADIUS = 0.14;
export const NET_HEIGHT = 1.0;
const NET_HALF_WIDTH = 5.8;
/** No quique: vy × −GROUND_RESTITUTION; vx e vz × GROUND_FRICTION. */
export const GROUND_RESTITUTION = 0.78;
export const GROUND_FRICTION = 0.92;

export type Hitter = "player" | "cpu" | "wall" | "machine";

export interface Velocity {
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Velocidade para a bola sair de `from` e quicar em `target`, com velocidade horizontal `hSpeed`.
 * Se a trajetória não passar a rede com folga, alonga o tempo de voo (bola mais alta e lenta).
 * Exata para a integração de TennisBall.update (gravidade constante, sem arrasto).
 */
export function aimShot(from: Point3, target: Point2, hSpeed: number, netClearance = 0.3): Velocity {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dist = Math.hypot(dx, dz);
  const crossesNet = from.z * target.z < 0;
  let T = Math.max(dist / hSpeed, 0.2);
  let v: Velocity = { vx: 0, vy: 0, vz: 0 };
  for (let i = 0; i < 60; i++) {
    v = { vx: dx / T, vy: (BALL_RADIUS - from.y - 0.5 * GRAVITY * T * T) / T, vz: dz / T };
    if (!crossesNet) break;
    const tNet = (from.z / (from.z - target.z)) * T;
    const yNet = from.y + v.vy * tNet + 0.5 * GRAVITY * tNet * tNet;
    if (yNet >= NET_HEIGHT + netClearance) break;
    T *= 1.05;
  }
  return v;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Cruzamento do plano da parede (bola indo para −z), com o ponto exato e se acertou a parede. */
export interface WallCrossing {
  point: Point3;
  /** Dentro da largura e abaixo do topo: a bola volta. Senão, passou pela parede (fora / por cima). */
  inside: boolean;
}

/** Plano em que o centro da bola encosta na face da parede. */
export const WALL_CONTACT_Z = TUNING.wallZ + BALL_RADIUS;

export function wallCrossing(prev: Point3, cur: Point3): WallCrossing | null {
  if (!(prev.z > WALL_CONTACT_Z && cur.z <= WALL_CONTACT_Z)) return null;
  const f = (prev.z - WALL_CONTACT_Z) / (prev.z - cur.z);
  const point = { x: prev.x + f * (cur.x - prev.x), y: prev.y + f * (cur.y - prev.y), z: WALL_CONTACT_Z };
  return { point, inside: Math.abs(point.x) <= TUNING.wallHalfWidth && point.y <= TUNING.wallHeight };
}

/** Altura com que a bola lançada com `v` de `from` cruza a linha de contato, após quicar em `bounceZ`. */
function heightAtContact(from: Point3, bounceZ: number, v: Velocity): number {
  const T = (bounceZ - from.z) / v.vz;
  const vyUp = -GROUND_RESTITUTION * (v.vy + GRAVITY * T);
  const t = (TUNING.contactZ - bounceZ) / (v.vz * GROUND_FRICTION);
  return BALL_RADIUS + vyUp * t + 0.5 * GRAVITY * t * t;
}

/**
 * Bola jogável para o jogador, saindo de `from` (lado de lá) com velocidade `vz` em z: passa a rede e quica
 * do lado do jogador onde chega à linha de contato perto da altura de rebatida (wallContactY).
 * `bounceX(z, T)` diz o x do quique para um quique em z, alcançado em T segundos.
 */
export function playableShot(from: Point3, vz: number, bounceX: (z: number, T: number) => number): Velocity {
  let best: Velocity | null = null;
  let bestErr = Infinity;
  for (let z = TUNING.wallBounceMinZ; z <= TUNING.wallBounceMaxZ + 1e-9; z += 0.25) {
    const T = (z - from.z) / vz;
    const x = bounceX(z, T);
    const s = aimShot(from, { x, z }, Math.hypot(x - from.x, z - from.z) / T, TUNING.netClearance);
    const err = Math.abs(heightAtContact(from, z, s) - TUNING.wallContactY);
    if (err < bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best!;
}

/**
 * Volta da parede, a partir do ponto de contato e da velocidade de chegada.
 * Horizontal como reflexão: vz = abs(vz) × restituição, limitado a [wallMinSpeed, wallMaxSpeed]; vx amortecido.
 * Vertical escolhida para a volta ser jogável (playableShot). Uma reflexão pura cairia na rede.
 */
export function wallReturn(hit: Point3, v: Velocity): Velocity {
  const vz = clamp(Math.abs(v.vz) * TUNING.wallRestitution, TUNING.wallMinSpeed, TUNING.wallMaxSpeed);
  const vx = v.vx * TUNING.wallSideDamp;
  return playableShot(hit, vz, (_z, T) => clamp(hit.x + vx * T, -TUNING.wallReturnMaxX, TUNING.wallReturnMaxX));
}

export interface BallStep {
  bounced: boolean;
  netHit: boolean;
  /** Ponto exato do quique (interpolado), quando houve. */
  bounce: Point2 | null;
}

const BALL_COLOR = 0xd4ff00; // Amarelo clássico de bola de tênis
const BALL_EMISSIVE = 0x668800;

export class TennisBall {
  public mesh: THREE.Mesh;
  public shadow: THREE.Mesh;

  public x = 0;
  public y = 1.5;
  public z = 8.0;

  public vx = 0;
  public vy = 0;
  public vz = 0;

  public readonly radius = BALL_RADIUS;
  private gravity = GRAVITY;
  private bounceRestitution = GROUND_RESTITUTION;
  private groundFriction = GROUND_FRICTION;

  public lastHitter: Hitter | null = null;
  public bounceCount = 0;

  constructor() {
    // Bola de tênis amarela brilhante Frutiger Aero
    const geo = new THREE.SphereGeometry(this.radius, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: BALL_COLOR,
      roughness: 0.35,
      metalness: 0.05,
      emissive: BALL_EMISSIVE,
      emissiveIntensity: 0.1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;

    // Sombra dinâmica da bola no chão
    const shadowGeo = new THREE.CircleGeometry(this.radius * 1.2, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.015;

    this.updateMesh();
  }

  public serve(fromPlayer = true) {
    this.bounceCount = 0;
    if (fromPlayer) {
      this.x = (Math.random() - 0.5) * 2;
      this.y = 1.4;
      this.z = 8.5;
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = 4.2;
      this.vz = -13.5;
      this.lastHitter = "player";
    } else {
      this.x = (Math.random() - 0.5) * 2;
      this.y = 1.4;
      this.z = -8.5;
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = 4.2;
      this.vz = 13.5;
      this.lastHitter = "cpu";
    }
  }

  public hit(power: number, side: 1 | -1, hitter: "player" | "cpu", targetX?: number) {
    this.lastHitter = hitter;
    this.bounceCount = 0;

    const clampedPower = Math.max(0.4, Math.min(power, 1.0));
    const baseSpeed = 12 + clampedPower * 9; // 12 a 21 m/s

    if (hitter === "player") {
      this.vz = -baseSpeed;
      this.vy = 3.6 + clampedPower * 1.8;
      // Direção lateral: se passar targetX, mira lá, senão usa o lado forehand/backhand
      if (targetX !== undefined) {
        this.vx = targetX * 0.4;
      } else {
        this.vx = side * (1.5 + clampedPower * 2.5);
      }
    } else {
      // CPU rebatendo
      this.vz = baseSpeed;
      this.vy = 3.6 + clampedPower * 1.6;
      this.vx = (Math.random() - 0.5) * 4.5;
    }
  }

  /** Lança a bola de `from` com a velocidade dada (golpe do jogador ou volta da parede). */
  public launch(from: Point3, v: Velocity, hitter: Hitter) {
    this.x = from.x;
    this.y = from.y;
    this.z = from.z;
    this.vx = v.vx;
    this.vy = v.vy;
    this.vz = v.vz;
    this.lastHitter = hitter;
    this.bounceCount = 0;
    this.updateMesh();
  }

  /** Pinta a bola (indicação de timing no treino); null = cor normal. */
  public setColor(hex: number | null) {
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    m.color.setHex(hex ?? BALL_COLOR);
    m.emissive.setHex(hex ?? BALL_EMISSIVE);
    m.emissiveIntensity = hex === null ? 0.1 : 0.45;
  }

  public update(dt: number): BallStep {
    let bounced = false;
    let netHit = false;
    let bounce: Point2 | null = null;

    // 1. Posição exata para gravidade constante (independe do FPS; aimShot conta com isso)
    const prevX = this.x;
    const prevY = this.y;
    const prevZ = this.z;
    this.x += this.vx * dt;
    this.y += this.vy * dt + 0.5 * this.gravity * dt * dt;
    this.z += this.vz * dt;
    this.vy += this.gravity * dt;

    // 2. Colisão com a rede (em Z = 0), avaliada no ponto em que a bola cruza o plano
    if ((prevZ < 0 && this.z >= 0) || (prevZ > 0 && this.z <= 0)) {
      const f = prevZ / (prevZ - this.z);
      const xAt = prevX + f * (this.x - prevX);
      const yAt = prevY + f * (this.y - prevY);
      if (Math.abs(xAt) <= NET_HALF_WIDTH && yAt <= NET_HEIGHT) {
        // Bateu na rede!
        netHit = true;
        this.vz = -this.vz * 0.25; // rebate fraco para trás
        this.vx *= 0.5;
        this.z = prevZ; // trava na frente da rede
      }
    }

    // 3. Colisão com o chão (quique)
    if (this.y <= this.radius) {
      if (Math.abs(this.vy) > 1.0) {
        // Ponto exato em que a bola tocou o chão dentro deste passo
        const drop = prevY - this.y;
        const f = drop > 0 ? Math.max(0, prevY - this.radius) / drop : 0;
        bounce = { x: prevX + f * (this.x - prevX), z: prevZ + f * (this.z - prevZ) };
        this.vy = -this.vy * this.bounceRestitution;
        this.vx *= this.groundFriction;
        this.vz *= this.groundFriction;
        bounced = true;
        this.bounceCount++;
      } else {
        this.vy = 0;
      }
    }

    if (this.y < this.radius) this.y = this.radius;

    this.updateMesh();
    return { bounced, netHit, bounce };
  }

  private updateMesh() {
    this.mesh.position.set(this.x, this.y, this.z);

    // Atualiza sombra no chão (diminui e fica mais suave conforme a bola sobe)
    this.shadow.position.set(this.x, 0.015, this.z);
    const heightFactor = Math.max(0.2, 1.0 - (this.y - this.radius) / 4.0);
    this.shadow.scale.set(heightFactor, heightFactor, heightFactor);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 * heightFactor;
  }
}
