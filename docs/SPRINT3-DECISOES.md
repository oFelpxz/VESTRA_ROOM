# Sprint 3 — decisões, achados e pendências

> Registro para apresentação ao professor. Sprint 3 do cronograma (09/09 a
> 23/09), **sem o item 3D-04** — a parte 3D ficou de fora por decisão do grupo.
> Branch: `feat/sprint3`, criada a partir da `main`.
>
> **Contexto de execução:** o Supabase (plano gratuito) estava pausado durante
> o desenvolvimento. Todo o código foi escrito e validado **sem banco**
> (typecheck, lint e testes da lógica isolada); a aplicação da migration e os
> testes no navegador ficaram para quando o banco for reativado. Esses testes
> foram feitos em 27/09/2026, no banco real — ver "Roteiro de testes →
> Resultados".

## Itens da sprint

| Item | Descrição | Situação |
|---|---|---|
| 14 | Frete no carrinho | ✅ Testado no banco real (passo 4) |
| 12 | Gerenciar cupons | ✅ Testado no banco real (passo 5) |
| 13 | Aplicar cupom no carrinho | ✅ Testado no banco real (passos 6 e 7) |
| 11 | Favoritos | ✅ Testado no banco real (passos 8 e 9) · falta só o caso "Esgotado" |
| 23 | Gestão de clientes | ✅ Testado no banco real (passo 10) |

Resultados detalhados em "Roteiro de testes → Resultados".

---

## Banco de dados (migration)

`prisma/migrations/20260927173052_sprint3_frete_cupons_favoritos_clientes`

**Decisão: migration só aditiva.** Cria tabelas e colunas novas; nenhum
`DROP`, `DELETE` ou `UPDATE`. Motivo: o banco é **compartilhado pelo grupo**, e
outras branches (`main`, `Felipe`) continuam rodando código antigo contra ele.
As colunas novas têm valor padrão, então código antigo que cria carrinho ou
pedido sem conhecê-las continua funcionando.

**Decisão: aplicar com `prisma migrate deploy`, nunca `migrate dev`.** O
`migrate dev`, ao detectar divergência entre banco e arquivos, oferece apagar o
banco para "resolver" — inaceitável num banco compartilhado. O `deploy` só
aplica migrations novas e nunca apaga dados.

**Decisão: SQL gerado offline.** Gerado com `prisma migrate diff` comparando o
schema da `main` com o novo, sem conectar no banco, e revisado antes de aplicar.
Um SQL de reversão também foi gerado. Única ressalva da reversão: se houver
cliente com status "Bloqueado", o Postgres não deixa remover esse status até
desbloqueá-lo.

| Mudança | Para |
|---|---|
| Tabela `Favorite` (único por usuário + produto) | Item 11 |
| Tabela `Coupon` + tipo `CouponType` (PERCENT / FIXED) | Item 12 |
| `Cart.couponId`, `Order.couponId` | Item 13 |
| Tipo `ShippingMethod` + `Cart.shippingMethod`, `Order.shippingMethod` (padrão ECONOMICO) | Item 14 |
| Status `BLOCKED` em `UserStatus` | Item 23 |

**Por que `BLOCKED` separado de `INACTIVE`:** o sistema já usava `INACTIVE` para
contas excluídas pelo próprio cliente (dados anonimizados). Reaproveitar o mesmo
status para bloqueio faria um cliente bloqueado e uma conta apagada ficarem
indistinguíveis.

---

## Item 14 — Frete no carrinho

**O cronograma pede "opções" de prazo e valor**, no plural. Havia só uma regra.
Criamos duas modalidades (valores simulados, como a regra anterior — a Sprint 4,
item 18, troca por integração real com Correios/Melhor Envio):

| Modalidade | Preço | Prazo |
|---|---|---|
| Econômico | Regra anterior, **inalterada**: grátis acima de R$ 300; senão R$ 15 + R$ 2 por item | 4 dias (capital) / 8 dias (demais) |
| Expresso | R$ 25 + R$ 3 por item, nunca grátis | 2 dias (capital) / 4 dias (demais) |

**Decisão: o cliente escolhe a modalidade e ela vale até o pedido** (em vez de
só exibir as opções sem permitir escolha, o que pareceria um bug).

**Decisão: a escolha fica gravada no carrinho, não na URL.** A primeira proposta
levava a escolha pela URL (`?frete=expresso`) de etapa em etapa. Ao ler o código
do checkout, vimos que a URL é montada em 7 lugares diferentes; esquecer um
deles faria a escolha se perder **em silêncio**, e o cliente que escolheu
Expresso seria cobrado como Econômico sem nenhum erro visível. Gravar no
carrinho dá um único lugar de verdade — o mesmo padrão usado para o cupom.

**Segurança:** o navegador envia só o **nome** da modalidade, nunca o preço. O
servidor recalcula o valor na criação do pedido.

**Fonte única de cálculo:** checkout e criação do pedido usam a mesma função
(`quoteShippingFor`), então não têm como divergir. Testado: o Econômico é
idêntico à regra antiga em todos os cenários.

**CEP no carrinho é estimativa.** Vem pré-preenchido com o endereço padrão do
cliente. No checkout o frete é recalculado com o CEP do endereço de entrega
escolhido — onde a entrega de fato acontece.

**O pedido grava a modalidade**, exibida no admin, no perfil do cliente e na
tela de sucesso — é o que permite ao Operador de Estoque saber que deve
despachar como expresso.

