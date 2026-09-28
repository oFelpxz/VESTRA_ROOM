"use client";

import { useActionState } from "react";
import {
  applyCouponAction,
  removeCouponAction,
  type CartActionState,
} from "@/lib/cart-actions";

const initialState: CartActionState = {};

/**
 * Campo de cupom do carrinho (item 13). Com cupom aplicado, mostra o código e,
 * se ele deixou de valer (ex.: carrinho abaixo do mínimo), o motivo.
 */
export function CouponField({
  applied,
}: {
  applied: { code: string; warning: string | null } | null;
}) {
  const [state, formAction, pending] = useActionState(
    applyCouponAction,
    initialState,
  );

  if (applied) {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            Cupom <span className="font-mono font-semibold">{applied.code}</span>
          </p>
          <form action={removeCouponAction}>
            <button
              type="submit"
              aria-label={`Remover cupom ${applied.code}`}
              className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Remover
            </button>
          </form>
        </div>
        {applied.warning && (
          <p className="mt-2 text-xs text-destructive">
            Não se aplica: {applied.warning}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <form action={formAction} className="flex gap-2">
        <label htmlFor="coupon-code" className="sr-only">
          Cupom de desconto
        </label>
        <input
          id="coupon-code"
          name="code"
          placeholder="Cupom de desconto"
          defaultValue={state.code}
          autoComplete="off"
          maxLength={20}
          className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm uppercase placeholder:normal-case"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-sm border border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {pending ? "..." : "Aplicar"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-destructive">{state.error}</p>
      )}
    </div>
  );
}
