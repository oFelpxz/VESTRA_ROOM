"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  ContactShadows,
  PerformanceMonitor,
} from "@react-three/drei";
import * as THREE from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import type { TopHem } from "@/lib/bottom-fit";
import { MOLDE_GRADE, type Grade } from "@/lib/garment-fit";
import { tintMaterial } from "@/lib/garment-color";
import type { GarmentLook } from "@/lib/garment-prints";
import { CLOSE_DISTANCE, closeUpY, type Box } from "@/lib/close-up";
import { liteMode, type LiteMode } from "@/lib/render-quality";
import { AvatarErrorBoundary } from "./avatar";
import { AVATAR_URL, DressedAvatar } from "./dressed-avatar";
import { BareAvatar, BottomGarment, Shoes, hemHeight } from "./bottom-garment";
import { LiteContext } from "./lite-context";
import { StudioAO } from "./studio-ao";
import { STUDIO_TONE_MAPPING, StudioLights } from "./studio-lights";
import { isAccessoryPiece, isBottomPiece, isFittedToMannequin } from "./mannequin-mark";

/**
 * Peça ajustada ao corpo de referência (marca `vestra_fit`) aparece vestida
 * no avatar do cliente; as demais seguem no encaixe aproximado antigo.
 */
function TryOnGarment({
  url,
  params,
  grade,
  selectedColor,
  look,
}: {
  url: string;
  params: AvatarParams;
  grade: Grade;
  selectedColor?: string;
  look?: GarmentLook | null;
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
        look={look}
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
  /** Versão com estampa (Street/Sport), lida do nome da cor. */
  look?: GarmentLook | null;
  /** Peça de cima: graduação do tamanho em relação ao molde (M). */
  grade?: Grade;
  /** Peça de baixo: folga do tamanho em relação ao molde (m). */
  ease?: number;
  /** Peça de baixo: quanto é mais longa que a perna (m, ver `bottomLength`). */
  length?: number;
};

/** Vistas dos botões; "chest" e "hem" são o close do tecido. */
export type CameraView = "front" | "side" | "back" | "chest" | "hem";

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
  // Barra da peça já vestida no cliente; até ela chegar, a do molde.
  const [hem, setHem] = useState<TopHem | null>(null);
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
            look={top.look}
            onHem={setHem}
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
            tuck={fitted ? (hem ?? tuckY) : null}
            selectedColor={bottom.color}
          />
        </Suspense>
      </AvatarErrorBoundary>
    </>
  );
}

/** Acessório (touca) preso à pele da cabeça, por cima das outras peças. */
function Accessory({ params, piece }: { params: AvatarParams; piece: ScenePiece }) {
  return (
    <AvatarErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <BottomGarment url={piece.url} params={params} ease={0} selectedColor={piece.color} />
      </Suspense>
    </AvatarErrorBoundary>
  );
}

/**
 * Escolhe como vestir: com peça de baixo moldada, o look inteiro; senão, só a
 * peça do provador (`primary`), como antes.
 */
export function Outfit({
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
  const piece = primary === "bottom" ? bottom : top;
  const pieceScene = useGLTF(piece?.url ?? AVATAR_URL).scene;
  if (bottom && isBottomPiece(bottomScene)) {
    return <DressedLook params={params} top={top} bottom={bottom} />;
  }
  if (!piece) return null;
  // Provador do próprio acessório: o corpo sem roupa com ele na cabeça.
  if (isAccessoryPiece(pieceScene)) {
    return (
      <>
        <BareAvatar params={params} />
        <Accessory params={params} piece={piece} />
      </>
    );
  }
  return (
    <TryOnGarment
      url={piece.url}
      params={params}
      grade={piece.grade ?? MOLDE_GRADE}
      selectedColor={piece.color}
      look={piece.look}
    />
  );
}

const VIEW_ANGLE: Record<"front" | "side" | "back", number> = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};

