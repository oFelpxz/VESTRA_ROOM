"use client";

import Link from "next/link";
import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import { addToCartAction, type CartActionState } from "@/lib/cart-actions";
import {
  overallFit,
  recommendSize,
  regionFits,
  type BodyMeasures,
  type FitPreference,
  type GarmentKind,
} from "@/lib/fit-regions";
import {
  buildAvatarParams,
  predictAvatarMeasurements,
  type AvatarBody,
} from "@/lib/avatar-builder";
import { colorToHex } from "@/lib/color-names";
import { MOLDE_SIZE, sizeGrade, type Grade } from "@/lib/garment-fit";
import { bottomEase, bottomLength } from "@/lib/bottom-fit";
import type { LookProduct, OpenLook } from "@/lib/look-data";
import { TryOnScene, type CameraView, type ScenePiece } from "./tryon-scene";
import { FitCompare, FitIndicator, FitPill, SizeSuggestion } from "./fit-indicator";
import { LookBuilder, type LookSelection } from "./look-builder";

const initialState: CartActionState = {};

type Variant = {
  id: string;
  color: string;
  size: string;
  stockQuantity: number;
};

type SizeRow = {
  size: string;
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
  armLengthMinCm: number | null;
  armLengthMaxCm: number | null;
  legLengthMinCm: number | null;
  legLengthMaxCm: number | null;
};

type UserProfile = {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  shoulderCm: number | null;
  armLengthCm: number | null;
  legLengthCm: number | null;
  fitPreference: FitPreference;
};

// Só em desenvolvimento: simular outros corpos sem mexer no perfil salvo.
const SIMULATE = process.env.NODE_ENV !== "production";
type SimKey =
  | "heightCm"
  | "weightKg"
  | "chestCm"
  | "waistCm"
  | "hipCm"
  | "shoulderCm"
  | "armLengthCm"
  | "legLengthCm";
const SIM_FIELDS: { key: SimKey; label: string; min: number; max: number }[] = [
  { key: "heightCm", label: "Altura (cm)", min: 150, max: 200 },
  { key: "weightKg", label: "Peso (kg)", min: 45, max: 130 },
  { key: "chestCm", label: "Peito (cm)", min: 78, max: 125 },
  { key: "waistCm", label: "Cintura (cm)", min: 60, max: 120 },
  { key: "hipCm", label: "Quadril (cm)", min: 80, max: 130 },
  { key: "shoulderCm", label: "Ombros (cm)", min: 36, max: 56 },
  { key: "armLengthCm", label: "Braço (cm)", min: 45, max: 72 },
  { key: "legLengthCm", label: "Perna (cm)", min: 62, max: 95 },
];

/** Caimento por região de um tamanho e o resumo dele. */
function sizeFit(
  size: string | null,
  body: BodyMeasures,
  chart: SizeRow[],
  kind: GarmentKind,
  toleranceCm: number,
) {
  const row = chart.find((r) => r.size === size);
  const regions = row ? regionFits(body, row, chart, kind, toleranceCm) : [];
  return { regions, overall: overallFit(regions) };
}

