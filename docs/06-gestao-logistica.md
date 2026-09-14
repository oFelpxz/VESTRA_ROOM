# 06 — Gestão de Logística (Operador)

**Semana 4** · Depende de: 03
**Objetivo**: `ADMIN` e `STOCK_OPERATOR` veem todos os pedidos, atualizam status e ajustam estoque.

## Estrutura de arquivos

```
src/app/admin/pedidos/
  page.tsx                     # Lista geral de pedidos com filtros
  [orderId]/page.tsx           # Detalhe + ações de status
src/app/admin/estoque/
  page.tsx                     # Lista de variantes com estoque editável
src/components/admin/
  order-table.tsx
  order-status-actions.tsx     # Botões de transição de status
  stock-editor.tsx             # Edição inline de stockQuantity
src/lib/
  logistics-actions.ts         # advanceOrderStatus, setTrackingCode, adjustStock
```

## Passo a passo

### 1. Server Actions (`src/lib/logistics-actions.ts`)

Permissão: `ADMIN` ou `STOCK_OPERATOR`.

- `advanceOrderStatus(orderId, newStatus)`:
  - Valida transição permitida (não pula etapas)
  - Transições válidas:
    ```
    PAID         → PREPARING
    PREPARING    → SHIPPED        (exige trackingCode)
    SHIPPED      → DELIVERED
    qualquer     → CANCELED       (com motivo)
    ```
- `setTrackingCode(orderId, code)` — string livre, valida formato mínimo
- `adjustStock(variantId, newQuantity, reason)` — registra log (opcional: criar `StockMovement`)

### 2. Lista de pedidos (`/admin/pedidos`)

- Tabela com todas as ordens
- Colunas: nº, cliente, data, total, status, método de pagamento
- Filtros: status, intervalo de data, busca por cliente
- Default: mostrar apenas PAID/PREPARING/SHIPPED (pedidos "ativos")
- Linha clicável → `[orderId]`

### 3. Detalhe do pedido (`/admin/pedidos/[orderId]`)

Reutiliza muita coisa do doc 05, mais:
- `order-status-actions.tsx`:
  - Botão principal pra próxima transição válida
  - Ex: pedido em PAID → botão "Iniciar preparação"
  - Em PREPARING → input de tracking + botão "Marcar como enviado"
  - Botão secundário "Cancelar pedido"
- Visualiza dados do cliente (nome, email, telefone)
- Endereço de entrega editável (só antes de SHIPPED)

### 4. Gestão de estoque (`/admin/estoque`)

- Tabela: produto, variante (cor/tamanho), SKU, estoque atual, ações
- Filtros: por produto, por categoria, "apenas baixo estoque" (< 5)
- Edição inline: input numérico + botão salvar
- Modal "Ajustar estoque" com motivo (reposição, perda, devolução, contagem)

### 5. Dashboard simples (opcional, ganho visual pra demo)

Em `/admin` (page principal já existe):
- Cards:
  - Pedidos hoje
  - Pedidos pendentes de envio
  - Produtos com estoque baixo
  - Faturamento do mês (soma de Order.totalAmount com status >= PAID)

### 6. Proteção de rota

Em `admin/layout.tsx`:
```ts
const allowed = ['ADMIN', 'STOCK_OPERATOR'];
if (!allowed.includes(session.user.role)) redirect('/');
```

E dentro de `/admin/produtos` e `/admin/modelos-3d` restringe mais (só ADMIN).

## Critérios de aceitação

- [ ] Operador vê todos os pedidos, com filtros funcionais
- [ ] Avança status seguindo a sequência válida; tentativas inválidas dão erro claro
- [ ] Marcar como SHIPPED exige tracking code
- [ ] Cliente vê mudança de status no `/perfil/pedidos/[id]` (doc 05)
- [ ] Operador edita estoque e mudança reflete imediatamente em `/catalogo` e nas compras
- [ ] Cancelamento de pedido devolve estoque
- [ ] CUSTOMER não acessa `/admin/pedidos` nem `/admin/estoque`
