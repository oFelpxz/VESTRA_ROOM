"use client";

import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  Center,
  Bounds,
} from "@react-three/drei";
import { Suspense, useMemo } from "react";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} />;
}

function Loader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-acid" />
        Carregando VESTRA FIT
      </div>
    </Html>
  );
}

export function Viewer3D({
  modelUrl,
  interactive = true,
  autoRotate = false,
}: {
  modelUrl?: string;
  interactive?: boolean;
  autoRotate?: boolean;
}) {
  if (!modelUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#e7e2da] text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/50">
        Modelo indisponível
      </div>
    );
  }

  return (
    <Canvas camera={{ position: [3, 2, 5], fov: 50 }}>
      {/* fundo de estúdio claro próprio (independente do CSS) */}
      <color attach="background" args={["#e7e2da"]} />

      {/* iluminação de estúdio — funciona para roupa clara ou escura */}
      <hemisphereLight intensity={0.7} groundColor="#cfcabd" />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 5]} intensity={1.4} />
      <directionalLight position={[-5, 2, -3]} intensity={0.6} />

      <Suspense fallback={<Loader />}>
        <Bounds fit clip observe margin={1.2}>
          <Center>
            <Model url={modelUrl} />
          </Center>
        </Bounds>
      </Suspense>

      <OrbitControls
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={1.1}
        enablePan={interactive}
        enableRotate={interactive}
        enableZoom={interactive}
      />
    </Canvas>
  );
}