const MIN_DISTANCE = 1.5;
/** Provador da touca: a câmera abre na cabeça, não no corpo inteiro. */
const HEAD_DISTANCE = 1.0;

type Controls = THREE.EventDispatcher<{ start: object }> & {
  target: THREE.Vector3;
  minDistance: number;
  update: () => void;
};

// Fora do componente: os controles são da cena, não do estado do React.
function setMinDistance(c: Controls, d: number) {
  c.minDistance = d;
}

function isFabric(o: THREE.Object3D) {
  const m = (o as THREE.Mesh).material as THREE.Material | undefined;
  return !!m && !Array.isArray(m) && m.customProgramCacheKey().startsWith("vestra-fabric");
}

/**
 * Leva a câmera para frente/lado/costas (mantendo distância e altura) ou
 * para perto do tecido (peito ou barra da peça do provador), deslizando.
 * Arrastar no meio do caminho cancela.
 */
function CameraRig({
  view,
  params,
  primary,
  home,
  head,
}: {
  view: { name: CameraView; n: number } | null;
  params: AvatarParams;
  primary: "top" | "bottom";
  home: { y: number; dist: number; targetY: number };
  head: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; close: boolean } | null>(null);
  const close = useRef(false);

  // Na touca a câmera já começa mais perto que o limite do corpo inteiro.
  const minDistance = head ? 0.6 : MIN_DISTANCE;

  useEffect(() => {
    if (!controls) return;
    setMinDistance(controls, minDistance);
    const stop = () => {
      if (goal.current) close.current = goal.current.close;
      goal.current = null;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls, minDistance]);

  useEffect(() => {
    if (!view || !controls) return;
    if (head && (view.name === "chest" || view.name === "hem")) {
      // Close da touca: a trama da malha na lateral da cabeça.
      const y = params.anchors.head.y + 0.07;
      const a = 0.6;
      const d = CLOSE_DISTANCE * 0.6;
      goal.current = {
        target: new THREE.Vector3(0, y, 0),
        pos: new THREE.Vector3(Math.sin(a) * d, y + 0.05, Math.cos(a) * d),
        close: true,
      };
    } else if (view.name === "chest" || view.name === "hem") {
      const boxes: Box[] = [];
      scene.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh || !isFabric(o)) return;
        const b = new THREE.Box3().setFromObject(o);
        if (!b.isEmpty()) boxes.push({ minY: b.min.y, maxY: b.max.y });
      });
      const y = closeUpY(view.name, boxes, primary, {
        chestY: params.anchors.chest.y,
        shoulderY: params.anchors.shoulder.y,
        hipY: params.anchors.hip.y,
      });
      // Um pouco de lado e de cima: o brilho do tecido e a trama aparecem.
      const a = 0.35;
      goal.current = {
        target: new THREE.Vector3(0, y, 0),
        pos: new THREE.Vector3(Math.sin(a) * CLOSE_DISTANCE, y + 0.08, Math.cos(a) * CLOSE_DISTANCE),
        close: true,
      };
    } else {
      const a = VIEW_ANGLE[view.name];
      // Saindo do close, volta para a distância e a altura do começo.
      const from = goal.current?.close || close.current;
      const t = from ? new THREE.Vector3(0, home.targetY, 0) : controls.target.clone();
      const offset = camera.position.clone().sub(controls.target);
      const flat = from ? home.dist : Math.hypot(offset.x, offset.z);
      const y = from ? home.y : camera.position.y;
      goal.current = {
        target: t,
        pos: new THREE.Vector3(t.x + Math.sin(a) * flat, y, t.z + Math.cos(a) * flat),
        close: false,
      };
    }
    // Deixa chegar perto durante o caminho; volta ao limite no fim.
    setMinDistance(controls, 0.3);
  }, [view, camera, controls, scene, params, primary, home, head]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 7);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.002 && controls.target.distanceTo(g.target) < 0.002) {
      camera.position.copy(g.pos);
      controls.target.copy(g.target);
      close.current = g.close;
      setMinDistance(controls, g.close ? 0.3 : minDistance);
      controls.update();
      goal.current = null;
    }
  });
  return null;
}

