"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html, Center, Bounds } from "@react-three/drei";
import * as THREE from "three";

function Model({
  url,
  onStats,
}: {
  url: string;
  onStats: (stats: { triangles: number; materials: number }) => void;
}) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    let tris = 0;
    const mats = new Set<string>();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const g = mesh.geometry as THREE.BufferGeometry;
        if (g.index) {
          tris += g.index.count / 3;
        } else if (g.attributes.position) {
          tris += g.attributes.position.count / 3;
        }
        const m = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => mats.add(x.uuid));
        else if (m) mats.add(m.uuid);
      }
    });
    onStats({ triangles: Math.round(tris), materials: mats.size });
  }, [scene, onStats]);

  return <primitive object={scene} />;
}

function Loader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-acid" />
        Carregando modelo
      </div>
    </Html>
  );
}

export function Model3DValidator({
  url,
  fileSizeMb,
}: {
  url: string;
  fileSizeMb: number | null;
}) {
  const [bg, setBg] = useState<"light" | "dark">("light");
  const [stats, setStats] = useState<{ triangles: number; materials: number }>({
    triangles: 0,
    materials: 0,
  });
  const [resetKey, setResetKey] = useState(0);

  const bgColor = bg === "light" ? "#e7e2da" : "#0b0b0b";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-border bg-muted">
        <Canvas
          key={resetKey}
          camera={{ position: [3, 2, 5], fov: 50 }}
        >
          <color attach="background" args={[bgColor]} />
          <hemisphereLight intensity={0.7} groundColor="#cfcabd" />
          <ambientLight intensity={0.45} />
          <directionalLight position={[5, 6, 5]} intensity={1.4} />
          <directionalLight position={[-5, 2, -3]} intensity={0.6} />
          <Suspense fallback={<Loader />}>
            <Bounds fit clip observe margin={1.2}>
              <Center>
                <Model url={url} onStats={setStats} />
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault />
        </Canvas>

        {/* Controles flutuantes */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-sm bg-background/85 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground backdrop-blur">
            <button
              onClick={() => setBg("light")}
              className={`rounded-sm px-2 py-1 ${bg === "light" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"}`}
            >
              Claro
            </button>
            <button
              onClick={() => setBg("dark")}
              className={`rounded-sm px-2 py-1 ${bg === "dark" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"}`}
            >
              Escuro
            </button>
          </div>

          <button
            onClick={() => setResetKey((k) => k + 1)}
            className="pointer-events-auto rounded-sm bg-background/85 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground backdrop-blur hover:bg-background"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Metric
          label="Tamanho"
          value={fileSizeMb ? `${fileSizeMb} MB` : "—"}
        />
        <Metric label="Triângulos" value={stats.triangles.toLocaleString("pt-BR")} />
        <Metric label="Materiais" value={String(stats.materials)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-heading text-lg font-bold">{value}</p>
    </div>
  );
}
