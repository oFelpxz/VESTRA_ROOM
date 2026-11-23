/**
 * Regras da loja num lugar só (item 25, configurações).
 *
 * O Admin muda a maior parte delas em /admin/configuracoes (tabela
 * `StoreSettings`, uma linha só). Este arquivo guarda os valores padrão —
 * usados enquanto a linha não existe ou se o banco não responder — e a
 * validação do formulário. Sem banco aqui, para poder ser testado; a leitura
 * do banco fica em `store-settings-db.ts`.
 */

export type StoreSettings = {
  /** Econômico grátis a partir deste valor em produtos (R$). */
  freeShippingFrom: number;
  /**
   * Tabela própria de frete, usada quando o Melhor Envio não está
   * configurado ou não responde (R$). Fixa no código.
   */
  shippingTable: {
    economyBase: number;
    economyPerItem: number;
    expressBase: number;
    expressPerItem: number;
  };
  /** CEP de onde a loja envia, se o .env não disser outro (MELHOR_ENVIO_FROM_CEP). */
  fromPostalCode: string;
  /** Dias corridos até o boleto vencer (o Stripe aceita de 0 a 60; a tela, 1 a 30). */
  boletoDays: number;
  /**
   * Minutos para o cliente concluir a página de pagamento do Stripe. Depois
   * disso o pedido é cancelado e o estoque volta. (O Stripe aceita de 30 a 1440.)
   */
  checkoutTtlMin: number;
  /** Limite de estoque baixo de cada variante nova (o Admin muda por variante). */
  lowStockThreshold: number;
};

export const STORE_SETTINGS: StoreSettings = {
  freeShippingFrom: 300,
  shippingTable: {
    economyBase: 15,
    economyPerItem: 2,
    expressBase: 25,
    expressPerItem: 3,
  },
  fromPostalCode: "01310100", // Av. Paulista, SP
  boletoDays: 3,
  checkoutTtlMin: 60,
  lowStockThreshold: 5,
};

/** Tudo que o Admin edita na tela (item 25). */
export type EditableSettings = {
  storeName: string;
  cnpj: string;
  email: string;
  phone: string;
  returnAddress: string;
  /** Vazio = texto padrão da página. */
  returnPolicy: string | null;
  privacyPolicy: string | null;
  /** Prazos de troca, em dias a partir da entrega (itens 21.1 a 21.3). */
  regretDays: number;
  exchangeDays: number;
  defectDays: number;
  boletoDays: number;
  freeShippingFrom: number;
  lowStockThreshold: number;
  /** Folga do indicador de caimento, em cm (25.8). */
  fitToleranceCm: number;
};

export const DEFAULT_SETTINGS: EditableSettings = {
  storeName: "VESTRA ROOM",
  cnpj: "00.000.000/0001-00",
  email: "contato@vestraroom.com.br",
  phone: "(11) 4000-0000",
  returnAddress:
    "VESTRA ROOM — Trocas\nAv. Paulista, 1000, sala 10\nBela Vista, São Paulo/SP\nCEP 01310-100",
  returnPolicy: null,
  privacyPolicy: null,
  regretDays: 7,
  exchangeDays: 30,
  defectDays: 90,
  boletoDays: STORE_SETTINGS.boletoDays,
  freeShippingFrom: STORE_SETTINGS.freeShippingFrom,
  lowStockThreshold: STORE_SETTINGS.lowStockThreshold,
  fitToleranceCm: 2,
};

export const SETTINGS_FIELDS = [
  "storeName",
  "cnpj",
  "email",
  "phone",
  "returnAddress",
  "returnPolicy",
  "privacyPolicy",
  "regretDays",
  "exchangeDays",
  "defectDays",
  "boletoDays",
  "freeShippingFrom",
  "lowStockThreshold",
  "fitToleranceCm",
] as const;

type IntRule = { label: string; min: number; max: number };

