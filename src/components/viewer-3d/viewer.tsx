"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense } from "react";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

useGLTF.preload("/models/Duck.glb");

export function Viewer3D({
  modelUrl = "/models/Duck.glb",
}: {
  modelUrl?: string;
}) {
  return (
    <Canvas camera={{ position: [3, 2, 5], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <Suspense fallback={null}>
        <Model url={modelUrl} />
      </Suspense>
      <OrbitControls />
    </Canvas>
  );
}
