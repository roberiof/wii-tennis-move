import * as THREE from "three";

export interface CourtBounds {
  length: number; // Z total (~24m)
  width: number;  // X total (~11m)
  netHeight: number;
}

export const COURT_BOUNDS: CourtBounds = {
  length: 24,
  width: 11,
  netHeight: 1.0,
};

export function createCourt(): THREE.Group {
  const courtGroup = new THREE.Group();

  // 1. Piso externo (área de escape verde vibrante Frutiger Aero)
  const outerGeo = new THREE.PlaneGeometry(24, 38);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x228b68, // Verde água / esmeralda Frutiger Aero
    roughness: 0.5,
    metalness: 0.1,
  });
  const outerFloor = new THREE.Mesh(outerGeo, outerMat);
  outerFloor.rotation.x = -Math.PI / 2;
  outerFloor.receiveShadow = true;
  courtGroup.add(outerFloor);

  // 2. Piso interno da quadra (azul ciano brilhante)
  const innerGeo = new THREE.PlaneGeometry(10.97, 23.77);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x1b72a6, // Azul vibrante Frutiger Aero
    roughness: 0.35,
    metalness: 0.15,
  });
  const innerFloor = new THREE.Mesh(innerGeo, innerMat);
  innerFloor.rotation.x = -Math.PI / 2;
  innerFloor.position.y = 0.005; // Levemente acima para evitar z-fighting
  innerFloor.receiveShadow = true;
  courtGroup.add(innerFloor);

  // 3. Linhas brancas da quadra (usando pequenos planos com espessura)
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineWidth = 0.08;

  function addLine(w: number, l: number, x: number, z: number) {
    const geo = new THREE.PlaneGeometry(w, l);
    const line = new THREE.Mesh(geo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.01, z);
    courtGroup.add(line);
  }

  const hw = 10.97 / 2;
  const hl = 23.77 / 2;
  const singleW = 8.23 / 2;
  const serviceL = 6.4;

  // Linhas de fundo (baselines)
  addLine(10.97, lineWidth, 0, -hl);
  addLine(10.97, lineWidth, 0, hl);

  // Linhas laterais externas (duplas)
  addLine(lineWidth, 23.77, -hw, 0);
  addLine(lineWidth, 23.77, hw, 0);

  // Linhas laterais internas (simples)
  addLine(lineWidth, 23.77, -singleW, 0);
  addLine(lineWidth, 23.77, singleW, 0);

  // Linhas de saque (service lines)
  addLine(8.23, lineWidth, 0, -serviceL);
  addLine(8.23, lineWidth, 0, serviceL);

  // Linha central de saque (center line)
  addLine(lineWidth, serviceL * 2, 0, 0);

  // Marcas centrais nas baselines
  addLine(lineWidth, 0.4, 0, -hl + 0.2);
  addLine(lineWidth, 0.4, 0, hl - 0.2);

  // 4. Rede 3D
  const netGroup = new THREE.Group();

  // Postes da rede
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.15, 16);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.8, roughness: 0.2 });
  
  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-hw - 0.3, 0.57, 0);
  leftPost.castShadow = true;
  netGroup.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(hw + 0.3, 0.57, 0);
  rightPost.castShadow = true;
  netGroup.add(rightPost);

  // Malha da rede (grid semitransparente)
  const netMeshGeo = new THREE.PlaneGeometry(10.97 + 0.6, 0.95);
  // Canvas dinâmico para criar padrão de malha
  const netCanvas = document.createElement("canvas");
  netCanvas.width = 64;
  netCanvas.height = 64;
  const ctx = netCanvas.getContext("2d")!;
  ctx.strokeStyle = "rgba(220, 230, 240, 0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 64, 64);
  ctx.beginPath();
  ctx.moveTo(32, 0); ctx.lineTo(32, 64);
  ctx.moveTo(0, 32); ctx.lineTo(64, 32);
  ctx.stroke();

  const netTexture = new THREE.CanvasTexture(netCanvas);
  netTexture.wrapS = THREE.RepeatWrapping;
  netTexture.wrapT = THREE.RepeatWrapping;
  netTexture.repeat.set(50, 8);

  const netMat = new THREE.MeshStandardMaterial({
    map: netTexture,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });

  const netMesh = new THREE.Mesh(netMeshGeo, netMat);
  netMesh.position.set(0, 0.5, 0);
  netMesh.castShadow = true;
  netGroup.add(netMesh);

  // Faixa superior da rede (branca)
  const bandGeo = new THREE.BoxGeometry(10.97 + 0.6, 0.08, 0.04);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const bandMesh = new THREE.Mesh(bandGeo, bandMat);
  bandMesh.position.set(0, 0.98, 0);
  bandMesh.castShadow = true;
  netGroup.add(bandMesh);

  courtGroup.add(netGroup);

  return courtGroup;
}
