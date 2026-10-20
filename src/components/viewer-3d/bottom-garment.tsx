"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import { bindBottom, fitBottom } from "@/lib/bottom-fit";
import { shapeBody } from "@/lib/garment-dress";
import { tintMaterial } from "@/lib/garment-color";
import { readMorphBody } from "./avatar";
import { AVATAR_URL, extractGarment } from "./dressed-avatar";

/**
 * Peças de baixo (marca `vestra_peca = "baixo"`) e o corpo sem peça de cima.
 * A peça acompanha a pele do corpo do cliente (ver `src/lib/bottom-fit.ts`);
 * a conta é rápida e roda aqui mesmo, sem Web Worker.
 */

/** Corpo do cliente (medidas aplicadas, pés no chão), lido do avatar. */
function useClientBody(params: AvatarParams) {
  const avatar = useGLTF(AVATAR_URL);
  const body = useMemo(() => {
    const found = readMorphBody(avatar.scene);
    if (!found) throw new Error("avatar sem morph targets");
    return found;
  }, [avatar.scene]);
  const { morphs, totalHeight } = params;
  const pos = useMemo(
    () => shapeBody(body, morphs, totalHeight).pos,
    [body, morphs, totalHeight],
  );
  return { body, pos };
}

/** Avatar sem peça de cima (quando o look só tem a de baixo). */
export function BareAvatar({ params }: { params: AvatarParams }) {
  const { body, pos } = useClientBody(params);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(body.index);
    g.computeVertexNormals();
    return g;
  }, [pos, body.index]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#d6c6b3" roughness={0.85} />
    </mesh>
  );
}

export function BottomGarment({
  url,
  params,
  ease,
  length = 0,
  tuckY = null,
  selectedColor,
}: {
  url: string;
  params: AvatarParams;
  /** Folga do tamanho escolhido em relação ao molde (m, ver `bottomEase`). */
  ease: number;
  /** Quanto a peça é mais longa que a perna (m, ver `bottomLength`). */
  length?: number;
  /** Barra da peça de cima no molde (m): acima dela a peça fica por dentro. */
  tuckY?: number | null;
  selectedColor?: string;
}) {
  const garment = useGLTF(url);
  const { body, pos } = useClientBody(params);
  const parts = useMemo(() => extractGarment(garment.scene), [garment.scene]);
  const bindings = useMemo(
    () => parts.map((p) => bindBottom(p.base, body.base)),
    [parts, body.base],
  );

  const geometries = useMemo(
    () =>
      parts.map((p, i) => {
        const g = p.geometry.clone();
        g.setAttribute(
          "position",
          new THREE.BufferAttribute(fitBottom(bindings[i], pos, ease, tuckY, length), 3),
        );
        g.computeVertexNormals();
        return g;
      }),
    [parts, bindings, pos, ease, tuckY, length],
  );

  const materials = useMemo(
    () =>
      parts.map((p) => {
        const m = tintMaterial(p.material, selectedColor);
        // Onde encosta na peça de cima, a de cima aparece por fora.
        m.polygonOffset = true;
        m.polygonOffsetFactor = 1;
        m.polygonOffsetUnits = 1;
        return m;
      }),
    [parts, selectedColor],
  );

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[VESTRA FIT] peça de baixo · folga ${(ease * 100).toFixed(1)} cm` +
          (length !== 0 ? ` · ${(length * 100).toFixed(1)} cm ${length > 0 ? "mais longa" : "mais curta"}` : "") +
          (tuckY != null ? ` · por dentro acima de ${tuckY.toFixed(2)} m` : ""),
      );
    }
  }, [ease, length, tuckY]);

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={materials[i]} castShadow />
      ))}
    </group>
  );
}

/** Altura (m, no molde) da barra de uma peça de cima ajustada ao manequim. */
export function hemHeight(scene: THREE.Object3D) {
  return new THREE.Box3().setFromObject(scene).min.y;
}
