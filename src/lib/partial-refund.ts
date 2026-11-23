/**
 * Reembolso parcial — preparação para o item 22 (aprovar devolução). Quanto
 * devolver quando o cliente devolve só parte do pedido. Função pura, sem
 * banco nem Stripe, para poder ser testada.
 *
 * Regras:
 *  - cada peça devolvida vale o preço que foi pago por ela (`unitPrice`);
 *  - o cupom deu desconto sobre os produtos (nunca sobre o frete, ver
 *    `computeDiscount`), então ele sai de cada peça na mesma proporção:
 *    peça de R$ 100 num pedido de R$ 200 com R$ 20 de cupom devolve R$ 90;
 *  - o frete da ida só volta com `includeShipping` (o grupo ainda decide
 *    quando: ver o item 22 em docs/SPRINT5-DECISOES.md);
 *  - nunca passa do que ainda falta devolver desse pagamento.
 *
 * As contas são em centavos. O desconto é calculado sobre o acumulado
 * devolvido (antes e depois desta devolução), não peça a peça: assim duas
 * devoluções parciais somam exatamente o mesmo que uma devolução de tudo,
 * sem sobrar nem faltar um centavo por arredondamento.
 */

export type RefundOrderItem = {
  id: string;
  /** Para a mensagem de erro, ex.: "Boxy Tee 01 (M)". */
  name?: string;
  unitPrice: number;
  quantity: number;
};

export type ReturnLine = { itemId: string; quantity: number };

export type PartialRefundInput = {
  items: RefundOrderItem[];
  /** O que o cliente devolve agora. */
  returns: ReturnLine[];
  /** Peças já devolvidas antes (id do item → quantidade). */
  alreadyReturned?: Record<string, number>;
  discountAmount: number;
  shippingAmount: number;
  /** Valor pago (Payment.amount). */
  paidAmount: number;
  /** Soma dos estornos já feitos neste pagamento. */
  alreadyRefunded?: number;
  /** Devolver o frete junto. Passe true uma vez só, no máximo. */
  includeShipping?: boolean;
};

export type PartialRefund =
  | {
      ok: true;
      /** Total a devolver, em reais e em centavos (o Stripe usa centavos). */
      amount: number;
      cents: number;
      /** Valor cheio das peças devolvidas agora, antes do cupom. */
      itemsValue: number;
      /** Parte do cupom que sai dessas peças. */
      discountShare: number;
      shipping: number;
      /** Com esta devolução, todas as peças do pedido voltaram. */
      allReturned: boolean;
      /** O valor foi cortado para não passar do que falta devolver. */
      capped: boolean;
    }
  | { ok: false; error: string };

const toCents = (n: number) => Math.round(n * 100);

export function computePartialRefund(input: PartialRefundInput): PartialRefund {
  const byId = new Map(input.items.map((i) => [i.id, i]));
  const already = input.alreadyReturned ?? {};

  // Junta linhas repetidas do mesmo item e confere as quantidades.
  const now = new Map<string, number>();
  for (const r of input.returns) {
    if (!Number.isInteger(r.quantity) || r.quantity <= 0) {
      return { ok: false, error: "Quantidade devolvida inválida." };
    }
    if (!byId.has(r.itemId)) {
      return { ok: false, error: "Peça que não é deste pedido." };
    }
    now.set(r.itemId, (now.get(r.itemId) ?? 0) + r.quantity);
  }
  if (now.size === 0) {
    return { ok: false, error: "Escolha pelo menos uma peça para devolver." };
  }

  let subtotal = 0;
  let before = 0;
  let after = 0;
  let unitsLeft = 0;
  for (const item of input.items) {
    const price = toCents(item.unitPrice);
    const prev = already[item.id] ?? 0;
    const returning = now.get(item.id) ?? 0;
    if (prev + returning > item.quantity) {
      const label = item.name ?? "uma peça";
      const left = Math.max(item.quantity - prev, 0);
      return {
        ok: false,
        error: `Quantidade maior que a comprada de ${label}: dá para devolver ${left}.`,
      };
    }
    subtotal += price * item.quantity;
    before += price * prev;
    after += price * (prev + returning);
    unitsLeft += item.quantity - prev - returning;
  }

  const discount = Math.min(toCents(input.discountAmount), subtotal);
  // Parte do cupom que fica com um valor acumulado de peças devolvidas.
  const share = (value: number) =>
    subtotal === 0 ? 0 : Math.round((discount * value) / subtotal);
  const itemsValue = after - before;
  const discountShare = share(after) - share(before);
  const shipping = input.includeShipping ? toCents(input.shippingAmount) : 0;

  const remaining =
    toCents(input.paidAmount) - toCents(input.alreadyRefunded ?? 0);
  if (remaining <= 0) {
    return { ok: false, error: "Este pagamento já foi todo devolvido." };
  }
  const wanted = itemsValue - discountShare + shipping;
  const cents = Math.min(wanted, remaining);

  return {
    ok: true,
    amount: cents / 100,
    cents,
    itemsValue: itemsValue / 100,
    discountShare: discountShare / 100,
    shipping: shipping / 100,
    allReturned: unitsLeft === 0,
    capped: cents < wanted,
  };
}
