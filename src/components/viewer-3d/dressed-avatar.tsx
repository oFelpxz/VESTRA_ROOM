"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import type { TopHem } from "@/lib/bottom-fit";
import { BODY_GRID_CELL, PointGrid, type Grade } from "@/lib/garment-fit";
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
import { deinterleave } from "@/lib/deinterleave";
import { dropInnerPieces, duplicateLayers, type Skin } from "@/lib/garment-layers";
import { addFabricEdge, addFabricRest, clothMaterial, fabricOf, type PrintDecal } from "@/lib/fabric";
import type { FabricName } from "@/lib/fabric-weave";
import type { GarmentLook } from "@/lib/garment-prints";
import type { EyeSocket } from "@/lib/eye-sockets";
import { readMorphBody } from "./avatar";
import { AvatarSkin, useEyeSockets } from "./avatar-skin";
import { useGarmentPrints } from "./brand-logo-canvas";
import { AVATAR_URL } from "./avatar-url";
import { useLite } from "./lite-context";

/**
 * Avatar do cliente vestindo uma peça ajustada ao corpo de referência
 * (marca `vestra_fit`). O corpo recebe as medidas do cliente; a peça mantém a
 * forma do tamanho escolhido, desce/sobe junto com os ombros e só é empurrada
 * onde o corpo for maior que ela (ver `src/lib/garment-dress.ts`). A conta
 * roda num Web Worker; enquanto ela roda, continua aparecendo a anterior.
 */

export { AVATAR_URL };

useGLTF.preload(AVATAR_URL);

// Raio dos vértices do corpo que acompanham cada articulação.
const JOINT_RADIUS = 0.05;

export type Part = FitPart & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  fabric: FabricName;
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

/**
 * `skin`: pele do corpo de referência, para tirar o avesso que vem como pedaço
 * solto na mesma malha (Hoodie Core); sem ela, só o avesso em malha separada.
 */
export function extractGarment(scene: THREE.Object3D, skin?: Skin): Part[] {
  scene.updateMatrixWorld(true);
  const meshes: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geometry = m.geometry.clone();
    geometry.applyMatrix4(m.matrixWorld);
    geometry.morphAttributes = {};
    deinterleave(geometry);
    if (skin) dropInnerPieces(geometry, skin);
    meshes.push({ mesh: m, geometry });
  });
  // O avesso duplicado furava a camada de fora (ver garment-layers.ts).
  const avesso = duplicateLayers(meshes.map((x) => x.geometry.attributes.position.array));
  const parts: Part[] = [];
  meshes.forEach(({ mesh: m, geometry }, i) => {
    if (avesso.has(i)) {
      geometry.dispose();
      return;
    }
    addFabricEdge(geometry);
    addFabricRest(geometry);
    const source = Array.isArray(m.material) ? m.material[0] : m.material;
    const material = source.clone();
    material.side = THREE.DoubleSide; // o avesso aparece na gola e na barra
    parts.push({
      geometry,
      material,
      fabric: fabricOf(scene, source),
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
  look,
  onHem,
}: {
  garmentUrl: string;
  params: AvatarParams;
  /** Graduação do tamanho escolhido em relação ao molde (M). */
  grade: Grade;
  selectedColor?: string;
  /** Versão com estampa (Street/Sport), lida do nome da cor. */
  look?: GarmentLook | null;
  /** Barra da peça já vestida, a cada encaixe (a peça de baixo fica por dentro). */
  onHem?: (hem: TopHem | null) => void;
}) {
  const avatar = useGLTF(AVATAR_URL);
  const garment = useGLTF(garmentUrl);

  const body = useMemo(() => extractBody(avatar.scene), [avatar.scene]);
  const parts = useMemo(
    () => extractGarment(garment.scene, { grid: new PointGrid(body.base, BODY_GRID_CELL), positions: body.base }),
    [garment.scene, body],
  );
  const options = useMemo(() => readFitOptions(garment.scene), [garment.scene]);
  const prints = useGarmentPrints(garmentUrl, look, selectedColor);
  const sockets = useEyeSockets(body.base);
  const { morphs, totalHeight, girths } = params;

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
    runner.current?.request(morphs, totalHeight, grade, girths);
  }, [body, parts, options, morphs, totalHeight, girths, grade]);

  // Deixa o AvatarErrorBoundary mostrar o encaixe antigo.
  if (error) throw error;

  // Troca de peça: até o worker devolver o caimento novo, segue a anterior na tela.
  const fitted = result?.parts === parts ? result.fitted : null;
  const [shown, setShown] = useState<Shown | null>(null);
  if (
    fitted &&
    (shown?.fitted !== fitted || shown.selectedColor !== selectedColor || shown.prints !== prints)
  )
    setShown({ parts, index: body.index, sockets, fitted, selectedColor, prints });
  const view = fitted ? { parts, index: body.index, sockets, fitted, selectedColor, prints } : shown;
  const hem = view?.fitted.hem ?? null;
  useEffect(() => onHem?.(hem), [onHem, hem]);
  return view ? (
    <FittedAvatar {...view} />
  ) : (
    <Html center>
      <div className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
        Vestindo…
      </div>
    </Html>
  );
}

type Shown = {
  parts: Part[];
  index: number[];
  sockets: EyeSocket[];
  fitted: Fitted;
  selectedColor?: string;
  prints: PrintDecal[];
};

function FittedAvatar({ parts, index, sockets, fitted, selectedColor, prints }: Shown) {
  const lite = useLite();
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
      parts.map((p) =>
        clothMaterial(p.material, selectedColor, p.fabric, "caimento", lite, prints),
      ),
    [parts, selectedColor, lite, prints],
  );

  // Libera da GPU as geometrias/materiais substituídos a cada troca.
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
      <AvatarSkin positions={fitted.body} index={index} sockets={sockets} />
      {clothGeometries.map((g, i) => (
        <mesh key={i} geometry={g} material={materials[i]} castShadow receiveShadow />
      ))}
    </group>
  );
}
