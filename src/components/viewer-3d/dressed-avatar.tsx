"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import { applyMorphs, drape, makeBody, pushOut } from "@/lib/garment-fit";
import { canonicalMorph } from "./avatar";

/**
 * Avatar do cliente vestindo uma peça ajustada ao corpo de referência
 * (marca `vestra_fit`). O corpo recebe as medidas do cliente; a peça mantém a
 * forma do tamanho escolhido, desce/sobe junto com os ombros e só é empurrada
 * onde o corpo for maior que ela (ver `src/lib/garment-fit.ts`).
 */

const AVATAR_URL =
  process.env.NEXT_PUBLIC_AVATAR_MODEL_URL ?? "/models/avatar_base.glb";

useGLTF.preload(AVATAR_URL);

// Pescoço do corpo de referência (m): a peça cresce/encolhe por tamanho a
// partir daqui, para a gola continuar no lugar.
const NECK = new THREE.Vector3(0, 1.42, 0.025);
// Comprimentos crescem menos que larguras entre tamanhos.
const LENGTH_SHARE = 0.5;
// Ombro e pulso do lado +X do corpo de referência na pose padrão (m; o lado
// -X é espelhado), de scripts/molde/pose_lib.py. A manga cresce/encolhe em
// volta do eixo ombro → pulso, para continuar em volta do braço.
const SHOULDER = new THREE.Vector3(0.18, 1.33, 0.02);
const WRIST = new THREE.Vector3(0.415, 0.869, 0.088);
// Raio dos vértices do corpo que acompanham cada articulação.
const JOINT_RADIUS = 0.05;
// Altura da axila do corpo de referência (m): o caimento do tronco começa aqui.
const ARMPIT_Y = 1.24;

type Part = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  base: Float32Array;
  /**
   * Quanto cada vértice é manga (0 a 1), com o sinal do lado (+X / -X):
   * atributo `_BRACO` gravado por scripts/molde/posar_roupa.py. Peças sem
   * ele (camiseta) crescem inteiras a partir do pescoço.
   */
  arm: ArrayLike<number> | null;
};

const mirror = (v: THREE.Vector3, side: number) =>
  new THREE.Vector3(v.x * side, v.y, v.z);

function extractBody(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  let found: THREE.Mesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!found && m.isMesh && m.geometry.morphAttributes.position) found = m;
  });
  const mesh = found as THREE.Mesh | null;
  if (!mesh) throw new Error("avatar sem morph targets");
  const geo = mesh.geometry;
  const matrix = mesh.matrixWorld;
  // deltas são vetores: só a parte linear (giro/escala), sem translação
  const linear = new THREE.Matrix3().setFromMatrix4(matrix);
  const v = new THREE.Vector3();

  const base = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(matrix);
    v.toArray(base, i * 3);
  }
  const names = Object.entries(mesh.morphTargetDictionary ?? {});
  const deltas: Float32Array[] = [];
  const keys: (keyof AvatarParams["morphs"] | null)[] = [];
  const morphPositions = geo.morphAttributes.position ?? [];
  for (const [name, idx] of names) {
    const attr = morphPositions[idx];
    const d = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(attr, i).applyMatrix3(linear);
      v.toArray(d, i * 3);
    }
    deltas.push(d);
    keys.push(canonicalMorph(name));
  }
  const index = geo.index
    ? Array.from(geo.index.array)
    : Array.from({ length: base.length / 3 }, (_, i) => i);

  // Topo dos ombros (|x| 9–13 cm, no meio da profundidade): a peça segue a
  // altura desses pontos.
  const cand: number[] = [];
  for (let i = 0; i < base.length / 3; i++) {
    const x = Math.abs(base[i * 3]);
    if (x > 0.09 && x < 0.13 && Math.abs(base[i * 3 + 2]) < 0.04 && base[i * 3 + 1] > 1.3)
      cand.push(i);
  }
  cand.sort((a, b) => base[b * 3 + 1] - base[a * 3 + 1]);
  const shoulders = cand.slice(0, 40);

  // Vértices em volta do ombro e do pulso de cada lado: a articulação se move
  // com a média deles quando as medidas mudam.
  const near = (j: THREE.Vector3) => {
    const out: number[] = [];
    for (let i = 0; i < base.length / 3; i++) {
      v.fromArray(base, i * 3);
      if (v.distanceTo(j) < JOINT_RADIUS) out.push(i);
    }
    return out;
  };
  const arms = [1, -1].map((side) => ({
    side,
    shoulder: near(mirror(SHOULDER, side)),
    wrist: near(mirror(WRIST, side)),
  }));

  return { base, deltas, keys, index, shoulders, arms };
}

