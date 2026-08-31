"use client";

import { useActionState, useEffect } from "react";
import {
  createAddressAction,
  updateAddressAction,
  type AddressFormState,
} from "@/lib/address-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AddressFormState = {};

export type AddressInitial = {
  id: string;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
  isDefault: boolean;
};

export function AddressForm({
  initial: address,
  onSaved,
}: {
  /** Presente = editar; ausente = criar novo. */
  initial?: AddressInitial;
  onSaved?: () => void;
}) {
  const action = address ? updateAddressAction : createAddressAction;
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (state.success) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {address && <input type="hidden" name="id" value={address.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="recipient">Destinatário</Label>
          <Input
            id="recipient"
            name="recipient"
            required
            defaultValue={address?.recipient}
            placeholder="Nome completo"
          />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="line1">Endereço</Label>
          <Input
            id="line1"
            name="line1"
            required
            defaultValue={address?.line1}
            placeholder="Rua, número"
          />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="line2">Complemento</Label>
          <Input
            id="line2"
            name="line2"
            defaultValue={address?.line2 ?? ""}
            placeholder="Apto, bloco — opcional"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" required defaultValue={address?.city} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="state">UF</Label>
          <Input
            id="state"
            name="state"
            required
            maxLength={2}
            defaultValue={address?.state}
            placeholder="SP"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="postalCode">CEP</Label>
          <Input
            id="postalCode"
            name="postalCode"
            required
            defaultValue={address?.postalCode}
            placeholder="00000-000"
            maxLength={9}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={address?.phone ?? ""}
            placeholder="Opcional"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
          className="size-4 rounded-sm border-border"
        />
        Definir como endereço padrão
      </label>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit" size="lg">
        {pending ? "Salvando..." : address ? "Salvar alterações" : "Salvar endereço"}
      </Button>
    </form>
  );
}
