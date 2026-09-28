"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import type { FitPreference } from "@/lib/fit-calculator";
import { buildGarmentFit, type GarmentSizeRow } from "@/lib/garment-fit";
import { Avatar } from "./avatar";

/** Número de fatias horizontais usadas para medir a largura da malha. */
const SLICES = 24;
/** Faixa de fatias considerada "torso" — evita gola/manga no topo e barra embaixo. */
const TORSO_BAND = { from: 0.15, to: 0.75 };

/**
 * Mede a malha da peça. A largura de torso é a mediana das fatias centrais:
 * a bounding box sozinha mede envergadura quando a peça está em A-pose.
 */
function measureGarment(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = size.y || 1;
  const slices = Array.from({ length: SLICES }, () => ({
    min: Infinity,
    max: -Infinity,
  }));

  const vertex = new THREE.Vector3();
  model.updateWorldMatrix(true, true);
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry?.getAttribute("position");
    if (!position) return;
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      const t = (vertex.y - box.min.y) / height;
      const index = clampIndex(Math.floor(t * SLICES));
      const slice = slices[index];
      if (vertex.x < slice.min) slice.min = vertex.x;
      if (vertex.x > slice.max) slice.max = vertex.x;
    }
  });

  const widths: number[] = [];
  const from = Math.floor(SLICES * TORSO_BAND.from);
  const to = Math.ceil(SLICES * TORSO_BAND.to);
  for (let i = from; i < to; i += 1) {
    const slice = slices[i];
    if (slice.max > slice.min) widths.push(slice.max - slice.min);
  }
  widths.sort((a, b) => a - b);
  const torsoWidth = widths.length
    ? widths[Math.floor(widths.length / 2)]
    : size.x;

  return { box, size, center, torsoWidth };
}

function clampIndex(i: number) {
  return Math.min(SLICES - 1, Math.max(0, i));
}

function Garment({
  url,
  params,
  selectedColor,
  sizeRow,
  preference,
}: {
  url: string;
  params: AvatarParams;
  selectedColor?: string;
  sizeRow: GarmentSizeRow | null;
  preference: FitPreference;
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);

  const shape = useMemo(() => measureGarment(model), [model]);

  const fit = useMemo(
    () =>
      buildGarmentFit({
        params,
        naturalHeight: shape.size.y,
        naturalTorsoWidth: shape.torsoWidth,
        sizeRow,
        preference,
      }),
    [params, shape, sizeRow, preference],
  );

  // Aplica cor selecionada como tint em todos os materiais
  useMemo(() => {
    if (!selectedColor) return;
    model.traverse((obj) => {
      const mesh = obj as unknown as {
        isMesh?: boolean;
        material?: { color?: { set: (c: string) => void } };
      };
      if (mesh.isMesh && mesh.material?.color) {
        try {
          mesh.material.color.set(selectedColor);
        } catch {
          // ignora se o material não suporta cor
        }
      }
    });
  }, [model, selectedColor]);

  return (
    <group position={[0, fit.topY, 0]} scale={fit.scale}>
      {/* Topo da malha em y=0 (encosta no ombro), centrada em X/Z. */}
      <group position={[-shape.center.x, -shape.box.max.y, -shape.center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-acid" />
        Preparando VESTRA FIT
      </div>
    </Html>
  );
}

export function TryOnScene({
  avatarParams,
  garmentUrl,
  selectedColor,
  sizeRow,
  preference,
}: {
  avatarParams: AvatarParams;
  garmentUrl: string | null;
  selectedColor?: string;
  sizeRow: GarmentSizeRow | null;
  preference: FitPreference;
}) {
  // Câmera "afasta" se o avatar for mais alto
  const camY = avatarParams.totalHeight * 0.55;
  const camDist = 2.4 + avatarParams.totalHeight * 0.5;

  return (
    <Canvas shadows camera={{ position: [0, camY, camDist], fov: 38 }}>
      <color attach="background" args={["#e7e2da"]} />

      {/* Iluminação de estúdio */}
      <hemisphereLight intensity={0.55} groundColor="#cfcabd" />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} />

      <Suspense fallback={<Loader />}>
        <Avatar params={avatarParams} />
        {garmentUrl && (
          <Garment
            url={garmentUrl}
            params={avatarParams}
            selectedColor={selectedColor}
            sizeRow={sizeRow}
            preference={preference}
          />
        )}
        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={0.45}
          scale={4}
          blur={2.4}
          far={2}
        />
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, avatarParams.totalHeight * 0.5, 0]}
        minDistance={1.5}
        maxDistance={6}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 4}
      />
    </Canvas>
  );
}
