"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createAddressAction,
  type AddressFormState,
} from "@/lib/address-actions";
import { Button } from "@/components/ui/button";
import { AddressFields } from "@/components/address/address-fields";

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
      <AddressFields />

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
