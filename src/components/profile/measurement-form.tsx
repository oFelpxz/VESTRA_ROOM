"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveMeasurementsAction,
  deleteMeasurementsAction,
  type MeasurementFormState,
} from "@/lib/measurement-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MeasurementInitial = {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  shoulderCm: number | null;
  armLengthCm: number | null;
  legLengthCm: number | null;
  fitPreference: string;
  acceptedTerms: boolean;
} | null;

const fields: { name: keyof NonNullable<MeasurementInitial>; label: string }[] =
  [
    { name: "heightCm", label: "Altura (cm)" },
    { name: "weightKg", label: "Peso aproximado (kg)" },
    { name: "chestCm", label: "Tórax / Busto (cm)" },
    { name: "waistCm", label: "Cintura (cm)" },
    { name: "hipCm", label: "Quadril (cm)" },
    { name: "shoulderCm", label: "Ombros (cm)" },
    { name: "armLengthCm", label: "Comprimento do braço (cm)" },
    { name: "legLengthCm", label: "Comprimento da perna (cm)" },
  ];

const initialState: MeasurementFormState = {};

export function MeasurementForm({
  initial,
}: {
  initial: MeasurementInitial;
}) {
  const [state, formAction, pending] = useActionState(
    saveMeasurementsAction,
    initialState,
  );

  return (
    <>
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-2">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              defaultValue={
                initial && initial[f.name] != null
                  ? String(initial[f.name])
                  : ""
              }
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="fitPreference">Preferência de caimento</Label>
        <select
          id="fitPreference"
          name="fitPreference"
          defaultValue={initial?.fitPreference ?? "REGULAR"}
          className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
        >
          <option value="SLIM">Justo (Slim)</option>
          <option value="REGULAR">Regular</option>
          <option value="OVERSIZED">Solto (Oversized)</option>
        </select>
      </div>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="acceptedTerms"
          defaultChecked={initial?.acceptedTerms ?? false}
          className="mt-0.5 size-4 accent-foreground"
        />
        <span>
          Autorizo o uso das minhas medidas corporais exclusivamente para
          recomendação de tamanho e para o provador virtual VESTRA FIT. Posso
          editar ou excluir esses dados a qualquer momento.
        </span>
      </label>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Medidas salvas com sucesso.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando..." : "Salvar medidas"}
      </Button>
    </form>
    {initial && <DeleteMeasurementsButton />}
    </>
  );
}

function DeleteMeasurementsButton() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    deleteMeasurementsAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <div className="mt-2 border-t border-border pt-6">
      <p className="text-xs text-muted-foreground">
        Isso apaga permanentemente suas medidas e faz o VESTRA FIT voltar a
        usar o avatar de referência genérico.
      </p>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "Excluir suas medidas corporais? Essa ação não pode ser desfeita.",
            )
          ) {
            e.preventDefault();
          }
        }}
        className="mt-3"
      >
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          {pending ? "Excluindo..." : "Excluir minhas medidas"}
        </Button>
      </form>
      {state.error && (
        <p className="mt-2 rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
