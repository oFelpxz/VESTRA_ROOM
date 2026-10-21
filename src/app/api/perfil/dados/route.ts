import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * LGPD: o cliente baixa uma cópia dos próprios dados em JSON (prometido na
 * política de privacidade, item 25). Só os dados da própria conta; nada de
 * senha, token de cartão ou dados internos da loja.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Faça login." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      measurementProfile: {
        select: {
          heightCm: true,
          weightKg: true,
          chestCm: true,
          waistCm: true,
          hipCm: true,
          shoulderCm: true,
          armLengthCm: true,
          legLengthCm: true,
          fitPreference: true,
          acceptedTerms: true,
          updatedAt: true,
        },
      },
      addresses: {
        select: {
          recipient: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          phone: true,
          isDefault: true,
        },
      },
      savedPaymentMethods: {
        select: { brand: true, last4: true, expMonth: true, expYear: true, holderName: true },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          deliveredAt: true,
          totalAmount: true,
          shippingAmount: true,
          discountAmount: true,
          shippingService: true,
          trackingCode: true,
          items: {
            select: { productName: true, color: true, size: true, quantity: true, unitPrice: true },
          },
          payment: { select: { method: true, status: true, refundedAmount: true } },
        },
      },
      returnRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          orderId: true,
          quantity: true,
          reason: true,
          reasonText: true,
          kind: true,
          status: true,
          adminMessage: true,
          refundAmount: true,
          createdAt: true,
        },
      },
      reviews: {
        select: { rating: true, comment: true, createdAt: true, product: { select: { name: true } } },
      },
      favorites: { select: { createdAt: true, product: { select: { name: true } } } },
      savedLooks: { select: { name: true, createdAt: true } },
    },
  });
  if (!user) return Response.json({ error: "Conta não encontrada." }, { status: 404 });

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), loja: "VESTRA ROOM", ...user },
    null,
    2,
  );
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vestra-room-meus-dados-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
