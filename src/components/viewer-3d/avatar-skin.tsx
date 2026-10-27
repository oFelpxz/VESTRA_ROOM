"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { findEyeSockets, placeEyes, type EyeSocket } from "@/lib/eye-sockets";
import { surfaceCavity } from "@/lib/skin-cavity";
import { SkinMaterial } from "./skin-material";

/**
 * Pele do cliente no provador: o corpo com as medidas (sombra nas dobras,
 * lista 11 item 3) e os globos dos olhos, da cor da pele (item 4).
 */

/** Cavidades dos olhos do corpo de referência (uma vez por modelo). */
export function useEyeSockets(base: Float32Array): EyeSocket[] {
  return useMemo(() => findEyeSockets(base), [base]);
}

export function AvatarSkin({
  positions,
  index,
  sockets,
}: {
  positions: Float32Array;
  index: number[];
  sockets: EyeSocket[];
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const cavity = surfaceCavity(positions, index, g.getAttribute("normal").array);
    g.setAttribute("skinCavity", new THREE.BufferAttribute(cavity, 1));
    return g;
  }, [positions, index]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const eyes = useMemo(() => placeEyes(positions, sockets), [positions, sockets]);

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <SkinMaterial folds />
      </mesh>
      {eyes.map((e, i) => (
        <mesh key={i} position={e.center} scale={e.radius} receiveShadow>
          <sphereGeometry args={[1, 32, 24]} />
          <SkinMaterial />
        </mesh>
      ))}
    </>
  );
}
