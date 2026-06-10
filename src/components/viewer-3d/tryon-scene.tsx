"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  Center,
  ContactShadows,
} from "@react-three/drei";
import type { AvatarParams } from "@/lib/avatar-builder";
import { Avatar } from "./avatar";

function Garment({
  url,
  params,
  selectedColor,
}: {
  url: string;
  params: AvatarParams;
  selectedColor?: string;
}) {
  const { scene } = useGLTF(url);

  // Aproximação: posiciona a roupa de modo que seu centro fique na altura do peito
  // e escala suavemente com a circunferência do peito.
  const a = params.anchors;
  const garmentScale = Math.max(
    1.0,
    (a.chest.halfWidth * 2) / 0.38, // referência: largura ~0.38m de torso médio
  );

  // Aplica cor selecionada como tint sutil em todos os materiais
  if (selectedColor) {
    scene.traverse((obj) => {
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
  }

  return (
    <group
      position={[0, a.chest.y - 0.05, 0]}
      scale={[garmentScale, garmentScale, garmentScale]}
    >
      <Center disableY>
        <primitive object={scene} />
      </Center>
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
}: {
  avatarParams: AvatarParams;
  garmentUrl: string | null;
  selectedColor?: string;
}) {
  // Câmera "afasta" se o avatar for mais alto
  const camY = avatarParams.totalHeight * 0.55;
  const camDist = 2.4 + avatarParams.totalHeight * 0.5;

  return (
    <Canvas
      shadows
      camera={{ position: [0, camY, camDist], fov: 38 }}
    >
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
