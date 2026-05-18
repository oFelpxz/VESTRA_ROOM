"use client";

import { useActionState } from "react";
import {
  saveSizeChartAction,
  type AdminFormState,
} from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SIZES = ["P", "M", "G", "GG"] as const;
const initialState: AdminFormState = {};

type ProductOption = { id: string; name: string };

export function SizeChartForm({ products }: { products: ProductOption[] }) {
  const [state, formAction, pending] = useActionState(
    saveSizeChartAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="productId">Produto</Label>
        <select
          id="productId"
          name="productId"
          required
          defaultValue=""
          className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
        >
          <option value="" disabled>
            Selecione um produto
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-2">Tam.</th>
              <th className="p-2">Tórax mín</th>
              <th className="p-2">Tórax máx</th>
              <th className="p-2">Cintura mín</th>
              <th className="p-2">Cintura máx</th>
              <th className="p-2">Quadril mín</th>
              <th className="p-2">Quadril máx</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((s) => (
              <tr key={s} className="border-t border-border">
                <td className="p-2 font-medium">{s}</td>
                {[
                  "chestMin",
                  "chestMax",
                  "waistMin",
                  "waistMax",
                  "hipMin",
                  "hipMax",
                ].map((field) => (
                  <td key={field} className="p-1">
                    <input
                      name={`${s}_${field}`}
                      type="number"
                      step="0.1"
                      min="0"
                      className="h-9 w-20 rounded-sm border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Tabela de medidas salva.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando..." : "Salvar tabela de medidas"}
      </Button>
    </form>
  );
}