---

## Item 12 — Gerenciar cupons

Tela `/admin/cupons`, **só Administrador** (a permissão está na matriz única de
acesso, `admin-access.ts`, que controla menu e bloqueio de rota juntos).

**Regras do formulário:**

| Campo | Regra |
|---|---|
| Código | Obrigatório, maiúsculas, 3 a 20 letras ou números, único |
| Tipo | Percentual ou valor fixo |
| Valor | Percentual: > 0 e ≤ 100. Fixo: > R$ 0 |
| Pedido mínimo | Opcional |
| Validade | Opcional. Vale **até 23:59 do dia, horário de Brasília**. Não aceita data passada nem inexistente (ex.: 31/02) |
| Limite de usos | Opcional (vazio = ilimitado), inteiro ≥ 1 |

**Situação exibida:** Ativo, Desativado, Expirado ou Esgotado.

**Decisão: sem edição de cupom existente.** Alterar "10%" para "30%" num cupom
já usado mudaria o significado dele retroativamente. Para corrigir, desativa e
cria outro. O cronograma pede a criação.

**Decisão: remover só cupom nunca usado.** Cupom com uso só pode ser desativado,
preservando o histórico dos pedidos (mesmo padrão das Categorias, que não podem
ser removidas se tiverem produtos).

**Decisão: todas as ações conferem a permissão no servidor**, não só escondendo
o botão.

**Decisão: remover sem janela de confirmação.** Segue o padrão das outras
remoções do admin (categorias, produtos). O risco é baixo: só dá para remover
cupom nunca usado, e ele pode ser recriado com o mesmo código.

**Limitação conhecida:** se um cliente usar o cupom entre o momento em que o
admin abriu a tela e o clique em "Remover", o servidor recusa a remoção (a
condição "nunca usado" está na própria operação do banco), mas sem mensagem:
a tela só recarrega mostrando o cupom com 1 uso e o botão desabilitado.

---

## Item 13 — Aplicar cupom no carrinho

**Mensagens de erro** (o cronograma pede expirado e inválido):

| Situação | Mensagem |
|---|---|
| Não existe ou está desativado | "Cupom inválido." |
| Venceu | "Este cupom expirou." |
| Atingiu o limite | "Este cupom esgotou." |
| Abaixo do mínimo | "Faltam R$ X para usar este cupom (pedido mínimo R$ Y)." |

**Decisão: cupom desativado aparece como "inválido"**, para não revelar ao
cliente que aquele código já existiu.

**Cálculo do desconto:**
- Percentual sobre o valor **dos produtos**, arredondado em centavos.
- Fixo limitado ao valor dos produtos — o total nunca fica negativo.
- **O desconto não incide sobre o frete.**
- Total = produtos − desconto + frete.

**Decisão: o frete grátis (acima de R$ 300) considera o valor ANTES do
desconto.** Um carrinho de R$ 320 com cupom de 20% paga R$ 256 e mantém o frete
grátis. Mantido assim para não alterar a regra de frete já existente. Validado
com o grupo.

**Decisão: cupom que deixa de valer depois de aplicado** (itens removidos,
validade vencida, admin desativou):
- No carrinho, continua listado com o motivo e **o desconto some do total**.
- No checkout, aparece um aviso antes do pagamento.
- **Na criação do pedido, o pedido é bloqueado** com a explicação — em vez de
  cobrar sem o desconto que o cliente viu na tela.

