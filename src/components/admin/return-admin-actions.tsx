"use client";

import { useActionState, useState } from "react";
import {
  approveReturnAction,
  closeApprovedReturnAction,
  completeReturnAction,
  denyReturnAction,
  receiveReturnAction,
  type ReturnFormState,
} from "@/lib/return-actions";
import { KIND_LABEL, type ReturnKind, type ReturnStatus } from "@/lib/returns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: ReturnFormState = {};

const textareaClass =
  "rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring";

function Feedback({ state }: { state: ReturnFormState }) {
  if (!state.error) return null;
  return (
    <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
  );
}

/** Responder um pedido em análise: aprovar (com instruções) ou negar (com justificativa). */
function AnswerForms({
  id,
  kind,
  exchangeInStock,
  defaultMessages,
}: {
  id: string;
  kind: ReturnKind;
  exchangeInStock: boolean;
  defaultMessages: Record<ReturnKind, string>;
}) {
  const [approveState, approve, approving] = useActionState(approveReturnAction, initial);
  const [denyState, deny, denying] = useActionState(denyReturnAction, initial);
  // Troca sem estoque já começa como devolução do valor.
  const [approvedKind, setApprovedKind] = useState<ReturnKind>(
    kind === "EXCHANGE" && exchangeInStock ? "EXCHANGE" : "REFUND",
  );
  const [message, setMessage] = useState(defaultMessages[approvedKind]);
  const [touched, setTouched] = useState(false);

  function pickKind(k: ReturnKind) {
    setApprovedKind(k);
    // Troca o texto padrão enquanto o Admin não escreveu nada próprio.
    if (!touched) setMessage(defaultMessages[k]);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={approve} className="flex flex-col gap-3 rounded-sm border border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Aprovar
        </p>
        <input type="hidden" name="id" value={id} />
        {kind === "EXCHANGE" && (
          <div className="flex flex-wrap gap-2">
            {(["EXCHANGE", "REFUND"] as const).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-sm ${
                  approvedKind === k ? "border-foreground" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="approvedKind"
                  value={k}
                  checked={approvedKind === k}
                  onChange={() => pickKind(k)}
                  className="accent-foreground"
                />
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
        )}
        {kind === "REFUND" && <input type="hidden" name="approvedKind" value="REFUND" />}
        {kind === "EXCHANGE" && !exchangeInStock && (
          <p className="text-xs text-destructive">
            A peça pedida está sem estoque: só dá para aprovar como devolução do valor.
          </p>
        )}
        <Label htmlFor="approve-message">Instruções de envio (o cliente vê)</Label>
        <textarea
          id="approve-message"
          name="message"
          rows={7}
          maxLength={2000}
          value={message}
          onChange={(e) => {
            setTouched(true);
            setMessage(e.target.value);
          }}
          className={textareaClass}
        />
        <Feedback state={approveState} />
        <Button type="submit" disabled={approving} className="w-fit">
          {approving ? "Aprovando..." : "Aprovar"}
        </Button>
      </form>

      <form action={deny} className="flex flex-col gap-3 rounded-sm border border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Negar
        </p>
        <input type="hidden" name="id" value={id} />
        <Label htmlFor="deny-message">Justificativa (o cliente vê)</Label>
        <textarea
          id="deny-message"
          name="message"
          rows={7}
          maxLength={2000}
          placeholder="Ex.: a foto mostra sinais de uso e lavagem, o que a política de trocas não cobre."
          className={textareaClass}
        />
        <Feedback state={denyState} />
        <Button type="submit" variant="outline" disabled={denying} className="w-fit">
          {denying ? "Negando..." : "Negar"}
        </Button>
      </form>
    </div>
  );
}

/** Aprovado: a peça chegou (ou não chegou e o pedido é encerrado). */
function ReceiveForms({ id }: { id: string }) {
  const [receiveState, receive, receiving] = useActionState(receiveReturnAction, initial);
  const [closeState, close, closing] = useActionState(closeApprovedReturnAction, initial);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={receive} className="flex flex-col gap-3 rounded-sm border border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Peça recebida
        </p>
        <input type="hidden" name="id" value={id} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="goodCondition" defaultChecked className="accent-foreground" />
          Em bom estado (volta ao estoque)
        </label>
        <Feedback state={receiveState} />
        <Button type="submit" disabled={receiving} className="w-fit">
          {receiving ? "Salvando..." : "Marcar como recebida"}
        </Button>
      </form>

      <form
        action={close}
        onSubmit={(e) => {
          if (!confirm("Encerrar o pedido de troca? A peça reservada volta ao estoque.")) {
            e.preventDefault();
          }
        }}
        className="flex flex-col gap-3 rounded-sm border border-border p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          A peça não chegou
        </p>
        <p className="text-xs text-muted-foreground">
          Passado o prazo de envio, encerre o pedido. A reserva da troca volta ao estoque.
        </p>
        <input type="hidden" name="id" value={id} />
        <Feedback state={closeState} />
        <Button type="submit" variant="outline" disabled={closing} className="w-fit">
          {closing ? "Encerrando..." : "Encerrar"}
        </Button>
      </form>
    </div>
  );
}

/** Peça recebida: concluir com o rastreio (troca) ou o reembolso (devolução). */
function CompleteForm({
  id,
  approvedKind,
  manualOnly,
  refundPreview,
}: {
  id: string;
  approvedKind: ReturnKind;
  manualOnly: boolean;
  refundPreview: string | null;
}) {
  const [state, complete, completing] = useActionState(completeReturnAction, initial);

  return (
    <form
      action={complete}
      onSubmit={(e) => {
        if (approvedKind === "REFUND" && !confirm(`Devolver ${refundPreview ?? "o valor"} ao cliente?`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3 rounded-sm border border-border p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Concluir
      </p>
      <input type="hidden" name="id" value={id} />
      {approvedKind === "EXCHANGE" ? (
        <>
          <Label htmlFor="trackingCode">Rastreio da peça nova (opcional)</Label>
          <input
            id="trackingCode"
            name="trackingCode"
            maxLength={60}
            className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          />
        </>
      ) : (
        <>
          <p className="text-sm">
            Valor a devolver: <strong>{refundPreview ?? "—"}</strong>
          </p>
          {manualOnly ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="manual" required className="accent-foreground" />
              Valor devolvido fora do Stripe (PIX ou transferência)
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              O estorno sai pelo mesmo meio de pagamento do pedido.
            </p>
          )}
        </>
      )}
      <Feedback state={state} />
      <Button type="submit" disabled={completing} className="w-fit">
        {completing
          ? "Concluindo..."
          : approvedKind === "EXCHANGE"
            ? "Concluir troca"
            : "Devolver o valor"}
      </Button>
    </form>
  );
}

export function ReturnAdminActions(props: {
  id: string;
  status: ReturnStatus;
  kind: ReturnKind;
  approvedKind: ReturnKind | null;
  exchangeInStock: boolean;
  defaultMessages: Record<ReturnKind, string>;
  manualOnly: boolean;
  refundPreview: string | null;
}) {
  if (props.status === "OPEN") {
    return (
      <AnswerForms
        id={props.id}
        kind={props.kind}
        exchangeInStock={props.exchangeInStock}
        defaultMessages={props.defaultMessages}
      />
    );
  }
  if (props.status === "APPROVED") return <ReceiveForms id={props.id} />;
  if (props.status === "RECEIVED" && props.approvedKind) {
    return (
      <CompleteForm
        id={props.id}
        approvedKind={props.approvedKind}
        manualOnly={props.manualOnly}
        refundPreview={props.refundPreview}
      />
    );
  }
  return null;
}
