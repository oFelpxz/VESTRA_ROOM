/**
 * Trocas e devoluções (itens 21 e 22) — regras puras, sem banco, para poder
 * ser testadas. As telas e as actions ficam em `return-actions.ts`.
 *
 * Prazos (contados da entrega, `Order.deliveredAt`, editáveis no item 25):
 *  - Arrependimento ou "Outro": `regretDays` (7). Pode trocar ou devolver.
 *  - Tamanho ou cor: `exchangeDays` (30). Só troca — devolver o dinheiro
 *    só dentro do arrependimento.
 *  - Defeito: `defectDays` (90). Troca ou devolução, com foto obrigatória.
 */

export type ReturnReason = "SIZE" | "COLOR" | "DEFECT" | "REGRET" | "OTHER";
export type ReturnKind = "EXCHANGE" | "REFUND";
export type ReturnStatus =
  | "OPEN"
  | "APPROVED"
  | "DENIED"
  | "RECEIVED"
  | "COMPLETED"
  | "CANCELED";

export const RETURN_REASONS: ReturnReason[] = ["SIZE", "COLOR", "DEFECT", "REGRET", "OTHER"];

export const REASON_LABEL: Record<ReturnReason, string> = {
  SIZE: "Tamanho não serviu",
  COLOR: "Quero outra cor",
  DEFECT: "Defeito",
  REGRET: "Desisti da compra",
  OTHER: "Outro motivo",
};

export const KIND_LABEL: Record<ReturnKind, string> = {
  EXCHANGE: "Troca",
  REFUND: "Devolução do dinheiro",
};

