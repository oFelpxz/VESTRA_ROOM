# Roadmap de Testes — Apresentação ao Vivo

Roteiro completo para validar todo o MVP antes/durante a apresentação.
Está organizado em ordem cronológica de execução: **Pré-voo → Smoke Test → Demo ao Vivo → Plano B**.

Imprimir esse arquivo para ter em mãos durante a demo.

---

## 0. Pré-voo (executar ~30 min antes da apresentação)

Checklist técnico antes de abrir pro público.

### 0.1 Infraestrutura
- [ ] Supabase **restaurado** e respondendo (acessar dashboard ou `npx prisma db pull`)
- [ ] `.env` correto: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`
- [ ] `npx prisma migrate deploy` rodado sem erro
- [ ] `npm run db:seed` rodado — confere usuários criados:
  - Admin: `admin@vestra.room` / `vestra123`
  - Cliente: `cliente@vestra.room` / `cliente123`
- [ ] `npm run build` passa sem erro
- [ ] `npm run start` rodando em `http://localhost:3000` (modo produção, mais performático)

### 0.2 Browser / ambiente
- [ ] **Chrome desktop** (não Firefox/Safari — Three.js performa melhor no Chrome)
- [ ] Resolução de tela ≥ 1920×1080
- [ ] DevTools console **fechado** (mas pronto pra abrir se precisar)
- [ ] Cache do browser limpo (`Ctrl+Shift+Del`)
- [ ] Bookmarks rápidos:
  - `http://localhost:3000/`
  - `http://localhost:3000/login`
  - `http://localhost:3000/admin`
- [ ] **Dois browsers ou abas separadas** — uma logada como cliente, outra como admin (assim alterna entre as duas durante a demo sem precisar deslogar)

### 0.3 Arquivos físicos
- [ ] `public/models/hoodie_black.glb` existe e abre direto no browser
- [ ] Modelos 3D adicionais (se aplicável) também acessíveis

### 0.4 Backup / fallback
- [ ] Vídeo de fallback gravado (rodar o roteiro abaixo uma vez gravando a tela)
- [ ] Screenshots de cada tela crítica
- [ ] Snapshot do banco antes da demo (`pg_dump` ou backup Supabase)

---

## 1. Smoke Test (executar ~10 min antes — confirma que nada quebrou)

Roteiro **rápido** validando o caminho feliz inteiro. Se algum passo falhar, **NÃO INICIAR A DEMO** — debugar primeiro.

| # | Ação | Resultado esperado | OK? |
|---|---|---|---|
| 1 | Abrir `/` | Home carrega em < 2s | ☐ |
| 2 | Clicar "Catálogo" | Lista de produtos aparece | ☐ |
| 3 | Abrir um produto com 3D | Viewer 3D carrega o GLB sem erro | ☐ |
| 4 | Login com `cliente@vestra.room` | Redirect para home, header mostra nome | ☐ |
| 5 | Abrir `/teste-3d` | Avatar carrega com as medidas do cliente | ☐ |
| 6 | Abrir Hoodie Core → "Experimentar no VESTRA FIT" | Provador abre em < 3s, avatar + roupa visíveis | ☐ |
| 7 | Adicionar ao carrinho do provador | Confirmação "Adicionado à sacola" | ☐ |
| 8 | `/checkout` → finalizar com PIX | Redirect para tela de sucesso, polling muda pra PAID em ~3s | ☐ |
| 9 | `/perfil/pedidos` | Pedido aparece com status PAID | ☐ |
| 10 | Login admin em outra aba → `/admin/pedidos` | Pedido aparece, clica → "Iniciar preparação" funciona | ☐ |
| 11 | Voltar na aba do cliente, esperar 10s | Status muda visualmente sem F5 | ☐ |

Se 1 a 11 ✅ → **PRONTO PARA A DEMO**.

---

## 2. Demo ao vivo (roteiro encenado)

Sequência completa em 4 cenas, ~8-10 minutos.

### 🎬 Cena 1 — Visitante (Anônimo)
**Personagem**: pessoa qualquer chegando na loja pela primeira vez.

| Ação | O que verbalizar | O que mostrar |
|---|---|---|
| Abrir `/` | "Aqui é o storefront da VESTRA ROOM, uma loja onde cada peça pode ser provada virtualmente em 3D." | Hero + seção VESTRA FIT |
| Rolar até a seção VESTRA FIT | "Essa é a proposta da marca — o provador virtual." | Cards explicativos |
| Clicar "Experimentar em 3D" → `/teste-3d` | "Sem login, vemos um avatar de referência genérico." | Avatar padrão (170cm/70kg) |
| Apontar painel lateral | "Pra ver com o **meu** corpo, precisa logar e cadastrar medidas." | CTA "Entrar" |

