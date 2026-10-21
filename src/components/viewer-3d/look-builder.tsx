"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState, type FormEvent } from "react";
import { saveLookAction, type LookFormState } from "@/lib/look-actions";
import {
  overallFit,
  recommendSize,
  regionFits,
  type BodyMeasures,
  type FitPreference,
} from "@/lib/fit-regions";
import { LOOK_NAME_LIMIT } from "@/lib/looks";
import type { LookProduct, OpenLook } from "@/lib/look-data";
import { ProductPlaceholder } from "@/components/product/product-placeholder";
import { FitPill } from "./fit-indicator";

const initialState: LookFormState = {};

const chip = (active: boolean, enabled = true) =>
  `rounded-sm border px-3 py-1.5 text-sm transition-colors ${
    active ? "border-foreground bg-foreground text-background" : "border-foreground/20 hover:border-foreground"
  } ${enabled ? "" : "cursor-not-allowed opacity-40 line-through"}`;

/**
 * Item 15: monta um look com a peça do provador (de cima ou de baixo) e uma
 * peça que a completa. O vestido é o look inteiro: só nome e salvar. A escolha (peça, cor, tamanho) sobe por `onChange`:
 * se a peça tiver molde 3D, o provador veste as duas no avatar. Sem molde, ela
 * aparece só como cartão, com o caimento estimado pelas medidas.
 */