export const STATUS_LABEL: Record<ReturnStatus, string> = {
  OPEN: "Em análise",
  APPROVED: "Aprovado · aguardando a peça",
  DENIED: "Negado",
  RECEIVED: "Peça recebida",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

/** Pedidos que ainda ocupam a quantidade do item. */
export const ACTIVE_STATUSES: ReturnStatus[] = ["OPEN", "APPROVED", "RECEIVED"];
/** Pedidos que contam como peça devolvida (para a quantidade e o reembolso). */
const COUNTED_STATUSES: ReturnStatus[] = ["OPEN", "APPROVED", "RECEIVED", "COMPLETED"];

export type ReturnDeadlines = {
  regretDays: number;
  exchangeDays: number;
  defectDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowDays(reason: ReturnReason, d: ReturnDeadlines) {
  if (reason === "DEFECT") return d.defectDays;
  if (reason === "SIZE" || reason === "COLOR") return d.exchangeDays;
  return d.regretDays;
}

/** Último instante para pedir pelo motivo. */
export function deadlineFor(deliveredAt: Date, reason: ReturnReason, d: ReturnDeadlines) {
  return new Date(deliveredAt.getTime() + windowDays(reason, d) * DAY_MS);
}

function within(deliveredAt: Date, days: number, now: Date) {
  return now.getTime() <= deliveredAt.getTime() + days * DAY_MS;
}

/** O que o cliente pode pedir por este motivo agora. Vazio = fora do prazo. */
export function allowedKinds(
  reason: ReturnReason,
  deliveredAt: Date,
  now: Date,
  d: ReturnDeadlines,
): ReturnKind[] {
  if (!within(deliveredAt, windowDays(reason, d), now)) return [];
  const kinds: ReturnKind[] = ["EXCHANGE"];
  if (reason === "DEFECT" || within(deliveredAt, d.regretDays, now)) kinds.push("REFUND");
  return kinds;
}

/** Motivos ainda abertos para o pedido (para mostrar o botão e o formulário). */
export function openReasons(deliveredAt: Date | null, now: Date, d: ReturnDeadlines) {
  if (!deliveredAt) return [];
  return RETURN_REASONS.filter((r) => allowedKinds(r, deliveredAt, now, d).length > 0);
}

/** Quantas peças do item ainda podem entrar num pedido de troca. */
export function availableToReturn(
  itemQuantity: number,
  requests: { quantity: number; status: ReturnStatus }[],
) {
  const used = requests
    .filter((r) => COUNTED_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + r.quantity, 0);
  return Math.max(itemQuantity - used, 0);
}

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const REASON_TEXT_LIMIT = 1000;

export type ReturnFormInput = {
  quantity: string;
  reason: string;
  reasonText: string;
  kind: string;
  /** Troca: variante desejada (mesmo produto). */
  exchangeVariantId: string;
  photoCount: number;
};

export type ReturnFormContext = {
  orderStatus: string;
  deliveredAt: Date | null;
  now: Date;
  deadlines: ReturnDeadlines;
  /** Peças do item que ainda podem ser pedidas. */
  available: number;
  /** Variante comprada (não dá para "trocar" pela mesma). */
  currentVariantId: string | null;
};

export type ParsedReturn = {
  quantity: number;
  reason: ReturnReason;
  reasonText: string | null;
  kind: ReturnKind;
  exchangeVariantId: string | null;
};

/** Valida o pedido do cliente (item 21). A variante da troca é conferida no banco depois. */
export function parseReturnForm(
  f: ReturnFormInput,
  ctx: ReturnFormContext,
): { data: ParsedReturn } | { error: string } {
  if (ctx.orderStatus !== "DELIVERED" || !ctx.deliveredAt) {
    return { error: "Só dá para trocar ou devolver peças de pedidos entregues." };
  }

  const reason = f.reason as ReturnReason;
  if (!RETURN_REASONS.includes(reason)) return { error: "Escolha o motivo." };

  const kinds = allowedKinds(reason, ctx.deliveredAt, ctx.now, ctx.deadlines);
  if (kinds.length === 0) {
    return {
      error: `O prazo para "${REASON_LABEL[reason]}" é de ${windowDays(reason, ctx.deadlines)} dias depois da entrega e já passou.`,
    };
  }

  const kind = f.kind as ReturnKind;
  if (kind !== "EXCHANGE" && kind !== "REFUND") return { error: "Escolha troca ou devolução." };
  if (!kinds.includes(kind)) {
    return {
      error: `Depois de ${ctx.deadlines.regretDays} dias da entrega, por esse motivo só dá para trocar.`,
    };
  }

  const quantity = Number(f.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Quantidade inválida." };
  if (ctx.available <= 0) return { error: "Esta peça já está num pedido de troca." };
  if (quantity > ctx.available) {
    return { error: `Dá para pedir no máximo ${ctx.available} desta peça.` };
  }

  const reasonText = f.reasonText.trim();
  if (reason === "OTHER" && reasonText.length < 5) {
    return { error: "Conte em poucas palavras o motivo." };
  }
  if (reason === "DEFECT" && reasonText.length < 5) {
    return { error: "Descreva o defeito." };
  }
  if (reasonText.length > REASON_TEXT_LIMIT) {
    return { error: `O texto pode ter até ${REASON_TEXT_LIMIT} caracteres.` };
  }

  let exchangeVariantId: string | null = null;
  if (kind === "EXCHANGE") {
    exchangeVariantId = f.exchangeVariantId.trim() || null;
    // Troca por defeito pode ser pela mesma peça (outra unidade).
    if (!exchangeVariantId) return { error: "Escolha a cor e o tamanho da troca." };
    if (exchangeVariantId === ctx.currentVariantId && reason !== "DEFECT") {
      return { error: "Escolha uma cor ou tamanho diferente do que você comprou." };
    }
  }

  if (f.photoCount > MAX_PHOTOS) return { error: `Envie no máximo ${MAX_PHOTOS} fotos.` };
  if (reason === "DEFECT" && f.photoCount === 0) {
    return { error: "Envie pelo menos uma foto do defeito." };
  }

  return {
    data: { quantity, reason, reasonText: reasonText || null, kind, exchangeVariantId },
  };
}

/** Tipo da imagem pelos primeiros bytes (não confia na extensão nem no navegador). */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Transições do pedido de troca. Quem faz cada uma está em return-actions.ts. */
const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  OPEN: ["APPROVED", "DENIED", "CANCELED"],
  APPROVED: ["RECEIVED", "CANCELED"],
  RECEIVED: ["COMPLETED"],
  DENIED: [],
  COMPLETED: [],
  CANCELED: [],
};

export function canMove(from: ReturnStatus, to: ReturnStatus) {
  return TRANSITIONS[from].includes(to);
}

/**
 * O frete da ida volta no arrependimento (CDC art. 49) e no defeito — uma vez
 * só por pedido, na primeira devolução em dinheiro desses motivos.
 */
export function refundsShipping(reason: ReturnReason, shippingAlreadyRefunded: boolean) {
  return (reason === "REGRET" || reason === "DEFECT") && !shippingAlreadyRefunded;
}

/** Texto padrão das instruções de envio da aprovação (o Admin pode editar). */
export function defaultApprovalMessage(input: {
  kind: ReturnKind;
  returnAddress: string;
  email: string;
}) {
  const what =
    input.kind === "EXCHANGE"
      ? "Assim que a peça chegar, enviamos a nova."
      : "Assim que a peça chegar e for conferida, devolvemos o valor.";
  return `Envie a peça em até 7 dias para:\n${input.returnAddress}\n\nO frete da volta é por nossa conta: escreva para ${input.email} com o número do pedido e mandamos o código de postagem. ${what}`;
}

// --- Relatório (item 24) -----------------------------------------------------

export type ReturnReportRow = {
  reason: ReturnReason;
  status: ReturnStatus;
  approvedKind: ReturnKind | null;
  quantity: number;
  createdAt: Date;
  answeredAt: Date | null;
  refundAmount: number | null;
};

/** Números do relatório de trocas e devoluções de um período. */
export function summarizeReturns(rows: ReturnReportRow[]) {
  const byReason = Object.fromEntries(RETURN_REASONS.map((r) => [r, 0])) as Record<
    ReturnReason,
    number
  >;
  const byStatus = Object.fromEntries(
    (Object.keys(STATUS_LABEL) as ReturnStatus[]).map((s) => [s, 0]),
  ) as Record<ReturnStatus, number>;
  let answerMs = 0;
  let answered = 0;
  for (const r of rows) {
    byReason[r.reason] += 1;
    byStatus[r.status] += 1;
    if (r.answeredAt) {
      answered += 1;
      answerMs += r.answeredAt.getTime() - r.createdAt.getTime();
    }
  }
  // Aprovado = recebeu um tipo do Admin, mesmo que depois tenha sido encerrado.
  const approved = rows.filter((r) => r.approvedKind !== null).length;
  const denied = byStatus.DENIED;
  return {
    requests: rows.length,
    units: rows.reduce((s, r) => s + r.quantity, 0),
    byReason,
    byStatus,
    approved,
    denied,
    /** Aprovados sobre respondidos, de 0 a 1. Sem resposta ainda: null. */
    approvalRate: approved + denied > 0 ? approved / (approved + denied) : null,
    /** Tempo médio até a resposta do Admin, em horas (1 casa). */
    avgAnswerHours: answered > 0 ? Math.round((answerMs / answered / 36e5) * 10) / 10 : null,
    refunded: Math.round(rows.reduce((s, r) => s + (r.refundAmount ?? 0), 0) * 100) / 100,
    exchanges: rows.filter((r) => r.approvedKind === "EXCHANGE" && r.status === "COMPLETED").length,
  };
}
