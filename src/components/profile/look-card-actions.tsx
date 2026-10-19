"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  addLookToCartAction,
  deleteLookAction,
  type LookFormState,
} from "@/lib/look-actions";

const initialState: LookFormState = {};

/** Botões de um look salvo: abrir no provador, pôr na sacola e excluir. */
export function LookCardActions({
  id,
  name,
  provadorHref,
  canAdd,
}: {
  id: string;
  name: string;
  provadorHref: string | null;
  canAdd: boolean;
}) {
  const [state, addAction, adding] = useActionState(addLookToCartAction, initialState);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {provadorHref && (
          <Link
            href={provadorHref}
            className="inline-flex h-10 items-center justify-center rounded-sm border border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background"
          >
            Abrir no provador
          </Link>
        )}
        <form action={addAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={adding || !canAdd}
            className="inline-flex h-10 items-center justify-center rounded-sm bg-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? "Adicionando..." : "Adicionar o look à sacola"}
          </button>
        </form>
        <form
          action={deleteLookAction}
          onSubmit={(e) => {
            if (!confirm(`Excluir o look "${name}"?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="h-10 px-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
          >
            Excluir
          </button>
        </form>
      </div>
      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm">
          As duas peças foram para a sacola.{" "}
          <Link href="/carrinho" className="font-semibold underline">
            Ver sacola
          </Link>
        </p>
      )}
    </div>
  );
}
