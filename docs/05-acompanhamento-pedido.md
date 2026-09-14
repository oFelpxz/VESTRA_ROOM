# 05 — Acompanhamento de Pedido (Cliente)

**Semana 4** · Depende de: 03
**Objetivo**: Cliente vê histórico de pedidos, status atual e código de rastreio.

## Estrutura de arquivos

```
src/app/perfil/pedidos/
  page.tsx                     # Lista de pedidos do user
  [orderId]/page.tsx           # Detalhe + timeline de status
src/components/profile/
  order-card.tsx               # Card resumo do pedido na lista
  order-timeline.tsx           # Stepper visual de status
  order-items-list.tsx
```

## Passo a passo

### 1. Listagem (`/perfil/pedidos`)

- Carrega via `listMyOrders()` (criado no doc 03)
- Ordena por `createdAt` desc
- Cada `order-card.tsx` mostra:
  - Nº pedido (curto: últimos 8 chars do id)
  - Data
  - Total
  - Status com cor (badge)
  - Thumbnail do primeiro item
  - Link "Ver detalhes" → `[orderId]`

Filtros opcionais: status (PENDING_PAYMENT, PAID, PREPARING, SHIPPED, DELIVERED, CANCELED).

### 2. Detalhe (`/perfil/pedidos/[orderId]`)

Seções:
1. **Cabeçalho**: nº pedido, data, status grande
2. **Timeline**: `order-timeline.tsx` — stepper com os estados
   ```
   PENDING_PAYMENT → PAID → PREPARING → SHIPPED → DELIVERED
   ```
   Cada step mostra ✓ ou pendente, com data quando aplicável
3. **Itens**: lista com imagem, nome, cor, tamanho, qtd, preço unit, subtotal
4. **Endereço de entrega**: exibe `shippingAddress`
5. **Pagamento**: método, status, valor
6. **Rastreio**: se `trackingCode` existir, exibe + link externo (mock)
7. **Total**: subtotal + frete - desconto = total

### 3. Atualização em tempo (quase) real

Para a demo do MVP:
- Polling simples a cada 10s na página de detalhe enquanto `status !== DELIVERED && status !== CANCELED`
- Alternativa: revalidar via `router.refresh()` em interval

### 4. Cancelamento (opcional MVP)

- Botão "Cancelar pedido" só visível se `status in (PENDING_PAYMENT, PAID)`
- Confirmação modal → `cancelOrder(id)` server action
- Action: muda status pra CANCELED, devolve estoque, marca payment como REFUNDED (se PAID)

### 5. Link no perfil

Em `/perfil` (page principal), adicionar card "Meus Pedidos" com contagem e link.

## Critérios de aceitação

- [ ] Cliente vê lista de seus pedidos ordenada por data
- [ ] Clica em pedido e vê todos os dados + timeline
- [ ] Status visualmente claro com cores e ícones
- [ ] Cliente NÃO vê pedidos de outros users
- [ ] Mudança de status feita pelo operador (doc 06) reflete aqui em até 10s
- [ ] Cancelamento (se implementado) devolve estoque e marca refund