/** Peça escolhida para completar o look, como o provador precisa para vestir. */
export type LookSelection = {
  product: LookProduct;
  color: string | null;
  size: string | null;
};
export function LookBuilder({
  role,
  ownVariantId,
  ownLabel,
  companions,
  body,
  preference,
  toleranceCm,
  openLook,
  onChange,
  takePhoto,
}: {
  role: "top" | "bottom" | "dress";
  /** Variante da peça do provador (cor + tamanho escolhidos), com ou sem estoque. */
  ownVariantId: string | null;
  ownLabel: string;
  companions: LookProduct[];
  body: BodyMeasures;
  preference: FitPreference;
  toleranceCm: number;
  openLook: OpenLook | null;
  /** Chamado a cada troca de peça, cor ou tamanho (null = nenhuma no avatar). */
  onChange?: (selection: LookSelection | null) => void;
  /** Foto do avatar vestido (JPEG em data URL), salva junto com o look. */
  takePhoto?: () => string | null;
}) {
  const [state, formAction, pending] = useActionState(saveLookAction, initialState);

  const startVariant = companions
    .flatMap((p) => p.variants.map((v) => ({ productId: p.id, ...v })))
    .find((v) => v.id === openLook?.companionVariantId);

  const [productId, setProductId] = useState<string>(
    startVariant?.productId ?? companions[0]?.id ?? "",
  );
  const product = companions.find((p) => p.id === productId) ?? null;
  const companionKind = role === "top" ? "bottom" : "top";

  const suggestion = useMemo(
    () =>
      product
        ? recommendSize(body, product.sizeChart, product.sizes, companionKind, preference, toleranceCm)
        : null,
    [product, body, companionKind, preference, toleranceCm],
  );

  const [color, setColor] = useState<string | null>(startVariant?.color ?? null);
  const [size, setSize] = useState<string | null>(startVariant?.size ?? null);
  // Ao trocar de peça, a cor e o tamanho voltam para a primeira cor e o sugerido.
  const effectiveColor = product?.colors.includes(color ?? "") ? color : (product?.colors[0] ?? null);
  const effectiveSize = product?.sizes.includes(size ?? "")
    ? size
    : (suggestion?.size ?? product?.sizes[0] ?? null);

  const variant = product?.variants.find(
    (v) => v.color === effectiveColor && v.size === effectiveSize,
  );
  const row = product?.sizeChart.find((r) => r.size === effectiveSize);
  const fit = row ? overallFit(regionFits(body, row, product!.sizeChart, companionKind, toleranceCm)) : null;

  // Vestir a outra peça no avatar (quando ela tem molde 3D).
  const [onAvatar, setOnAvatar] = useState(true);
  useEffect(() => {
    onChange?.(
      product && onAvatar ? { product, color: effectiveColor, size: effectiveSize } : null,
    );
  }, [onChange, product, onAvatar, effectiveColor, effectiveSize]);

  function pickProduct(id: string) {
    setProductId(id);
    setColor(null);
    setSize(null);
  }

  // A foto sai do canvas na hora de salvar, então entra no envio aqui.
  function submitWithPhoto(e: FormEvent<HTMLFormElement>) {
    const photo = takePhoto?.();
    if (!photo) return;
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("previewImage", photo);
    startTransition(() => formAction(data));
  }

  const nameAndSave = (disabled: boolean) => (
    <>
      <input
        name="name"
        required
        maxLength={LOOK_NAME_LIMIT}
        defaultValue={openLook?.name ?? ""}
        placeholder="Nome do look (ex.: Fim de semana)"
        aria-label="Nome do look"
        className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
      />

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm">
          Look salvo.{" "}
          <Link href="/perfil/looks" className="font-semibold underline">
            Ver meus looks
          </Link>
        </p>
      )}

      <button
        type="submit"
        disabled={pending || disabled}
        className="inline-flex h-10 items-center justify-center rounded-sm border border-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Salvando..." : openLook ? "Salvar alterações" : "Salvar look"}
      </button>
    </>
  );

  if (role === "dress") {
    return (
      <form
        action={formAction}
        onSubmit={submitWithPhoto}
        className="flex flex-col gap-4 rounded-sm border border-border p-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {openLook ? "Editar look" : "Salvar look"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ownLabel}: o vestido é o look inteiro (de cima e de baixo).
          </p>
        </div>
        {openLook && <input type="hidden" name="lookId" value={openLook.id} />}
        <input type="hidden" name="ownVariantId" value={ownVariantId ?? ""} />
        <input type="hidden" name="companionVariantId" value={ownVariantId ?? ""} />
        {nameAndSave(!ownVariantId)}
      </form>
    );
  }

  if (companions.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border p-4 text-xs text-muted-foreground">
        Montar look: ainda não há peças {role === "top" ? "de baixo" : "de cima"} à venda para
        combinar.
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={submitWithPhoto}
      className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {openLook ? "Editar look" : "Montar look"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ownLabel} + uma peça {role === "top" ? "de baixo" : "de cima"}.
        </p>
      </div>

      {openLook && <input type="hidden" name="lookId" value={openLook.id} />}
      <input type="hidden" name="ownVariantId" value={ownVariantId ?? ""} />
      <input type="hidden" name="companionVariantId" value={variant?.id ?? ""} />

      <select
        aria-label={role === "top" ? "Peça de baixo" : "Peça de cima"}
        value={productId}
        onChange={(e) => pickProduct(e.target.value)}
        className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
      >
        {companions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.price}
          </option>
        ))}
      </select>

      {product && (
        <div className="flex gap-3">
          <Link
            href={`/produto/${product.id}`}
            className="relative aspect-square w-20 shrink-0 overflow-hidden bg-secondary"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <ProductPlaceholder />
            )}
          </Link>
          <div className="flex min-w-0 flex-col gap-1 text-xs">
            <p className="text-sm font-medium">{product.name}</p>
            <p className="text-muted-foreground">{product.price}</p>
            {fit && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                Caimento estimado <FitPill fit={fit} />
              </p>
            )}
            {suggestion && (
              <p className="text-muted-foreground">Sugerido: {suggestion.size} (estimativa)</p>
            )}
          </div>
        </div>
      )}

      {product && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {product.colors.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={chip(effectiveColor === c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((s) => {
              const exists = product.variants.some((v) => v.color === effectiveColor && v.size === s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!exists}
                  onClick={() => setSize(s)}
                  className={chip(effectiveSize === s, exists)}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {product.modelUrl ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onAvatar}
                onChange={(e) => setOnAvatar(e.target.checked)}
              />
              Vestir no avatar
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Essa peça ainda não tem modelo 3D: aparece só aqui, com o caimento estimado.
            </p>
          )}
          {variant && variant.stockQuantity <= 0 && (
            <p className="text-xs text-muted-foreground">
              Sem estoque agora: o look fica salvo, mas essa peça não entra na sacola.
            </p>
          )}
        </div>
      )}

      {nameAndSave(!ownVariantId || !variant)}
    </form>
  );
}
