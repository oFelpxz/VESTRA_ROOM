import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { shortOrderCode } from "@/lib/payment-rules";
import { needsManualRefund } from "@/lib/payments";
import { signReturnPhotos } from "@/lib/return-photos";
import { loadReturnRefund } from "@/lib/return-refund";
import { defaultApprovalMessage, KIND_LABEL, REASON_LABEL } from "@/lib/returns";
import { getStoreSettings } from "@/lib/store-settings-db";
import { ReturnAdminActions } from "@/components/admin/return-admin-actions";
import { ReturnTimeline } from "@/components/returns/return-timeline";

export const metadata = { title: "Troca" };

export default async function AdminTrocaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const { id } = await params;

  const req = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      order: { select: { deliveredAt: true, totalAmount: true } },
      orderItem: { select: { productName: true, color: true, size: true, unitPrice: true } },
      exchangeVariant: { select: { stockQuantity: true } },
      photos: { select: { id: true, path: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!req) notFound();

  const [settings, photos, refundInfo] = await Promise.all([
    getStoreSettings(),
    signReturnPhotos(req.photos),
    req.status === "RECEIVED" && req.approvedKind === "REFUND" ? loadReturnRefund(req) : null,
  ]);

  const defaultMessages = {
    EXCHANGE: defaultApprovalMessage({ kind: "EXCHANGE", returnAddress: settings.returnAddress, email: settings.email }),
    REFUND: defaultApprovalMessage({ kind: "REFUND", returnAddress: settings.returnAddress, email: settings.email }),
  };
  const refundPreview =
    refundInfo?.ok
      ? `${formatBRL(refundInfo.refund.amount)}${refundInfo.refund.shipping > 0 ? " (com o frete)" : ""}`
      : null;
  const exchangeTo =
    req.exchangeColor && req.exchangeSize ? `${req.exchangeColor} · Tam ${req.exchangeSize}` : null;

  return (
    <div className="max-w-4xl">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href="/admin/trocas" className="underline-offset-4 hover:underline">
          Trocas
        </Link>{" "}
        / #{req.id.slice(-8).toUpperCase()}
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-4xl">
        {KIND_LABEL[req.kind]} · {REASON_LABEL[req.reason]}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {req.user.name} · <span className="font-mono">{req.user.email}</span> ·{" "}
        <Link href={`/admin/pedidos/${req.orderId}`} className="underline hover:text-foreground">
          Pedido #{shortOrderCode(req.orderId)}
        </Link>
        {req.order.deliveredAt && ` · entregue em ${req.order.deliveredAt.toLocaleDateString("pt-BR")}`}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm border border-border p-5">
          <ReturnTimeline status={req.status} dates={req} />
        </div>
        <div className="rounded-sm border border-border p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Peça
          </p>
          <p className="mt-3">
            {req.quantity}× {req.orderItem.productName} · {req.orderItem.color} · Tam{" "}
            {req.orderItem.size} · {formatBRL(Number(req.orderItem.unitPrice))} cada
          </p>
          {req.kind === "EXCHANGE" && (
            <p className="mt-1">
              Trocar por: {exchangeTo ?? "variante removida"}
              {req.exchangeVariant &&
                req.status === "OPEN" &&
                ` · ${req.exchangeVariant.stockQuantity} em estoque`}
            </p>
          )}
          {req.approvedKind && <p className="mt-1">Aprovado como: {KIND_LABEL[req.approvedKind]}</p>}
          {req.goodCondition !== null && (
            <p className="mt-1">
              Chegou {req.goodCondition ? "em bom estado (voltou ao estoque)" : "com avaria (fora do estoque)"}
            </p>
          )}
          {req.refundAmount !== null && (
            <p className="mt-1">
              Devolvido: {formatBRL(Number(req.refundAmount))}
              {req.refundShipping && " (com o frete)"}
              {req.refundId ? ` · ${req.refundId}` : " · fora do Stripe"}
            </p>
          )}
          {req.trackingCode && <p className="mt-1">Rastreio: {req.trackingCode}</p>}
        </div>
      </div>

      {req.reasonText && (
        <div className="mt-4 rounded-sm border border-border p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            O cliente escreveu
          </p>
          <p className="mt-3 whitespace-pre-line">{req.reasonText}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Foto do cliente" className="size-40 rounded-sm border border-border object-cover" />
            </a>
          ))}
        </div>
      )}
      {req.photos.length > photos.length && (
        <p className="mt-2 text-xs text-destructive">Algumas fotos não carregaram (Storage).</p>
      )}

      {req.adminMessage && (
        <div className="mt-4 rounded-sm border border-border p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {req.status === "DENIED" ? "Justificativa enviada" : "Instruções enviadas"}
          </p>
          <p className="mt-3 whitespace-pre-line">{req.adminMessage}</p>
        </div>
      )}

      {refundInfo && !refundInfo.ok && (
        <p className="mt-4 rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {refundInfo.error}
        </p>
      )}

      <div className="mt-8">
        <ReturnAdminActions
          id={req.id}
          status={req.status}
          kind={req.kind}
          approvedKind={req.approvedKind}
          exchangeInStock={(req.exchangeVariant?.stockQuantity ?? 0) >= req.quantity}
          defaultMessages={defaultMessages}
          manualOnly={refundInfo?.ok === true && needsManualRefund(refundInfo.payment)}
          refundPreview={refundPreview}
        />
      </div>
    </div>
  );
}
