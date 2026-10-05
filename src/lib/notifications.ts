import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Avisos ao cliente dentro do site (item 20). Aparecem no sininho do
 * cabeçalho e em /perfil/notificacoes.
 */

export type NewNotification = {
  userId: string;
  title: string;
  body: string;
  href?: string | null;
};

/** Cria o aviso na mesma transação da mudança que ele anuncia. */
export function notifyInTx(tx: Prisma.TransactionClient, n: NewNotification) {
  return tx.notification.create({
    data: { userId: n.userId, title: n.title, body: n.body, href: n.href ?? null },
  });
}

export function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export function listNotifications(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
