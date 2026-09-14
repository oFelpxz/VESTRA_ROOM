# Checklist de Funcionalidades

Lista enxuta de todas as funcionalidades, na ordem ideal de teste.
Marca cada item ao confirmar que está funcionando.

---

## 🔐 1. Autenticação

- [ ] Cadastrar nova conta em `/cadastro`
- [ ] Login em `/login` com conta criada
- [ ] Login com senha errada mostra erro
- [ ] Logout pelo header
- [ ] Logout pelo painel admin (quando logado como admin)

---

## 👤 2. Perfil do usuário

- [ ] Acessar `/perfil` logado mostra os dados
- [ ] Cards de Endereços e Pedidos mostram contagem real
- [ ] Acessar `/perfil` deslogado → redirect `/login`

### 2.1 Medidas corporais
- [ ] Acessar `/perfil/medidas`
- [ ] Preencher todas as 8 medidas (altura, peso, peito, cintura, quadril, ombros, braço, perna)
- [ ] Escolher preferência de caimento (Slim/Regular/Oversized)
- [ ] Marcar o aceite de termos
- [ ] Salvar e ver confirmação
- [ ] Voltar na página e ver os valores persistidos
- [ ] Editar e salvar de novo

---

## 🛍 3. Catálogo

- [ ] Acessar `/catalogo` mostra produtos ACTIVE
- [ ] Filtrar por **categoria**
- [ ] Filtrar por **tamanho**
- [ ] Filtrar por **cor**
- [ ] Filtrar por **faixa de preço**
- [ ] Combinar 2 filtros funciona
- [ ] Limpar filtros volta lista completa
- [ ] Produto DRAFT/INACTIVE não aparece

---

## 📦 4. Página de produto

- [ ] Abrir um produto pelo catálogo
- [ ] Viewer 3D carrega (em produto com modelo validado)
- [ ] Produto sem 3D mostra placeholder/imagem
- [ ] Tabela de medidas exibe todas as 5 colunas (Tórax, Cintura, Quadril, Braço, Perna)
- [ ] Selecionar **cor**
- [ ] Selecionar **tamanho**
- [ ] Cor sem variante em estoque aparece riscada
- [ ] "Adicionar à sacola" (logado) funciona
- [ ] "Adicionar à sacola" (deslogado) → "Entrar para comprar"
- [ ] Botão "● Experimentar no VESTRA FIT" aparece **só** em produto com 3D validado

---

## 🤖 5. VESTRA FIT — Avatar

### 5.1 Página `/teste-3d`
- [ ] Deslogado: avatar de referência genérico + CTA "Entrar"
- [ ] Logado sem medidas: avatar de referência + CTA "Cadastrar medidas"
- [ ] Logado sem termos aceitos: gate de termos
- [ ] Logado completo: avatar com **suas medidas**
- [ ] Painel lateral mostra cada medida usada
- [ ] Arrastar gira o avatar
- [ ] Scroll faz zoom

### 5.2 Teste paramétrico (prova que o avatar reage)
- [ ] Editar medidas para extremo baixo (155cm / 50kg) → avatar fica baixo e magro
- [ ] Editar medidas para extremo alto (190cm / 100kg) → avatar fica alto e largo
- [ ] Editar só o peito (ex: 110cm) → torso fica mais largo
- [ ] Editar só o quadril → base fica mais larga
- [ ] Editar só ombros → braços se afastam

---

## 👗 6. Provador virtual (no produto)

- [ ] Em produto com 3D validado, clicar "Experimentar no VESTRA FIT"
- [ ] Cena abre em tela cheia: avatar + roupa
- [ ] Painel lateral lista cor / tamanho / preferência
- [ ] Indicador de caimento aparece

### 6.1 Caimento reage
- [ ] Trocar tamanho (P → M → G) → indicador muda (Justo / Ideal / Folgado)
- [ ] Lista de detalhes mostra cm por eixo (peito, cintura, quadril, braço, perna)
- [ ] Trocar preferência Slim → caimento fica mais justo
- [ ] Trocar preferência Oversized → caimento fica mais folgado

### 6.2 Cor reage
- [ ] Trocar cor da roupa muda o tecido na cena

### 6.3 Add ao carrinho
- [ ] Clicar "Adicionar à sacola" funciona
- [ ] Confirmação aparece com link "Ver sacola"
- [ ] Variante correta (cor+tamanho escolhidos) vai pro carrinho

### 6.4 Guards
- [ ] Deslogado → redirect `/login?next=...`
- [ ] Sem medidas → gate "Cadastre suas medidas"
- [ ] Sem termos → mesmo gate
- [ ] Produto sem 3D → gate "Provador indisponível"

---

## 🛒 7. Carrinho

- [ ] Item adicionado aparece em `/carrinho`
- [ ] Aumentar quantidade atualiza subtotal
- [ ] Diminuir abaixo de 1 remove item
- [ ] Esvaziar carrinho mostra estado vazio
- [ ] Botão "Ir para checkout" leva pra `/checkout`

