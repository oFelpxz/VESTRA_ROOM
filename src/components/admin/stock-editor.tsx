"use client";

import { useActionState, useState } from "react";
import {
  adjustStockAction,
  type LogisticsState,
} from "@/lib/logistics-actions";

const initial: LogisticsState = {};

type Variant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  stockQuantity: number;
  productName: string;
};

export function StockEditor({ variants }: { variants: Variant[] }) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {variants.length === 0 && (
        <li className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma variante encontrada.
        </li>
      )}
      {variants.map((v) => (
        <StockRow key={v.id} variant={v} />
      ))}
    </ul>
  );
}

function StockRow({ variant }: { variant: Variant }) {
  const [state, formAction, pending] = useActionState(adjustStockAction, initial);
  const [open, setOpen] = useState(false);
  const lowStock = variant.stockQuantity < 5;

  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{variant.productName}</p>
            {lowStock && (
              <span className="rounded-sm bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-destructive">
                Baixo
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {variant.color} · Tam {variant.size} · SKU{" "}
            <span className="font-mono">{variant.sku}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="font-heading text-lg font-bold">
            {variant.stockQuantity}
          </p>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-sm border border-foreground/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
          >
            {open ? "Cancelar" : "Ajustar"}
          </button>
        </div>
      </div>

      {open && (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-2 rounded-sm border border-border bg-secondary/30 p-4 md:flex-row md:items-end"
        >
          <input type="hidden" name="variantId" value={variant.id} />

          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Nova quantidade
            </label>
            <input
              type="number"
              name="newQuantity"
              min="0"
              defaultValue={variant.stockQuantity}
              className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Motivo
            </label>
            <select
              name="reason"
              className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            >
              <option>Reposição</option>
              <option>Contagem</option>
              <option>Perda</option>
              <option>Devolução</option>
              <option>Ajuste manual</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}

      {state.error && (
        <p className="mt-2 rounded-sm bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </p>
      )}
    </li>
  );
}
