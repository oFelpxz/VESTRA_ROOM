"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  Center,
  Bounds,
} from "@react-three/drei";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

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

type ViewPreset = "front" | "side" | "back";

const AZIMUTH: Record<ViewPreset, number> = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};

/** Reposiciona a câmera num ângulo predefinido, preservando distância/elevação atuais. */
function CameraPreset({
  view,
  controlsRef,
}: {
  view: ViewPreset | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!view || !controls) return;

    const target = controls.target as THREE.Vector3;
    const offset = new THREE.Vector3().copy(camera.position).sub(target);
    const radius = offset.length();
    if (radius === 0) return;

    const polar = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));
    const newOffset = new THREE.Vector3().setFromSphericalCoords(
      radius,
      polar,
      AZIMUTH[view],
    );

    camera.position.copy(target).add(newOffset);
    camera.lookAt(target);
    controls.update();
  }, [view, camera, controlsRef]);

  return null;
}

const VIEW_LABEL: Record<ViewPreset, string> = {
  front: "Frente",
  side: "Lateral",
  back: "Costas",
};

export function Viewer3D({
  modelUrl,
  interactive = true,
  autoRotate = false,
  /** Mostra a barra de controles (iluminação, tela cheia, vistas). */
  controls = false,
}: {
  modelUrl?: string;
  interactive?: boolean;
  autoRotate?: boolean;
  controls?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const [bg, setBg] = useState<"light" | "dark">("light");
  const [view, setView] = useState<ViewPreset | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current?.requestFullscreen();
    }
  }

  if (!modelUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#e7e2da] text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/50">
        Modelo indisponível
      </div>
    );
  }

  const bgColor = bg === "light" ? "#e7e2da" : "#141414";

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full w-full ${isFullscreen ? "bg-background" : ""}`}
    >
      <Canvas camera={{ position: [3, 2, 5], fov: 50 }}>
        {/* fundo de estúdio — independente do CSS, funciona em tela cheia */}
        <color attach="background" args={[bgColor]} />

        {/* iluminação de estúdio — ajustada por tema claro/escuro */}
        <hemisphereLight
          intensity={bg === "light" ? 0.7 : 0.4}
          groundColor={bg === "light" ? "#cfcabd" : "#1a1a1a"}
        />
        <ambientLight intensity={bg === "light" ? 0.45 : 0.25} />
        <directionalLight position={[5, 6, 5]} intensity={bg === "light" ? 1.4 : 1.7} />
        <directionalLight position={[-5, 2, -3]} intensity={0.6} />

        <Suspense fallback={<Loader />}>
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <Model url={modelUrl} />
            </Center>
          </Bounds>
        </Suspense>

        <CameraPreset view={view} controlsRef={orbitRef} />

        <OrbitControls
          ref={orbitRef}
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={1.1}
          enablePan={interactive}
          enableRotate={interactive}
          enableZoom={interactive}
        />
      </Canvas>

      {controls && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-sm bg-background/85 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] backdrop-blur">
            {(["front", "side", "back"] as ViewPreset[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="rounded-sm px-2 py-1 text-foreground/60 transition-colors hover:text-foreground"
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            <div className="flex items-center gap-1 rounded-sm bg-background/85 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] backdrop-blur">
              <button
                type="button"
                onClick={() => setBg("light")}
                className={`rounded-sm px-2 py-1 ${bg === "light" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"}`}
              >
                Claro
              </button>
              <button
                type="button"
                onClick={() => setBg("dark")}
                className={`rounded-sm px-2 py-1 ${bg === "dark" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"}`}
              >
                Escuro
              </button>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-sm bg-background/85 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] backdrop-blur transition-colors hover:bg-background"
            >
              {isFullscreen ? "Sair" : "Tela cheia"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
