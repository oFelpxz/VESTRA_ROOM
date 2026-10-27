"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addLookPiecesToCartAction, type LookFormState } from "@/lib/look-actions";
import { brandLookTotal } from "@/lib/brand-looks";
import { formatBRL } from "@/lib/format";

const initialState: LookFormState = {};

/** Peça do look para a sacola: a variação escolhida (null = falta cor ou tamanho). */
export type BuyLookPiece = {
  variantId: string | null;
  /** "Cargo Pant (Preto, 42)" */
  label: string;
  price: number;
  stockQuantity: number;
};

/**
 * "Comprar o look todo" (lista 10, item 8): um botão põe todas as peças na
 * sacola, uma unidade de cada, pelo preço somado (sem desconto). Sem cor e
 * tamanho de alguma, ou com alguma esgotada, o botão diz qual e não envia; o
 * servidor confere de novo o estoque e só põe se todas couberem.
 */
export function BuyLook({ pieces }: { pieces: BuyLookPiece[] }) {
  const [state, formAction, pending] = useActionState(addLookPiecesToCartAction, initialState);
  const missing = pieces.find((p) => !p.variantId);
  const soldOut = pieces.find((p) => p.variantId && p.stockQuantity < 1);
  const blocked = missing
    ? `Escolha cor e tamanho de ${missing.label}.`
    : soldOut
      ? `${soldOut.label} esgotou.`
      : null;
  const total = brandLookTotal(pieces.map((p) => p.price));

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-sm border border-foreground p-4">
      {pieces.map((p) => (
        <input key={p.label} type="hidden" name="productVariantId" value={p.variantId ?? ""} />
      ))}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.15em]">
          Look completo · {pieces.length} peças
        </p>
        <p className="text-sm font-semibold">{formatBRL(total)}</p>
      </div>
      <p className="text-xs text-muted-foreground">Soma das peças, cada uma pelo seu preço.</p>

      {(state.error || blocked) && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error ?? blocked}
        </p>
      )}
      {state.success && !blocked && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Look na sacola.{" "}
          <Link href="/carrinho" className="font-semibold underline">
            Ver sacola
          </Link>
        </p>
      )}

      <button
        type="submit"
        disabled={!!blocked || pending}
        className="inline-flex h-12 items-center justify-center rounded-sm bg-acid px-8 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Adicionando..." : "Comprar o look todo"}
      </button>
    </form>
  );
}
