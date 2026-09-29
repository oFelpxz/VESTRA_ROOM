"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { addToCartAction, type CartActionState } from "@/lib/cart-actions";
import {
  calculateFit,
  type FitPreference,
} from "@/lib/fit-calculator";
import { buildAvatarParams } from "@/lib/avatar-builder";
import { MOLDE_SIZE, sizeGrade } from "@/lib/garment-fit";
import { TryOnScene } from "./tryon-scene";
import { FitIndicator } from "./fit-indicator";

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

// Pequena paleta para "cor visual" — mapeia nome → hex aproximado
const COLOR_HEX: Record<string, string> = {
  preto: "#1a1a1a",
  branco: "#f4f1ea",
  white: "#f4f1ea",
  "off-white": "#ece6d8",
  areia: "#cdb896",
  cinza: "#9c9c9c",
  azul: "#2a4a8a",
  vermelho: "#a02a2a",
  verde: "#2a7a3a",
  bege: "#d4c4a8",
  marrom: "#5a3a26",
  rosa: "#d48aa8",
  amarelo: "#e0b840",
};

function colorToHex(name: string): string {
  const key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return COLOR_HEX[key] ?? "#3a3a3a";
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
}: {
  productName: string;
  productId: string;
  variants: Variant[];
  colors: string[];
  sizes: string[];
  garmentUrl: string | null;
  profile: UserProfile;
  sizeChart: SizeRow[];
}) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors[0] ?? null,
  );
  // Começa no tamanho do molde (M), se a peça tiver; senão, no do meio.
  const [selectedSize, setSelectedSize] = useState<string | null>(
    sizes.includes(MOLDE_SIZE)
      ? MOLDE_SIZE
      : (sizes[Math.floor(sizes.length / 2)] ?? null),
  );
  const [preference, setPreference] = useState<FitPreference>(
    profile.fitPreference,
  );
  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
  );
  const [sim, setSim] = useState<Partial<Record<SimKey, number>>>({});
  const body = useMemo(() => ({ ...profile, ...sim }), [profile, sim]);

  // Parâmetros do avatar — medidas do usuário (ou as simuladas, em dev)
  const avatarParams = useMemo(
    () =>
      buildAvatarParams({
        heightCm: body.heightCm,
        weightKg: body.weightKg,
        chestCm: body.chestCm,
        waistCm: body.waistCm,
        hipCm: body.hipCm,
        shoulderCm: body.shoulderCm,
        armLengthCm: body.armLengthCm,
        legLengthCm: body.legLengthCm,
      }),
    [body],
  );

  // A peça tem a forma do tamanho escolhido — não acompanha o corpo.
  const garmentGrade = useMemo(
    () => sizeGrade(selectedSize, sizeChart),
    [selectedSize, sizeChart],
  );

  // Linha da SizeChart correspondente ao tamanho selecionado
  const currentSizeRow = useMemo(
    () => sizeChart.find((r) => r.size === selectedSize),
    [sizeChart, selectedSize],
  );

  // Cálculo do caimento
  const fitResult = useMemo(() => {
    if (!currentSizeRow) {
      return {
        label: "IDEAL" as const,
        score: 0,
        details: [],
      };
    }
    return calculateFit(
      {
        chestCm: body.chestCm,
        waistCm: body.waistCm,
        hipCm: body.hipCm,
        armLengthCm: body.armLengthCm,
        legLengthCm: body.legLengthCm,
      },
      currentSizeRow,
      preference,
    );
  }, [body, currentSizeRow, preference]);

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
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_360px]">
      {/* Cena 3D */}
      <div className="relative bg-muted">
        <TryOnScene
          avatarParams={avatarParams}
          garmentUrl={garmentUrl}
          selectedColor={selectedColor ? colorToHex(selectedColor) : undefined}
          garmentGrade={garmentGrade}
        />

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-foreground/60">
          <span className="inline-block size-1.5 rounded-full bg-acid" />
          VESTRA FIT · Provador
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 text-[10px] uppercase tracking-[0.2em] text-foreground/50">
          arraste para girar · scroll para zoom
        </div>
      </div>

      {/* Painel lateral */}
      <aside className="flex flex-col gap-6 overflow-y-auto border-t border-border bg-background px-5 py-6 md:px-6 lg:border-l lg:border-t-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Experimentando
          </p>
          <h2 className="font-heading mt-1 text-2xl font-bold uppercase tracking-tight">
            {productName}
          </h2>
        </div>

        {/* Caimento */}
        <FitIndicator result={fitResult} />

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
                    onClick={() => setSelectedSize(active ? null : s)}
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
      </aside>
    </div>
  );
}
