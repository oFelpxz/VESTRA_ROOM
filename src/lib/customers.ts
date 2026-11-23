import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Consultas da gestão de clientes (item 23). Fora de "use server" de propósito:
// recebem IDs como parâmetro e não podem virar endpoints públicos.
//
// Privacidade (regra do escopo): as consultas usam `select` explícito, então as
// medidas corporais nunca são carregadas do banco — não é só esconder na tela.

/**
 * Segunda barreira, junto dos dados: o middleware já restringe /admin/clientes
 * ao Administrador, mas dados pessoais não podem depender de uma camada só.
 */
async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

/** Pedidos que contam como compra efetivada (mesmo critério das avaliações). */
const PURCHASED_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

/** Só clientes; contas excluídas pelo próprio cliente (INACTIVE) ficam de fora. */
const CUSTOMER_WHERE = {
  role: "CUSTOMER" as const,
  status: { in: ["ACTIVE" as const, "BLOCKED" as const] },
};

export async function listCustomers(search: string) {
  await assertAdmin();
  const q = search.trim().slice(0, 100);
  const customers = await prisma.user.findMany({
    where: {
      ...CUSTOMER_WHERE,
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  // Total gasto de todos os clientes listados numa única consulta agregada.
  const totals = await prisma.order.groupBy({
    by: ["userId"],
    where: {
      userId: { in: customers.map((c) => c.id) },
      status: { in: [...PURCHASED_STATUSES] },
    },
    _sum: { totalAmount: true },
  });
  const spentByUser = new Map(
    totals.map((t) => [t.userId, Number(t._sum.totalAmount ?? 0)]),
  );

  return customers.map((c) => ({
    ...c,
    totalSpent: spentByUser.get(c.id) ?? 0,
  }));
}

export async function getCustomerDetail(id: string) {
  await assertAdmin();
  const customer = await prisma.user.findFirst({
    where: { id, ...CUSTOMER_WHERE },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          totalAmount: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!customer) return null;

  const totalSpent = customer.orders
    .filter((o) => (PURCHASED_STATUSES as readonly string[]).includes(o.status))
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return { ...customer, totalSpent };
}
