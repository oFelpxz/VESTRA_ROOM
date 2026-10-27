"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import * as THREE from "three";
import { findEyeSockets, placeEyes, type EyeSocket } from "@/lib/eye-sockets";
import { hairHeight, hairMask, hairShell } from "@/lib/hair";
import { surfaceCavity } from "@/lib/skin-cavity";
import { weldedNormals } from "@/lib/welded-normals";
import { HairMaterial, SkinMaterial } from "./skin-material";

/**
 * Pele do cliente no provador: o corpo com as medidas (sombra nas dobras,
 * lista 11 item 3), os globos dos olhos, da cor da pele (item 4), e o cabelo
 * (item 5). Normais lisas nas costuras do corpo base (item 6).
 */

/** Corte de quem prova (id de `HAIR_STYLES`); "none" com touca e no manequim. */
export const HairContext = createContext("none");

/** Quanto o cabelo pintado cobre a pele em cada corte (o curto ganha a casca por cima). */
const HAIR_COVER: Record<string, number> = { raspado: 0.8, curto: 1 };

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
  const style = useContext(HairContext);
  const eyes = useMemo(() => placeEyes(positions, sockets), [positions, sockets]);
  // Sem olho achado (outro modelo de corpo), sem referência para o cabelo.
  const cover = eyes.length ? (HAIR_COVER[style] ?? 0) : 0;
  const eyeY = eyes.length ? eyes.reduce((s, e) => s + e.center[1], 0) / eyes.length : 0;

  const above = useMemo(() => (cover > 0 ? hairHeight(positions, eyeY) : null), [positions, cover, eyeY]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(index);
    g.setAttribute("normal", new THREE.BufferAttribute(weldedNormals(positions, index), 3));
    const cavity = surfaceCavity(positions, index, g.getAttribute("normal").array);
    g.setAttribute("skinCavity", new THREE.BufferAttribute(cavity, 1));
    if (above) g.setAttribute("hairMask", new THREE.BufferAttribute(hairMask(above), 1));
    return g;
  }, [positions, index, above]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const shell = useMemo(() => {
    if (!above || style !== "curto") return null;
    const s = hairShell(positions, geometry.getAttribute("normal").array, index, above, eyeY);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(s.position, 3));
    g.setAttribute("hairRoot", new THREE.BufferAttribute(s.root, 3));
    g.setAttribute("hairMask", new THREE.BufferAttribute(s.mask, 1));
    g.setIndex(s.index);
    g.computeVertexNormals();
    return g;
  }, [positions, index, geometry, above, style, eyeY]);
  useEffect(() => () => shell?.dispose(), [shell]);

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <SkinMaterial folds hair={cover} />
      </mesh>
      {shell && (
        <mesh geometry={shell} receiveShadow>
          <HairMaterial />
        </mesh>
      )}
      {eyes.map((e, i) => (
        <mesh key={i} position={e.center} scale={e.radius} receiveShadow>
          <sphereGeometry args={[1, 32, 24]} />
          <SkinMaterial />
        </mesh>
      ))}
    </>
  );
}
