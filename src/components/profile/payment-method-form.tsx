"use client";

import { useActionState, useEffect } from "react";
import {
  createSavedPaymentMethodAction,
  type PaymentMethodFormState,
} from "@/lib/payment-method-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: PaymentMethodFormState = {};

export function PaymentMethodForm({ onSaved }: { onSaved?: () => void }) {
  const [state, formAction, pending] = useActionState(
    createSavedPaymentMethodAction,
    initial,
  );

  useEffect(() => {
    if (state.success) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear + i);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="holderName">Nome impresso no cartão</Label>
          <Input id="holderName" name="holderName" required placeholder="Como está no cartão" />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="cardNumber">Número do cartão</Label>
          <Input
            id="cardNumber"
            name="cardNumber"
            required
            inputMode="numeric"
            placeholder="4111 1111 1111 1111"
            maxLength={19}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expMonth">Mês</Label>
          <select
            id="expMonth"
            name="expMonth"
            required
            defaultValue=""
            className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="" disabled>
              MM
            </option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expYear">Ano</Label>
          <select
            id="expYear"
            name="expYear"
            required
            defaultValue=""
            className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="" disabled>
              AAAA
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cvv">CVV</Label>
          <Input id="cvv" name="cvv" required inputMode="numeric" maxLength={4} placeholder="123" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="isDefault"
          className="size-4 rounded-sm border-border"
        />
        Definir como forma de pagamento padrão
      </label>

      <p className="text-[11px] text-muted-foreground">
        Guardamos apenas a bandeira e os 4 últimos dígitos — o número
        completo e o CVV não são armazenados.
      </p>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit" size="lg">
        {pending ? "Salvando..." : "Salvar cartão"}
      </Button>
    </form>
  );
}