### 🎬 Cena 2 — Cliente (Cadastro + Try-on)
**Personagem**: cliente novo, vai criar conta e provar.

| Ação | O que mostrar |
|---|---|
| Clicar "Entrar" → "Criar conta" → cadastrar `demo@vestra.room` | Cadastro funciona |
| Ir em `/perfil/medidas` | Form completo: altura, peso, peito, cintura, quadril, ombros, braço, perna |
| Preencher com valores extremos para impressionar (ex: 188cm, 90kg, peito 110, etc.) + marcar termos | Salvo |
| Voltar em `/teste-3d` | **Avatar mudou visivelmente** — alto e largo |
| Editar medidas para 158cm, 50kg + voltar | **Avatar agora baixo e magro** — prova que o paramétrico funciona |
| Ir no catálogo → Hoodie Core | Página do produto com viewer 3D estático da peça |
| Clicar "● Experimentar no VESTRA FIT" | Provador abre em tela cheia: avatar + hoodie sobreposto |
| Trocar tamanho (P → M → G) | Indicador de caimento muda em tempo real (Justo/Ideal/Folgado) |
| Trocar cor | Tecido muda de cor na cena |
| Trocar preferência (Slim/Regular/Oversized) | Caimento se ajusta — explicar que é **gosto pessoal** |
| Apontar detalhes do caimento | Diferenças em cm por eixo: peito/cintura/quadril/braço/perna |
| Clicar "Adicionar à sacola" | Confirmação |

### 🎬 Cena 3 — Checkout (Compra simulada)
**Continuação do cliente**.

| Ação | O que mostrar |
|---|---|
| Abrir `/carrinho` → "Ir para checkout" | Stepper de 3 etapas com `|01| Endereço` ativo |
| Cadastrar endereço novo (CEP `01310-100`, capital) | Salvo, avança pro passo `|02| Revisão` |
| Mostrar valores | Subtotal, frete calculado, total |
| Avançar pro `|03| Pagamento` | 4 métodos (PIX, Cartão, Débito, Boleto) |
| Escolher PIX → mostrar QR code simulado | Visual de QR |
| Clicar "Finalizar pedido" | Redirect pra `/checkout/sucesso/[id]` |
| **Esperar ~3 segundos sem F5** | Chip "Aguardando confirmação..." muda pra **"Pagamento confirmado"** (verde ácido) |
| Apontar | "Isso é o webhook simulado de pagamento — em prod seria Mercado Pago." |
| Clicar "Ver meus pedidos" | Lista do `/perfil/pedidos` |
| Abrir o detalhe | Timeline mostra `01 ✓ Aguardando` `02 ✓ Pago` (acid) `03 Em preparação` |

### 🎬 Cena 4 — Admin/Operador (Gestão)
**Alternar para a aba do admin** (`admin@vestra.room`).

| Ação | O que mostrar |
|---|---|
| Abrir `/admin` | Dashboard com **"Pedidos hoje: 1"** subiu | 
| Apontar "A despachar: 1" | Métricas operacionais |
| Clicar em `/admin/pedidos` | Lista — pedido novo no topo com status PAID |
| Abrir o pedido | Detalhe completo: cliente, itens, endereço, valores |
| Clicar **"● Iniciar preparação"** | Status PAID → PREPARING |
| Preencher código de rastreio (ex: `BR123456789`) → "Marcar como enviado" | Status PREPARING → SHIPPED com tracking |
| Voltar pra aba do cliente (`/perfil/pedidos/[id]`) | Em até 10s, status muda pra SHIPPED com tracking visível **sem F5** |
| Apontar | "Polling automático — cliente vê o status sem precisar atualizar." |
| Voltar no admin → `/admin/estoque` | Lista de variantes |
| Ajustar estoque de uma variante para 0 com motivo | Lista marca "Baixo" |
| Voltar em `/admin` | Card "Estoque baixo" aparece em vermelho |

### 🎬 Cena 5 — Encerramento
| Ação |
|---|
| Voltar pra home, abrir `/teste-3d` |
| "Pra fechar: tudo isso roda no nosso stack — Next 16, React 19, Prisma, Three.js. Pagamento é simulado, mas a arquitetura já está pronta pra integrar Mercado Pago. O avatar atual é paramétrico simples; evolução é trocar pra SMPL ou MakeHuman quando for produção." |

---

## 3. Testes funcionais completos (referência exaustiva)

Caso queiram testar **cada funcionalidade** isoladamente fora do roteiro encenado.

### 3.1 Auth & Perfil
| Caso | Resultado esperado |
|---|---|
| Cadastro com email novo | Conta criada, login automático |
| Cadastro com email existente | Erro "Email já cadastrado" |
| Login senha errada | Erro |
| Logout via header/admin | Redirect home |
| Cliente acessa `/admin` | Redirect `/login` |
| Cliente acessa `/admin/produtos` direto | Redirect `/login` |

