import * as THREE from "three";

export interface CharacterConfig {
  color: number;       // Cor principal (ex.: 0x00d2ff ciano ou 0x76b900 verde MSN)
  isCpu?: boolean;
}

export class Character {
  public group: THREE.Group;
  public racketGroup: THREE.Group;
  public head: THREE.Mesh;
  public body: THREE.Mesh;
  public shadow: THREE.Mesh;

  private isSwinging = false;
  private swingProgress = 0;
  private swingSide: 1 | -1 = 1;
  private swingDuration = 0.28; // segundos

  private idleTime = Math.random() * 10;
  private targetX = 0;
  private targetZ = 0;
  private runSpeed = 10.5; // m/s velocidade de corrida automática
  public isCpu: boolean;

  constructor(config: CharacterConfig) {
    this.isCpu = !!config.isCpu;
    this.group = new THREE.Group();

    // Material Frutiger Aero / MSN 2012 (Glossy, translúcido com brilho suave e clearcoat)
    const aeroMaterial = new THREE.MeshPhysicalMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.15,
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.25, // Leve efeito de vidro / acrílico translúcido Frutiger Aero
      ior: 1.4,
    });

    // 1. Cabeça (esfera perfeitamente redonda e flutuante)
    const headGeo = new THREE.SphereGeometry(0.38, 32, 32);
    this.head = new THREE.Mesh(headGeo, aeroMaterial);
    this.head.position.y = 1.75;
    this.head.castShadow = true;
    this.group.add(this.head);

    // 2. Corpo (tronco arredondado estilo gota / elipsoide MSN)
    const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
    bodyGeo.scale(0.9, 1.25, 0.75); // Formato de gota/feijão fofo
    this.body = new THREE.Mesh(bodyGeo, aeroMaterial);
    this.body.position.y = 1.05;
    this.body.castShadow = true;
    this.group.add(this.body);

    // 3. Raquete flutuante (sem braços)
    this.racketGroup = new THREE.Group();
    this.buildRacket(config.color);
    // Posição inicial: flutuando ao lado direito
    this.racketGroup.position.set(0.7, 1.15, 0.2);
    this.group.add(this.racketGroup);

    // 4. Sombra suave no chão
    const shadowGeo = new THREE.PlaneGeometry(1.2, 1.0);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.group.add(this.shadow);
  }

  private buildRacket(accentColor: number) {
    // Cabo da raquete
    const handleGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.45, 16);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.22;
    handle.castShadow = true;
    this.racketGroup.add(handle);

    // Aro da cabeça da raquete (elipse/toro)
    const rimGeo = new THREE.TorusGeometry(0.24, 0.022, 16, 32);
    rimGeo.scale(1.0, 1.35, 1.0);
    const rimMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.2, metalness: 0.3 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.68;
    rim.castShadow = true;
    this.racketGroup.add(rim);

    // Cordas da raquete (disco semitransparente com textura de grade)
    const stringsGeo = new THREE.CircleGeometry(0.22, 16);
    stringsGeo.scale(0.95, 1.3, 1.0);
    const stringsMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const strings = new THREE.Mesh(stringsGeo, stringsMat);
    strings.position.y = 0.68;
    this.racketGroup.add(strings);

    // Rotação natural da raquete em descanso
    this.racketGroup.rotation.z = -0.3;
    this.racketGroup.rotation.y = 0.2;
  }

  public setTargetPosition(x: number, z: number) {
    this.targetX = x;
    this.targetZ = z;
  }

  public triggerSwing(side: 1 | -1 = 1) {
    this.isSwinging = true;
    this.swingProgress = 0;
    this.swingSide = side;
  }

  public update(dt: number) {
    this.idleTime += dt;

    // 1. Movimento automático suave até a bola (correr até targetX, targetZ)
    const dx = this.targetX - this.group.position.x;
    const dz = this.targetZ - this.group.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.05) {
      const step = Math.min(dist, this.runSpeed * dt);
      this.group.position.x += (dx / dist) * step;
      this.group.position.z += (dz / dist) * step;

      // Inclinação suave do corpo na direção da corrida
      const leanX = (dx / dist) * 0.18;
      const leanZ = (dz / dist) * 0.15;
      this.body.rotation.z = -leanX;
      this.body.rotation.x = leanZ;
      this.head.rotation.z = -leanX * 0.8;
    } else {
      // Retorno suave à postura ereta
      this.body.rotation.z *= 0.9;
      this.body.rotation.x *= 0.9;
      this.head.rotation.z *= 0.9;
    }

    // 2. Levitação sutil (estilo Frutiger Aero / flutuante)
    const hoverY = Math.sin(this.idleTime * 3.5) * 0.04;
    this.head.position.y = 1.75 + hoverY;
    this.body.position.y = 1.05 + hoverY * 0.7;

    // 3. Animação da raquete flutuante
    if (this.isSwinging) {
      this.swingProgress += dt / this.swingDuration;
      if (this.swingProgress >= 1.0) {
        this.isSwinging = false;
        this.swingProgress = 0;
      }
    }

    if (this.isSwinging) {
      // Curva de swing rápida de raquete (arco de forehand ou backhand)
      const p = this.swingProgress;
      const angle = Math.sin(p * Math.PI) * 2.2 * this.swingSide;
      this.racketGroup.rotation.y = (this.isCpu ? Math.PI : 0) + angle;
      this.racketGroup.rotation.z = -0.3 + Math.sin(p * Math.PI) * 0.8;
      this.racketGroup.position.x = (this.swingSide > 0 ? 0.7 : -0.7) + Math.cos(p * Math.PI) * 0.2;
    } else {
      // Postura de espera da raquete
      const naturalX = this.swingSide > 0 ? 0.7 : -0.7;
      this.racketGroup.position.x = naturalX;
      this.racketGroup.position.y = 1.15 + hoverY * 0.9;
      this.racketGroup.rotation.y = this.isCpu ? Math.PI : 0.2;
      this.racketGroup.rotation.z = this.swingSide > 0 ? -0.3 : 0.3;
    }
  }
}
