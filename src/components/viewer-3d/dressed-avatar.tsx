"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import type { Grade } from "@/lib/garment-fit";
import { FitRunner } from "@/lib/fit-runner";
import {
  SHOULDER,
  WRIST,
  mirror,
  type FitBody,
  type FitOptions,
  type FitPart,
  type Fitted,
} from "@/lib/garment-dress";
import { tintMaterial } from "@/lib/garment-color";
import { readMorphBody } from "./avatar";

/**
 * Avatar do cliente vestindo uma peça ajustada ao corpo de referência
 * (marca `vestra_fit`). O corpo recebe as medidas do cliente; a peça mantém a
 * forma do tamanho escolhido, desce/sobe junto com os ombros e só é empurrada
 * onde o corpo for maior que ela (ver `src/lib/garment-dress.ts`). A conta
 * roda num Web Worker; enquanto ela roda, continua aparecendo a anterior.
 */

const AVATAR_URL =
  process.env.NEXT_PUBLIC_AVATAR_MODEL_URL ?? "/models/avatar_base.glb";

useGLTF.preload(AVATAR_URL);

// Raio dos vértices do corpo que acompanham cada articulação.
const JOINT_RADIUS = 0.05;

type Part = FitPart & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

function extractBody(scene: THREE.Object3D): FitBody {
  const found = readMorphBody(scene);
  if (!found) throw new Error("avatar sem morph targets");
  const { base, deltas, keys, index } = found;
  const v = new THREE.Vector3();

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

/**
 * Ajustes da peça gravados no molde (Custom Properties da cena no Blender,
 * ver scripts/molde/marcar.py): `vestra_ribana` = altura da ribana da barra, em m.
 */
function readFitOptions(scene: THREE.Object3D): FitOptions {
  let rib = 0;
  scene.traverse((o) => {
    const v = Number(o.userData?.vestra_ribana);
    if (v > 0) rib = v;
  });
  return { rib };
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
  grade,
  selectedColor,
}: {
  garmentUrl: string;
  params: AvatarParams;
  /** Graduação do tamanho escolhido em relação ao molde (M). */
  grade: Grade;
  selectedColor?: string;
}) {
  const avatar = useGLTF(AVATAR_URL);
  const garment = useGLTF(garmentUrl);

  const body = useMemo(() => extractBody(avatar.scene), [avatar.scene]);
  const parts = useMemo(() => extractGarment(garment.scene), [garment.scene]);
  const options = useMemo(() => readFitOptions(garment.scene), [garment.scene]);
  const { morphs, totalHeight } = params;

  // Resultado do worker, marcado com as peças para as quais foi calculado.
  const [result, setResult] = useState<{ parts: Part[]; fitted: Fitted } | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const runner = useRef<FitRunner | null>(null);

  useEffect(() => {
    const r = new FitRunner(
      body,
      parts.map((p) => ({ base: p.base, arm: p.arm })),
      (fitted) => setResult({ parts, fitted }),
      (e) => setError(e ?? new Error("falha no caimento")),
      options,
    );
    runner.current = r;
    return () => {
      r.dispose();
      runner.current = null;
    };
  }, [body, parts, options]);

  useEffect(() => {
    runner.current?.request(morphs, totalHeight, grade);
  }, [body, parts, options, morphs, totalHeight, grade]);

  // Deixa o AvatarErrorBoundary mostrar o encaixe antigo.
  if (error) throw error;

  const fitted = result?.parts === parts ? result.fitted : null;
  return fitted ? (
    <FittedAvatar
      parts={parts}
      index={body.index}
      fitted={fitted}
      selectedColor={selectedColor}
    />
  ) : (
    <Html center>
      <div className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
        Vestindo…
      </div>
    </Html>
  );
}

function FittedAvatar({
  parts,
  index,
  fitted,
  selectedColor,
}: {
  parts: Part[];
  index: number[];
  fitted: Fitted;
  selectedColor?: string;
}) {
  const bodyGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(fitted.body, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [fitted, index]);

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
    () => parts.map((p) => tintMaterial(p.material, selectedColor)),
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
        `[VESTRA FIT] caimento em ${fitted.ms} ms · peito ×${fitted.grade.chest.toFixed(2)}` +
          ` · ${fitted.touching} pontos ainda encostando` +
          ` · ${fitted.settled} assentados · ${fitted.draped} no caimento`,
      );
    }
  }, [fitted]);

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
