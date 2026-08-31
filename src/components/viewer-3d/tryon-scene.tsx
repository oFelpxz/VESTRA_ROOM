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
  const model = useMemo(() => scene.clone(true), [scene]);

  // Mede a bounding box natural do modelo (em suas próprias unidades)
  // e calcula a escala que faz a roupa caber no torso do avatar.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Torso "vestível" do avatar: do ombro até um pouco abaixo do quadril
    const torsoTop = params.anchors.shoulder.y;
    const torsoBottom = params.anchors.hip.y - params.totalHeight * 0.08;
    const targetHeight = torsoTop - torsoBottom;

    // Escala baseada na altura do torso — multiplicador suaviza para hoodie
    // ficar caindo um pouco abaixo do quadril (não fica espremido)
    const baseScale = (targetHeight / size.y) * 1.15;

    // Ajuste de largura: se a peça é mais larga, escalamos um pouco mais
    // baseado na largura dos ombros do avatar
    const shoulderWidth = params.anchors.shoulder.halfWidth * 2;
    const shoulderRatio = shoulderWidth / (size.x * baseScale);
    const widthBoost = Math.max(1.0, shoulderRatio * 1.05);

    return {
      scale: baseScale * widthBoost,
      offset: center, // centro natural do modelo para subtrair
      naturalSize: size,
    };
  }, [model, params]);

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

  // Posiciona o grupo de modo que o centro Y do modelo (escalado) fique
  // na altura do centro do torso do avatar.
  const torsoCenterY =
    (params.anchors.shoulder.y + params.anchors.hip.y) / 2;

  return (
    <group position={[0, torsoCenterY, 0]} scale={fit.scale}>
      {/* Compensa o offset do modelo para que ele seja centralizado em (0,0,0) */}
      <group position={[-fit.offset.x, -fit.offset.y, -fit.offset.z]}>
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
}: {
  avatarParams: AvatarParams;
  garmentUrl: string | null;
  selectedColor?: string;
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
