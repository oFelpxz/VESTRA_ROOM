# Roadmap de Execução — MVP Loja 3D

Ordem de execução do que falta, seguindo o cronograma original (Semanas 3 → 5).
Cada doc abaixo é um passo-a-passo independente — execute na ordem.

## Status atual (ponto de partida)

Concluído (S1 + S2):
- Auth (login, cadastro, perfil) com NextAuth 5
- POC 3D no browser (`/teste-3d`)
- Catálogo + página de produto com viewer 3D estático
- Perfil de medidas + aceite de termos
- Admin: categorias e tabela de medidas
- Carrinho funcional (S3 parcial)

Pendente:
- **S3**: Checkout sandbox, Admin produtos, Admin modelos 3D
- **S4**: Provador virtual, Acompanhamento de pedido, Gestão logística
- **S5**: Apresentação final

> **Tarefas manuais** (config, dados, assets): ver [TAREFAS-MANUAIS.md](./TAREFAS-MANUAIS.md)

## Ordem de desenvolvimento

| # | Documento | Entrega | Semana |
|---|---|---|---|
| 01 | [01-admin-produtos.md](./01-admin-produtos.md) | CRUD de produtos e variantes no admin | S3 |
| 02 | [02-admin-modelos-3d.md](./02-admin-modelos-3d.md) | Upload, associação e validação de modelos 3D | S3 |
| 03 | [03-checkout-sandbox.md](./03-checkout-sandbox.md) | Fluxo de checkout completo com pagamento simulado | S3 |
| 04 | [04-provador-virtual.md](./04-provador-virtual.md) | Avatar + roupa + indicador de caimento + add ao carrinho | S4 |
| 05 | [05-acompanhamento-pedido.md](./05-acompanhamento-pedido.md) | Cliente vê status e histórico de pedidos | S4 |
| 06 | [06-gestao-logistica.md](./06-gestao-logistica.md) | Admin/operador gerencia status de pedido e estoque | S4 |
| 07 | [07-apresentacao-final.md](./07-apresentacao-final.md) | Checklist da demo end-to-end | S5 |

## Convenções

- **Server Actions** para mutações (padrão já usado em `src/lib/*-actions.ts`)
- **Prisma** para acesso a dados via `src/lib/prisma.ts`
- **shadcn/radix** para UI
- **Validação**: feita na action antes de chamar Prisma
- **Roles**: `CUSTOMER`, `ADMIN`, `STOCK_OPERATOR`, `MODEL_3D` (já no schema)
- **Rotas admin**: protegidas por verificação de `session.user.role` em `layout.tsx`
