"use client";

import { useActionState } from "react";
import {
  addProductImageAction,
  removeProductImageAction,
  type ProductFormState,
} from "@/lib/product-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProductFormState = {};

type Image = {
  id: string;
  url: string;
  altText: string | null;
  position: number;
};

export function ProductImageManager({
  productId,
  images,
}: {
  productId: string;
  images: Image[];
}) {
  const [state, formAction, pending] = useActionState(
    addProductImageAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-8">
      {images.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma imagem cadastrada. Adicione ao menos uma para poder publicar.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative overflow-hidden rounded-sm border border-border"
            >
              <div className="aspect-square bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.altText ?? ""}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Posição {img.position}
                </p>
                <form action={removeProductImageAction}>
                  <input type="hidden" name="id" value={img.id} />
                  <button
                    type="submit"
                    className="rounded-sm border border-foreground/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
                  >
                    Remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Nova imagem
        </p>
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="productId" value={productId} />

          <div className="grid gap-4 md:grid-cols-6">
            <div className="flex flex-col gap-2 md:col-span-4">
              <Label htmlFor="url">URL da imagem</Label>
              <Input
                id="url"
                name="url"
                required
                placeholder="https://... ou /images/produto.jpg"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="position">Posição</Label>
              <Input
                id="position"
                name="position"
                type="number"
                min="0"
                defaultValue={images.length}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-1">
              <Label htmlFor="altText">Alt</Label>
              <Input id="altText" name="altText" placeholder="Opcional" />
            </div>
          </div>

          {state.error && (
            <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
              Imagem adicionada.
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Adicionando..." : "Adicionar imagem"}
          </Button>
        </form>
      </div>
    </div>
  );
}
