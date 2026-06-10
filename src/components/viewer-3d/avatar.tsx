"use client";

import type { AvatarParams } from "@/lib/avatar-builder";

/**
 * Avatar feito com primitivas Three.js (MVP).
 *
 * Quando trocarmos para um GLB com morph targets (SMPL/MakeHuman):
 *   - Carregar o GLB com `useGLTF`
 *   - Iterar `mesh.morphTargetDictionary` aplicando os pesos vindos de `buildAvatarParams`
 *   - As ancoragens já estão definidas em `params.anchors` e seguem servindo
 *     para posicionar a roupa por cima.
 */
export function Avatar({ params }: { params: AvatarParams }) {
  const a = params.anchors;
  const skinColor = "#d6c6b3";
  const accentColor = "#b9a78f";

  // Comprimentos derivados
  const torsoTop = a.shoulder.y;
  const torsoBottom = a.hip.y - 0.04;
  const torsoHeight = torsoTop - torsoBottom;
  const torsoYCenter = (torsoTop + torsoBottom) / 2;

  // Dimensões do torso (elipse aproximada por scale em box)
  const torsoWidth = Math.max(a.chest.halfWidth, a.shoulder.halfWidth) * 2;
  const torsoDepth = torsoWidth * 0.55;

  // Cabeça
  const headRadius = params.totalHeight * 0.055;
  const headY = a.head.y + headRadius * 0.3;

  // Pescoço
  const neckHeight = (a.head.y - a.shoulder.y) - headRadius * 0.7;
  const neckRadius = params.totalHeight * 0.028;
  const neckY = a.shoulder.y + neckHeight / 2 + 0.01;

  // Braços
  const armLength = params.totalHeight * params.ratioArm;
  const armRadius = params.totalHeight * 0.028 * params.scaleGirth;
  const armOffsetX = a.shoulder.halfWidth + armRadius * 0.6;

  // Pernas
  const legLength = a.hip.y;
  const legRadius = params.totalHeight * 0.045 * params.scaleGirth;
  const legOffsetX = a.hip.halfWidth * 0.45;

  return (
    <group position={[0, 0, 0]}>
      {/* Cabeça */}
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[headRadius, 32, 32]} />
        <meshStandardMaterial color={skinColor} roughness={0.85} />
      </mesh>

      {/* Pescoço */}
      <mesh position={[0, neckY, 0]} castShadow>
        <cylinderGeometry args={[neckRadius, neckRadius * 1.1, neckHeight, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.9} />
      </mesh>

      {/* Torso (elipsoide aproximado por sphere escalado) */}
      <mesh
        position={[0, torsoYCenter, 0]}
        scale={[
          torsoWidth / 2,
          torsoHeight / 2,
          torsoDepth / 2,
        ]}
        castShadow
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} />
      </mesh>

      {/* Cintura — overlay sutil pra dar afunilamento (sphere escalado por scaleWaist) */}
      <mesh
        position={[0, a.waist.y, 0]}
        scale={[
          a.waist.halfWidth * 2 * 0.55,
          torsoHeight * 0.18,
          a.waist.halfWidth * 2 * 0.32,
        ]}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} />
      </mesh>

      {/* Quadril */}
      <mesh
        position={[0, a.hip.y, 0]}
        scale={[
          a.hip.halfWidth * 2 * 0.55,
          torsoHeight * 0.22,
          a.hip.halfWidth * 2 * 0.35,
        ]}
        castShadow
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} />
      </mesh>

      {/* Braços */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Ombro */}
          <mesh position={[side * a.shoulder.halfWidth, a.shoulder.y, 0]} castShadow>
            <sphereGeometry args={[armRadius * 1.3, 16, 16]} />
            <meshStandardMaterial color={accentColor} roughness={0.9} />
          </mesh>
          {/* Braço */}
          <mesh
            position={[
              side * armOffsetX,
              a.shoulder.y - armLength / 2,
              0,
            ]}
            castShadow
          >
            <cylinderGeometry args={[armRadius, armRadius * 0.85, armLength, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.9} />
          </mesh>
          {/* Mão */}
          <mesh
            position={[
              side * armOffsetX,
              a.shoulder.y - armLength - armRadius,
              0,
            ]}
            castShadow
          >
            <sphereGeometry args={[armRadius * 0.95, 16, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Pernas */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * legOffsetX, legLength / 2, 0]}
            castShadow
          >
            <cylinderGeometry args={[legRadius, legRadius * 0.7, legLength, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.9} />
          </mesh>
          {/* Pé */}
          <mesh
            position={[side * legOffsetX, 0.03, 0.06]}
            castShadow
          >
            <boxGeometry args={[legRadius * 1.6, 0.06, legRadius * 3]} />
            <meshStandardMaterial color="#222" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
