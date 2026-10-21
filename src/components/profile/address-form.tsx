"use client";

import { startTransition, useActionState, useEffect } from "react";
import {
  createAddressAction,
  updateAddressAction,
  type AddressFormState,
} from "@/lib/address-actions";
import { Button } from "@/components/ui/button";
import { AddressFields } from "@/components/address/address-fields";

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
    // onSubmit em vez de action: assim o React não limpa os campos quando o
    // servidor devolve um erro (ex.: CEP com 7 dígitos).
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
      {address && <input type="hidden" name="id" value={address.id} />}

      <AddressFields
        initial={
          address && {
            ...address,
            line2: address.line2 ?? "",
            phone: address.phone ?? "",
          }
        }
      />

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