**Decisão: limite de usos seguro com compras simultâneas.** Se um cupom tem 1
uso restante e dois clientes finalizam no mesmo instante, os dois leriam "1
restante". Por isso o uso é reservado **dentro da transação que cria o pedido**,
numa única operação condicional no banco ("incremente só se ainda houver uso,
estiver ativo e dentro da validade"). Se falhar, tudo é desfeito — pedido, baixa
de estoque e carrinho.

**Fonte única da regra** (`evaluateCoupon`) para carrinho, checkout e pedido.

**Correção feita junto:** as telas de detalhe do pedido calculavam o subtotal
como "total − frete". Com desconto isso fica errado; passou a ser
"total − frete + desconto", e as três telas mostram "Desconto · CÓDIGO".

---

## Item 11 — Favoritos

- Coração nos cards do catálogo e na página do produto ("Favoritar" /
  "Favoritado"). Visitante não logado que clica é levado ao login.
- Página `/favoritos` (lista de desejos), com link no header global (ícone de
  coração no desktop, item no menu do celular) e nos cabeçalhos próprios da home
  e do catálogo — só para quem está logado.

**Decisão: o atalho "adicionar ao carrinho" pede cor e tamanho.** O carrinho
guarda a **variação** (cor + tamanho), não o produto, então um botão único não
teria o que adicionar. Cada favorito tem um seletor com **apenas as combinações
em estoque** e o botão "Adicionar". Reaproveita a mesma ação de adicionar à
sacola da página de produto, então a validação de estoque é idêntica.

**Decisão: o coração fica fora do link do card.** O card inteiro do catálogo é
um link; um botão dentro de um link é HTML inválido e o clique no coração
abriria o produto. O card foi reorganizado com o coração posicionado sobre a
imagem, como elemento irmão do link.

**Decisão: o botão envia o estado desejado** ("favoritar" ou "desfavoritar"), e
não um "inverter". Dois cliques rápidos não se anulam, e clique duplo não gera
erro (o índice único do banco barra a duplicata e isso é tratado como sucesso).

**Decisão de segurança: consultas fora do arquivo de ações.** No Next.js, toda
função exportada de um arquivo `"use server"` vira um endereço que qualquer
pessoa pode chamar do navegador. As consultas de favoritos recebem o ID do
usuário como parâmetro, então ficam em um arquivo comum (`favorites.ts`); a
única ação pública (`setFavoriteAction`) usa sempre o usuário da sessão.

- Só é possível favoritar produto **ativo**. Um favorito cujo produto foi
  desativado depois continua na lista como "Indisponível no momento", e pode ser
  removido.
- O catálogo busca os favoritos do usuário em **uma única consulta** para a
  página inteira, não uma por card.
- Com promoção, a lista mostra o preço promocional e o cheio riscado, no mesmo
  padrão da página do produto — a lista de desejos é justamente onde o cliente
  quer saber que a peça baixou de preço.

**Decisão de acessibilidade: o coração é um botão de alternar com nome fixo.**
O leitor de tela anuncia "Favoritar Knit Beanie" e diz "pressionado" quando a
peça já está nos favoritos. O nome não muda com o estado (o estado vai só no
"pressionado"), como recomenda o guia de padrões do W3C, e leva o nome da peça,
porque o catálogo tem um coração por card. Na página do produto, onde o texto
"Favoritar"/"Favoritado" está visível, o nome é o próprio texto, para que
comandos de voz ("clicar em Favoritar") funcionem. A dica ao passar o mouse
continua dizendo a ação ("Adicionar aos favoritos"/"Remover dos favoritos").
Pelo mesmo motivo, o atalho de compra da lista se anuncia "Cor e tamanho de
Hoodie Core" e "Adicionar Hoodie Core à sacola", e a confirmação "Adicionado à
sacola" é lida automaticamente.

---

## Item 23 — Gestão de clientes

- `/admin/clientes`: lista com **busca por nome ou e-mail**, telefone, data de
  cadastro, número de pedidos, total gasto e situação (Ativo / Bloqueado).
- `/admin/clientes/[id]`: dados de contato, total gasto, histórico de compras
  (cada pedido com link para o detalhe já existente) e botão Bloquear /
  Desbloquear.
- **Só Administrador.** O cronograma determina que Operador de Estoque e
  Modelador 3D não acessam clientes; a permissão está na matriz única de acesso.

**Privacidade — regra do escopo: sem exposição das medidas corporais.** As
consultas usam seleção explícita de campos, então as medidas **nunca são
carregadas do banco** nessas telas — não é só deixar de exibi-las.

**Decisão: minimização de dados.** "Dados de contato" = e-mail e telefone. Os
endereços não aparecem na tela do cliente; o endereço de cada entrega continua
visível no detalhe do pedido, onde é necessário.

**Decisão: quem aparece.** Só contas de cliente. Contas **excluídas pelo próprio
cliente** (anonimizadas como "Usuário removido") ficam de fora. Staff não
aparece.

**Decisão: "total gasto"** soma o valor pago (com frete, já descontado o cupom)
dos pedidos efetivados — Pago, Preparando, Enviado e Entregue. Pedidos
aguardando pagamento, cancelados ou reembolsados não contam. É o mesmo critério
de "compra efetivada" usado nas avaliações (Sprint 2).

**Travas do bloqueio** (conferidas no servidor, numa única operação):
- só bloqueia **clientes** — nunca outro admin, e o admin não bloqueia a si mesmo;
- só alterna **Ativo ↔ Bloqueado** — uma conta excluída nunca é reativada por
  engano.

### Decisão: o que o bloqueio faz com quem já está logado

A sessão de login (JWT) fica guardada no navegador por até 30 dias, e o sistema
não consulta o banco a cada página. As duas opções consideradas:

| | Opção A — **escolhida** | Opção B — descartada |
|---|---|---|
| Login novo | Barrado na hora | Barrado na hora |
| Finalizar pedido | **Barrado na hora** (a criação do pedido confere o status no banco) | Barrado na hora |
| Sessão já aberta | Continua navegando até expirar | **Derrubada** em poucos minutos |
| Como | Uma checagem na criação do pedido | Reconferir o status no banco periodicamente dentro do sistema de login e deslogar o bloqueado |
| Custo / risco | Mínimo | Mexe no sistema de login de todo o site, a parte mais delicada do projeto |

**Por que A:** fecha o que importa — **o cliente bloqueado não compra** — com uma
mudança pequena e isolada. A Opção B fica registrada como evolução futura.

**Decisão: mensagem de login genérica para bloqueado.** Quem tenta entrar numa
conta bloqueada vê "E-mail ou senha inválidos", a mesma mensagem de senha
errada. Uma mensagem "conta bloqueada" confirmaria para qualquer pessoa que
aquele e-mail está cadastrado. Na tentativa de compra (já logado), a mensagem é
"Não é possível finalizar compras com esta conta. Entre em contato com a loja."

**Fora do escopo:** paginação da lista (poucos clientes; já listada como
melhoria futura) e confirmação antes de bloquear (a ação é reversível pelo
botão Desbloquear).

---

## Seed (dados de exemplo)

**Decisão: um seed separado, só da Sprint 3** (`npm run db:seed:sprint3`).
Ao analisar o seed completo, vimos que ele não apaga nada, mas **sobrescreve**:
o estoque de todas as variações volta para 10, nome/preço/status dos produtos
voltam ao original, e **os modelos 3D voltam ao arquivo original, desfazendo
uploads do Modelador**. Rodá-lo de novo no banco compartilhado destruiria o
trabalho do grupo. O seed da Sprint 3 só **cria** os cupons que ainda não
existem e não toca em mais nada — nem nos contadores de uso de testes
anteriores.

O seed completo também passou a criar os cupons, para quem montar um banco
novo do zero. Os dados ficam num arquivo só (`prisma/seed-data/coupons.ts`),
compartilhado pelos dois.

**Cupons de exemplo** — os "DEMO…" demonstram cada mensagem de erro sem
precisar preparar nada. Cada um foi testado contra a regra real do sistema:

| Código | Regra | Demonstra |
|---|---|---|
| `BEMVINDO10` | 10%, sem mínimo | Uso normal |
| `VESTRA20` | R$ 20, mínimo R$ 150, até 100 usos | "Faltam R$ X para usar este cupom" |
| `DEMOEXPIRADO` | 15%, venceu em 31/01/2026 | "Este cupom expirou." |
| `DEMOESGOTADO` | 10%, limite de 1 uso já atingido | "Este cupom esgotou." |
| `DEMODESATIVADO` | 10%, desativado | "Cupom inválido." |
| `LIMITE1` | 5%, limite de 1 uso | Limite com compras simultâneas |

---

## Versionamento

- Um commit por item, cada um feito **depois** de uma revisão linha a linha.
  O bug do preço promocional ficou num commit separado, para poder ser desfeito
  sozinho se o grupo discordar da regra.
- **Decisão: a branch não foi enviada ao GitHub ainda.** Enviar protegeria o
  trabalho contra perda do computador, mas o grupo preferiu esperar: com a
  migration no GitHub, alguém poderia aplicá-la no banco compartilhado antes da
  hora, mesmo com aviso. O envio fica para depois dos testes com o banco.

---

## Achados fora do escopo da Sprint 3

| Achado | Onde | Situação |
|---|---|---|
| **O carrinho ignorava o preço promocional.** A página de produto mostra o preço promocional (com o cheio riscado), mas ao adicionar à sacola o preço gravado era `variant.price ?? basePrice` — o promocional nunca era considerado. O cliente via um preço e era cobrado por outro. | `addToCartAction` em `src/lib/cart-actions.ts` (Sprint 2, item 07) | **Corrigido**, com autorização do grupo. Regra: promocional (se houver) → preço da variação → preço cheio. Princípio: o que o cliente vê é o que ele paga. |
| O **preço por variação** (cadastrável no admin) nunca é exibido ao cliente — a página mostra só o preço do produto. Sem promoção, uma variação com preço próprio seria cobrada por um valor que o cliente não viu. Nenhum produto usa esse recurso hoje. | Página do produto × `addToCartAction` | Não corrigido — exigiria exibir o preço por variação na página do produto |
| **Parâmetro repetido na URL derrubava 5 páginas antigas.** O mesmo problema corrigido na Sprint 3 (ex.: `?status=a&status=b` chega como lista, não como texto) existia em páginas anteriores. Em produtos e estoque, a lista ia direto para a consulta do banco. O catálogo já tratava corretamente. | `/perfil/pedidos`, `/admin/pedidos`, `/admin/modelos-3d`, `/admin/produtos`, `/admin/estoque` | **Corrigido**, com autorização do grupo, no mesmo padrão do catálogo. Todas as 10 páginas que leem a URL foram conferidas uma a uma |
| **Checkout em branco com etapa inválida.** `?step=` nunca era validado: com um valor desconhecido (`?step=xyz`) ou repetido, nenhuma etapa batia e a área principal ficava vazia — sem formulário e sem mensagem. | `/checkout` | **Corrigido**: qualquer etapa inválida vira "endereço" |
| **O login ignora a página de origem.** Rotas protegidas mandam para `/login?next=…`, mas depois de entrar o cliente sempre vai para `/perfil`. Afeta o provador e o coração de favoritos para visitante. | `loginAction` em `src/lib/auth-actions.ts` | **Corrigido na branch `leonardoquartaroli`** (commit `3fcbaf6`), não nesta: a mesma função já tinha sido alterada lá (redirecionamento por perfil), e mudar nas duas daria conflito no merge. O destino é validado no servidor para só aceitar endereço do próprio site — sem isso o link de login viraria um redirecionador aberto para phishing. Testado contra 8 truques conhecidos (`//`, `https://`, barra invertida, tab escondido, `javascript:`, `data:`, outra porta, `@`). Nesta branch, o coração de favoritos para visitante passou a enviar a página do produto como destino (`?next=`); **o retorno só funciona depois que as duas branches forem juntadas** |
| 4 problemas de lint (2 erros, 2 avisos) | `marquee.tsx`, `tryon-experience.tsx`, `measurement-actions.ts` | Já existiam antes da Sprint 3, em arquivos não alterados. A sprint não adicionou nenhum |
| O preço fica gravado no item do carrinho no momento em que é adicionado. Se uma promoção começar ou acabar depois, o carrinho mantém o preço antigo até o item ser adicionado de novo. **Confirmado no teste do passo 9:** depois que a promoção foi removida, a sacola continuou cobrando R$ 149 — ou seja, quem deixa a peça na sacola compra pelo preço promocional mesmo depois do fim da promoção. | `CartItem.unitPrice` | Não corrigido — comportamento já existente; a correção seria o checkout recalcular o preço atual |
| O **card do catálogo mostra só o preço cheio**, mesmo com promoção: a Boxy Tee 01 aparecia a R$ 189 no catálogo e a R$ 149 na página do produto, na sacola e nos favoritos. O filtro de preço do catálogo também usa o preço cheio. Não prejudica o cliente (ele paga menos do que viu), mas esconde a promoção justamente onde ela chamaria atenção. | `getProducts` em `src/lib/products.ts` e `product-card.tsx` (catálogo, Sprint 2) | Não corrigido — fora do escopo; a correção é levar o promocional ao card, no mesmo padrão de preço riscado |
| O admin aceita **preço promocional maior ou igual ao preço cheio** (não há validação). A página do produto mostraria o "promocional" com o cheio, menor, riscado ao lado. Também aceita promocional **R$ 0** — e aí o carrinho cobraria zero pela peça. Um valor negativo é descartado em silêncio (a promoção some sem aviso). | `updateProductAction` / `createProductAction` em `src/lib/product-actions.ts` | Não corrigido — visto só na leitura do código, não testado para não gravar dado incoerente no banco compartilhado |
| O filtro de tamanhos do catálogo lista os tamanhos em ordem alfabética ("G, GG, M, P"). Cosmético. | `getFilterOptions` em `src/lib/products.ts` | Não corrigido — a ordem certa já existe em `src/lib/sizes.ts` e pode ser reaproveitada |
| O Hoodie Core tem variações nas cores "Branco" **e** "White" (P a GG em cada), que parecem a mesma cor cadastrada duas vezes. Aparece para o cliente na página do produto e no atalho dos favoritos. | Dados do banco (variações do produto `hoodie-core`) | Não corrigido — é dado de cadastro, não código; decisão do grupo (desativar as "White" pelo admin, se forem duplicadas) |
| As **mensagens de erro do checkout não são anunciadas pelo leitor de tela** (não ficam numa região "ao vivo"). Quem usa leitor de tela clica em "Finalizar pedido" e não fica sabendo que foi recusado — vale para todos os erros da etapa de pagamento, inclusive a nova mensagem de conta bloqueada. | `src/components/checkout/payment-step.tsx` (Sprint 2) | Não corrigido — arquivo anterior à Sprint 3 e não alterado por ela; a correção é a mesma usada no atalho dos favoritos (região `aria-live` sempre presente) |
| A tela de pedido confirmado mostra o status em inglês, como está no banco ("STATUS ATUAL · PENDING", depois "PAID"). Cosmético. | `src/components/checkout/payment-status-poller.tsx` (usado em `/checkout/sucesso/[orderId]`) | Não corrigido — anterior à Sprint 3 e não alterado por ela |

---

## Fora do escopo (conscientemente)

| O quê | Por quê |
|---|---|
| Limite de um uso de cupom **por cliente** | O cronograma pede limite de uso do cupom, não por cliente |
| Devolver o uso do cupom quando o pedido é cancelado | Cancelamento completo é o item 19, da Sprint 4 |
| Limite de tentativas de código de cupom (anti-força-bruta) | Mesmo tema do rate limit de login, já listado como melhoria futura |
| Cupom removido pelo admin some dos carrinhos que o tinham aplicado | Só é possível remover cupom nunca usado; carrinho em aberto não conta como uso |

---

## Problemas encontrados nas revisões (e corrigidos)

Cada passo passou por uma revisão linha a linha antes do commit.

| Passo | Problema | Gravidade |
|---|---|---|
| 3 | **O tipo do cupom voltava sozinho para "Percentual" após um erro no formulário.** Confirmado no código-fonte do React: ele ignora mudança de valor padrão em `<select>` já montado. O admin podia criar um cupom de 50% achando que era R$ 50. Corrigido remontando o campo. | Alta |
| 3 | Valores acima do limite das colunas do banco derrubavam a tela com erro técnico. Validados antes de gravar. | Média |
| 3 | "Desativar" quebrava se outro admin tivesse acabado de remover o cupom. | Baixa |
| 3 | A remoção checava e apagava em dois passos; um pedido podia usar o cupom entre eles. Virou uma operação única. | Baixa |
| 4 | **Carrinho que somava exatamente o pedido mínimo podia ser recusado com "Faltam R$ 0,00".** Soma de dinheiro em ponto flutuante fica um fio abaixo (0,7 + 0,1 = 0,7999…). Corrigido arredondando em centavos antes de comparar. | Média |
| 4 | A mensagem de falha de último instante dizia sempre "esgotou", mas também dispara se o cupom expirar ou for desativado no mesmo instante. | Baixa |
| 2 | Nome da pasta da migration não citava o frete; renomeado antes de aplicar (depois de aplicado, o nome fica gravado no banco). | Baixa |
| 5 | O seletor do atalho de favoritos ordenava tamanhos em ordem alfabética ("G, GG, M, P"). Criada uma ordem de vestuário (PP, P, M, G, GG…, depois numéricos em ordem crescente), em `src/lib/sizes.ts`. | Baixa |
| 6 | Um componente auxiliar foi exportado de dentro de um arquivo de página. O Next.js não permite isso e o **build de produção quebraria** — o typecheck comum não detecta. Movido para arquivo próprio antes do commit; o build de produção confirmou. | Alta |
| 6 | **Dados pessoais dependiam de uma barreira só.** O layout do admin só confere se a pessoa é da equipe (qualquer perfil); quem restringia `/admin/clientes` ao Administrador era apenas o middleware. Se ele falhasse ou fosse contornado (já houve falha pública assim no Next.js, CVE-2025-29927), um Operador veria nome, e-mail, telefone e compras de todos os clientes. A documentação do Next.js também avisa que a checagem no layout não roda de novo a cada navegação. Corrigido: as consultas de clientes exigem Administrador por conta própria e falham fechadas. | Alta |
| 2 e 6 | **Parâmetro repetido na URL derrubava a página.** No Next.js, `?cep=1&cep=2` chega como lista, não como texto, e o código chamava funções de texto nele. Afetava o CEP do carrinho e a busca de clientes. Corrigido aceitando só texto. | Média |
| 7 | O cupom `LIMITE1` fica esgotado após o primeiro teste e o seed não o recria. Anotado no roteiro como repetir o teste. | Baixa |
| Geral | Na etapa de revisão do checkout a linha dizia só "Frete", enquanto o resumo ao lado dizia "Frete · Expresso". Unificado. | Baixa |
| 13 | **Achado nos testes no banco real:** com cupom aplicado, a sacola tinha três botões chamados só "Remover" (dois itens e o cupom); para leitor de tela o do cupom ficava indistinguível. Agora ele se anuncia "Remover cupom VESTRA20", nome que começa pelo texto visível, para comandos de voz ("clicar em Remover") continuarem funcionando. Os "Remover" dos itens já existiam antes da Sprint 3 e ficaram como estavam. | Baixa |
| 13 | **Achado nos testes no banco real:** a ordem das linhas mudava de página para página — sacola e checkout mostravam Subtotal → Desconto → Frete, e confirmação, "Meus pedidos" e admin mostravam Subtotal → Frete → Desconto. Unificado na primeira, que explica melhor a conta: o cupom é calculado sobre os produtos, nunca sobre o frete. Só a ordem mudou; nenhum valor. | Baixa |
| 11 | **Achado nos testes no banco real (acessibilidade dos favoritos):** o nome do coração mudava com o estado ("Adicionar aos favoritos" ↔ "Remover dos favoritos") ao mesmo tempo que usava "pressionado", anunciando o estado duas vezes; os 13 corações do catálogo tinham nomes idênticos; e na página do produto o texto visível ("Favoritar") não fazia parte do nome, quebrando comando de voz. Na lista de favoritos, campo e botão do atalho eram iguais em todas as peças, a confirmação "Adicionado à sacola" não era anunciada, e a foto de peça sem imagem virava um link sem nome. Corrigido — ver a decisão de acessibilidade no item 11. | Média |
| 11 | **Achado nos testes no banco real:** com a peça em promoção, a lista de favoritos mostrava só o preço promocional, sem o cheio riscado que a página do produto mostra — o cliente não percebia que a peça tinha baixado de preço. Agora mostra os dois; para leitor de tela, o riscado é lido como "antes R$ 189,00". Na revisão desse ajuste, o HTML gerado colava os preços ("149,00antes") — o leitor de tela leria assim; acrescentado o espaço e conferido de novo com a promoção ativa. | Baixa |

---

## Roteiro de testes (quando o banco voltar)

1. `npx prisma migrate status` → confirmar que só a migration da Sprint 3 está pendente.
2. `npx prisma migrate deploy`, depois `npx prisma migrate status` de novo → "up to date".
3. `npm run db:seed:sprint3` → cria os cupons de exemplo. **Nunca** `npm run db:seed` nesse banco.
4. **Frete:** um pedido Econômico e um Expresso; conferir valor e modalidade gravados no admin.
5. **Cupons (admin):** criar percentual e fixo; tentar código duplicado; desativar e reativar; tentar remover cupom usado.
6. **Aplicar cupom:** `DEMOEXPIRADO`, `DEMOESGOTADO`, `DEMODESATIVADO` e `VESTRA20` com carrinho abaixo de R$ 150 mostram cada mensagem de erro; `BEMVINDO10` (percentual) e `VESTRA20` (fixo) aplicam desconto; remover itens até ficar abaixo do mínimo.
7. **Limite de usos:** `LIMITE1` em dois pedidos — o segundo deve ser recusado. Confirma também o SQL da comparação entre colunas (`usedCount < usageLimit`), que só pode ser verificado no banco real. O `LIMITE1` fica esgotado depois disso e o seed não o recria; para repetir o teste, crie outro cupom com limite 1 pelo admin.
8. **Favoritos:** favoritar pelo catálogo e pela página do produto; visitante vai ao login; coração não abre o produto; adicionar à sacola pelo atalho; produto sem estoque mostra "Esgotado"; desfavoritar pela lista.
9. **Preço promocional:** cadastrar um promocional num produto, adicionar à sacola e conferir que o carrinho cobra o promocional.
10. **Clientes:** buscar por nome e por e-mail; conferir que Operador e Modelador não acessam; bloquear o cliente de teste → login recusado; com uma sessão já aberta, tentar finalizar pedido → recusado; desbloquear → volta a comprar.
11. **Enviar a branch ao GitHub** (`git push -u origin feat/sprint3`) e abrir o pedido de merge para a `main`.

### Resultados (27/09/2026, banco real, `localhost:3000`)

| Passo | Resultado |
|---|---|
| 1–2 | Só a migration da Sprint 3 estava pendente; aplicada com `migrate deploy`. Os 8 carrinhos e 5 pedidos existentes ficaram como Econômico, sem outra alteração. |
| 3 | Os 6 cupons de exemplo criados e conferidos no banco. |
| 4 | ✅ CEP do endereço padrão vem preenchido; CEP do interior (13000-000): Econômico R$ 17 / 8 dias, Expresso R$ 28 / 4 dias; CEP de capital (01310-100): 4 e 2 dias; `?cep=123` mostra "CEP inválido". Pedido Econômico #GS6A28RO (R$ 199 + R$ 17 = R$ 216) e Expresso #40FHSPKS (R$ 199 + R$ 28 = R$ 227): valores e modalidade iguais no carrinho, na revisão, no pagamento, na confirmação, no banco e no admin. Ambos foram para PAGO (pagamento simulado). |
| 5 | ✅ Criados `TESTEPCT` (15%, digitado em minúsculas e gravado em maiúsculas) e `TESTEFIX` (R$ 30, mínimo R$ 100, 5 usos). Código duplicado recusado ("Já existe um cupom com o código TESTEPCT.") mantendo código, tipo "Fixo" e valor no formulário. Recusados: 150% ("não pode passar de 100%"), `ABC DEF` e `CAFÉ10` (só letras e números). Desativar e reativar funcionam. `DEMOESGOTADO` (já usado): botão desabilitado na tela e, forçando o envio pelo navegador, o servidor também não remove. Os dois cupons de teste foram removidos no fim; o banco ficou só com os 6 do seed. |
| 6 | ✅ Sacola com Knit Beanie (R$ 89): `DEMOEXPIRADO` → "Este cupom expirou."; `DEMOESGOTADO` → "Este cupom esgotou."; `DEMODESATIVADO` e um código inexistente → "Cupom inválido." (de propósito, a mesma mensagem: não revela que o cupom desativado existe); `VESTRA20` → "Faltam R$ 61,00 … (pedido mínimo R$ 150,00)". Nenhuma recusa alterou o total. `BEMVINDO10`: − R$ 8,90, total R$ 97,10 (89 − 8,90 + 17), igual no checkout; ao somar a Relugar (R$ 288), o desconto recalculou para − R$ 28,80 e o frete para R$ 19 / R$ 31 (2 peças). `VESTRA20` com R$ 288: − R$ 20, total R$ 287. Ao tirar a Relugar, o cupom ficou na sacola com o aviso "Não se aplica: Faltam R$ 61,00…", o desconto sumiu (total R$ 106) e o checkout mostrou "O cupom VESTRA20 não pode ser usado…" com link para a sacola. Nenhum pedido foi finalizado neste passo. |
| 7 | ✅ Pedido #Z9JL4DWO com `LIMITE1` (Knit Beanie R$ 89 − R$ 4,45 + R$ 17 = R$ 101,55): banco com desconto 4,45 e cupom `LIMITE1`; admin mostra "Desconto · LIMITE1" e o cupom como "Esgotado · 1 de 1 usos". Nova tentativa pela sacola → "Este cupom esgotou.". **Trava no banco real:** a operação exata que o pedido usa para gastar o cupom (`usedCount < usageLimit`, comparação entre colunas) foi executada dentro de uma transação desfeita no fim: `LIMITE1` → 0 linhas (recusado), e os controles `VESTRA20` (0 de 100) e `BEMVINDO10` (sem limite) → 1 linha cada, provando que a condição não recusa tudo. Depois do rollback, todos os contadores idênticos aos de antes. |
| 8 | ✅ Visitante: o coração leva a `/login?next=/produto/…` e `/favoritos` manda para o login (o retorno à peça depois de entrar depende da branch `leonardoquartaroli`, ver "Achados fora do escopo"). Cliente: favoritou o Knit Beanie pelo card (coração preenchido, página continuou no catálogo) e o Hoodie Core pela página do produto ("Favoritar" → "Favoritado"). `/favoritos` listou os dois, mais recente primeiro, com "Adicionar" desabilitado até escolher a variação; o atalho colocou o Hoodie Core Preto M na sacola e mostrou "Adicionado à sacola". Desfavoritar pela lista e pelo catálogo funcionou; a lista vazia mostra a mensagem e o link para a coleção. O banco terminou com 0 favoritos. ⏳ **Pendente: "Esgotado"** — exige zerar o estoque de uma peça no banco compartilhado. O grupo autorizou, mas a ferramenta de IA usada (Claude Code) bloqueia por conta própria alterações de estoque em banco compartilhado, então esse teste fica para uma pessoa do grupo. Para testar: no admin → Estoque, zerar as duas variações do Knit Beanie, favoritá-lo, conferir "Esgotado" na lista e voltar o estoque a Cinza 10 / Preto 9. |
| 9 | ✅ Com autorização, a Boxy Tee 01 (R$ 189) recebeu promocional de R$ 149 pelo admin. Página do produto: R$ 149,00 com R$ 189,00 riscado e "3x de R$ 49,67". Cliente adicionou Preto M: sacola e checkout cobram R$ 149,00 (subtotal 89 + 299 + 149 = R$ 537,00), e o banco gravou 149 no item. Favoritada, a peça aparece na lista a R$ 149 — daqui saiu o ajuste do preço riscado (ver "Problemas encontrados nas revisões"). Dois achados fora do escopo: o card do catálogo continuou mostrando R$ 189, e, depois de removida a promoção, a sacola seguiu cobrando R$ 149 (ver "Achados fora do escopo"). **Tudo restaurado e conferido no banco:** promocional de volta a vazio (nenhum produto com promoção), peça retirada da sacola (que voltou a ter só Knit Beanie e Hoodie Core) e 0 favoritos. Nenhum pedido finalizado. Na revisão do ajuste, a promoção foi ligada mais uma vez, pelo mesmo caminho, só para conferir o preço riscado nos favoritos, e restaurada de novo; os campos que o formulário do admin regrava (nome, marca, descrição, categoria, provador) foram comparados com o cadastro original e estão idênticos. |
| 10 | ✅ **Busca:** por nome em minúsculas ("cliente teste" → 1 cliente, no singular), por e-mail completo, por parte do e-mail em maiúsculas ("GMAIL" → 5), sem resultado ("Nenhum cliente encontrado.") e com parâmetro repetido na URL (ignorado, sem quebrar). A lista mostra só clientes (6), sem staff nem contas excluídas. **Detalhe:** e-mail, telefone, data de cadastro, 6 pedidos com links funcionando e total gasto R$ 1.445,55 — conferido pela soma dos 6 pedidos pagos; sem endereços e sem medidas. **Permissões:** Operador de Estoque e Modelador 3D são mandados para `/admin` ao abrir a lista ou o detalhe, e o menu deles não mostra "Clientes". Enviando o formulário de bloqueio direto, com a sessão do Operador, o middleware também barrou (redirecionamento para `/admin`, cliente continuou como estava). A segunda barreira — a checagem de Administrador dentro da própria ação — não é alcançável por uma requisição normal: o Next.js só aceita a ação na página que a importa, que é protegida pelo middleware (tentar por outra página dá "Failed to find Server Action"). Ela só entraria em jogo se o middleware fosse contornado (o cenário da CVE-2025-29927); fica verificada pela leitura do código. **Bloqueio com sessão aberta:** cliente logado e parado em "Finalizar pedido"; o admin bloqueou numa segunda sessão (formulário da própria página, enviado pelo terminal, já que o navegador guarda um login por vez); o cliente clicou em "Finalizar pedido" → "Não é possível finalizar compras com esta conta. Entre em contato com a loja." — nenhum pedido criado, estoque igual —, e continuou navegando (Opção A). Login novo com a conta bloqueada → "E-mail ou senha inválidos.". Admin vê "Bloqueado" na lista e no detalhe. **Desbloqueio pela tela:** botão "Desbloquear" → "Ativo"; o cliente entrou de novo e finalizou o pedido #M4APV13K (Knit Beanie + Hoodie Core, os itens que estavam na sacola desde os passos 7 e 8: R$ 388, frete Econômico grátis), que foi para Pago; estoque Knit Beanie Preto 9 → 8 e Hoodie Core Preto M 10 → 9. **Travas no banco real**, numa transação desfeita no fim, com a condição exata da ação: bloquear o admin, bloquear o Operador, reativar conta excluída e "desbloquear" cliente já ativo → 0 linhas cada; controle (bloquear o cliente ativo) → 1 linha. Depois do rollback, usuários idênticos aos de antes. O cliente de teste terminou **Ativo**. |

## Validação sem banco

Além de typecheck, lint e testes da lógica isolada a cada passo, o **build de
produção** (`next build`) da sprint inteira passou: as 33 rotas compilam. O
build valida regras que o typecheck não pega, como o que uma página pode
exportar e a separação entre código de servidor e de navegador.

**Pente fino geral** (depois de todos os itens, olhando a sprint como um todo):
- O SQL da migration é **idêntico** ao gerado a partir do schema final.
- Lint do projeto inteiro: **nenhum problema novo** em relação à `main`.
- Sem resquícios de depuração.
- **Todas as 8 ações públicas novas** conferem permissão na primeira linha (5
  pela sessão do cliente, 3 exigindo Administrador), e nenhuma deixa um
  usuário alterar dados de outro.
- Interações entre itens revisadas: frete × cupom, cupom × cliente bloqueado,
  favoritos × preço promocional, estado do carrinho depois do pedido.

## Ambiente: projeto dentro de pasta sincronizada com o iCloud

O projeto está em `~/Desktop`, que está sincronizado com o iCloud Drive. Quando
um arquivo é reescrito durante a sincronização, o iCloud cria cópias
duplicadas com sufixo numérico (`routes.d 3.ts`). Isso aconteceu nos arquivos
temporários do build (`.next/types`) e fez o typecheck acusar erros falsos de
forma intermitente — o build seguinte os apagou.

Verificado: **nenhuma duplicata no código-fonte, na documentação nem no `.git`**,
e `git fsck` confirmou o repositório íntegro. O risco real seria uma duplicata
dentro do `.git`, que pode corromper o histórico. Recomendação: mover o projeto
para uma pasta fora do iCloud (ex.: `~/Projetos`) — com a ressalva de que hoje o
iCloud é, na prática, a única cópia de segurança dos commits que ainda não foram
enviados ao GitHub.

## Armadilha conhecida

O cliente do Prisma é gerado localmente e **não acompanha a troca de branch**.
Até a migration ser aplicada, trocar para outra branch e rodar o site dá erro ao
ler carrinho e pedidos. Solução: `npx prisma generate` depois de trocar de
branch.
