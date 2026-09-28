# Status — Fase 2 (2º semestre)

> **Documento de contexto** — gerado em 2026-09-14 pra continuar o trabalho em
> outra sessão/chat sem perder o histórico. Os outros arquivos em `docs/`
> (`00-roadmap.md`, `TAREFAS-MANUAIS.md`, `CHECKLIST-FUNCIONALIDADES.md` etc.)
> são de um **ciclo de planejamento antigo** (antes da Fase 2 começar) e estão
> desatualizados — não usar como referência de escopo. A fonte de verdade da
> Fase 2 é o `Vestra_Room_Cronograma_Fase2.docx` (Downloads do usuário) +
> este arquivo.

## Onde estamos agora

- **`main` e `Felipe` estão sincronizados** (mesmo commit) — `main` estava
  parado desde maio, foi mergeado com `Felipe` em 2026-09-14. Os dois branches
  têm Sprint 1 + Sprint 2 + avatar 3D real completos.
- Merge teve 3 conflitos reais (arquivos que `main` nunca tinha atualizado):
  `next.config.ts` foi **combinado** (mantém `remotePatterns` do `main` +
  `serverExternalPackages` do `Felipe`, os dois eram necessários);
  `products.ts` e `product-card.tsx` ficaram com a versão do `Felipe` (o
  `main` tinha a UI antiga, pré-redesign).
- O merge expôs um bug: `public/models/hoodie_black.glb` mudou de lugar
  (virou `others/moletompreto.glb`), quebrando o fallback que "Boxy Tee 01" e
  "Hoodie Core" usavam no seed. **Corrigido** — os dois agora apontam pro
  próprio `.glb` que já existia (`boxy_tee_01.glb`, `hoodie_core.glb`), seed
  rodado de novo, verificado no navegador.
- **Já enviado ao GitHub** (conferido em 27/09/2026: `main` e `Felipe` no
  GitHub iguais às locais). O ambiente onde essas sessões rodam não tem
  credencial de escrita no GitHub; o envio foi feito com:
  ```bash
  git push origin main Felipe
  ```
  (pede login do GitHub — só o usuário consegue fazer isso).
- Servidor local: `npm run dev` → http://localhost:3000. Precisa do `.env`
  (gitignored, não versionado) com `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MODELS_BUCKET`,
  `NEXT_PUBLIC_AVATAR_MODEL_URL="/models/avatar_base.glb"`.
- **Risco recorrente**: o projeto Supabase (free tier) **pausa sozinho após
  ~7 dias sem uso** — já aconteceu duas vezes e foi a causa real do atraso da
  Sprint 2. Sintoma: erro `tenant/user ... not found` (projeto pausado, precisa
  restaurar pelo dashboard) ou `password authentication failed` (a
  restauração às vezes troca a senha do banco — pegar a nova em Project
  Settings → Database). Verificar/abrir o projeto pelo menos uma vez por
  semana, ou considerar o plano pago antes da apresentação final (26/10).

---

## Sprint 1 — 11/08 a 24/08 — ✅ 8/8 completa

Perfis de acesso, conta do cliente com privacidade, fundação do pipeline 3D.

| Item | Entrega | Onde no código |
|---|---|---|
| 27 | Permissões e painéis por perfil (Admin, Operador de Estoque, Modelador 3D, Cliente) — bloqueio real no middleware, não só menu escondido | `src/lib/admin-access.ts`, `src/auth.config.ts` |
| 01 | Gerenciar endereços — CRUD, endereço padrão pré-selecionado no checkout | `/perfil/enderecos`, `src/lib/address-actions.ts` |
| 02 | Excluir/resetar medidas corporais | `/perfil/medidas`, `src/lib/measurement-actions.ts` |
| 03 | Excluir conta — anonimiza histórico de pedidos, preserva registro fiscal | `src/lib/auth-actions.ts` |
| 04 | Salvar formas de pagamento — tokenizado, só token + 4 últimos dígitos | `/perfil/pagamento`, `src/lib/payment-method-actions.ts` |
| 05 | Peso aproximado — campo novo na tabela de medidas | `prisma/schema.prisma` (`MeasurementProfile.weightKg`) |
| 3D-01 | Pipeline de modelos 3D — valida formato, versiona, **comprime automaticamente** (gltf-transform: dedup/weld/quantize, ~29% de redução típica) | `src/lib/model-optimizer.ts`, `/api/models-3d/upload` |
| 26 | Storage 3D em nuvem — Supabase Storage, bucket privado `models-3d`, signed URL de 2h | `src/lib/storage.ts` |

