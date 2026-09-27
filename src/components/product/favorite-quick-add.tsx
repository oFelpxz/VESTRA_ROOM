"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCartAction, type CartActionState } from "@/lib/cart-actions";

const initialState: CartActionState = {};

type Variant = { id: string; color: string; size: string; stockQuantity: number };

/**
 * Atalho da lista de desejos (item 11): o carrinho guarda cor + tamanho, então
 * o atalho pede a variação — só as que têm estoque.
 */
export function FavoriteQuickAdd({ variants }: { variants: Variant[] }) {
  const inStock = variants.filter((v) => v.stockQuantity > 0);
  const [variantId, setVariantId] = useState("");
  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
  );

  if (inStock.length === 0) {
    return (
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Esgotado
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor={`variant-${inStock[0].id}`} className="sr-only">
          Cor e tamanho
        </label>
        <select
          id={`variant-${inStock[0].id}`}
          name="productVariantId"
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-sm"
        >
          <option value="" disabled>
            Cor e tamanho
          </option>
          {inStock.map((v) => (
            <option key={v.id} value={v.id}>
              {v.color} · {v.size}
            </option>
          ))}
        </select>
        <input type="hidden" name="quantity" value="1" />
        <button
          type="submit"
          disabled={!variantId || pending}
          className="h-10 rounded-sm bg-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "..." : "Adicionar"}
        </button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-xs text-foreground">
          Adicionado à sacola.{" "}
          <Link href="/carrinho" className="font-semibold underline">
            Ver sacola
          </Link>
        </p>
      )}
    </form>
  );
}
