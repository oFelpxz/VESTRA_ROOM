"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { tintMaterial } from "@/lib/garment-color";

/**
 * Cópia da cena com os materiais na cor escolhida (ver `tintMaterial`).
 * Sem cor, a peça aparece como veio do arquivo. A cópia divide a malha com
 * o arquivo; só os materiais são novos.
 */
export function useTintedScene(scene: THREE.Object3D, color?: string) {
  const { model, created } = useMemo(() => {
    const model = scene.clone(true);
    const created: THREE.Material[] = [];
    if (color) {
      const tint = (m: THREE.Material) => {
        const t = tintMaterial(m, color);
        created.push(t);
        return t;
      };
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(tint)
          : tint(mesh.material);
      });
    }
    return { model, created };
  }, [scene, color]);

  useEffect(() => () => created.forEach((m) => m.dispose()), [created]);
  return model;
}
