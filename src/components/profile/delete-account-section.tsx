"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, type AuthFormState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = {};

export function DeleteAccountSection({ userEmail }: { userEmail: string }) {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialState,
  );
  const [typedEmail, setTypedEmail] = useState("");
  const canSubmit = typedEmail.trim().toLowerCase() === userEmail.toLowerCase();

  return (
    <div className="mt-16 rounded-sm border border-destructive/30 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-destructive">
        Zona de risco
      </p>
      <h2 className="mt-2 text-lg font-semibold">Excluir conta</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Isso apaga permanentemente seus dados pessoais (nome, e-mail, telefone),
        suas medidas, endereços e carrinho. Seu histórico de pedidos é mantido
        para fins fiscais, mas desvinculado da sua identidade. Essa ação não
        pode ser desfeita e você será desconectado.
      </p>

      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "Tem certeza? Sua conta será excluída permanentemente e você será desconectado.",
            )
          ) {
            e.preventDefault();
          }
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <div className="flex flex-col gap-2 max-w-sm">
          <Label htmlFor="confirmEmail">
            Digite <span className="font-semibold">{userEmail}</span> para confirmar
          </Label>
          <Input
            id="confirmEmail"
            name="confirmEmail"
            type="email"
            autoComplete="off"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder={userEmail}
          />
        </div>

        {state.error && (
          <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          variant="outline"
          disabled={!canSubmit || pending}
          className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          {pending ? "Excluindo..." : "Excluir minha conta"}
        </Button>
      </form>
    </div>
  );
}
