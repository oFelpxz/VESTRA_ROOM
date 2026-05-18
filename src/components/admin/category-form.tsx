"use client";

import { useActionState } from "react";
import {
  createCategoryAction,
  type AdminFormState,
} from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AdminFormState = {};

export function CategoryForm() {
  const [state, formAction, pending] = useActionState(
    createCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome da categoria</Label>
        <Input id="name" name="name" type="text" placeholder="Ex: Bermudas" required />
      </div>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Categoria criada.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Criando..." : "Criar categoria"}
      </Button>
    </form>
  );
}
