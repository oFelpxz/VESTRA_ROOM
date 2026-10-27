"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { bottomWrinkle } from "@/lib/bottom-fit";
import { deinterleave } from "@/lib/deinterleave";
import {
  addFabricEdge,
  addFabricRest,
  clothMaterial,
  fabricOf,
  type PrintDecal,
  type Wrinkle,
} from "@/lib/fabric";
import { duplicateLayers } from "@/lib/garment-layers";
import { isBottomPiece, isFittedToMannequin } from "./mannequin-mark";

type Piece = { geometry: THREE.BufferGeometry; source: THREE.Material; wrinkle: Wrinkle | null };

// A conta da borda (barra e pesponto) é feita uma vez por arquivo; trocar a
// cor só troca os materiais.
const pieces = new WeakMap<THREE.Object3D, Piece[]>();

// Mesmo array sempre: um `[]` novo a cada render refaria os materiais.
const NO_PRINTS: PrintDecal[] = [];

function piecesOf(scene: THREE.Object3D): Piece[] {
  let out = pieces.get(scene);
  if (out) return out;
  // Dobras só em peça feita sobre o corpo de referência: nas outras a altura
  // do arquivo não diz onde fica o joelho ou a cintura.
  const fitted = isFittedToMannequin(scene);
  const bottom = isBottomPiece(scene);
  scene.updateMatrixWorld(true);
  out = [];
  const meshes: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Em metros, nas coordenadas da cena: a trama sai do mesmo tamanho em
    // qualquer arquivo (alguns vêm do Sketchfab com escala nos nós).
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.morphAttributes = {};
    deinterleave(geometry);
    meshes.push({ mesh, geometry });
  });
  // O avesso duplicado furava a camada de fora em manchas cinza, como no
  // provador (ver garment-layers.ts).
  const avesso = duplicateLayers(meshes.map((x) => x.geometry.attributes.position.array));
  meshes.forEach(({ mesh, geometry }, i) => {
    if (avesso.has(i)) {
      geometry.dispose();
      return;
    }
    addFabricEdge(geometry);
    addFabricRest(geometry);
    const wrinkle = !fitted
      ? null
      : bottom
        ? bottomWrinkle(geometry.attributes.position.array as Float32Array)
        : "caimento";
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    out!.push({ geometry, source, wrinkle });
  });
  pieces.set(scene, out);
  return out;
}

/**
 * Cópia da peça com o material de tecido (`clothMaterial`: trama, barra,
 * pesponto e dobras) na cor escolhida, com as estampas `prints`. Sem cor,
 * fica a cor do arquivo. A malha é dividida entre as cópias; só os
 * materiais são novos.
 */
export function useTintedScene(
  scene: THREE.Object3D,
  color?: string,
  prints: PrintDecal[] = NO_PRINTS,
) {
  const { model, created } = useMemo(() => {
    const model = new THREE.Group();
    const created: THREE.Material[] = [];
    for (const p of piecesOf(scene)) {
      const m = clothMaterial(p.source, color, fabricOf(scene, p.source), p.wrinkle, false, prints);
      m.side = THREE.DoubleSide; // o avesso aparece na gola e na barra
      created.push(m);
      const mesh = new THREE.Mesh(p.geometry, m);
      // Sombra da própria peça (capuz no peito, manga no tronco).
      mesh.castShadow = mesh.receiveShadow = true;
      model.add(mesh);
    }
    return { model, created };
  }, [scene, color, prints]);

  useEffect(() => () => created.forEach((m) => m.dispose()), [created]);
  return model;
}