### 3.2 Catálogo
| Caso | Resultado esperado |
|---|---|
| Filtrar por categoria | Lista filtra |
| Filtrar por tamanho | Lista filtra |
| Filtrar por cor | Lista filtra |
| Filtrar por faixa de preço | Lista filtra |
| Combinar filtros | Funciona |
| Produto INACTIVE | Não aparece no catálogo |
| Produto DRAFT | Não aparece no catálogo |

### 3.3 Página de produto + 3D estático
| Caso | Resultado esperado |
|---|---|
| Produto com 3D validado | Viewer carrega GLB |
| Produto sem 3D | Mostra placeholder ou imagem |
| Tabela de medidas com arm/leg preenchidos | Mostra colunas Braço + Perna |
| Botão "Experimentar no VESTRA FIT" | Só aparece se `has3DModel && availableForVirtualTryOn` |
| Selecionar cor → tamanho → "Adicionar à sacola" | Funciona logado |
| Cor sem variante em estoque | Riscada/desabilitada |

### 3.4 Provador virtual (VESTRA FIT)
| Caso | Resultado esperado |
|---|---|
| Acesso deslogado | Redirect `/login?next=/produto/.../provador` |
| Sem MeasurementProfile | Gate "Cadastre suas medidas" |
| Sem termos aceitos | Mesmo gate |
| Produto sem 3D validado | Gate "Provador indisponível" |
| Avatar com altura 155, peso 50 | Visivelmente baixo e magro |
| Avatar com altura 195, peso 100 | Visivelmente alto e largo |
| Trocar tamanho | Indicador de caimento atualiza < 500ms |
| Trocar cor | Tecido muda de cor |
| Trocar preferência | Caimento recalcula |
| Caimento mostra cm por eixo | Peito + cintura + quadril + braço + perna |
| Add ao carrinho | Variante correta (cor+tamanho) entra na sacola |
| Sair sem comprar | Estado não persiste (preferência não salva no perfil) |

### 3.5 Carrinho
| Caso | Resultado esperado |
|---|---|
| Aumentar quantidade | Subtotal atualiza |
| Reduzir abaixo de 1 | Item removido |
| Variante esgotada | Erro de estoque ao tentar aumentar |
| Esvaziar carrinho | Lista vazia + CTA voltar pro catálogo |
| Botão "Ir para checkout" | Vai pra `/checkout` |

### 3.6 Checkout
| Caso | Resultado esperado |
|---|---|
| Não logado | Redirect `/login?next=/checkout` |
| Carrinho vazio | Redirect `/carrinho` |
| Pular passos via URL (`?step=payment`) sem addressId | Volta pro step 1 |
| Endereço com UF inválida (3 letras) | Erro de validação |
| CEP com letras | Erro |
| Frete grátis acima de R$ 300 | Mostra "Grátis" |
| CEP de capital (01..., 02..., 20..., etc.) | Prazo 4 dias |
| CEP fora | Prazo 8 dias |
| Finalizar com PIX | Pedido criado PENDING_PAYMENT, Payment PENDING |
| Esperar ~3s | Vira PAID via webhook |
| Estoque insuficiente | Erro detalhado por item, pedido NÃO criado |

### 3.7 Acompanhamento de pedido (cliente)
| Caso | Resultado esperado |
|---|---|
| `/perfil/pedidos` deslogado | Redirect `/login` |
| Lista vazia | "Você ainda não fez nenhum pedido" + CTA catálogo |
| Filtros (PAID/SHIPPED/etc.) | Lista filtra |
| Detalhe de pedido alheio (URL manipulada) | 404 |
| Timeline coerente com status | Steps marcados ✓ |
| Status muda no admin | Cliente vê em ≤10s via polling |
| Cancelar pedido em PAID | Devolve estoque, marca Payment como REFUNDED |
| Cancelar em SHIPPED | Botão não aparece |

### 3.8 Admin — Produtos
| Caso | Resultado esperado |
|---|---|
| `/admin/produtos/novo` sem categoria | Mostra aviso "Crie uma categoria primeiro" |
| Criar produto válido | Redirect pra `/admin/produtos/[id]`, status DRAFT |
| Adicionar variante com SKU duplicado | Erro |
| Adicionar imagem com URL `abc` | Erro de URL |
| Publicar sem variante | Botão desabilitado (tooltip explica) |
| Publicar sem imagem | Botão desabilitado |
| Publicar OK | Status vira ACTIVE, produto aparece em `/catalogo` |
| Despublicar | Status vira INACTIVE, some do catálogo |
| Excluir produto com pedidos | Vira INACTIVE (soft-delete) |
| Excluir produto sem pedidos | Apaga de fato |

