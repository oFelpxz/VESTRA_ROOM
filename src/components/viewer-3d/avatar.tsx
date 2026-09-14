"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";

/**
 * Avatar do VESTRA FIT.
 *
 * - Sem `NEXT_PUBLIC_AVATAR_MODEL_URL` definido → avatar de primitivas (MVP).
 * - Com a env apontando para um `.glb` com morph targets → usa o modelo real,
 *   aplicando `params.morphs` em `mesh.morphTargetInfluences`. Se o arquivo
 *   falhar (404, formato inválido), cai de volta no avatar de primitivas.
 *
 * O GLB deve ser modelado na proporção de referência (~1,70 m), com shape keys
 * nomeadas por eixo — aceita variações de nome:
 *   height · weight · chest · waist · hip · shoulder · armLength · legLength
 * As âncoras da roupa (`params.anchors`) são calculadas à parte e continuam
 * valendo para posicionar a peça por cima.
 */

const AVATAR_MODEL_URL = process.env.NEXT_PUBLIC_AVATAR_MODEL_URL;

if (AVATAR_MODEL_URL) {
  useGLTF.preload(AVATAR_MODEL_URL);
}

export function Avatar({ params }: { params: AvatarParams }) {
  if (!AVATAR_MODEL_URL) {
    return <PrimitiveAvatar params={params} />;
  }
  return (
    <AvatarErrorBoundary fallback={<PrimitiveAvatar params={params} />}>
      <GltfAvatar url={AVATAR_MODEL_URL} params={params} />
    </AvatarErrorBoundary>
  );
}

/* -------------------------------------------------------------------------- */
/* GLB paramétrico com morph targets                                          */
/* -------------------------------------------------------------------------- */

type MorphKey = keyof AvatarParams["morphs"];

/** Nome de shape key (normalizado) → eixo canônico. */
const MORPH_ALIASES: Record<string, MorphKey> = {
  height: "height",
  altura: "height",
  stature: "height",
  tall: "height",
  weight: "weight",
  peso: "weight",
  girth: "weight",
  mass: "weight",
  bodyfat: "weight",
  chest: "chest",
  bust: "chest",
  peito: "chest",
  torax: "chest",
  waist: "waist",
  cintura: "waist",
  hip: "hip",
  hips: "hip",
  quadril: "hip",
  shoulder: "shoulder",
  shoulders: "shoulder",
  ombro: "shoulder",
  ombros: "shoulder",
  armlength: "armLength",
  arm: "armLength",
  arms: "armLength",
  braco: "armLength",
  leglength: "legLength",
  leg: "legLength",
  legs: "legLength",
  perna: "legLength",
  inseam: "legLength",
};

function canonicalMorph(name: string): MorphKey | null {
  return MORPH_ALIASES[name.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

function GltfAvatar({
  url,
  params,
}: {
  url: string;
  params: AvatarParams;
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  const rootRef = useRef<THREE.Group>(null);

  // Escala para a altura real do usuário, com os pés em y = 0.
  const transform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? params.totalHeight / size.y : 1;
    return { scale, y: -box.min.y * scale };
  }, [model, params.totalHeight]);

  // Aplica os pesos das medidas nas influências dos morph targets.
  // Percorre a árvore renderizada (via ref) a cada mudança de medida.
  const {
    height,
    weight,
    chest,
    waist,
    hip,
    shoulder,
    armLength,
    legLength,
  } = params.morphs;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const values: Record<MorphKey, number> = {
      height,
      weight,
      chest,
      waist,
      hip,
      shoulder,
      armLength,
      legLength,
    };
    let matched = 0;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.morphTargetDictionary) return;
      const influences = mesh.morphTargetInfluences;
      if (!influences) return;
      for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
        const canon = canonicalMorph(name);
        if (canon != null) {
          influences[idx] = values[canon];
          matched += 1;
        }
      }
    });
    if (matched === 0 && process.env.NODE_ENV !== "production") {
      console.warn(
        `[Avatar] ${url}: nenhuma morph target reconhecida. Renomeie as shape ` +
          "keys para height/weight/chest/waist/hip/shoulder/armLength/legLength.",
      );
    }
  }, [
    model,
    url,
    height,
    weight,
    chest,
    waist,
    hip,
    shoulder,
    armLength,
    legLength,
  ]);

  return (
    <group
      ref={rootRef}
      position={[0, transform.y, 0]}
      scale={transform.scale}
    >
      <primitive object={model} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Error boundary — volta para o avatar de primitivas se o GLB falhar         */
/* -------------------------------------------------------------------------- */

class AvatarErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(
      "[Avatar] GLB indisponível, usando avatar de primitivas:",
      error,
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* -------------------------------------------------------------------------- */
/* Avatar de primitivas Three.js (default do MVP / fallback)                  */
/* -------------------------------------------------------------------------- */

function PrimitiveAvatar({ params }: { params: AvatarParams }) {
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
  const neckHeight = a.head.y - a.shoulder.y - headRadius * 0.7;
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
        scale={[torsoWidth / 2, torsoHeight / 2, torsoDepth / 2]}
        castShadow
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} />
      </mesh>

      {/* Cintura — overlay sutil pra dar afunilamento */}
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
          <mesh
            position={[side * a.shoulder.halfWidth, a.shoulder.y, 0]}
            castShadow
          >
            <sphereGeometry args={[armRadius * 1.3, 16, 16]} />
            <meshStandardMaterial color={accentColor} roughness={0.9} />
          </mesh>
          {/* Braço */}
          <mesh
            position={[side * armOffsetX, a.shoulder.y - armLength / 2, 0]}
            castShadow
          >
            <cylinderGeometry
              args={[armRadius, armRadius * 0.85, armLength, 16]}
            />
            <meshStandardMaterial color={skinColor} roughness={0.9} />
          </mesh>
          {/* Mão */}
          <mesh
            position={[side * armOffsetX, a.shoulder.y - armLength - armRadius, 0]}
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
          <mesh position={[side * legOffsetX, legLength / 2, 0]} castShadow>
            <cylinderGeometry
              args={[legRadius, legRadius * 0.7, legLength, 16]}
            />
            <meshStandardMaterial color={skinColor} roughness={0.9} />
          </mesh>
          {/* Pé */}
          <mesh position={[side * legOffsetX, 0.03, 0.06]} castShadow>
            <boxGeometry args={[legRadius * 1.6, 0.06, legRadius * 3]} />
            <meshStandardMaterial color="#222" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
