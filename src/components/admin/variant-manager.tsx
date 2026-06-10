"use client";

import { useActionState } from "react";
import {
  addVariantAction,
  updateVariantStockAction,
  toggleVariantStatusAction,
  removeVariantAction,
  type ProductFormState,
} from "@/lib/product-actions";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProductFormState = {};

type Variant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  price: string | number | null;
  stockQuantity: number;
  status: string;
};

export function VariantManager({
  productId,
  basePrice,
  variants,
}: {
  productId: string;
  basePrice: string | number;
  variants: Variant[];
}) {
  const [state, formAction, pending] = useActionState(
    addVariantAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Lista */}
      <div>
        {variants.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma variante cadastrada ainda. Adicione ao menos uma para poder
            publicar o produto.
          </div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {variants.map((v) => {
              const inactive = v.status !== "ACTIVE";
              return (
                <li
                  key={v.id}
                  className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {v.color} · {v.size}
                      </p>
                      {inactive && (
                        <span className="rounded-sm bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-destructive">
                          Inativa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      SKU {v.sku} ·{" "}
                      {v.price
                        ? formatBRL(Number(v.price))
                        : `${formatBRL(Number(basePrice))} (base)`}
                    </p>
                  </div>

                  {/* Estoque editável inline */}
                  <form
                    action={updateVariantStockAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={v.id} />
                    <Label htmlFor={`stock-${v.id}`} className="text-xs">
                      Estoque
                    </Label>
                    <Input
                      id={`stock-${v.id}`}
                      name="stockQuantity"
                      type="number"
                      min="0"
                      defaultValue={v.stockQuantity}
                      className="w-20"
                    />
                    <button
                      type="submit"
                      className="rounded-sm border border-foreground/15 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
                    >
                      Salvar
                    </button>
                  </form>

                  <form action={toggleVariantStatusAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-foreground/15 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
                    >
                      {inactive ? "Ativar" : "Inativar"}
                    </button>
                  </form>

                  <form action={removeVariantAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-foreground/15 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
                    >
                      Remover
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Form de nova variante */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Nova variante
        </p>
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="productId" value={productId} />

          <div className="grid gap-4 md:grid-cols-5">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                name="sku"
                required
                placeholder="HOODIE-BLK-M"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" name="color" required placeholder="Preto" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="size">Tamanho</Label>
              <Input id="size" name="size" required placeholder="M" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stockQuantity">Estoque</Label>
              <Input
                id="stockQuantity"
                name="stockQuantity"
                type="number"
                min="0"
                defaultValue="0"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                placeholder={`Opcional · base ${formatBRL(Number(basePrice))}`}
              />
            </div>
          </div>

          {state.error && (
            <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
              Variante adicionada.
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Adicionando..." : "Adicionar variante"}
          </Button>
        </form>
      </div>
    </div>
  );
}
