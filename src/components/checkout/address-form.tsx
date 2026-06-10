"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createAddressAction,
  type AddressFormState,
} from "@/lib/address-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AddressFormState = {};

export function AddressForm({
  redirectStep,
}: {
  redirectStep?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createAddressAction,
    initial,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success && state.id) {
      const url = redirectStep
        ? `/checkout?step=${redirectStep}&addressId=${state.id}`
        : `/checkout?addressId=${state.id}`;
      router.push(url);
    }
  }, [state.success, state.id, redirectStep, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="recipient">Destinatário</Label>
          <Input id="recipient" name="recipient" required placeholder="Nome completo" />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="line1">Endereço</Label>
          <Input id="line1" name="line1" required placeholder="Rua, número" />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="line2">Complemento</Label>
          <Input id="line2" name="line2" placeholder="Apto, bloco — opcional" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="state">UF</Label>
          <Input id="state" name="state" required maxLength={2} placeholder="SP" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="postalCode">CEP</Label>
          <Input
            id="postalCode"
            name="postalCode"
            required
            placeholder="00000-000"
            maxLength={9}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" placeholder="Opcional" />
        </div>
      </div>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit" size="lg">
        {pending ? "Salvando..." : "Salvar endereço"}
      </Button>
    </form>
  );
}
