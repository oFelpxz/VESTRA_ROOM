"use client";

import { useActionState } from "react";
import {
  createCouponAction,
  type CouponFormState,
} from "@/lib/coupon-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CouponFormState = {};

export function CouponForm() {
  const [state, formAction, pending] = useActionState(
    createCouponAction,
    initialState,
  );
  const v = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          name="code"
          type="text"
          placeholder="Ex: BEMVINDO10"
          defaultValue={v.code}
          maxLength={20}
          autoComplete="off"
          className="uppercase"
          required
        />
        <p className="text-xs text-muted-foreground">
          3 a 20 letras ou números. Gravado em maiúsculas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo</Label>
          {/* key: o React ignora mudança de defaultValue em <select> já montado;
              sem remontar, o tipo voltaria para "Percentual" após um erro. */}
          <select
            key={v.type ?? "PERCENT"}
            id="type"
            name="type"
            required
            defaultValue={v.type ?? "PERCENT"}
            className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="PERCENT">Percentual (%)</option>
            <option value="FIXED">Valor fixo (R$)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="value">Valor</Label>
          <Input
            id="value"
            name="value"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 10"
            defaultValue={v.value}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="minOrderAmount">Pedido mínimo (R$)</Label>
          <Input
            id="minOrderAmount"
            name="minOrderAmount"
            defaultValue={v.minOrderAmount}
            type="text"
            inputMode="decimal"
            placeholder="Opcional"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="usageLimit">Limite de usos</Label>
          <Input
            id="usageLimit"
            name="usageLimit"
            defaultValue={v.usageLimit}
            type="number"
            min={1}
            step={1}
            placeholder="Ilimitado"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="expiresAt">Validade</Label>
        <Input id="expiresAt" name="expiresAt" type="date" defaultValue={v.expiresAt} />
        <p className="text-xs text-muted-foreground">
          Vale até 23:59 do dia escolhido (horário de Brasília). Vazio = não expira.
        </p>
      </div>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Cupom criado.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Criando..." : "Criar cupom"}
      </Button>
    </form>
  );
}
