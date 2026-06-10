"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCartAction, type CartActionState } from "@/lib/cart-actions";

const initialState: CartActionState = {};

type Variant = {
  id: string;
  color: string;
  size: string;
  stockQuantity: number;
};

export function ProductPurchase({
  variants,
  colors,
  sizes,
  isLoggedIn,
}: {
  variants: Variant[];
  colors: string[];
  sizes: string[];
  isLoggedIn: boolean;
}) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
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
    <form action={formAction} className="flex flex-col gap-6">
      {/* Cores */}
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
                  type="button"
                  key={c}
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

      {/* Tamanhos */}
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
                  type="button"
                  key={s}
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

      {isLoggedIn ? (
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
      ) : (
        <Link
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          Entrar para comprar
        </Link>
      )}
    </form>
  );
}
