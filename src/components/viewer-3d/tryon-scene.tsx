"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import { MOLDE_GRADE, type Grade } from "@/lib/garment-fit";
import { tintMaterial } from "@/lib/garment-color";
import { AvatarErrorBoundary } from "./avatar";
import { AVATAR_URL, DressedAvatar } from "./dressed-avatar";
import { BareAvatar, BottomGarment, hemHeight } from "./bottom-garment";
import { isBottomPiece, isFittedToMannequin } from "./mannequin-mark";

/**
 * Peça ajustada ao corpo de referência (marca `vestra_fit`) aparece vestida
 * no avatar do cliente; as demais seguem no encaixe aproximado antigo.
 */
function TryOnGarment({
  url,
  params,
  grade,
  selectedColor,
}: {
  url: string;
  params: AvatarParams;
  grade: Grade;
  selectedColor?: string;
}) {
  const { scene } = useGLTF(url);
  const loose = (
    <Garment url={url} params={params} selectedColor={selectedColor} />
  );
  if (!isFittedToMannequin(scene)) return loose;
  // Se o avatar não carregar, a peça ainda aparece (encaixe antigo).
  return (
    <AvatarErrorBoundary fallback={loose}>
      <DressedAvatar
        garmentUrl={url}
        params={params}
        grade={grade}
        selectedColor={selectedColor}
      />
    </AvatarErrorBoundary>
  );
}

// Material do arquivo de cada mesh, antes de receber a cor.
const sourceMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

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

  // Cor selecionada numa cópia dos materiais (os originais ficam no cache do
  // useGLTF e aparecem em outras telas).
  const tinted = useMemo(() => {
    const created: THREE.Material[] = [];
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // sempre a partir do material do arquivo, não da cópia da cor anterior
      const source = sourceMaterials.get(mesh) ?? mesh.material;
      sourceMaterials.set(mesh, source);
      const tint = (m: THREE.Material) => {
        const t = tintMaterial(m, selectedColor);
        created.push(t);
        return t;
      };
      mesh.material = Array.isArray(source) ? source.map(tint) : tint(source);
    });
    return created;
  }, [model, selectedColor]);
  useEffect(() => () => tinted.forEach((m) => m.dispose()), [tinted]);

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

/** Uma peça do look na cena: modelo, cor e tamanho. */
export type ScenePiece = {
  url: string;
  color?: string;
  /** Peça de cima: graduação do tamanho em relação ao molde (M). */
  grade?: Grade;
  /** Peça de baixo: folga do tamanho em relação ao molde (m). */
  ease?: number;
  /** Peça de baixo: quanto é mais longa que a perna (m, ver `bottomLength`). */
  length?: number;
};

export type CameraView = "front" | "side" | "back";

/**
 * Look com peça de baixo: a de cima veste o corpo (DressedAvatar desenha o
 * corpo junto) e a de baixo acompanha o mesmo corpo, por dentro da de cima.
 */
function DressedLook({
  params,
  top,
  bottom,
}: {
  params: AvatarParams;
  top: ScenePiece | null;
  bottom: ScenePiece;
}) {
  const topScene = useGLTF(top?.url ?? bottom.url).scene;
  const fitted = top != null && isFittedToMannequin(topScene);
  const tuckY = useMemo(() => (fitted ? hemHeight(topScene) : null), [fitted, topScene]);
  const bare = <BareAvatar params={params} />;

  return (
    <>
      {!top ? (
        bare
      ) : fitted ? (
        <AvatarErrorBoundary fallback={bare}>
          <DressedAvatar
            garmentUrl={top.url}
            params={params}
            grade={top.grade ?? MOLDE_GRADE}
            selectedColor={top.color}
          />
        </AvatarErrorBoundary>
      ) : (
        <>
          {bare}
          <Garment url={top.url} params={params} selectedColor={top.color} />
        </>
      )}
      <AvatarErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <BottomGarment
            url={bottom.url}
            params={params}
            ease={bottom.ease ?? 0}
            length={bottom.length ?? 0}
            tuckY={tuckY}
            selectedColor={bottom.color}
          />
        </Suspense>
      </AvatarErrorBoundary>
    </>
  );
}

/**
 * Escolhe como vestir: com peça de baixo moldada, o look inteiro; senão, só a
 * peça do provador (`primary`), como antes.
 */
function Outfit({
  params,
  top,
  bottom,
  primary,
}: {
  params: AvatarParams;
  top: ScenePiece | null;
  bottom: ScenePiece | null;
  primary: "top" | "bottom";
}) {
  const bottomScene = useGLTF(bottom?.url ?? top?.url ?? AVATAR_URL).scene;
  if (bottom && isBottomPiece(bottomScene)) {
    return <DressedLook params={params} top={top} bottom={bottom} />;
  }
  const piece = primary === "bottom" ? bottom : top;
  if (!piece) return null;
  return (
    <TryOnGarment
      url={piece.url}
      params={params}
      grade={piece.grade ?? MOLDE_GRADE}
      selectedColor={piece.color}
    />
  );
}

const VIEW_ANGLE: Record<CameraView, number> = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};

/** Leva a câmera para frente/lado/costas, mantendo a distância e a altura. */
function CameraRig({ view }: { view: { name: CameraView; n: number } | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    if (!view || !controls) return;
    const t = controls.target;
    const offset = camera.position.clone().sub(t);
    const flat = Math.hypot(offset.x, offset.z);
    const a = VIEW_ANGLE[view.name];
    camera.position.set(t.x + Math.sin(a) * flat, camera.position.y, t.z + Math.cos(a) * flat);
    controls.update();
  }, [view, camera, controls]);
  return null;
}

export function TryOnScene({
  avatarParams,
  top,
  bottom,
  primary,
  view = null,
  autoRotate = false,
}: {
  avatarParams: AvatarParams;
  top: ScenePiece | null;
  bottom: ScenePiece | null;
  /** Peça do provador (a outra é a que completa o look). */
  primary: "top" | "bottom";
  /** Vista pedida pelos botões (n muda a cada clique). */
  view?: { name: CameraView; n: number } | null;
  autoRotate?: boolean;
}) {
  // Câmera "afasta" se o avatar for mais alto
  const camY = avatarParams.totalHeight * 0.55;
  const camDist = 2.4 + avatarParams.totalHeight * 0.5;

  return (
    <Canvas
      shadows
      camera={{ position: [0, camY, camDist], fov: 38 }}
      // Mantém a imagem para o botão "Baixar foto do look".
      gl={{ preserveDrawingBuffer: true }}
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
        {(top || bottom) && (
          <Outfit params={avatarParams} top={top} bottom={bottom} primary={primary} />
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
        autoRotate={autoRotate}
        autoRotateSpeed={1.6}
      />
      <CameraRig view={view} />
    </Canvas>
  );
}