### 3.9 Admin — Modelos 3D
| Caso | Resultado esperado |
|---|---|
| Upload `.glb` < 25MB | OK, arquivo em `/public/models/{slug}-v1.glb` |
| Upload `.png` | Erro "apenas .glb ou .gltf" |
| Upload > 25MB | Erro de tamanho |
| Viewer carrega o modelo + métricas | Triângulos + materiais |
| Aprovar | `has3DModel = true`, status VALIDATED |
| Reupload | Cria v2 com status PENDING, zera `has3DModel` |
| Rejeitar | Status REJECTED |
| Excluir modelo | Apaga arquivo do disco |
| MODEL_3D acessa `/admin/modelos-3d` | OK (menu filtrado, sem produtos/pedidos) |
| MODEL_3D tenta `/admin/produtos` | Layout permite, mas actions bloqueiam (pode acessar a lista) |

### 3.10 Admin — Pedidos / Logística
| Caso | Resultado esperado |
|---|---|
| STOCK_OPERATOR acessa `/admin` | Menu filtrado: Painel + Pedidos + Estoque |
| Lista default | Mostra PAID/PREPARING/SHIPPED |
| Filtro "Todos" | Mostra tudo incluindo cancelados |
| Busca por nome/email | Filtra |
| PAID → "Iniciar preparação" | Vira PREPARING |
| PREPARING → "Marcar como enviado" sem tracking | Erro |
| PREPARING → "Marcar como enviado" com tracking | Vira SHIPPED |
| SHIPPED → "Marcar como entregue" | Vira DELIVERED |
| DELIVERED → nenhuma ação | Mensagem "estado final" |
| Cancelar em PREPARING | Devolve estoque |
| Cliente vê mudança em /perfil/pedidos | Em ≤10s |

### 3.11 Admin — Estoque
| Caso | Resultado esperado |
|---|---|
| Lista padrão | Variantes ordenadas por estoque crescente |
| Filtro "Estoque baixo" | Apenas variantes < 5 unidades |
| Editar inline | Salva, lista atualiza |
| Motivo selecionado | Vai no log do server (ver console do `npm run start`) |
| Pedido finalizado | Estoque decrementa nas variantes envolvidas |
| Pedido cancelado | Estoque é devolvido |

### 3.12 Dashboard
| Caso | Resultado esperado |
|---|---|
| "Pedidos hoje" | Conta criados depois de 00:00 |
| "A despachar" | Conta PAID + PREPARING |
| "Estoque baixo" | Linka pra `/admin/estoque?baixo=1` |
| "Faturamento mês" | Soma dos pedidos PAID+ do mês corrente |
| "3D pendentes" | Linka pra `/admin/modelos-3d?status=pending` |

---

## 4. Cenários de erro a evitar / preparar resposta

| Erro | Como reagir |
|---|---|
| **3D não carrega** (cube vazio cinza) | Abrir DevTools → Network — checar se `.glb` retorna 200. Se 404, é caminho errado. Se 500, problema de serving. |
| **Avatar muito pequeno/gigante** | Medidas zeradas ou negativas. Voltar em `/perfil/medidas` e refazer. |
| **Pagamento não vira PAID em 3s** | Pode ser que o webhook não saiu. Olhar logs do servidor. Recurso: abrir `/api/payments/simulate?orderId=...` direto na aba e ver o JSON. |
| **Mudança no admin não reflete no cliente** | Polling é a cada 10s — pode esperar. Ou apertar F5 na aba do cliente como último recurso. |
| **Erro de conexão Postgres** | Banco pausou. Restaurar no Supabase. |
| **Produto não aparece no catálogo** | Status precisa ser ACTIVE. Conferir em `/admin/produtos`. |
| **Provador diz "indisponível"** | Produto precisa de `availableForVirtualTryOn=true` E modelo 3D VALIDATED. |
| **Estoque "Esgotado" no Hoodie Core** | Rodar `npm run db:seed` reseta pra 10 por variante. |

---

## 5. Plano B (se tudo der errado durante a demo)

1. **Vídeo de fallback** (gravado no pré-voo): tem o fluxo todo, basta projetar
2. **Screenshots de cada tela** (pasta `docs/screenshots/`)
3. **Slides explicativos** com arquitetura e stack
4. **Falar do código** abrindo o VSCode com o repositório — mostrar organização de pastas, `prisma/schema.prisma`, `docs/*.md`

---

## 6. Após a demo — debrief

Anotar feedback recebido em:
- [ ] Sugestões pós-MVP
- [ ] Bugs encontrados ao vivo
- [ ] Tempo gasto em cada cena (pra ajustar próxima demo)
- [ ] Perguntas mais frequentes do público
