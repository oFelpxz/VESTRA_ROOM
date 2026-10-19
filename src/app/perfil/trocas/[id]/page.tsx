import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { shortOrderCode } from "@/lib/payment-rules";
import { cancelReturnRequestAction } from "@/lib/return-actions";
import { signReturnPhotos } from "@/lib/return-photos";
import { KIND_LABEL, REASON_LABEL } from "@/lib/returns";
import { ReturnTimeline } from "@/components/returns/return-timeline";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Troca" };

export default async function MinhaTrocaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const req = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      orderItem: { select: { productName: true, color: true, size: true } },
      photos: { select: { id: true, path: true }, orderBy: { createdAt: "asc" } },
    },
  });
  // Pedido de outra pessoa = não existe.
  if (!req || req.userId !== session.user.id) notFound();

  const photos = await signReturnPhotos(req.photos);
  const kind = req.approvedKind ?? req.kind;
  const exchangeTo =
    req.exchangeColor && req.exchangeSize ? `${req.exchangeColor} · Tam ${req.exchangeSize}` : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href="/perfil" className="underline-offset-4 hover:underline">
          Minha conta
        </Link>{" "}
        /{" "}
        <Link href="/perfil/trocas" className="underline-offset-4 hover:underline">
          Trocas
        </Link>
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-4xl">
        {KIND_LABEL[kind]}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {req.quantity}× {req.orderItem.productName} · {req.orderItem.color} · Tam {req.orderItem.size}{" "}
        ·{" "}
        <Link href={`/perfil/pedidos/${req.orderId}`} className="underline hover:text-foreground">
          Pedido #{shortOrderCode(req.orderId)}
        </Link>
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm border border-border p-5">
          <ReturnTimeline status={req.status} dates={req} />
        </div>

        <div className="rounded-sm border border-border p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Seu pedido
          </p>
          <p className="mt-3">Motivo: {REASON_LABEL[req.reason]}</p>
          <p>Pediu: {KIND_LABEL[req.kind]}</p>
          {req.kind === "EXCHANGE" && exchangeTo && <p>Trocar por: {exchangeTo}</p>}
          {req.approvedKind && req.approvedKind !== req.kind && (
            <p className="mt-2 text-muted-foreground">
              A peça da troca acabou: a loja aprovou como devolução do dinheiro.
            </p>
          )}
          {req.reasonText && (
            <p className="mt-2 whitespace-pre-line text-muted-foreground">“{req.reasonText}”</p>
          )}
        </div>
      </div>

      {req.adminMessage && (
        <div className="mt-4 rounded-sm border border-foreground p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {req.status === "DENIED" ? "Por que foi negado" : "Instruções da loja"}
          </p>
          <p className="mt-3 whitespace-pre-line">{req.adminMessage}</p>
        </div>
      )}

      {(req.refundAmount !== null || req.trackingCode) && (
        <div className="mt-4 rounded-sm border border-border p-5 text-sm">
          {req.refundAmount !== null && (
            <p>
              Valor devolvido: <strong>{formatBRL(Number(req.refundAmount))}</strong>
              {req.refundShipping && " (com o frete)"}. No cartão, pode levar até 2 faturas para
              aparecer.
            </p>
          )}
          {req.trackingCode && (
            <p>
              Rastreio da peça nova: <span className="font-mono">{req.trackingCode}</span>
            </p>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Fotos enviadas
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                {/* Link assinado e temporário: sem otimização do next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt="Foto da peça"
                  className="size-28 rounded-sm border border-border object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {req.status === "OPEN" && (
        <form action={cancelReturnRequestAction} className="mt-8">
          <input type="hidden" name="id" value={req.id} />
          <Button type="submit" variant="outline">
            Desistir do pedido
          </Button>
        </form>
      )}
    </section>
  );
}
