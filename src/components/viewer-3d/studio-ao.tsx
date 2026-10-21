"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";

/**
 * Sombra de contato (AO) na roupa e no corpo: escurece onde a luz do
 * estúdio não chega — axila, gola, entre as pernas, a barra do moletom
 * sobre a calça. A luz de ambiente (Lightformer) ilumina tudo por igual e
 * a peça ficava "colada" no corpo sem esse escurecido.
 *
 * Passa a desenhar a cena (prioridade 1 no `useFrame`): renderiza com
 * antisserrilhado (MSAA) num alvo intermediário, aplica o GTAO do three e
 * por último o tone mapping do Canvas (`OutputPass`). Só no modo normal: no
 * leve fica de fora (ver `src/lib/render-quality.ts`).
 */
export function StudioAO() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 1, 1);
    // Raio em metros: pega a dobra da axila e da gola sem escurecer o tronco.
    ao.updateGtaoMaterial({ radius: 0.08, distanceExponent: 1, thickness: 1, scale: 1, samples: 24 });
    ao.blendIntensity = 0.85;
    c.addPass(ao);
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [composer, dpr, size.width, size.height]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => composer.render(), 1);
  return null;
}
