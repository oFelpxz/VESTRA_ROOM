"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import * as THREE from "three";
import { findEyeSockets, placeEyes, type EyeSocket } from "@/lib/eye-sockets";
import { faceCoords } from "@/lib/face-marks";
import { hairEdge, hairHeight, hairShell } from "@/lib/hair";
import { surfaceCavity } from "@/lib/skin-cavity";
import { weldedNormals } from "@/lib/welded-normals";
import { EyeMaterial, HairMaterial, SkinMaterial } from "./skin-material";

/**
 * Pele do cliente no provador: o corpo com as medidas (sombra nas dobras,
 * lista 11 item 3; sobrancelha, boca e pálpebra, lista 12 item 3), os olhos
 * (globo do item 4, íris e córnea da lista 12) e o cabelo (item 5). Normais lisas nas costuras do corpo base (item 6).
 */

/** Corte de quem prova (id de `HAIR_STYLES`); "none" com touca e no manequim. */
export const HairContext = createContext("none");

/** Quanto o cabelo pintado cobre a pele em cada corte (o curto ganha a casca por cima). */
const HAIR_COVER: Record<string, number> = { raspado: 0.8, curto: 1 };

/** Cavidades dos olhos e marcas do rosto do corpo de referência (uma vez por modelo). */
export type Face = { sockets: EyeSocket[]; marks: Float32Array | null };

export function useFace(base: Float32Array): Face {
  return useMemo(() => {
    const sockets = findEyeSockets(base);
    const eyes = placeEyes(base, sockets);
    // Medidas no corpo de referência: com as medidas do cliente, a boca e a
    // sobrancelha pintadas andam junto com a malha.
    return { sockets, marks: eyes.length === 2 ? faceCoords(base, eyes) : null };
  }, [base]);
}

export function AvatarSkin({
  positions,
  index,
  face,
}: {
  positions: Float32Array;
  index: number[];
  face: Face;
}) {
  const style = useContext(HairContext);
  const eyes = useMemo(() => placeEyes(positions, face.sockets), [positions, face]);
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
    if (above) g.setAttribute("hairAbove", new THREE.BufferAttribute(hairEdge(above), 1));
    if (face.marks) g.setAttribute("skinFace", new THREE.BufferAttribute(face.marks, 3));
    return g;
  }, [positions, index, above, face]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const shell = useMemo(() => {
    if (!above || style !== "curto") return null;
    const s = hairShell(positions, geometry.getAttribute("normal").array, index, above, eyeY);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(s.position, 3));
    g.setAttribute("hairRoot", new THREE.BufferAttribute(s.root, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(s.normal, 3));
    g.setAttribute("hairAbove", new THREE.BufferAttribute(s.above, 1));
    g.setAttribute("hairFlow", new THREE.BufferAttribute(s.flow, 3));
    g.setAttribute("tangent", new THREE.BufferAttribute(s.tangent, 4));
    g.setIndex(s.index);
    return g;
  }, [positions, index, geometry, above, style, eyeY]);
  useEffect(() => () => shell?.dispose(), [shell]);

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <SkinMaterial folds hair={cover} face={face.marks !== null} />
      </mesh>
      {shell && (
        <mesh geometry={shell} receiveShadow>
          <HairMaterial />
        </mesh>
      )}
      {eyes.map((e, i) => (
        <mesh key={i} position={e.center} scale={e.radius} receiveShadow>
          <sphereGeometry args={[1, 48, 32]} />
          <EyeMaterial />
        </mesh>
      ))}
    </>
  );
}
