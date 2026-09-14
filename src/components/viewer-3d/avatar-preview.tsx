"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import { buildAvatarParams, type MeasurementInput } from "@/lib/avatar-builder";
import { Avatar } from "./avatar";

/**
 * Cena de pré-visualização do avatar (sem roupa).
 * Usada em /teste-3d como demonstração do VESTRA FIT.
 */
export function AvatarPreview({ measures }: { measures: MeasurementInput }) {
  const params = buildAvatarParams(measures);

  const camY = params.totalHeight * 0.55;
  const camDist = 2.4 + params.totalHeight * 0.5;

  return (
    <Canvas shadows camera={{ position: [0, camY, camDist], fov: 38 }}>
      <color attach="background" args={["#e7e2da"]} />

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

      <Suspense
        fallback={
          <Html center>
            <div className="flex items-center gap-2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-acid" />
              Montando avatar
            </div>
          </Html>
        }
      >
        <Avatar params={params} />
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
        target={[0, params.totalHeight * 0.5, 0]}
        minDistance={1.5}
        maxDistance={6}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 4}
      />
    </Canvas>
  );
}
