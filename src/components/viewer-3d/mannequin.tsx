"use client";

import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useBounds, useGLTF } from "@react-three/drei";
import { buildAvatarParams } from "@/lib/avatar-builder";
import type { GarmentLook } from "@/lib/garment-prints";
import { AvatarErrorBoundary } from "./avatar";
import { Shoes } from "./bottom-garment";
import { isBottomPiece } from "./mannequin-mark";
import { MannequinFinish } from "./skin-material";
import { Outfit, type ScenePiece } from "./tryon-scene";

/**
 * Peça vestida no manequim da página do produto (item 3D-04).
 *
 * O manequim é o mesmo avatar do provador, com as medidas de referência
 * (1,70 m / 70 kg), com braços, tênis e o material de tecido, mas com
 * acabamento de manequim de loja no lugar da pele. Não lê nenhum
 * dado do cliente, por isso funciona igual para o Visitante. (Antes era o
 * `manequim.glb`, o avatar sem braços — ficava com cara de corpo cortado.)
 *
 * A peça só chega aqui se foi ajustada no Blender sobre esse corpo (ver
 * `mannequin-mark.ts`).
 */

const REFERENCE = buildAvatarParams({
  heightCm: null,
  weightKg: null,
  chestCm: null,
  waistCm: null,
  hipCm: null,
  shoulderCm: null,
  armLengthCm: null,
  legLengthCm: null,
});

const box = new THREE.Box3();

/**
 * O corpo vestido sai do worker depois do tênis: enquanto a altura da cena
 * cresce, reenquadra a câmera (o `Bounds` do visualizador só enquadra uma vez).
 */
function useRefitWhileLoading(ref: RefObject<THREE.Group | null>) {
  const bounds = useBounds();
  const camera = useThree((st) => st.camera);
  const state = useRef({ height: 0, next: 0, until: -1 });
  useFrame(({ clock }) => {
    const s = state.current;
    const t = clock.elapsedTime;
    if (s.until < 0) s.until = t + 20;
    if (!ref.current || t < s.next || t > s.until) return;
    s.next = t + 0.4;
    const h = box.setFromObject(ref.current).max.y - box.min.y;
    if (h > s.height + 0.01) {
      s.height = h;
      // De frente, na altura do peito: o primeiro enquadramento (só o
      // tênis) deixava a câmera olhando de baixo.
      const c = box.getCenter(new THREE.Vector3());
      camera.position.set(c.x, c.y + h * 0.1, c.z + h * 2);
      bounds.refresh(ref.current).clip().fit();
    }
  });
}

export default function Mannequin({
  garmentUrl,
  color,
  look,
}: {
  garmentUrl: string;
  /** Cor da peça (hex). */
  color?: string;
  /** Versão com estampa (Street/Sport). */
  look?: GarmentLook | null;
}) {
  const { scene } = useGLTF(garmentUrl);
  const piece: ScenePiece = { url: garmentUrl, color, look };
  const bottom = isBottomPiece(scene);
  const ref = useRef<THREE.Group>(null);
  useRefitWhileLoading(ref);
  return (
    <MannequinFinish.Provider value>
      <group ref={ref}>
        <Outfit
          params={REFERENCE}
          top={bottom ? null : piece}
          bottom={bottom ? piece : null}
          primary={bottom ? "bottom" : "top"}
        />
        <AvatarErrorBoundary fallback={null}>
          <Shoes params={REFERENCE} />
        </AvatarErrorBoundary>
      </group>
    </MannequinFinish.Provider>
  );
}