Testes de usuário (seed): `admin@vestra.room` / `vestra123` ·
`estoque@vestra.room` / `estoque123` · `modelador@vestra.room` / `modelo123` ·
`cliente@vestra.room` / `cliente123`.

---

## Sprint 2 — 25/08 a 08/09 — ✅ 7/7 completa

Catálogo, ficha de produto, avaliações, estoque configurável, visualizador
avançado. **Atrasou 5+ dias por causa da pausa do Supabase** (ver seção de
riscos) — só foi commitada/testada de verdade em 2026-09-14.

| Item | Entrega | Onde no código |
|---|---|---|
| 06 | Novos filtros — gênero, coleção, material, disponível no provador | `src/lib/products.ts` (`ProductFilters`), `src/app/catalogo/page.tsx` |
| 07 | Ficha técnica (composição, cuidados, política de troca) + parcelamento calculado | `Product.composition/careInstructions/returnPolicy/maxInstallments`, `src/app/produto/[id]/page.tsx` |
| 08 | Categorias novas — Camisas, Bermudas, Saias, Vestidos, com produto de exemplo | `prisma/seed.ts` |
| 09 | Avaliações — só quem comprou avalia (nota 1–5 + comentário), moderação do Admin, média no produto | model `Review`, `src/lib/review-actions.ts`, `/admin/avaliacoes` |
| 10 | Estoque baixo configurável por variação (SKU), badge + contador no painel do Operador | `ProductVariant.lowStockThreshold`, `src/components/admin/stock-editor.tsx` |
| 3D-02 | Upload de textura separado, histórico de versões com "Restaurar", tamanhos com simulação 3D | model `Model3DVersion`, `Model3D.availableSizes`, `/api/models-3d/upload-texture`, `src/lib/model-3d-actions.ts` |
| 3D-03 | Visualizador do cliente: claro/escuro, tela cheia, vistas frente/lateral/costas | `src/components/viewer-3d/viewer.tsx` |

Migration: `20260914160757_sprint2_catalogo_avaliacoes_estoque_3d`.

