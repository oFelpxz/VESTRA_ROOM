"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

/**
 * Peça vestida num manequim genérico (item 3D-04).
 *
 * O manequim é o `avatar_base.glb` com as medidas de referência e sem os
 * braços, como os de vitrine — gerado pelo script
 * `scripts/manequim_sem_bracos.py`. Não lê nenhum dado do cliente,
 * por isso funciona igual para o Visitante.
 *
 * A peça só chega aqui se foi ajustada no Blender sobre esse corpo (ver
 * `mannequin-mark.ts`): está nas mesmas coordenadas e entra 1:1, sem conta.
 */

const MANNEQUIN_URL = "/models/manequim.glb";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} />;
}

export default function Mannequin({ garmentUrl }: { garmentUrl: string }) {
  return (
    <group>
      <Model url={MANNEQUIN_URL} />
      <Model url={garmentUrl} />
    </group>
  );
}