function extractGarment(scene: THREE.Object3D): Part[] {
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geometry = m.geometry.clone();
    geometry.applyMatrix4(m.matrixWorld);
    geometry.morphAttributes = {};
    const source = Array.isArray(m.material) ? m.material[0] : m.material;
    const material = source.clone();
    material.side = THREE.DoubleSide; // o avesso aparece na gola e na barra
    parts.push({
      geometry,
      material,
      base: new Float32Array(geometry.attributes.position.array),
      arm: geometry.attributes._braco?.array ?? null,
    });
  });
  return parts;
}

export function DressedAvatar({
  garmentUrl,
  params,
  size,
  selectedColor,
}: {
  garmentUrl: string;
  params: AvatarParams;
  /** Escala da peça pelo tamanho escolhido (M = 1). */
  size: number;
  selectedColor?: string;
}) {
  const avatar = useGLTF(AVATAR_URL);
  const garment = useGLTF(garmentUrl);

  const body = useMemo(() => extractBody(avatar.scene), [avatar.scene]);
  const parts = useMemo(() => extractGarment(garment.scene), [garment.scene]);
  const { morphs, totalHeight } = params;

  const fitted = useMemo(
    () => dress(body, parts, morphs, totalHeight, size),
    [body, parts, morphs, totalHeight, size],
  );

  const bodyGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(fitted.body, 3));
    g.setIndex(body.index);
    g.computeVertexNormals();
    return g;
  }, [fitted, body.index]);

  const clothGeometries = useMemo(
    () =>
      parts.map((p, i) => {
        const g = p.geometry.clone();
        const start = fitted.starts[i];
        g.setAttribute(
          "position",
          new THREE.BufferAttribute(
            fitted.cloth.slice(start, start + p.base.length),
            3,
          ),
        );
        g.computeVertexNormals();
        return g;
      }),
    [parts, fitted],
  );

  const materials = useMemo(
    () =>
      parts.map((p) => {
        const m = p.material.clone() as THREE.MeshStandardMaterial;
        if (selectedColor) m.color?.set(selectedColor);
        return m;
      }),
    [parts, selectedColor],
  );

  // Libera da GPU as geometrias/materiais substituídos a cada troca.
  useEffect(() => () => bodyGeometry.dispose(), [bodyGeometry]);
  useEffect(
    () => () => clothGeometries.forEach((g) => g.dispose()),
    [clothGeometries],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[VESTRA FIT] caimento em ${fitted.ms} ms · tamanho ×${size.toFixed(2)}` +
          ` · ${fitted.touching} pontos ainda encostando` +
          ` · ${fitted.draped} no caimento`,
      );
    }
  }, [fitted, size]);

  return (
    <group>
      <mesh geometry={bodyGeometry} castShadow>
        <meshStandardMaterial color="#d6c6b3" roughness={0.85} />
      </mesh>
      {clothGeometries.map((g, i) => (
        <mesh key={i} geometry={g} material={materials[i]} castShadow />
      ))}
    </group>
  );
}

/**
 * Corpo com as medidas do cliente + peça no tamanho escolhido, apoiada nos
 * ombros e empurrada só onde o corpo passa do tecido.
 */
function dress(
  body: ReturnType<typeof extractBody>,
  parts: Part[],
  morphs: AvatarParams["morphs"],
  totalHeight: number,
  size: number,
) {
  const t0 = performance.now();

  // 1) corpo com as medidas; a altura é resolvida para bater em cm
  const weights = body.keys.map((k) => (k && k !== "height" ? morphs[k] : 0));
  let pos = applyMorphs(body.base, body.deltas, weights);
  const hk = body.keys.indexOf("height");
  if (hk >= 0) {
    let top = 0;
    let bottom = 0;
    for (let i = 1; i < pos.length / 3; i++) {
      if (pos[i * 3 + 1] > pos[top * 3 + 1]) top = i;
      if (pos[i * 3 + 1] < pos[bottom * 3 + 1]) bottom = i;
    }
    const h0 = pos[top * 3 + 1] - pos[bottom * 3 + 1];
    const gain = body.deltas[hk][top * 3 + 1] - body.deltas[hk][bottom * 3 + 1];
    if (gain > 0) {
      weights[hk] = THREE.MathUtils.clamp((totalHeight - h0) / gain, -1, 1);
      pos = applyMorphs(body.base, body.deltas, weights);
    }
  }
  // pés no chão
  let minY = Infinity;
  for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i]);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;

  // 2) quanto os ombros subiram/desceram e foram para frente/trás
  let dy = 0;
  let dz = 0;
  for (const i of body.shoulders) {
    dy += pos[i * 3 + 1] - body.base[i * 3 + 1];
    dz += pos[i * 3 + 2] - body.base[i * 3 + 2];
  }
  dy /= body.shoulders.length;
  dz /= body.shoulders.length;

  // ... e o eixo ombro → pulso de cada braço (referência e cliente)
  const track = (idx: number[], j: THREE.Vector3) => {
    const out = j.clone();
    for (const i of idx) {
      out.x += (pos[i * 3] - body.base[i * 3]) / idx.length;
      out.y += (pos[i * 3 + 1] - body.base[i * 3 + 1]) / idx.length;
      out.z += (pos[i * 3 + 2] - body.base[i * 3 + 2]) / idx.length;
    }
    return out;
  };
  const arms = new Map(
    body.arms.map((a) => {
      const s0 = mirror(SHOULDER, a.side);
      const w0 = mirror(WRIST, a.side);
      const s1 = track(a.shoulder, s0);
      const w1 = track(a.wrist, w0);
      return [
        a.side,
        { s0, d0: w0.sub(s0).normalize(), s1, d1: w1.sub(s1).normalize() },
      ];
    }),
  );

  // 3) peça no tamanho escolhido, apoiada nos ombros. A manga cresce em volta
  // do braço do cliente: comprimento ao longo do eixo, largura em volta dele.
  const sLen = 1 + (size - 1) * LENGTH_SHARE;
  const cloth = new Float32Array(parts.reduce((n, p) => n + p.base.length, 0));
  const armOf = new Float32Array(cloth.length / 3);
  const starts: number[] = [];
  const p0 = new THREE.Vector3();
  const radial = new THREE.Vector3();
  let off = 0;
  for (const p of parts) {
    starts.push(off);
    for (let i = 0; i < p.base.length; i += 3) {
      const x = p.base[i] * size;
      const y = NECK.y + (p.base[i + 1] - NECK.y) * sLen + dy;
      const z = NECK.z + (p.base[i + 2] - NECK.z) * size + dz;
      const a = p.arm ? p.arm[i / 3] : 0;
      armOf[(off + i) / 3] = a;
      const arm = a ? arms.get(Math.sign(a)) : undefined;
      if (!arm) {
        cloth[off + i] = x;
        cloth[off + i + 1] = y;
        cloth[off + i + 2] = z;
        continue;
      }
      p0.fromArray(p.base, i).sub(arm.s0);
      const t = p0.dot(arm.d0);
      radial.copy(p0).addScaledVector(arm.d0, -t).multiplyScalar(size);
      const q = radial.add(arm.s1).addScaledVector(arm.d1, t * sLen);
      const w = Math.min(1, Math.abs(a));
      cloth[off + i] = x + (q.x - x) * w;
      cloth[off + i + 1] = y + (q.y - y) * w;
      cloth[off + i + 2] = z + (q.z - z) * w;
    }
    off += p.base.length;
  }

  // 4) onde o corpo passa do tecido, o tecido é empurrado ...
  const before = cloth.slice();
  const touching = pushOut(cloth, makeBody(pos, body.index));
  // 5) ... e, no tronco, desce reto a partir dali em vez de voltar para dentro
  const draped = drape(cloth, before, armOf, ARMPIT_Y + dy);

  return {
    body: pos,
    cloth,
    starts,
    touching,
    draped,
    ms: Math.round(performance.now() - t0),
  };
}
