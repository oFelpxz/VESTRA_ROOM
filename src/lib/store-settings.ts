/**
 * Regras da loja num lugar só (preparação do item 25, configurações).
 *
 * Hoje são valores fixos no código. Quando o item 25 sair, o Admin vai
 * poder mudar estes valores pela tela; até lá, eles são o padrão. Para
 * mudar uma regra agora, mude aqui e todo o resto acompanha.
 */

export type StoreSettings = {
  /** Econômico grátis a partir deste valor em produtos (R$). */
  freeShippingFrom: number;
  /**
   * Tabela própria de frete, usada quando o Melhor Envio não está
   * configurado ou não responde (R$).
   */
  shippingTable: {
    economyBase: number;
    economyPerItem: number;
    expressBase: number;
    expressPerItem: number;
  };
  /** CEP de onde a loja envia, se o .env não disser outro (MELHOR_ENVIO_FROM_CEP). */
  fromPostalCode: string;
  /** Dias corridos até o boleto vencer (o Stripe aceita de 0 a 60). */
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
