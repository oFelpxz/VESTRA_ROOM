"use client";

import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/**
 * Luz de estúdio do provador e da prévia do avatar.
 *
 * O reflexo vem de "softboxes" desenhados na hora (Lightformer, sem baixar
 * HDRI): principal na frente à direita, rebatedor à esquerda, contra-luz atrás
 * (contorna ombros e braços) e o chão claro. As luzes diretas ficam só para a
 * sombra (principal) e para o contorno (rim).
 */

/** Tone mapping do Canvas: mantém a cor da peça (o padrão ACES escurece e
 * tira saturação). Usar em `gl={{ toneMapping: STUDIO_TONE_MAPPING }}`. */
export const STUDIO_TONE_MAPPING = THREE.NeutralToneMapping;

export function StudioLights() {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#fff5ea"
          position={[3, 4, 4]}
          scale={[4, 4, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1}
          color="#eef1fb"
          position={[-4, 2, 2]}
          scale={[3, 5, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 3, -4]}
          scale={[6, 2, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          color="#e7e2da"
          position={[0, -1, 0]}
          rotation-x={Math.PI / 2}
          scale={[8, 8, 1]}
        />
      </Environment>

      <hemisphereLight intensity={0.2} groundColor="#cfcabd" />
      {/* Principal: faz a sombra do braço no tronco e da peça de cima na de baixo. */}
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.5}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.6}
        shadow-camera-near={1}
        shadow-camera-far={14}
      />
      {/* Contorno (rim): de trás e do alto, separa a roupa do fundo. */}
      <directionalLight position={[-2.5, 3.5, -4]} intensity={1.3} color="#fffaf2" />
    </>
  );
}