const INT_RULES: Record<
  "regretDays" | "exchangeDays" | "defectDays" | "boletoDays" | "lowStockThreshold",
  IntRule
> = {
  // CDC art. 49: arrependimento é no mínimo 7 dias.
  regretDays: { label: "Prazo de arrependimento", min: 7, max: 365 },
  exchangeDays: { label: "Prazo de troca de tamanho ou cor", min: 1, max: 365 },
  // CDC art. 26: produto durável, 90 dias.
  defectDays: { label: "Prazo para defeito", min: 90, max: 730 },
  boletoDays: { label: "Dias para pagar o boleto", min: 1, max: 30 },
  lowStockThreshold: { label: "Estoque baixo padrão", min: 0, max: 1000 },
};

const TEXT_LIMIT = 20_000;

function num(value: string) {
  const clean = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!clean) return NaN;
  return Number(clean);
}

/**
 * Valida o formulário de configurações. Recebe os campos como texto (como
 * vêm do FormData) e devolve os valores prontos ou a primeira mensagem de erro.
 */
export function parseSettingsForm(
  fields: Record<string, string>,
): { data: EditableSettings } | { error: string } {
  const text = (k: string) => (fields[k] ?? "").trim();

  const storeName = text("storeName");
  if (!storeName) return { error: "Informe o nome da loja." };
  if (storeName.length > 80) return { error: "O nome da loja pode ter até 80 caracteres." };

  const cnpj = text("cnpj");
  if (cnpj.replace(/\D/g, "").length !== 14) {
    return { error: "O CNPJ precisa ter 14 números." };
  }

  const email = text("email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  const phone = text("phone");
  const phoneDigits = phone.replace(/\D/g, "").length;
  if (phoneDigits < 10 || phoneDigits > 13) {
    return { error: "Informe um telefone com DDD." };
  }

  const returnAddress = text("returnAddress").replace(/\r\n/g, "\n");
  if (returnAddress.length < 10) {
    return { error: "Informe o endereço para devoluções completo." };
  }
  if (returnAddress.length > 500) {
    return { error: "O endereço para devoluções pode ter até 500 caracteres." };
  }

  const returnPolicy = text("returnPolicy").replace(/\r\n/g, "\n");
  const privacyPolicy = text("privacyPolicy").replace(/\r\n/g, "\n");
  if (returnPolicy.length > TEXT_LIMIT || privacyPolicy.length > TEXT_LIMIT) {
    return { error: `Cada política pode ter até ${TEXT_LIMIT.toLocaleString("pt-BR")} caracteres.` };
  }

  const ints = {} as Record<keyof typeof INT_RULES, number>;
  for (const [key, rule] of Object.entries(INT_RULES) as [keyof typeof INT_RULES, IntRule][]) {
    const n = num(text(key));
    if (!Number.isInteger(n)) return { error: `${rule.label}: informe um número inteiro.` };
    if (n < rule.min || n > rule.max) {
      return { error: `${rule.label}: entre ${rule.min} e ${rule.max}.` };
    }
    ints[key] = n;
  }

  const freeShippingFrom = num(text("freeShippingFrom"));
  if (!Number.isFinite(freeShippingFrom) || freeShippingFrom < 0 || freeShippingFrom > 100_000) {
    return { error: "Frete grátis a partir de: informe um valor entre 0 e 100.000." };
  }

  const fitToleranceCm = num(text("fitToleranceCm"));
  if (!Number.isFinite(fitToleranceCm) || fitToleranceCm < 0 || fitToleranceCm > 10) {
    return { error: "Tolerância do caimento: entre 0 e 10 cm." };
  }

  return {
    data: {
      storeName,
      cnpj,
      email,
      phone,
      returnAddress,
      returnPolicy: returnPolicy || null,
      privacyPolicy: privacyPolicy || null,
      ...ints,
      freeShippingFrom: Math.round(freeShippingFrom * 100) / 100,
      fitToleranceCm: Math.round(fitToleranceCm * 10) / 10,
    },
  };
}
