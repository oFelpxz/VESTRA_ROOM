/**
 * Textos padrão das páginas /trocas e /privacidade (item 25). Valem enquanto
 * o Admin não escrever um texto próprio em /admin/configuracoes. Os prazos e
 * o e-mail vêm das configurações, então mudar um prazo muda o texto também.
 *
 * Formato simples, o mesmo que o Admin usa no painel:
 * - linha em branco separa parágrafos;
 * - "## " no começo da linha vira título;
 * - "- " no começo da linha vira item de lista.
 */

import type { EditableSettings } from "@/lib/store-settings";

type PolicyInput = Pick<
  EditableSettings,
  "regretDays" | "exchangeDays" | "defectDays" | "email" | "storeName"
>;

export function defaultReturnPolicy(s: PolicyInput) {
  return `## Desistiu da compra?
Você tem ${s.regretDays} dias a partir do recebimento para devolver, sem precisar dizer o motivo. Devolvemos o valor total, frete incluso.

## Não serviu ou quer outra cor?
Você tem ${s.exchangeDays} dias a partir do recebimento para trocar pelo mesmo modelo em outro tamanho ou cor, enquanto houver estoque. Se não houver, devolvemos o valor da peça.

## Veio com defeito?
Você tem ${s.defectDays} dias a partir do recebimento. Envie fotos do defeito ao abrir o pedido. Trocamos a peça ou devolvemos o valor, e o frete é por nossa conta.

## Como pedir
Em Perfil → Pedidos, abra o pedido entregue e escolha "Trocar ou devolver". Acompanhe a resposta pelo sino de avisos.

## Condições
A peça deve voltar sem uso, sem lavagem e com a etiqueta (exceto em caso de defeito).

## Reembolso
- No cartão, o estorno aparece em até 2 faturas, conforme o banco.
- No PIX ou boleto, devolvemos por PIX em até 10 dias úteis depois de recebermos a peça.

Dúvidas: ${s.email}.`;
}

export function defaultPrivacyPolicy(s: PolicyInput) {
  return `## O que coletamos
- Cadastro: nome, e-mail, telefone e endereço de entrega.
- Medidas do corpo: altura, peso e medidas, só se você preencher o perfil de medidas.
- Compras: pedidos, trocas e avaliações.
- Cartões salvos: bandeira, 4 últimos números, validade e nome impresso. O número completo nunca fica com a loja; nas compras, o cartão é digitado na página do Stripe.

## Para que usamos
- Entregar seus pedidos.
- Montar o seu avatar no provador e recomendar tamanhos.
- Atender trocas e devoluções.
- Cumprir obrigações legais.

Não vendemos seus dados e não usamos suas medidas para publicidade.

## Com quem compartilhamos
Só o necessário para a loja funcionar:
- Stripe (pagamento).
- Melhor Envio e transportadoras (entrega).
- Supabase (armazenamento).
- Vercel (hospedagem do site).

## Medidas do corpo
Só você vê. A equipe da loja não tem acesso a elas, nem na tela de clientes.

## Seus direitos (LGPD)
- Ver e corrigir seus dados em Perfil.
- Baixar uma cópia dos seus dados em Perfil → "Baixar meus dados".
- Apagar suas medidas a qualquer momento em Perfil → Medidas.
- Excluir a conta em Perfil.

## Cookies
Usamos só o necessário para manter você conectado. Não usamos cookies de propaganda.

## Por quanto tempo guardamos
Enquanto a conta existir. Ao excluir a conta, apagamos suas medidas, endereços, cartões salvos e sacola e removemos seu nome, e-mail e telefone. O histórico de pedidos continua guardado, sem esses dados, pelo prazo que a lei fiscal exige.

## Contato
${s.email}`;
}

export type PolicyBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/** Quebra o texto em títulos, parágrafos e listas (sem HTML: o React escapa tudo). */
export function parsePolicy(text: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    if (list.length) blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      if (paragraph.length) {
        blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
        paragraph = [];
      }
      list.push(line.slice(2).trim());
    } else {
      if (list.length) {
        blocks.push({ kind: "list", items: list });
        list = [];
      }
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
