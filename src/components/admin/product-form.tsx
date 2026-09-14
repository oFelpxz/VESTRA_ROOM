"use client";

import { useActionState } from "react";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/lib/product-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProductFormState = {};

type CategoryOption = { id: string; name: string };

type Defaults = {
  id?: string;
  name?: string;
  categoryId?: string;
  description?: string | null;
  brand?: string | null;
  basePrice?: string | number;
  promotionalPrice?: string | number | null;
  availableForVirtualTryOn?: boolean;
};

export function ProductForm({
  categories,
  mode,
  defaults,
}: {
  categories: CategoryOption[];
  mode: "create" | "edit";
  defaults?: Defaults;
}) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mode === "edit" && defaults?.id && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="name">Nome do produto</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={defaults?.name ?? ""}
            placeholder="Ex: Hoodie Black Essential"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">Categoria</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={defaults?.categoryId ?? ""}
            className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="" disabled>
              Selecione uma categoria
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="brand">Marca</Label>
          <Input
            id="brand"
            name="brand"
            defaultValue={defaults?.brand ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="basePrice">Preço base (R$)</Label>
          <Input
            id="basePrice"
            name="basePrice"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaults?.basePrice?.toString() ?? ""}
            placeholder="199.90"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="promotionalPrice">Preço promocional (R$)</Label>
          <Input
            id="promotionalPrice"
            name="promotionalPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults?.promotionalPrice?.toString() ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={defaults?.description ?? ""}
            placeholder="Descreva o produto, caimento, materiais..."
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-4 transition-colors hover:border-foreground/40">
            <input
              type="checkbox"
              name="availableForVirtualTryOn"
              defaultChecked={defaults?.availableForVirtualTryOn ?? false}
              className="size-4 accent-foreground"
            />
            <div>
              <p className="text-sm font-medium">
                Disponível para provador virtual
              </p>
              <p className="text-xs text-muted-foreground">
                Exibe o botão de experimentar em 3D na página do produto
                (requer modelo 3D validado).
              </p>
            </div>
          </label>
        </div>
      </div>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Produto atualizado.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit" size="lg">
        {pending
          ? "Salvando..."
          : mode === "create"
            ? "Criar produto"
            : "Salvar alterações"}
      </Button>
    </form>
  );
}
