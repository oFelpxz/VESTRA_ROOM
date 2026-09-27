# Sprint 3 — decisões, achados e pendências

> Registro para apresentação ao professor. Sprint 3 do cronograma (09/09 a
> 23/09), **sem o item 3D-04** — a parte 3D ficou de fora por decisão do grupo.
> Branch: `feat/sprint3`, criada a partir da `main`.
>
> **Contexto de execução:** o Supabase (plano gratuito) estava pausado durante
> o desenvolvimento. Todo o código foi escrito e validado **sem banco**
> (typecheck, lint e testes da lógica isolada); a aplicação da migration e os
> testes no navegador ficaram para quando o banco for reativado.

## Itens da sprint

| Item | Descrição | Situação |
|---|---|---|
| 14 | Frete no carrinho | Código pronto · teste no navegador pendente |
| 12 | Gerenciar cupons | Código pronto · teste no navegador pendente |
| 13 | Aplicar cupom no carrinho | Código pronto · teste no navegador pendente |
| 11 | Favoritos | Código pronto · teste no navegador pendente |
| 23 | Gestão de clientes | Código pronto · teste no navegador pendente |

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

## Achados fora do escopo da Sprint 3

| Achado | Onde | Situação |
|---|---|---|
| **O carrinho ignorava o preço promocional.** A página de produto mostra o preço promocional (com o cheio riscado), mas ao adicionar à sacola o preço gravado era `variant.price ?? basePrice` — o promocional nunca era considerado. O cliente via um preço e era cobrado por outro. | `addToCartAction` em `src/lib/cart-actions.ts` (Sprint 2, item 07) | **Corrigido**, com autorização do grupo. Regra: promocional (se houver) → preço da variação → preço cheio. Princípio: o que o cliente vê é o que ele paga. |
| O **preço por variação** (cadastrável no admin) nunca é exibido ao cliente — a página mostra só o preço do produto. Sem promoção, uma variação com preço próprio seria cobrada por um valor que o cliente não viu. Nenhum produto usa esse recurso hoje. | Página do produto × `addToCartAction` | Não corrigido — exigiria exibir o preço por variação na página do produto |
| O preço fica gravado no item do carrinho no momento em que é adicionado. Se uma promoção começar ou acabar depois, o carrinho mantém o preço antigo até o item ser adicionado de novo. | `CartItem.unitPrice` | Não corrigido — comportamento já existente |
| O filtro de tamanhos do catálogo lista os tamanhos em ordem alfabética ("G, GG, M, P"). Cosmético. | `getFilterOptions` em `src/lib/products.ts` | Não corrigido — a ordem certa já existe em `src/lib/sizes.ts` e pode ser reaproveitada |

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

---

## Roteiro de testes (quando o banco voltar)

1. `npx prisma migrate status` → confirmar que só a migration da Sprint 3 está pendente.
2. `npx prisma migrate deploy`.
3. **Frete:** um pedido Econômico e um Expresso; conferir valor e modalidade gravados no admin.
4. **Cupons (admin):** criar percentual e fixo; tentar código duplicado; desativar e reativar; tentar remover cupom usado.
5. **Aplicar cupom:** cada mensagem de erro; desconto percentual e fixo; remover itens até ficar abaixo do mínimo.
6. **Limite de usos:** cupom com limite 1, dois pedidos — o segundo deve ser recusado. Confirma também o SQL da comparação entre colunas (`usedCount < usageLimit`), que só pode ser verificado no banco real.
7. **Favoritos:** favoritar pelo catálogo e pela página do produto; visitante vai ao login; coração não abre o produto; adicionar à sacola pelo atalho; produto sem estoque mostra "Esgotado"; desfavoritar pela lista.
8. **Preço promocional:** cadastrar um promocional num produto, adicionar à sacola e conferir que o carrinho cobra o promocional.
9. **Clientes:** buscar por nome e por e-mail; conferir que Operador e Modelador não acessam; bloquear o cliente de teste → login recusado; com uma sessão já aberta, tentar finalizar pedido → recusado; desbloquear → volta a comprar.

## Validação sem banco

Além de typecheck, lint e testes da lógica isolada a cada passo, o **build de
produção** (`next build`) da sprint inteira passou: as 33 rotas compilam. O
build valida regras que o typecheck não pega, como o que uma página pode
exportar e a separação entre código de servidor e de navegador.

## Armadilha conhecida

O cliente do Prisma é gerado localmente e **não acompanha a troca de branch**.
Até a migration ser aplicada, trocar para outra branch e rodar o site dá erro ao
ler carrinho e pedidos. Solução: `npx prisma generate` depois de trocar de
branch.