// Lido uma vez por página (o aparelho não muda); no servidor, completo.
let deviceMode: LiteMode | null = null;
const FULL: LiteMode = { lite: false, auto: false };
function readDeviceMode(): LiteMode {
  deviceMode ??= liteMode({
    search: window.location.search,
    touch: window.matchMedia("(pointer: coarse)").matches,
    cores: navigator.hardwareConcurrency,
    memory: (navigator as { deviceMemory?: number }).deviceMemory,
  });
  return deviceMode;
}
const noSubscribe = () => () => {};

export function TryOnScene({
  avatarParams,
  top,
  bottom,
  accessory = null,
  primary,
  view = null,
  autoRotate = false,
  focus = "body",
}: {
  avatarParams: AvatarParams;
  top: ScenePiece | null;
  bottom: ScenePiece | null;
  /** Acessório do look (touca), por cima das outras peças. */
  accessory?: ScenePiece | null;
  /** Peça do provador (a outra é a que completa o look). */
  primary: "top" | "bottom";
  /** Vista pedida pelos botões (n muda a cada clique). */
  view?: { name: CameraView; n: number } | null;
  autoRotate?: boolean;
  /** "head": provador da touca, enquadrado da cabeça ao peito. */
  focus?: "body" | "head";
}) {
  const head = focus === "head";
  const headY = avatarParams.anchors.head.y;
  const home = useMemo(
    () =>
      head
        ? { y: headY + 0.12, dist: HEAD_DISTANCE, targetY: headY + 0.04 }
        : // Câmera "afasta" se o avatar for mais alto
          {
            y: avatarParams.totalHeight * 0.55,
            dist: 2.4 + avatarParams.totalHeight * 0.5,
            targetY: avatarParams.totalHeight * 0.5,
          },
    [head, headY, avatarParams.totalHeight],
  );

  // Modo leve (src/lib/render-quality.ts): pelo aparelho ou se travar.
  const device = useSyncExternalStore(noSubscribe, readDeviceMode, () => FULL);
  const [slow, setSlow] = useState(false);
  const lite = device.lite || slow;

  return (
    <Canvas
      shadows={!lite}
      dpr={lite ? 1 : [1.5, 2]}
      data-lite={lite ? "1" : undefined}
      camera={{ position: [0, home.y, home.dist], fov: 38 }}
      // Mantém a imagem para o botão "Baixar foto do look".
      gl={{ preserveDrawingBuffer: true, toneMapping: STUDIO_TONE_MAPPING }}
    >
      <color attach="background" args={["#e7e2da"]} />

      {device.auto && !lite && <PerformanceMonitor onDecline={() => setSlow(true)} />}
      <StudioLights shadows={!lite} />

      <LiteContext.Provider value={lite}>
      <Suspense fallback={<Loader />}>
        {top || bottom ? (
          <Outfit params={avatarParams} top={top} bottom={bottom} primary={primary} />
        ) : (
          accessory && <BareAvatar params={avatarParams} />
        )}
        {accessory && <Accessory params={avatarParams} piece={accessory} />}
        {(top || bottom || accessory) && (
          <AvatarErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <Shoes params={avatarParams} />
            </Suspense>
          </AvatarErrorBoundary>
        )}
        {!lite && (
          <ContactShadows
            position={[0, 0.005, 0]}
            opacity={0.45}
            scale={4}
            blur={2.4}
            far={2}
          />
        )}
      </Suspense>
      </LiteContext.Provider>

      <OrbitControls
        makeDefault
        target={[0, home.targetY, 0]}
        maxDistance={6}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 4}
        autoRotate={autoRotate}
        autoRotateSpeed={1.6}
      />
      <CameraRig view={view} params={avatarParams} primary={primary} home={home} head={head} />
      {!lite && <StudioAO />}
    </Canvas>
  );
}