export function TryOnExperience({
  productName,
  productId: _productId,
  variants,
  colors,
  sizes,
  garmentUrl,
  profile,
  sizeChart,
  kind,
  toleranceCm,
  companions,
  openLook,
}: {
  productName: string;
  productId: string;
  variants: Variant[];
  colors: string[];
  sizes: string[];
  garmentUrl: string | null;
  profile: UserProfile;
  sizeChart: SizeRow[];
  /** Tipo de peça, pela categoria (decide as regiões do caimento). */
  kind: GarmentKind;
  /** Folga do indicador de caimento (configurações da loja, 25.8). */
  toleranceCm: number;
  /** Peças que completam um look (item 15). */
  companions: LookProduct[];
  /** Look aberto pelo `?look=`. */
  openLook: OpenLook | null;
}) {
  const lookVariant = variants.find((v) => v.id === openLook?.ownVariantId);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    lookVariant?.color ?? colors[0] ?? null,
  );
  // Começa no look aberto, senão no tamanho sugerido, senão no molde (M) ou
  // no do meio.
  const [selectedSize, setSelectedSize] = useState<string | null>(() => {
    if (lookVariant) return lookVariant.size;
    const rec = recommendSize(profile, sizeChart, sizes, kind, profile.fitPreference, toleranceCm);
    if (rec) return rec.size;
    return sizes.includes(MOLDE_SIZE)
      ? MOLDE_SIZE
      : (sizes[Math.floor(sizes.length / 2)] ?? null);
  });
  // 3D-07: segundo tamanho, lado a lado
  const [compareSize, setCompareSize] = useState<string | null>(null);
  const [preference, setPreference] = useState<FitPreference>(
    profile.fitPreference,
  );
  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
  );
  // Corpo do avatar: começa no unissex; não é salvo no perfil
  const [bodyType, setBodyType] = useState<AvatarBody>("neutral");
  const [sim, setSim] = useState<Partial<Record<SimKey, number>>>({});
  const body = useMemo(() => ({ ...profile, ...sim }), [profile, sim]);

  // Parâmetros do avatar — medidas do usuário (ou as simuladas, em dev)
  const avatarParams = useMemo(
    () =>
      buildAvatarParams(
        {
          heightCm: body.heightCm,
          weightKg: body.weightKg,
          chestCm: body.chestCm,
          waistCm: body.waistCm,
          hipCm: body.hipCm,
          shoulderCm: body.shoulderCm,
          armLengthCm: body.armLengthCm,
          legLengthCm: body.legLengthCm,
        },
        bodyType,
      ),
    [body, bodyType],
  );

  // Perna (entrepernas) do avatar, em cm: a barra da calça depende dela.
  const avatarLegCm = useMemo(
    () => predictAvatarMeasurements(avatarParams.morphs).inseam,
    [avatarParams],
  );

  // A peça tem a forma do tamanho escolhido — não acompanha o corpo.
  const garmentGrade = useMemo(
    () => sizeGrade(selectedSize, sizeChart),
    [selectedSize, sizeChart],
  );

  const compareGrade = useMemo(
    () => sizeGrade(compareSize, sizeChart),
    [compareSize, sizeChart],
  );

  // Item 15: a peça escolhida em "Montar look" veste junto no avatar.
  const [companionSel, setCompanionSel] = useState<LookSelection | null>(null);
  const onCompanionChange = useCallback((sel: LookSelection | null) => setCompanionSel(sel), []);
  // O vestido veste como as peças de baixo (segue a pele) e não tem outra peça.
  const ownRole = kind === "bottom" || kind === "dress" ? "bottom" : "top";

  // Peça do provador num tamanho: a de cima pela graduação, a de baixo pela folga.
  const ownPiece = useCallback(
    (size: string | null, grade: Grade): ScenePiece | null =>
      garmentUrl
        ? {
            url: garmentUrl,
            color: selectedColor ? colorToHex(selectedColor) : undefined,
            grade,
            ease: bottomEase(size, sizeChart, body.hipCm),
            length: bottomLength(size, sizeChart, avatarLegCm),
          }
        : null,
    [garmentUrl, selectedColor, sizeChart, body.hipCm, avatarLegCm],
  );
  const companionPiece = useMemo((): ScenePiece | null => {
    const p = companionSel?.product;
    if (!companionSel || !p?.modelUrl) return null;
    return {
      url: p.modelUrl,
      color: companionSel.color ? colorToHex(companionSel.color) : undefined,
      grade: sizeGrade(companionSel.size, p.sizeChart),
      ease: bottomEase(companionSel.size, p.sizeChart, body.hipCm),
      length: bottomLength(companionSel.size, p.sizeChart, avatarLegCm),
    };
  }, [companionSel, body.hipCm, avatarLegCm]);

  // Vista da câmera, giro automático e foto do look
  const [view, setView] = useState<{ name: CameraView; n: number } | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  function downloadPhoto() {
    const canvas = sceneRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    const name = [productName, companionSel?.product.name].filter(Boolean).join(" + ");
    a.download = `VESTRA look - ${name}.png`;
    a.click();
  }
  // Foto pequena para "Meus looks": o meio da cena em retrato (3:4), JPEG 240x320.
  const takeLookPhoto = useCallback(() => {
    const canvas = sceneRef.current?.querySelector("canvas");
    if (!canvas || canvas.width === 0) return null;
    const width = 240;
    const height = 320;
    const cropH = Math.min(canvas.height, (canvas.width * height) / width);
    const cropW = (cropH * width) / height;
    const thumb = document.createElement("canvas");
    thumb.width = width;
    thumb.height = height;
    const ctx = thumb.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#f2f0ec";
    ctx.fillStyle = getComputedStyle(sceneRef.current!).backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(
      canvas,
      (canvas.width - cropW) / 2,
      (canvas.height - cropH) / 2,
      cropW,
      cropH,
      0,
      0,
      width,
      height,
    );
    return thumb.toDataURL("image/jpeg", 0.8);
  }, []);

  // 3D-06: caimento por região
  const fit = useMemo(
    () => sizeFit(selectedSize, body, sizeChart, kind, toleranceCm),
    [body, selectedSize, sizeChart, kind, toleranceCm],
  );
  const compareFit = useMemo(
    () => (compareSize ? sizeFit(compareSize, body, sizeChart, kind, toleranceCm) : null),
    [body, compareSize, sizeChart, kind, toleranceCm],
  );

  // 3D-08: tamanho sugerido (estimativa), pela preferência desta tentativa
  const recommendation = useMemo(
    () => recommendSize(body, sizeChart, sizes, kind, preference, toleranceCm),
    [body, sizeChart, sizes, kind, preference, toleranceCm],
  );

  // Variante da cor + tamanho escolhidos, mesmo sem estoque (para o look)
  const lookOwnVariant = variants.find(
    (v) => v.color === selectedColor && v.size === selectedSize,
  );

  const selectedVariant = variants.find(
    (v) =>
      v.color === selectedColor &&
      v.size === selectedSize &&
      v.stockQuantity > 0,
  );

  const colorAvailable = (color: string) =>
    variants.some((v) => v.color === color && v.stockQuantity > 0);

  const sizeAvailable = (size: string) =>
    selectedColor == null
      ? variants.some((v) => v.size === size && v.stockQuantity > 0)
      : variants.some(
          (v) =>
            v.color === selectedColor &&
            v.size === size &&
            v.stockQuantity > 0,
        );

  return (
    <div className="grid grid-cols-1 lg:h-[calc(100vh-4rem)] lg:grid-cols-[1fr_360px]">
      {/* Cena 3D */}
      <div
        ref={sceneRef}
        className={`relative grid bg-muted lg:h-auto ${
          compareSize
            ? // No celular, um embaixo do outro (lado a lado ficava estreito demais).
              "h-[110svh] grid-rows-2 divide-y divide-border md:h-[65vh] md:grid-cols-2 md:grid-rows-1 md:divide-x md:divide-y-0"
            : "h-[65vh]"
        }`}
      >
        {[
          { size: selectedSize, grade: garmentGrade, overall: fit.overall },
          ...(compareSize && compareFit
            ? [{ size: compareSize, grade: compareGrade, overall: compareFit.overall }]
            : []),
        ].map((scene, i) => {
          const own = ownPiece(scene.size, scene.grade);
          return (
          <div key={i} className="relative min-h-0">
            <TryOnScene
              avatarParams={avatarParams}
              top={ownRole === "top" ? own : companionPiece}
              bottom={ownRole === "bottom" ? own : companionPiece}
              primary={ownRole}
              view={view}
              autoRotate={autoRotate}
            />
            {compareSize && (
              <div className={`pointer-events-none absolute left-1/2 flex ${i === 0 ? "top-12" : "top-3 md:top-12"} -translate-x-1/2 items-center gap-2 rounded-sm bg-background/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]`}>
                Tam {scene.size}
                {scene.overall && <FitPill fit={scene.overall} />}
              </div>
            )}
          </div>
          );
        })}

        {/* Vistas, giro automático e foto */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5 sm:bottom-4 sm:left-4 sm:right-auto">
          {(
            [
              ["front", "Frente"],
              ["side", "Lado"],
              ["back", "Costas"],
            ] as const
          ).map(([name, label]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setAutoRotate(false);
                setView((v) => ({ name, n: (v?.n ?? 0) + 1 }));
              }}
              className="rounded-sm border border-foreground/20 bg-background/80 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors hover:border-foreground"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={autoRotate}
            onClick={() => setAutoRotate((r) => !r)}
            className={`rounded-sm border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors ${
              autoRotate
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 bg-background/80 hover:border-foreground"
            }`}
          >
            Girar<span className="hidden sm:inline"> sozinho</span>
          </button>
          <button
            type="button"
            onClick={downloadPhoto}
            className="rounded-sm border border-foreground/20 bg-background/80 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors hover:border-foreground"
          >
            <span className="hidden sm:inline">Baixar foto do look</span>
            <span className="sm:hidden">Foto</span>
          </button>
        </div>

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
          <span className="inline-block size-1.5 rounded-full bg-acid" />
          VESTRA FIT · Provador
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 hidden text-[10px] uppercase tracking-[0.2em] text-foreground/50 xl:block">
          arraste para girar · scroll para zoom
        </div>
      </div>

      {/* Painel lateral */}
      <aside className="flex flex-col gap-6 border-t border-border bg-background px-5 py-6 md:px-6 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Experimentando
          </p>
          <h2 className="font-heading mt-1 text-2xl font-bold uppercase tracking-tight">
            {productName}
          </h2>
        </div>

        {/* Caimento */}
        <SizeSuggestion
          recommendation={recommendation}
          selectedSize={selectedSize}
          onUse={(s) => {
            setSelectedSize(s);
            if (compareSize === s) setCompareSize(null);
          }}
        />
        {compareSize && compareFit && selectedSize ? (
          <FitCompare
            a={{ size: selectedSize, regions: fit.regions }}
            b={{ size: compareSize, regions: compareFit.regions }}
          />
        ) : (
          <FitIndicator
            size={selectedSize}
            overall={fit.overall}
            regions={fit.regions}
            kind={kind}
          />
        )}

        {SIMULATE && (
          <details className="rounded-sm border border-dashed border-border p-3 text-xs">
            <summary className="cursor-pointer font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Simular corpo (dev)
            </summary>
            <div className="mt-3 flex flex-col gap-2">
              {SIM_FIELDS.map((f) => {
                const value = body[f.key] ?? Math.round((f.min + f.max) / 2);
                return (
                  <label key={f.key} className="flex items-center gap-2">
                    <span className="w-24 shrink-0">{f.label}</span>
                    <input
                      type="range"
                      min={f.min}
                      max={f.max}
                      value={value}
                      onChange={(e) =>
                        setSim((s) => ({ ...s, [f.key]: Number(e.target.value) }))
                      }
                      className="flex-1"
                    />
                    <span className="w-8 text-right tabular-nums">{value}</span>
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => setSim({})}
                className="self-start text-[10px] font-semibold uppercase tracking-[0.15em] underline"
              >
                Voltar às minhas medidas
              </button>
            </div>
          </details>
        )}

        {/* Corpo do avatar */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Corpo
          </p>
          <div className="mt-3 flex gap-1.5">
            {(["male", "female"] as const).map((b) => {
              const active = bodyType === b;
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBodyType(active ? "neutral" : b)}
                  className={`flex-1 rounded-sm border px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {b === "male" ? "Homem" : "Mulher"}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {bodyType === "neutral"
              ? "Corpo unissex"
              : "Não salva no perfil — só nesta tentativa"}
          </p>
        </div>

        {/* Preferência de caimento */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Preferência de caimento
          </p>
          <div className="mt-3 flex gap-1.5">
            {(["SLIM", "REGULAR", "OVERSIZED"] as FitPreference[]).map((p) => {
              const active = preference === p;
              const label =
                p === "SLIM" ? "Slim" : p === "REGULAR" ? "Regular" : "Oversized";
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreference(p)}
                  className={`flex-1 rounded-sm border px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {preference !== profile.fitPreference && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Não salva no perfil — só nesta tentativa
            </p>
          )}
        </div>

        {/* Cor */}
        {colors.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Cor{" "}
              {selectedColor && (
                <span className="ml-2 normal-case tracking-normal text-foreground">
                  {selectedColor}
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {colors.map((c) => {
                const enabled = colorAvailable(c);
                const active = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(active ? null : c)}
                    disabled={!enabled}
                    className={`rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/20 hover:border-foreground"
                    } ${!enabled ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tamanho */}
        {sizes.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Tamanho{" "}
              {selectedSize && (
                <span className="ml-2 normal-case tracking-normal text-foreground">
                  {selectedSize}
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const enabled = sizeAvailable(s);
                const active = selectedSize === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedSize(active ? null : s);
                      if (compareSize === s) setCompareSize(null);
                    }}
                    disabled={!enabled}
                    className={`flex h-11 min-w-11 items-center justify-center rounded-sm border px-3 text-sm transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/20 hover:border-foreground"
                    } ${!enabled ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* 3D-07: comparar com outro tamanho (provar não depende de estoque) */}
            {selectedSize && sizes.length > 1 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Comparar<span className="hidden md:inline"> lado a lado</span> com
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sizes
                    .filter((s) => s !== selectedSize)
                    .map((s) => {
                      const active = compareSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCompareSize(active ? null : s)}
                          className={`flex h-9 min-w-9 items-center justify-center rounded-sm border px-2.5 text-xs transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-dashed border-foreground/30 hover:border-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  {compareSize && (
                    <button
                      type="button"
                      onClick={() => setCompareSize(null)}
                      className="px-2 text-[10px] font-semibold uppercase tracking-[0.15em] underline underline-offset-4"
                    >
                      Sair da comparação
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add ao carrinho */}
        <form action={formAction} className="mt-auto flex flex-col gap-3">
          <input
            type="hidden"
            name="productVariantId"
            value={selectedVariant?.id ?? ""}
          />
          <input type="hidden" name="quantity" value="1" />

          {state.error && (
            <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
              Adicionado à sacola.{" "}
              <Link href="/carrinho" className="font-semibold underline">
                Ver sacola
              </Link>
            </p>
          )}

          <button
            type="submit"
            disabled={!selectedVariant || pending}
            className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending
              ? "Adicionando..."
              : selectedVariant
                ? "Adicionar à sacola"
                : "Selecione cor e tamanho"}
          </button>
        </form>

        {/* Item 15: look com uma peça de cima e uma de baixo (ou um vestido) */}
        {(kind === "top" || kind === "bottom" || kind === "dress") && (
          <LookBuilder
            role={kind}
            ownVariantId={lookOwnVariant?.id ?? null}
            ownLabel={
              selectedColor && selectedSize
                ? `${productName} (${selectedColor}, ${selectedSize})`
                : productName
            }
            companions={companions}
            body={body}
            preference={preference}
            toleranceCm={toleranceCm}
            openLook={openLook}
            onChange={onCompanionChange}
            takePhoto={takeLookPhoto}
          />
        )}
      </aside>
    </div>
  );
}