---

## 💳 8. Checkout

### 8.1 Step 1 — Endereço
- [ ] Acessar `/checkout` sem login → redirect `/login?next=/checkout`
- [ ] Carrinho vazio → redirect `/carrinho`
- [ ] Sem endereços: form aparece
- [ ] Cadastrar endereço com CEP capital (01310-100) salva
- [ ] CEP com menos de 8 dígitos → erro
- [ ] UF com 3 letras → erro
- [ ] Endereço aparece na lista
- [ ] Selecionar endereço avança pro step 2

### 8.2 Step 2 — Revisão
- [ ] Mostra dados do endereço escolhido
- [ ] Calcula frete (CEP capital: prazo 4 dias)
- [ ] Frete grátis acima de R$ 300
- [ ] Botão "Trocar" volta pro step 1
- [ ] "Ir para pagamento" avança pro step 3

### 8.3 Step 3 — Pagamento
- [ ] 4 métodos visíveis (PIX, Crédito, Débito, Boleto)
- [ ] PIX mostra QR simulado
- [ ] Cartão mostra form (campos vazios, é só visual)
- [ ] Boleto mostra código simulado
- [ ] Estoque insuficiente → erro detalhado por item
- [ ] "Finalizar pedido" redireciona pra sucesso

### 8.4 Sucesso + Polling
- [ ] Tela de sucesso mostra resumo do pedido
- [ ] Chip "Aguardando confirmação..." pulsando
- [ ] Em ~3 segundos vira "Pagamento confirmado" (verde ácido) **sem F5**
- [ ] Botões "Ver meus pedidos" e "Continuar comprando" funcionam

---

## 📦 9. Acompanhamento de pedido (cliente)

- [ ] `/perfil/pedidos` mostra lista ordenada por data desc
- [ ] Status com cores corretas (cinza/ácido/dark/destrutivo)
- [ ] Filtros (Aguardando/Pago/Preparando/Enviado/Entregue/Cancelado) funcionam
- [ ] Abrir detalhe `/perfil/pedidos/[id]`
- [ ] Timeline mostra steps com ✓ até o status atual
- [ ] Mostra itens, endereço, pagamento (com paidAt)
- [ ] Botão "Cancelar pedido" aparece em PENDING_PAYMENT/PAID
- [ ] Cancelar devolve estoque + marca Payment como REFUNDED/FAILED
- [ ] Pedido de outro user (URL manipulada) → 404
- [ ] Refresh automático puxa novos status (testar trocando status no admin em outra aba)

---

## 🎛 10. Admin — Painel

- [ ] Login como `admin@vestra.room` → redirect `/admin`
- [ ] Dashboard mostra métricas: Pedidos hoje, A despachar, Estoque baixo, Faturamento mês
- [ ] Cards inferiores: Produtos, Categorias, Usuários, 3D pendentes
- [ ] Atalhos para Pedidos, Estoque, Produtos, Modelos 3D, Categorias, Medidas

---

## 📋 11. Admin — Categorias

- [ ] Criar categoria nova em `/admin/categorias`
- [ ] Nome duplicado → erro
- [ ] Categoria com produtos não permite remover
- [ ] Categoria sem produtos pode ser removida

---

## 👕 12. Admin — Produtos

### 12.1 Listagem
- [ ] `/admin/produtos` lista todos os produtos
- [ ] Filtros por status (Todos/Rascunho/Ativo/Inativo) funcionam
- [ ] Filtros por categoria funcionam
- [ ] Tag "3D" aparece em produtos com modelo

### 12.2 Criação
- [ ] `/admin/produtos/novo` abre form
- [ ] Sem categoria cadastrada → aviso pedindo criar primeiro
- [ ] Criar com dados válidos cria em DRAFT e redireciona pra edição

### 12.3 Edição
- [ ] Editar dados básicos salva
- [ ] Adicionar variante com SKU único OK
- [ ] SKU duplicado → erro
- [ ] Editar estoque inline salva
- [ ] Inativar/ativar variante alterna
- [ ] Adicionar imagem com URL válida OK
- [ ] URL inválida (ex: "abc") → erro
- [ ] Remover imagem funciona

### 12.4 Publicação
- [ ] Botão "Publicar" desabilitado sem variante OU sem imagem (tooltip explica)
- [ ] Publicar com ambos → status ACTIVE
- [ ] Produto ACTIVE aparece em `/catalogo`
- [ ] Despublicar funciona

### 12.5 Exclusão
- [ ] Excluir produto sem pedidos → apaga de fato
- [ ] Excluir produto com pedidos → vira INACTIVE (soft-delete)

---

## 🎨 13. Admin — Modelos 3D

### 13.1 Listagem
- [ ] `/admin/modelos-3d` mostra tabs por status (PENDING/VALIDATED/REJECTED/OPTIMIZED) com contadores
- [ ] Bloco "Produtos sem modelo 3D" lista candidatos

