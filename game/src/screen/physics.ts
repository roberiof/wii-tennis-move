import * as THREE from "three";

export class TennisBall {
  public mesh: THREE.Mesh;
  public shadow: THREE.Mesh;

  public x = 0;
  public y = 1.5;
  public z = 8.0;

  public vx = 0;
  public vy = 0;
  public vz = 0;

  public readonly radius = 0.14;
  private gravity = -11.5; // m/s² (um pouco mais ágil para sensação de arcade de tênis)
  private bounceRestitution = 0.78;
  private groundFriction = 0.92;

  public lastHitter: "player" | "cpu" | null = null;
  public bounceCount = 0;

  constructor() {
    // Bola de tênis amarela brilhante Frutiger Aero
    const geo = new THREE.SphereGeometry(this.radius, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd4ff00, // Amarelo clássico de bola de tênis
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0x668800,
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

  public update(dt: number): { bounced: boolean; netHit: boolean } {
    let bounced = false;
    let netHit = false;

    // 1. Aplica gravidade
    this.vy += this.gravity * dt;

    // 2. Atualiza posições
    const prevZ = this.z;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // 3. Colisão com a rede (em Z = 0)
    // A rede está entre -5.8 e +5.8 no eixo X e altura 0 a 1.0 no eixo Y
    if ((prevZ < 0 && this.z >= 0) || (prevZ > 0 && this.z <= 0)) {
      if (Math.abs(this.x) <= 5.8 && this.y <= 1.0) {
        // Bateu na rede!
        netHit = true;
        this.vz = -this.vz * 0.25; // rebate fraco para trás
        this.vx *= 0.5;
        this.z = prevZ; // trava na frente da rede
      }
    }

    // 4. Colisão com o chão (quique)
    if (this.y <= this.radius) {
      this.y = this.radius;
      if (Math.abs(this.vy) > 1.0) {
        this.vy = -this.vy * this.bounceRestitution;
        this.vx *= this.groundFriction;
        this.vz *= this.groundFriction;
        bounced = true;
        this.bounceCount++;
      } else {
        this.vy = 0;
      }
    }

    this.updateMesh();
    return { bounced, netHit };
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