**Decisão de escopo assumida**: item 10 ("notificação quando estoque cruzar o
limite") virou destaque visual (badge + contador), não um sistema de
e-mail/push — cobre a necessidade prática do MVP.

---

## Sprint 3 — 09/09 a 23/09 — ✅ 5/5 (sem o 3D-04), testada no banco real

Sem o item **3D-04**, por decisão do grupo. Branch **`feat/sprint3`**, a partir
da `main`. Desenvolvida com o Supabase pausado e validada sem banco (typecheck,
lint, testes da lógica isolada e build de produção); a migration foi aplicada e
tudo foi testado no navegador, no banco real, em 27/09/2026. Falta só o caso
"Esgotado" dos favoritos, que exige zerar estoque e ficou para uma pessoa do
grupo. **O envio ao GitHub depende do login de uma pessoa do grupo.**

| Item | Entrega | Onde no código |
|---|---|---|
| 14 | Frete por CEP no carrinho, modalidades Econômico e Expresso; a escolha vale até o pedido | `src/lib/shipping.ts`, `src/components/cart/shipping-estimator.tsx` |
| 12 | Gestão de cupons (só Admin) | `/admin/cupons`, `src/lib/coupons.ts`, `src/lib/coupon-actions.ts` |
| 13 | Aplicar cupom no carrinho, com revalidação e reserva de uso na criação do pedido | `src/components/cart/coupon-field.tsx`, `src/lib/order-actions.ts` |
| 11 | Favoritos: coração no catálogo e no produto, lista `/favoritos` com atalho para a sacola | `src/lib/favorites.ts`, `src/lib/favorite-actions.ts` |
| 23 | Gestão de clientes (só Admin), sem expor medidas; bloqueio impede login e compra | `/admin/clientes`, `src/lib/customers.ts` |

Também corrigido: o carrinho ignorava o **preço promocional** (bug do item 07).

Migration: `20260927173052_sprint3_frete_cupons_favoritos_clientes` —
**só aditiva**, compatível com o código das outras branches. **Já aplicada no
banco compartilhado em 27/09/2026**; em outro banco, aplicar **só com
`npx prisma migrate deploy`**, nunca `migrate dev`.

**Todas as decisões, achados das revisões e o roteiro de testes:
[`SPRINT3-DECISOES.md`](SPRINT3-DECISOES.md).**

> ⚠️ **Não rodar `npm run db:seed` no banco compartilhado.** O seed completo
> sobrescreve estoque, preços e modelos 3D alterados pelo admin. Para os cupons
> de exemplo, use `npm run db:seed:sprint3`, que só cria o que falta.

---

## Bônus — Avatar 3D real (item 3D-05, adiantado da Sprint 4)

Corpo humano de verdade substituindo o avatar de primitivas (cápsulas/esferas).

**Pipeline**: MakeHuman/MPFB2 (addon do Blender, `extensions.blender.org/add-ons/mpfb`)
→ usuário esculpe o corpo base + 8 variações extremas (uma por medida) →
exporta cada uma como `.obj` → `scripts/build_avatar.py` (roda o Blender
headless, sem interface) junta as 8 variações como *shape keys* no corpo base
→ exporta `public/models/avatar_base.glb` com 8 morph targets nomeados.

```bash
blender --background --python scripts/build_avatar.py -- \
  --input-dir <pasta com base.obj + 8 variações> \
  --output public/models/avatar_base.glb
```

Mapeamento eixo → slider do MPFB (documentado porque os nomes não são óbvios):

| Eixo | Onde no MPFB | Slider(s) |
|---|---|---|
| `height` | phenotype → Macrodetails | Height |
| `weight` | phenotype → Macrodetails | Weight |
| `chest` | breast | breast-volume-vert-down-up |
| `waist` | stomach | stomach-pregnant-decr-incr |
| `hip` | hip | hip-scale-horiz-decr-incr + hip-scale-depth-decr-incr |
| `shoulder` | arms | upperarm-shoulder-muscle-decr-incr (L+R) |
| `armLength` | arms | measure-upperarm-length-decr-incr + measure-lowerarm-length-decr-incr |
| `legLength` | legs | measure-upperleg-height-decr-incr + measure-lowerleg-height-decr-incr |

Consumo em runtime: `src/lib/avatar-builder.ts` converte as medidas do
cliente em 8 pesos (-1..1); `src/components/viewer-3d/avatar.tsx` carrega o
`avatar_base.glb` e aplica os pesos nos morph targets. Sem
`NEXT_PUBLIC_AVATAR_MODEL_URL` definida, cai pro avatar de primitivas — o
fallback é automático (error boundary), nunca quebra a página.

**Limitação conhecida**: cada shape key só foi modelada num sentido (neutro →
"grande"). Cliente menor que a referência recebe peso negativo, que
extrapola em vez de interpolar entre dois corpos reais — ver item A2 abaixo.

---

## Overreview — melhorias fora do escopo das sprints

Levantamento feito lendo o código (não é pendência de sprint, é análise à
parte). Documento visual completo publicado como artifact nesta sessão; texto
consolidado aqui pra sobreviver à troca de chat. 32 itens, 6 categorias.

### ✅ Solo — resolvo sem depender de nada externo

- **A1** — Ligar o avatar no provador: hoje o `TryOnScene`
  (`src/components/viewer-3d/tryon-scene.tsx`) recebe `avatarParams` mas só
  usa pra posicionar câmera — o `<Avatar />` nunca é renderizado na cena, só
  a roupa flutua. **Era o próximo item que eu ia atacar quando essa sessão
  foi interrompida.**
- **B1** — Reprocessar modelos antigos que nunca passaram pela compressão:
  `hoodie_core.glb` (52,9 MB) e `tech_vest.glb` (36,7 MB) — o pipeline de
  compressão (`src/lib/model-optimizer.ts`) já existe, é rodar os arquivos
  locais por ele e reenviar pro Storage.
- **B3** — Draco no pipeline de compressão + decoder no viewer (ganho maior
  que a quantização atual, mas adiciona dependência no cliente).
- **B4** — Catálogo usar os `/previews/*.png` em vez de carregar o `.glb`
  inteiro só pra mostrar miniatura.
- **C1** — Assinatura/segredo no webhook simulado de pagamento
  (`/api/payments/simulate` hoje aceita qualquer POST com um `orderId` e
  marca como pago, sem autenticação nenhuma).
- **C4** — Rate limit no login (lógica + banco, sem serviço externo).
- **C6** — Fechar corrida de estoque negativo (`UPDATE ... WHERE
  stockQuantity >= quantidade` em vez de `decrement` cego).
- **D1** — Log de auditoria (tabela nova + wiring nas actions existentes).
- **D2** — Tela de admin pra gerenciar usuários (promover/desativar).
- **D3** — Busca e paginação nas listas do admin (produtos/pedidos/estoque).
- **D4** — Edição em massa (seleção múltipla + ação em lote).
- **D5** — Relatório de carrinho abandonado (`CartStatus.ABANDONED` já
  existe no schema, ninguém usa).
- **D6** — Série temporal no dashboard (gráfico client-side).
- **E1** — Busca de verdade no catálogo — hoje "Pesquisa" no header é um
  `<span>` morto, não um link nem campo.
- **E2** — Paginação e ordenação no catálogo.
- **E5** — Contraste/acessibilidade (auditoria + correções de código).
- **E6** — Fallback pra dispositivo fraco (detectar e permitir desligar 3D).
- **F1** — Testes (Vitest) pro `src/lib/fit-calculator.ts` e
  `src/lib/avatar-builder.ts` — lógica pura, sem banco, os testes mais fáceis
  e mais valiosos do projeto.
- **F7** — 2 erros de lint pré-existentes + um `console.log` de debug
  esquecido em `src/lib/products.ts`.

### 🟡 Parcial — preparo o código, mas trava numa parte externa

| Item | Eu faço | Trava em |
|---|---|---|
| C2 — LGPD | Política de privacidade, página `/privacidade`, registro de consentimento com data/versão | Revisão jurídica do texto final |
| C3/C5/E4 — Recuperação de senha, verificação de e-mail, e-mail transacional | Fluxo inteiro (token, páginas, gatilhos) | Envio real precisa de conta num provedor (Resend/SendGrid) — sem isso, fica em modo "link aparece só no console" |
| B2 — Modelos `.glb` versionados no Git | Paro de versionar novos | Limpar histórico é reescrita destrutiva — só com autorização explícita |
| F3 — Backup / ambiente separado | `pg_dump` + script de backup | Segundo projeto Supabase precisa o usuário criar a conta |
| F5 — `main` desatualizado | Deixo o merge pronto localmente | `git push` precisa do login do usuário |

### ❌ Preciso do usuário

- **A2–A7** — tudo que exige modelar ativos 3D novos no MakeHuman/Blender
  (shape keys nos dois sentidos, medidas de circunferência reais, drapeado
  de roupa, rig/pose, tom de pele, avatar por foto).
- **E3** — fotos reais de produto (fotografia, não dá pra gerar).
- **F2** — CI (escrevo o workflow, só roda depois do push).
- **F4** — Supabase pausar sozinho (decisão de billing/rotina).
- **F6** — Sentry (precisa criar conta e passar a chave/DSN).

---

## Próximos passos sugeridos

1. **Onda 1 (crítico, solo)**: A1 (avatar no provador) → B1 (reprocessar
   modelos gigantes) → C1 (assinar webhook). Branch já criado:
   `feat/solo-fixes-wave1`, sincronizado com `main`/`Felipe` — **nenhum
   código dessa onda foi escrito ainda**, a sessão foi interrompida antes de
   começar A1.
2. Depois: continuar a lista ✅ Solo por categoria ou por severidade — a
   decidir com o usuário.
3. **Sprint 3 feita** na branch `feat/sprint3` (11–14 e 23; o 3D-04 ficou de
   fora) — ver a seção da Sprint 3 acima.
4. ~~Dar `git push origin main Felipe`~~ — feito: em 27/09/2026 as duas
   estavam no GitHub, iguais às locais. Falta enviar `feat/sprint3` (precisa
   do usuário logado).

## Referências rápidas

- Projeto Supabase: `gmegjohpfsmskfstlscf`
- Usuários de teste: ver tabela da Sprint 1 acima
- Cronograma completo: `Vestra_Room_Cronograma_Fase2.docx` (Downloads do
  usuário) — não está no repo
- **Cuidado ao trocar de branch com trabalho não commitado**: git compartilha
  a working directory entre branches. Um arquivo committed só num branch
  (ex.: `avatar_base.glb` antes desta consolidação) **some do disco** ao
  trocar pra outro branch que não o tem — sem aviso, sem erro. Pra recuperar
  sem fazer checkout: `git show <branch>:<caminho> > <caminho>`.
