# 03 — Checkout Sandbox

**Semana 3** · Depende de: 01 · Pré-requisito para: 05, 06
**Objetivo**: Fluxo completo de finalização de compra com pagamento simulado (provider `SIMULATED`), validação de estoque e cálculo de frete.

## Estrutura de arquivos

```
src/app/checkout/
  page.tsx                     # Etapas: endereço → revisão → pagamento
  sucesso/[orderId]/page.tsx   # Confirmação
src/app/api/payments/
  simulate/route.ts            # Webhook simulado: marca pagamento como PAID após X segundos
src/components/checkout/
  address-step.tsx
  review-step.tsx
  payment-step.tsx
  order-summary.tsx
src/lib/
  order-actions.ts             # createOrderFromCart, getOrderById, listMyOrders
  payment-actions.ts           # createSimulatedPayment, confirmPayment
  shipping.ts                  # calculateShipping(items, postalCode) → mock
```

## Passo a passo

### 1. Cálculo de frete (`src/lib/shipping.ts`)

Mock simples para MVP:
```ts
export function calculateShipping(items, postalCode) {
  // Regra fake: R$ 15 fixo + R$ 2 por item; grátis > R$ 300
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  if (subtotal >= 300) return 0;
  return 15 + items.length * 2;
}
```

### 2. Server Actions de pedido (`src/lib/order-actions.ts`)

- `createOrderFromCart(addressId, paymentMethod)`:
  1. Carrega carrinho ACTIVE do user
  2. **Trava estoque**: para cada item, verificar `stockQuantity >= quantity`. Se falhar, retornar lista de itens indisponíveis (não cria pedido)
  3. Calcula totais (subtotal + frete - desconto)
  4. Em **transaction**:
     - Cria `Order` (status `PENDING_PAYMENT`)
     - Cria `OrderItem` para cada `CartItem` (copia productName, color, size, unitPrice, totalPrice)
     - Decrementa `stockQuantity` das variantes
     - Marca carrinho como `CONVERTED`
     - Cria `Payment` (status `PENDING`, provider `SIMULATED`)
  5. Retorna `orderId`

- `getOrderById(id)` — só dono ou ADMIN/STOCK_OPERATOR
- `listMyOrders()` — pedidos do user logado

### 3. Pagamento simulado (`src/lib/payment-actions.ts` + `api/payments/simulate`)

- `createSimulatedPayment(orderId)` — dispara o webhook simulado (POST para `/api/payments/simulate`)
- `/api/payments/simulate` (POST):
  - Recebe `{ orderId }`
  - Aguarda 3 segundos (`setTimeout` ou simplesmente delay)
  - Atualiza `Payment.status = PAID`, `paidAt = now()`
  - Atualiza `Order.status = PAID`
  - (Opcional) Dispara função pra preparar pedido → `PREPARING`

> Para PIX simulado: gerar QR code fake (string) e exibir.
> Para cartão simulado: form que sempre aprova.

### 4. UI do checkout (`/checkout`)

Stepper de 3 passos:

**Step 1 — Endereço**
- Lista endereços do user (`Address`)
- Botão "Novo endereço" abre form inline
- Seleciona um → salva no state

**Step 2 — Revisão**
- `order-summary.tsx`: itens, subtotal, frete (calculado ao selecionar endereço), total
- Mostra avisos se algum item está com estoque baixo

**Step 3 — Pagamento**
- Radio: PIX | Cartão de Crédito | Boleto
- PIX: mostra QR code fake + "Aguardando pagamento..."
- Cartão: form (número, validade, CVV — não armazenar, é mock)
- Boleto: gera "código" fake
- Botão "Finalizar pedido" → `createOrderFromCart` → redireciona pra `sucesso/[orderId]`

### 5. Tela de sucesso (`/checkout/sucesso/[orderId]`)

- Mostra resumo do pedido
- Status do pagamento (polling a cada 2s até virar PAID)
- Botão "Ver meus pedidos" → `/perfil/pedidos` (criado no doc 05)

### 6. Atualizações no carrinho

- Em `carrinho/page.tsx`, botão "Finalizar compra" → `/checkout`
- Bloquear acesso se carrinho vazio (redirect)

## Critérios de aceitação

- [ ] Carrinho com itens → checkout abre no step de endereço
- [ ] Sem endereço cadastrado: form aparece e salva
- [ ] Frete é calculado e exibido na revisão
- [ ] Tentativa de comprar item sem estoque suficiente → erro claro, pedido não criado
- [ ] Finalização cria Order PENDING_PAYMENT + Payment PENDING
- [ ] Após ~3s, status muda pra PAID na tela de sucesso (sem refresh manual)
- [ ] Estoque das variantes é decrementado
- [ ] Carrinho original vira CONVERTED, novo carrinho ACTIVE criado vazio
- [ ] Usuário deslogado é redirecionado pro login antes do checkout
