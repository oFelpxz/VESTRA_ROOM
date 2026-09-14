# 01 — Admin: Cadastro de Produtos

**Semana 3** · Pré-requisito para: 02, 03
**Objetivo**: Permitir que `ADMIN` cadastre, edite e gerencie produtos e variantes pela UI.

## Estrutura de arquivos

```
src/app/admin/produtos/
  page.tsx                     # Lista de produtos
  novo/page.tsx                # Formulário criar
  [id]/page.tsx                # Editar produto + gerenciar variantes
src/components/admin/
  product-form.tsx             # Form reutilizado (criar/editar)
  product-list.tsx             # Tabela com paginação
  variant-manager.tsx          # CRUD inline de variantes (SKU/cor/tamanho/estoque)
src/lib/
  product-actions.ts           # createProduct, updateProduct, deleteProduct, addVariant, updateVariant, removeVariant
```

## Passo a passo

### 1. Server Actions (`src/lib/product-actions.ts`)

Criar funções `"use server"`:
- `createProduct(data)` — valida slug único, cria produto em status `DRAFT`
- `updateProduct(id, data)` — atualiza campos básicos
- `publishProduct(id)` — muda status `DRAFT` → `ACTIVE` (exige ao menos 1 variante e 1 imagem)
- `deleteProduct(id)` — só permitido se não tiver pedidos vinculados (senão `INACTIVE`)
- `addVariant(productId, { sku, color, size, price?, stockQuantity })` — valida SKU único
- `updateVariant(id, data)`
- `removeVariant(id)` — bloquear se houver `CartItem`/`OrderItem` referenciando
- `addProductImage(productId, { url, altText, position })`
- `removeProductImage(id)`

Todas devem verificar `session.user.role === 'ADMIN'` antes de executar.

### 2. Lista (`/admin/produtos`)

- Tabela: nome, categoria, preço base, status, nº de variantes, has3DModel
- Filtros: por categoria, por status
- Botão "Novo produto" → `/admin/produtos/novo`
- Ações por linha: editar, publicar/despublicar, excluir

### 3. Formulário de criação (`/admin/produtos/novo`)

Campos:
- nome (gera slug automático, editável)
- descrição (textarea)
- marca
- categoria (select carregado do banco)
- basePrice / promotionalPrice
- status (default DRAFT)
- availableForVirtualTryOn (checkbox)

Após salvar → redireciona para `/admin/produtos/[id]` para adicionar variantes e imagens.

### 4. Edição (`/admin/produtos/[id]`)

Tabs ou seções:
1. **Dados básicos** — mesmo form da criação
2. **Variantes** — `variant-manager.tsx`: lista + form inline (SKU, cor, tamanho, preço opcional, estoque)
3. **Imagens** — upload + ordenação (`position`)
4. **Modelo 3D** — link para `/admin/modelos-3d/[productId]` (doc 02)
5. **Tabela de tamanhos** — CRUD de `SizeChart` + `SizeChartMeasure`

### 5. Proteção de rota

Em `src/app/admin/layout.tsx` (já existe), garantir bloqueio para roles ≠ `ADMIN`:

```ts
const session = await auth();
if (!session || session.user.role !== 'ADMIN') redirect('/login');
```

## Critérios de aceitação

- [ ] Admin cria produto em DRAFT com sucesso
- [ ] Adiciona ≥1 variante com SKU único e estoque
- [ ] Publica produto (status ACTIVE) e ele aparece em `/catalogo`
- [ ] Edita preço e a alteração reflete no carrinho ao adicionar
- [ ] Tentativa de excluir produto com pedidos → erro tratado, vira INACTIVE
- [ ] Usuário CUSTOMER não acessa `/admin/produtos` (redirect)
