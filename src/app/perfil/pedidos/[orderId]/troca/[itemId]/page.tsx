import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { shortOrderCode } from "@/lib/payment-rules";
import {
  allowedKinds,
  availableToReturn,
  deadlineFor,
  openReasons,
  type ReturnStatus,
} from "@/lib/returns";
import { compareVariants } from "@/lib/sizes";
import { getStoreSettings } from "@/lib/store-settings-db";
import { ReturnRequestForm } from "@/components/profile/return-request-form";

export default async function TrocaPage({
  params,
}: {
  params: Promise<{ orderId: string; itemId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { orderId, itemId } = await params;

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      orderId: true,
      productName: true,
      color: true,
      size: true,
      quantity: true,
      unitPrice: true,
      productVariantId: true,
      productVariant: {
        select: {
          product: {
            select: {
              variants: {
                where: { status: "ACTIVE" },
                select: { id: true, color: true, size: true, stockQuantity: true },
              },
            },
          },
        },
      },
      order: { select: { userId: true, status: true, deliveredAt: true } },
      returnRequests: { select: { quantity: true, status: true } },
    },
  });
  if (!item || item.orderId !== orderId || item.order.userId !== session.user.id) notFound();

  const settings = await getStoreSettings();
  const now = new Date();
  const available = availableToReturn(
    item.quantity,
    item.returnRequests.map((r) => ({ ...r, status: r.status as ReturnStatus })),
  );
  const deliveredAt = item.order.deliveredAt;
  const reasons =
    item.order.status === "DELIVERED" && deliveredAt
      ? openReasons(deliveredAt, now, settings).map((reason) => ({
          reason,
          kinds: allowedKinds(reason, deliveredAt, now, settings),
          deadline: deadlineFor(deliveredAt, reason, settings).toLocaleDateString("pt-BR"),
        }))
      : [];
  const variants = [...(item.productVariant?.product.variants ?? [])].sort(compareVariants);
  const code = shortOrderCode(orderId);

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href={`/perfil/pedidos/${orderId}`} className="underline-offset-4 hover:underline">
          Pedido #{code}
        </Link>{" "}
        / Troca ou devolução
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight">
        Trocar ou devolver
      </h1>

      <div className="mt-6 rounded-sm border border-border p-5 text-sm">
        <p className="font-medium">{item.productName}</p>
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {item.color} · Tam {item.size} · {item.quantity}x · {formatBRL(Number(item.unitPrice))}
        </p>
      </div>

      {reasons.length === 0 || available === 0 ? (
        <p className="mt-6 rounded-sm bg-secondary px-4 py-3 text-sm text-muted-foreground">
          {available === 0
            ? "Esta peça já está num pedido de troca."
            : "Esta peça não pode mais ser trocada: o prazo terminou ou o pedido não foi entregue."}{" "}
          Veja a{" "}
          <Link href="/trocas" className="underline">
            política de trocas
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8">
          <ReturnRequestForm
            orderItemId={item.id}
            available={available}
            reasons={reasons}
            currentVariantId={item.productVariantId}
            variants={variants}
          />
        </div>
      )}
    </section>
  );
}