### 13.2 Upload
- [ ] Acessar `/admin/modelos-3d/[productId]`
- [ ] Drag & drop de `.glb` válido funciona
- [ ] Barra de progresso aparece
- [ ] Arquivo salvo em `public/models/{slug}-v1.glb`
- [ ] Upload `.png` → erro "apenas .glb ou .gltf"
- [ ] Upload > 25 MB → erro de tamanho

### 13.3 Validação
- [ ] Viewer carrega o modelo
- [ ] Botões Claro/Escuro trocam fundo
- [ ] Reset reposiciona câmera
- [ ] Métricas mostram tamanho, triângulos, materiais
- [ ] Aprovar → `Product.has3DModel = true`, status VALIDATED
- [ ] Rejeitar → status REJECTED
- [ ] Excluir modelo apaga arquivo do disco

### 13.4 Versionamento
- [ ] Reupload cria v2 com PENDING e zera `has3DModel`
- [ ] Aprovar v2 reativa `has3DModel`

### 13.5 Acesso por role
- [ ] MODEL_3D consegue acessar `/admin/modelos-3d`
- [ ] MODEL_3D vê menu filtrado (Painel + Modelos 3D)

---

## 📥 14. Admin — Pedidos / Logística

### 14.1 Listagem
- [ ] `/admin/pedidos` mostra lista (default: PAID/PREPARING/SHIPPED)
- [ ] Filtro "Todos" mostra todos os status
- [ ] Filtros individuais por status funcionam
- [ ] Busca por nome do cliente funciona
- [ ] Busca por email do cliente funciona

### 14.2 Detalhe + ações de status
- [ ] Abrir detalhe de pedido
- [ ] Timeline coerente com status
- [ ] PAID → botão "Iniciar preparação" funciona (vira PREPARING)
- [ ] PREPARING → "Marcar como enviado" sem tracking → erro
- [ ] PREPARING → "Marcar como enviado" com tracking → vira SHIPPED
- [ ] SHIPPED → "Marcar como entregue" → vira DELIVERED
- [ ] DELIVERED → sem ações disponíveis
- [ ] Cancelar pedido devolve estoque
- [ ] Mudança reflete no `/perfil/pedidos/[id]` do cliente em ≤10s

### 14.3 Acesso por role
- [ ] STOCK_OPERATOR consegue logar e acessar `/admin/pedidos`
- [ ] STOCK_OPERATOR vê menu filtrado (Painel + Pedidos + Estoque)

---

## 📊 15. Admin — Estoque

- [ ] `/admin/estoque` lista variantes ordenadas por estoque crescente
- [ ] Variantes com < 5 marcam tag "Baixo"
- [ ] Filtro "Estoque baixo" mostra só as < 5
- [ ] Filtro por categoria funciona
- [ ] Filtro por produto funciona
- [ ] Editar inline com motivo salva
- [ ] Mudança reflete no `/catalogo` (estoque na variante)
- [ ] Pedido finalizado decrementa estoque
- [ ] Pedido cancelado devolve estoque

---

## 📐 16. Admin — Tabela de medidas

- [ ] `/admin/medidas` lista tabelas existentes
- [ ] Selecionar produto + preencher tabela com Tórax/Cintura/Quadril/Braço/Perna
- [ ] Salvar substitui a tabela existente
- [ ] Tabela aparece na página do produto público
- [ ] Provador usa esses valores no cálculo de caimento

---

## 🔒 17. Controle de acesso (testes finais)

- [ ] CUSTOMER acessa `/admin` → redirect `/login`
- [ ] CUSTOMER acessa `/admin/produtos` → redirect
- [ ] CUSTOMER acessa `/admin/pedidos` → redirect
- [ ] MODEL_3D acessa `/admin/categorias` (action) → bloqueada
- [ ] STOCK_OPERATOR acessa `/admin/produtos` → vê layout mas actions bloqueadas
- [ ] Não logado acessa `/checkout` → redirect com next
- [ ] Não logado acessa `/perfil/pedidos` → redirect

---

## 🔄 18. Fluxos end-to-end (cenários completos)

### 18.1 Caminho feliz total
- [ ] Cadastro → medidas → catálogo → provador → carrinho → checkout → sucesso → cliente vê em /perfil/pedidos

### 18.2 Ciclo admin completo
- [ ] Admin cadastra produto → upload 3D → valida → publica → produto aparece no catálogo

### 18.3 Ciclo logística completo
- [ ] Cliente compra → admin avança PAID → PREPARING → SHIPPED → DELIVERED → cliente acompanha em tempo real

### 18.4 Cancelamento
- [ ] Cliente compra → cancela pelo próprio perfil → estoque é devolvido

### 18.5 Cancelamento via admin
- [ ] Cliente compra → admin cancela → cliente vê CANCELED com Payment REFUNDED
