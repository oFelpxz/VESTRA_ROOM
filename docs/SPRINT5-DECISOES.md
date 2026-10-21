# Sprint 5 — decisões, testes e pendências

> Sprint 5 do cronograma (09/10 a 26/10, **entrega final em 26/10**): provador
> virtual completo, trocas e fechamento. Itens: 15 (looks), 21 (pedir troca ou
> devolução), 22 (aprovar ou negar troca), 24 (relatórios), 25 (configurações
> da loja), 3D-06, 3D-07 e 3D-08.
>
> **Branch:** `feat/sprint5`, criada em cima de `feat/sprint4-pagamento-frete`
> (PR #11). O PR da Sprint 5 deve usar essa branch como base enquanto o #11
> não for mergeado.
>
> **Branch dos itens:** `feat/sprint5-itens`, criada em cima de
> `feat/sprint5`. O PR dela usa `feat/sprint5` como base.
>
> Este documento tem três partes: o que já foi feito, as **decisões** dos
> itens 21, 22 e 25 (o grupo aprovou **todas as sugestões** em 19/10) e os
> rascunhos das políticas de troca e de privacidade.

## Itens da sprint

| Item | Descrição | Situação |
|---|---|---|
| 15 | Salvar looks (combinação de peças no provador) | ✅ Uma peça de cima + uma de baixo, com nome e foto do avatar vestido. Abrir de novo no provador e pôr o look inteiro na sacola. Ver "Provador e looks" |
| 21 | Cliente pede troca ou devolução | ✅ Feito com as sugestões 21.1 a 21.9 |
| 22 | Admin aprova ou nega a troca | ✅ Feito com as sugestões 22.1 a 22.8, com reembolso parcial |
| 24 | Relatórios por período com CSV | ✅ Vendas e estoque (`6702237`) e trocas e devoluções |
| 25 | Configurações da loja | ✅ Feito com as sugestões 25.1 a 25.8 (`/admin/configuracoes`, `/trocas`, `/privacidade`) |
| 3D-06 | Vestir a peça no avatar com indicador de caimento por região | ✅ Seis regiões e cinco classes. Ver "Provador e looks" |
| 3D-07 | Trocar tamanho e cor; comparar 2 tamanhos lado a lado | ✅ Também com a peça do look junto nos dois avatares |
| 3D-08 | Recomendar tamanho (estimativa) e validar o provador de ponta a ponta | ✅ Recomendação feita e provador validado no navegador em 19/10 (ver "Teste no navegador") |

**Migration nova:** `20261019120000_sprint5_trocas_configuracoes_looks`
(trocas, fotos das trocas, looks, configurações da loja, data da entrega do
pedido e valor já devolvido de cada pagamento). Aplicar com
`npx prisma migrate deploy` (nunca `migrate dev` no banco compartilhado).
Em 20/10 entrou mais uma, `20261020120000_sprint5_look_foto` (foto do look),
já aplicada.

**Roteiro da entrega de 26/10:**
[`ROTEIRO-APRESENTACAO-26-10.md`](ROTEIRO-APRESENTACAO-26-10.md).

---

## Item 24 — Relatórios

Tela nova **`/admin/relatorios`**, só para o Admin (o Operador não vê
faturamento, mesma regra do painel). Aparece no menu como "11 Relatórios" e
nos atalhos do painel.

- **Período:** duas datas (de/até) ou os atalhos 7, 30 e 90 dias. Sem datas,
  mostra os últimos 30 dias. Datas invertidas são trocadas, data no futuro
  vira hoje e o período máximo é de 366 dias; em todos esses casos a tela
  avisa o que foi corrigido.
- **Vendas:** faturamento, número de vendas, ticket médio, peças vendidas,
  descontos de cupom e frete cobrado; lista de pedidos (com link para cada
  um) e vendas por produto. Conta como venda a mesma regra do painel: pedido
  pago, em preparação, enviado ou entregue, pela data do pedido no horário de
  Brasília.
- **Estoque:** foto de agora (a loja não guarda histórico de estoque, então
  não depende do período): variantes, peças, estoque baixo e esgotadas.

**Três downloads em CSV:** pedidos, vendas por produto e estoque completo.

| Decisão | Por quê |
|---|---|
| Separador `;` e vírgula decimal (`199,90`) | É o que o Excel em português espera; com `,` ele junta tudo numa coluna |
| BOM no início do arquivo | Sem ele o Excel mostra "SituaÃ§Ã£o" em vez de "Situação" |
| Valores sem "R$" | Para o Excel conseguir somar a coluna |
| Texto que começa com `=`, `+`, `-` ou `@` ganha um `'` na frente | Um cliente com nome `=HYPERLINK(...)` viraria fórmula ao abrir a planilha |
| Só o nome do cliente, sem e-mail nem telefone | Menos dado pessoal circulando em arquivo (LGPD); o contato está na tela de Clientes |
| A tela e o CSV usam a mesma consulta | Os números nunca divergem |
| O CSV confere de novo se é Admin | O proxy já barra, mas a resposta é um arquivo com dados de vendas |

---

## Correções feitas nesta sprint

| Commit | Problema | Correção | Como foi conferido |
|---|---|---|---|
| `08ce1e0` | O Admin conseguia salvar promoção **maior** que o preço cheio, ou promoção de **R$ 0** (a peça ficava de graça na sacola). Preço base R$ 0 também passava. Depois de um erro, o formulário apagava o que tinha sido digitado | Preço base maior que zero; promocional, se preenchido, maior que zero e menor que o preço base, com mensagens claras. O formulário mantém o que foi digitado | 6 testes automáticos. No navegador, com uma trava temporária que impedia salvar: os 4 casos errados mostraram a mensagem certa e mantiveram os campos; o caso certo passou na validação. Depois, o Hoodie Core continuava igual no banco |
| `5f4d2c0` | O filtro de preço do catálogo olhava o preço cheio: uma peça de R$ 299 em promoção por R$ 179 não aparecia em "Até R$ 200" | O filtro usa o preço que o cliente paga (o promocional, se houver) | As três faixas mostraram os mesmos produtos de antes (nenhum produto tem promoção hoje, e o banco não foi alterado). O caso com promoção não foi testado no navegador |
| `1d63866` | Variante com estoque 0 aparecia como "Baixo" na tela de Estoque. Status do modelo 3D em inglês (VALIDATED, PENDING) na lista de modelos e na página do produto | Selo **"Esgotado"** para estoque 0; status em português (Validado, Pendente...) | Estoque simulado só na tela: uma variante com 0 mostrou "Esgotado" e uma com 1 mostrou "Baixo". Lista de modelos e página do Hoodie Core mostraram "Validado" |
| `6702237` | — | Item 24 (acima) | 16 testes automáticos (período e CSV). No navegador: os números de 90 dias bateram com o painel (R$ 2.258,41 em 9 vendas); os três CSVs abriram com BOM, `;` e acentos; subtotal − desconto + frete = total em todos os pedidos; sem login, o CSV redireciona para o login; tela sem rolagem lateral no celular |
| `3c5d3c2` | Excluir a conta não apagava os **cartões salvos** do cliente (nome impresso, final e validade) | Os cartões são apagados junto com medidas, endereços e sacola, na mesma transação | Só checagem de tipos e lint: testar exigiria excluir uma conta no banco compartilhado |
| `7549a14` | O caso "produto em promoção" do filtro de preço (`5f4d2c0`) não tinha sido testado | A regra da faixa foi separada em `price-filter.ts` e ganhou teste. `?preco=constructor` e `?preco=__proto__` passam a ser ignorados | 5 testes automáticos: peça de R$ 400 em promoção por R$ 180 aparece em "Até R$ 200" e não em "R$ 350+". O catálogo abriu normal com e sem filtro |

### Correções de pagamento, checkout e endereço (19/10, Supabase fora do ar)

Feitas enquanto o banco estava pausado: conferidas com checagem de tipos,
lint e testes automáticos (214 passando). Testadas no navegador em 19/10,
depois que o banco voltou (ver "Teste no navegador").

| Problema | Correção |
|---|---|
| **Corrida de estoque** (era o C6 do `STATUS-FASE2.md`): o estoque era conferido fora da transação e baixado "às cegas"; dois clientes comprando a última peça ao mesmo tempo deixavam o estoque negativo | A baixa só acontece se ainda houver estoque (`updateMany` com `stockQuantity >= quantidade`). O segundo cliente recebe "Uma das peças da sua sacola acabou de esgotar…" e nada é gravado |
| Peça **desativada** (ou em rascunho) que já estava na sacola ainda podia ser comprada; e dava para colocar na sacola uma variante ativa de produto desativado | Checkout e "adicionar à sacola" exigem variante **e** produto ativos; no checkout ela aparece na lista de indisponíveis com 0 |
| Quantidade quebrada (`1.5`) vinda do formulário da sacola derrubava a gravação | Arredondada para baixo |
| **PIX simulado podia ficar pendente para sempre**: o checkout disparava uma chamada "solta" para `/api/payments/simulate`, que na Vercel pode morrer junto com a resposta ou ir para o endereço errado (`NEXT_PUBLIC_BASE_URL`) | O pagamento simulado é aprovado quando alguém olha o pedido (a página de sucesso consulta a cada 2 s, e a página do pedido também) e ele já tem 3 s. `NEXT_PUBLIC_BASE_URL` deixou de ser usado para isso |
| `POST /api/payments/simulate` **sem login** marcava como pago qualquer pedido simulado (era o C1) | Rota removida; fica só a consulta (GET), que exige ser o dono do pedido |
| **Estorno não podia ser repetido**: com chave de idempotência fixa, o Stripe guarda até a resposta de erro por 24 h; depois de uma falha, o Admin recebia o mesmo erro ao tentar de novo (no cancelamento e na devolução) | `refundOnce`: procura antes um estorno dessa devolução/pedido que deu certo (pela `metadata.vestra_ref`) e devolve ele; se não houver, pede um novo com a chave do minuto. Clique duplo continua sem estornar em dobro. 4 testes |
| **Login ignorava o `?next=`**: quem entrava pelo checkout, pelo provador ou pelos favoritos caía no perfil | Volta para a página de antes (também o `callbackUrl` que o NextAuth manda para /perfil e /admin). Só aceita caminho da loja: `//site.com` e `https://…` não viram redirecionamento para fora. 5 testes |
| Depois de um erro (ex.: CEP com 7 dígitos), os formulários de endereço e o de login **apagavam o que tinha sido digitado** | Endereço: campos controlados, enviados sem o reset do React. Login: o e-mail volta preenchido |

**Novo: preenchimento do endereço pelo CEP.** No checkout e no perfil, o CEP
veio para o topo do formulário, com máscara `00000-000`. Com os 8 dígitos, a
loja consulta o ViaCEP (e a BrasilAPI, se ele estiver fora), preenche rua,
cidade e UF e põe o cursor no fim da rua para o cliente digitar o número. Se
o cliente já tinha digitado a rua, ela não é apagada. CEP inexistente ou
serviço fora mostram uma mensagem e o cliente preenche à mão. O bairro
aparece na mensagem, mas **não é salvo**: o endereço não tem campo de bairro
(precisaria de migração). A consulta sai do navegador e leva só o CEP; a
política de privacidade passou a citar os dois serviços. 11 testes.

Roteiro para quando o banco voltar (itens 1, 2 e 4 testados em 19/10; o 3
e o 5 ficaram de fora, ver abaixo):

1. Endereço novo no checkout: digitar `01310-100` → rua, cidade e UF
   preenchidas; digitar `00000-000` → "Não achamos esse CEP" (o
   `99999-999` existe: é de Sarandi/PR); salvar com
   CEP incompleto → erro e os campos continuam preenchidos.
2. Editar um endereço no perfil: os dados antigos aparecem; trocar o CEP.
3. PIX: o pedido vira Pago em ~3 s na página de sucesso. Fechar a aba logo
   depois de finalizar e abrir o pedido no perfil: ele aparece Pago.
4. Sair, abrir `/checkout`, entrar: volta para o checkout.
5. Só se o grupo topar mexer num produto de teste: desativar uma peça que
   está na sacola de um cliente de teste → o checkout mostra ela como
   indisponível (depois, reativar).

## Teste no navegador (19/10)

Feito no `npm run dev` local, com o banco compartilhado, depois de aplicar a
migration com `migrate deploy`. Contas de teste criadas para isso (as senhas
ficam só no computador de quem testou, fora do Git):

- Cliente: `teste.cliente.claude@example.com`
- Admin: `teste.admin.claude@example.com` (promovido a Admin por script)

Ficaram no banco: o pedido de teste **#5DZK6HBG** (1 peça, R$ 312,88, pago
com cartão de teste do Stripe e já reembolsado) e a devolução **#TJNVUTX2**.
O estoque da peça voltou ao que era (8 → 9 com o recebimento).

| O que | Resultado |
|---|---|
| Login com `?next=` (checkout, perfil) | ✅ Volta para a página de antes |
| `/trocas` e `/privacidade` | ✅ Abrem; `/trocas` mostra os prazos das configurações |
| CEP: `01310-100`, `00000-000`, CEP incompleto | ✅ Preenche; mostra "Não achamos esse CEP"; erro sem apagar os campos |
| Endereço: salvar, editar, trocar o CEP | ✅ |
| Medidas e provador (3D-06 a 3D-08) | ✅ Tamanho sugerido M; comparar com G (×1,08) |
| Looks (item 15) | ✅ Salvar, abrir de novo e pôr o look inteiro na sacola |
| Checkout com cartão (Stripe, modo teste) | ✅ Endereço padrão já escolhido; pagamento aprovado; pedido Pago; página "Pagamento confirmado" |
| Admin: Em preparação → Enviado → Entregue | ✅ Enviado exige código de rastreio |
| Cliente pede devolução (item 21) | ✅ Prazos certos: arrependimento até 26/10, tamanho/cor até 18/11, defeito até 17/01/2027 |
| Admin aprova, recebe e devolve o valor (item 22) | ✅ Estoque voltou (peça em bom estado); estorno de R$ 312,88 com frete no Stripe; pagamento "Reembolsado" |
| Avisos do cliente | ✅ Pagamento confirmado, devolução recebida, aprovada, peça recebida e reembolso |
| Configurações (item 25) | ✅ Arrependimento 5 dias é recusado (mínimo 7); troca 31 dias salvou e apareceu em `/trocas` na hora. Tudo voltou aos valores de antes |
| Relatórios (item 24) | ✅ Vendas, trocas (1 devolução, 12,5%, R$ 312,88) e estoque; os 4 CSVs baixam |

**Não testado:** a peça desativada na sacola (mexeria num produto do
grupo).

**PIX simulado (testado em 20/10):** dois pedidos de teste, **#DH8JJ1F6** e
**#OR55HDOJ** (Boxy Tee 01 Preto M, R$ 201,78 cada, conta
`teste.admin.claude@example.com`). Os dois viraram **Pago** em ~3 s na
página de sucesso, com provedor "Simulado", e a página se atualizou sozinha.
Os dois pedidos ficaram no banco e tiraram 2 unidades do estoque dessa
variante.

### Corrigido durante o teste

| Problema | Correção |
|---|---|
| A foto provisória do catálogo (`public/models/placeholder.png`) era um SVG com nome de PNG e não aparecia | Trocada por um PNG de verdade |
| Em telas baixas (≤ ~880 px de altura), o menu lateral do Admin cortava **Configurações**, **Voltar à loja** e **Sair** | O menu rola sozinho (`src/app/admin/layout.tsx`) |
| O aviso de pagamento promete avisar quando o pedido sair, mas **Enviado** e **Entregue** não geravam aviso | Os dois geram aviso, com o código de rastreio no Enviado, na mesma transação da mudança (`src/lib/logistics-actions.ts`). Conferido com checagem de tipos; no navegador precisaria de outro pedido |
| Títulos da aba repetidos ("Endereços \| VESTRA ROOM \| VESTRA ROOM") em endereços, formas de pagamento e na página do produto; páginas do Admin sem título | Sufixo só no layout; Admin aparece como "Admin \| VESTRA ROOM" |

### Para o grupo decidir

Achados do teste que mexem em produto ou em regra; nada foi alterado.

- ~~Nenhuma peça de baixo tinha tabela de medidas.~~ Resolvido em 20/10:
  Cargo Pant 02, Bermuda Utility, Wide Denim e Saia Midi Plissada ganharam
  tabela (ver "Peças de baixo em 3D"). O grupo pode conferir os números.
- O Hoodie Core tem as cores **"Branco"** e **"White"** (aparecem duplicadas
  na troca de cor).
- Um produto se chama **"Relugar T-Shirt"** (erro de digitação?).
- O frete aparece como "Econômico · Correios SEDEX" (SEDEX não é o
  econômico).
- Pedido reembolsado **continua no faturamento** do relatório de vendas:
  mostrar o valor bruto ou o líquido (descontando devoluções)?
- A página de sucesso diz "PEDIDO ENVIADO", que pode ser confundido com o
  status Enviado (a peça ainda não saiu).
- O Admin pode cancelar um pedido já entregue (decisão do item 19); o
  bloqueio só existe com devolução em aberto.
- O bairro continua sem ser salvo (precisaria de migração).

## Preparação para os próximos itens

Feito antes das decisões do grupo, sem mexer no banco e sem mudar nada que
o cliente vê.

| Commit | Para qual item | O que já existe |
|---|---|---|
| `79dd790` | 22 (reembolso de devolução) | `computePartialRefund` (`src/lib/partial-refund.ts`) calcula quanto devolver quando volta só parte do pedido: preço pago pelas peças, menos a parte do cupom delas, frete da ida opcional e nunca mais do que falta devolver. Duas devoluções separadas somam exatamente o mesmo que devolver tudo. `createRefund` agora aceita um valor (estorno parcial no Stripe); sem valor, continua estornando tudo. 14 testes automáticos, sem chamar o Stripe de verdade |
| `88f976b` | 25 (configurações) | As regras da loja ficam em `src/lib/store-settings.ts`: frete grátis (R$ 300), tabela própria de frete, CEP de origem, prazo do boleto (3 dias), tempo da página de pagamento (60 min) e limite de estoque baixo das variantes novas (5). Os valores não mudaram; o item 25 vai trocar esse arquivo por uma leitura do banco |

---

## Provador e looks (3D-06, 3D-07, 3D-08 e item 15)

### Indicador de caimento por região (3D-06)

As regras ficam em `src/lib/fit-regions.ts` (sem banco, com 15 testes).
Cada região compara a medida do cliente com a faixa da tabela de medidas do
tamanho escolhido. A tolerância é a do item 25.8 (2 cm, editável no painel).

| Classe | Quando (diferença = medida do cliente − meio da faixa) |
|---|---|
| Muito justo | Passa da metade da faixa + tolerância |
| Justo | Passa da tolerância |
| Regular | Dentro da tolerância, para mais ou para menos |
| Solto | Abaixo de − tolerância |
| Oversized | Abaixo de −(metade da faixa + tolerância) |

| Região | De onde vem a faixa |
|---|---|
| Tórax, cintura, quadril | Tabela de medidas |
| Manga | Comprimento do braço na tabela |
| Ombros | **Estimado:** 46% da faixa do tórax (a tabela não tem ombro) |
| Barra (peça de cima) | **Estimado pela altura:** 170 cm no M, 5 cm a mais ou a menos por tamanho, ±4 cm |
| Barra (peça de baixo) | Comprimento da perna na tabela |

Que regiões aparecem: peça de cima, todas as seis; peça de baixo, cintura,
quadril e barra; vestido, ombros, tórax, cintura e quadril. Nas regiões de
comprimento (manga e barra) a tela também diz se fica curta ou comprida.

A classe é **física** (quanto a peça aperta ou sobra) e não muda com a
preferência do cliente. A preferência só muda a **recomendação**.

### Trocar tamanho e cor, comparar (3D-07)

No provador, depois dos botões de tamanho, "Comparar lado a lado com" abre
dois avatares, cada um com um tamanho, e uma tabela região por região.

### Tamanho sugerido (3D-08)

O provador já abre no tamanho sugerido. A sugestão procura o tamanho mais
perto do alvo de cada preferência: **ajustado** mira um pouco justo,
**regular** mira o meio da faixa e **oversized** mira o solto. Comprimentos
pesam metade. Um tamanho que fica muito justo em alguma região só é
sugerido se nenhum servir, e aí vai o que menos aperta, com aviso. A tela
sempre diz que é uma **estimativa**.

**Correção:** o cálculo antigo (`fit-calculator.ts`) aplicava a preferência
ao contrário (quem pedia ajustado recebia folga). Foi trocado pelo novo e
apagado.

### Looks (item 15)

- No provador de uma peça de cima (ou de baixo), o bloco "Montar look"
  escolhe a outra peça, a cor e o tamanho (já vem o sugerido), e dá um nome.
  A outra peça veste junto no avatar (ver "Peças de baixo em 3D"); uma peça
  sem molde 3D aparece como cartão, com o caimento estimado pelas medidas.
- Ao salvar, vai junto uma **foto do avatar vestido** (ver "Foto do look").
- Em "Minha conta → Looks" (`/perfil/looks`): abrir no provador, pôr o look
  na sacola e excluir.
- Pôr na sacola é **tudo ou nada**: se uma peça está fora de venda ou sem
  estoque, nenhuma entra e a mensagem diz qual. Salvar um look com peça sem
  estoque é permitido.
- Até 50 looks por cliente, nome com até 60 caracteres.
- Se uma peça sai da loja, o look continua e mostra "Peça saiu da loja".

### Peças de baixo em 3D (20/10)

Quatro peças de baixo vestem no avatar, sozinhas ou junto com a peça de
cima do look:

| Peça | Molde | Tamanhos na tabela |
|---|---|---|
| Cargo Pant 02 | 40, com bolsos cargo | 38–44 (cintura, quadril e perna) |
| Bermuda Utility | 40 | 38–44 (cintura e quadril) |
| Wide Denim | 40, perna larga até o chão | 38–42 (cintura, quadril e perna) |
| Saia Midi Plissada | M, evasê com pregas até o meio da canela | P/M/G (cintura e quadril) |

Os moldes saem do próprio avatar, por script no Blender sem interface
(`scripts/molde/calca.py` e `saia.py`, passo a passo em
`scripts/molde/README.md`). `scripts/attach-bottom-models.ts` liga os .glb
aos produtos e cria as tabelas de medidas (rodado no banco compartilhado em
20/10).

Como a peça veste (`src/lib/bottom-fit.ts`, com testes):

- Cada ponto do tecido fica preso aos pontos da pele em volta dele (até
  5 cm) e acompanha o corpo do cliente (medidas, homem ou mulher).
- **Folga:** vem da diferença de quadril entre o tamanho escolhido e o
  cliente, com no máximo 4 cm a mais. Sem tabela, conta 4 cm de quadril
  por número.
- **Comprimento:** vem da diferença entre a perna do tamanho e a do
  cliente. A coxa fica onde está; a barra sobe ou desce. No máximo 5 cm mais
  longa (e nunca abaixo do chão) e 10 cm mais curta.
- **Tamanho apertado** só aperta acima do entrepernas, e no máximo 3/4 da
  distância até a pele. Na perna não aperta (o bolso cargo entraria no
  tecido).
- **Tamanho folgado:** na perna, o lado de dentro ganha só 1/4 da folga,
  para as pernas não se cruzarem.
- O tecido nunca entra na pele (mínimo de 3 mm).
- **Por dentro da peça de cima:** acima da barra da camiseta ou do moletom,
  a peça de baixo fica rente ao corpo, e a de cima aparece por fora.
- **Saia:** a parte solta, longe da pele, segue as duas pernas juntas, não só
  a mais perto.

"Comparar lado a lado" também funciona com a peça do look: cada avatar veste
as duas peças (ex.: Tee M × GG com a calça; Saia P × G).

### Foto do look (20/10)

**Migration nova:** `20261020120000_sprint5_look_foto` (coluna
`previewImage` em `SavedLook`), aplicada com `npx prisma migrate deploy`.

- Ao salvar, o provador tira uma foto do avatar: o meio da tela, em retrato
  3:4, num JPEG de 240×320 (qualidade 0,8), com o fundo da página.
- O servidor só aceita `data:image/jpeg;base64,` com até 200 mil caracteres
  (`parseLookPhoto` em `src/lib/looks.ts`); outra coisa é ignorada e o look
  salva sem foto.
- Editar um look troca a foto; um look sem foto nova mantém a antiga.
- Em "Meus looks" a foto aparece à esquerda (em cima, no celular).

### Busca e cesto no catálogo (20/10)

- A "Pesquisa" do topo do `/catalogo` virou busca de verdade: procura em
  nome, descrição, coleção e material, sem diferenciar maiúsculas, até 60
  caracteres. Os filtros de categoria mantêm a busca.
- O "Cesto" mostra a quantidade real da sacola e leva para `/carrinho`.

### Mais peças e ajustes do provador (20/10, tarde)

**Migration nova:** `20261020130000_sprint5_look_acessorio` (coluna
`accessoryVariantId` em `SavedLook`), aplicada com `npx prisma migrate deploy`.

| Peça | Como foi feita | Tamanhos na tabela |
|---|---|---|
| Vestido Slip Acetinado | `scripts/molde/vestido.py`: corpete reto, saia evasê até abaixo do joelho, alcinhas | P/M/G (busto, cintura e quadril) |
| Oversized Shirt | `scripts/derivar-oversized.ts`, a partir do molde da Boxy Tee 01 (tronco mais largo e 6 cm mais comprido, manga 30% mais longa) | P/M/G (peito e cintura) |
| Knit Beanie | `scripts/molde/gorro.py`, saído da cabeça do avatar, com canelado e barra dobrada | Tamanho único (sem tabela) |

- **Vestido:** é marcado como peça de baixo (segue a pele inteira) e ocupa
  os dois lugares do look; "Meus looks" e a sacola contam a peça uma vez só.
- **Gorro = 3ª peça do look ("Acessório"):** acompanha a cabeça do cliente
  e vai junto no salvar, em "Meus looks" e no "pôr na sacola".
- **Cor:** na página do produto, o 3D (também o do manequim) troca para a
  cor escolhida, com o mesmo tingimento do provador.
- **Entrepernas:** a calça bem maior que o corpo não mostra mais o buraco
  branco no gancho (o lado de dentro da perna não ganha folga ali).
- **Mais leve:** a Tech Vest caiu de 38 MB para 5 MB
  (`scripts/simplificar-modelo.ts`), e a página do produto já baixa o
  avatar do provador quando fica ociosa.
- **Celular:** no "Comparar", os dois tamanhos ficam um embaixo do outro;
  os botões da cena cabem numa linha.
- **Relugar T-Shirt:** usa o mesmo 3D da Boxy Tee 01 e agora também a mesma
  tabela P/M/G/GG (`scripts/copy-size-chart.ts`).

### Limitações conhecidas

- A primeira carga do 3D no `npm run dev` ainda demora (o Next compila a
  página e o avatar é baixado); a partir da segunda é rápida.
- Oversized Shirt e Vestido só têm P/M/G na tabela.
- O gorro tem tamanho único: não muda com a medida da cabeça.

---

## Decisões dos itens 21, 22 e 25

> **Aprovadas pelo grupo em 19/10:** todas as sugestões abaixo.

### Item 21 — Cliente pede troca ou devolução

| # | Pergunta | Sugestão | Por quê |
|---|---|---|---|
| 21.1 | Prazo para **devolver por arrependimento** (dinheiro de volta) | **7 dias** a partir da entrega | É o mínimo do Código de Defesa do Consumidor (art. 49) para compra pela internet |
| 21.2 | Prazo para **trocar tamanho ou cor** | **30 dias** a partir da entrega | Não é obrigação legal; 30 dias é comum no varejo de moda |
| 21.3 | Prazo para **peça com defeito** | **90 dias** a partir da entrega | CDC art. 26 (roupa conta como produto durável) |
| 21.4 | Quando o cliente pode pedir | Só com o pedido **Entregue** | Antes disso ele pode cancelar (item 19) |
| 21.5 | Pode pedir só **uma peça** de um pedido com várias? | **Sim**, escolhendo a peça e a quantidade | É o caso mais comum |
| 21.6 | Motivos da lista | Tamanho não serviu · Cor diferente do esperado · Defeito · Não gostei · Outro (com texto) | O motivo decide o prazo (21.1 a 21.3) |
| 21.7 | Fotos | **Obrigatória para defeito**, opcional nos outros. Até 3 fotos JPG/PNG/WEBP de até 5 MB cada | Mesma nuvem dos modelos 3D (Supabase), numa pasta **privada**: só o cliente dono e o Admin veem |
| 21.8 | Troca por outra peça (não só tamanho/cor da mesma)? | **Não** nesta sprint | Exigiria acertar diferença de preço; fica para depois |
| 21.9 | Quantos pedidos abertos por peça | **Um** por vez | Evita pedido duplicado |

**Detalhe técnico:** hoje o pedido não guarda a **data da entrega**, só que
está "Entregue". Para contar os prazos, o item 21 vai precisar de um campo
novo (`deliveredAt`) numa migration. Pedidos que já estão entregues ficam
com a data da última atualização.

### Item 22 — Admin aprova ou nega

| # | Pergunta | Sugestão |
|---|---|---|
| 22.1 | Situações do pedido de troca | Aberto → Aprovado ou Negado → Peça recebida → Concluído (e "Cancelado pelo cliente" enquanto estiver Aberto) |
| 22.2 | O que o cliente recebe ao ser aprovado | Aviso no sino com as instruções de envio: endereço da loja (do item 25) e prazo de **7 dias** para postar |
| 22.3 | Quem paga o frete da volta | **A loja**, nos casos de defeito e arrependimento (exigência do CDC). Na troca de tamanho/cor, **a loja também** na primeira troca (decisão comercial; o grupo pode mudar) |
| 22.4 | Postagem reversa de verdade (etiqueta do Melhor Envio)? | **Não**: só instruções em texto. A etiqueta reversa exige mais configuração e não cabe até 26/10 |
| 22.5 | Negar exige justificativa? | **Sim**, texto obrigatório, que aparece para o cliente |
| 22.6 | Quando a nova peça sai do estoque (troca) | Na **aprovação**, para garantir que ainda tenha. Se não tiver estoque, o Admin só consegue aprovar como devolução com reembolso |
| 22.7 | Quando a peça devolvida volta ao estoque | Quando o Admin marca **"Peça recebida"** e confirma que está em bom estado (com defeito, não volta) |
| 22.8 | Reembolso | Usa o fluxo da Sprint 4: cartão estorna pelo Stripe; PIX e boleto o Admin devolve por fora e registra |

**Detalhe técnico:** o reembolso da Sprint 4 devolve o **pedido inteiro**.
Devolver uma peça só precisa de **reembolso parcial**: o cálculo e o
estorno parcial no Stripe já estão prontos (`79dd790`, ver "Preparação para
os próximos itens"). Para usar, falta guardar quanto já foi devolvido de
cada pagamento (campo novo, migration). Também é preciso decidir se o frete
da ida é devolvido; a sugestão é devolver só no arrependimento e no defeito.

### Item 24 — relatório de trocas (feito)

Trocas e devoluções por período, com motivo, situação,
tempo até a resposta e valor reembolsado. Mesmo formato de CSV dos outros.

### Item 25 — Configurações da loja

O cronograma pede: dados da loja, políticas de troca e privacidade, prazos
padrão e parâmetros do provador.

| # | Configuração | Valor hoje | Sugestão |
|---|---|---|---|
| 25.1 | Dados da loja: nome, CNPJ, e-mail, telefone e **endereço para devoluções** | Não existe | Editável no painel. Usar CNPJ e endereço **fictícios** (projeto acadêmico) |
| 25.2 | Texto da política de troca | Campo por produto ("Trocas e devoluções" na ficha técnica) | Um texto geral da loja numa página **`/trocas`**, editável no painel; o campo por produto continua para exceções |
| 25.3 | Texto da política de privacidade | Não existe | Página **`/privacidade`**, editável no painel; link no rodapé e no cadastro |
| 25.4 | Prazos de troca (21.1 a 21.3) | — | Editáveis |
| 25.5 | Dias para pagar o boleto | 3 (fixo no código) | Editável (1 a 30) |
| 25.6 | Frete grátis a partir de | R$ 300 (fixo no código) | Editável |
| 25.7 | Limite padrão de estoque baixo para variantes novas | 5 | Editável (as variantes existentes mantêm o seu) |
| 25.8 | Tolerância do indicador de caimento (Justo / Ideal / Folgado) | Não há um número: o indicador usa a faixa mín–máx de cada tamanho na tabela de medidas | Criar uma folga em cm (sugestão: 2 cm) e deixar editável. **Conversar com a Equipe 3D** |

**Detalhe técnico:** as configurações vão numa tabela nova de uma linha só
(migration). As regras que já existem no código estão juntas em
`src/lib/store-settings.ts` (`88f976b`); a tabela nova começa com esses
valores. Quem pode mexer: só o Admin, como o cronograma pede ("nenhum dos
dois acessa financeiro, clientes ou configurações").

### Pergunta solta

- O **Operador de Estoque** deve ver o relatório de **estoque** (sem a parte
  de vendas)? Hoje a tela de relatórios é só do Admin.

---

## Rascunho — política de trocas e devoluções

> Rascunho para o grupo revisar. Os prazos seguem as sugestões acima; se
> mudarem lá, mudam aqui. Projeto acadêmico: não foi revisado por advogado.

**Trocas e devoluções na VESTRA ROOM**

1. **Desistiu da compra?** Você tem **7 dias** a partir do recebimento para
   devolver, sem precisar dizer o motivo. Devolvemos o valor total, frete
   incluso.
2. **Não serviu ou quer outra cor?** Você tem **30 dias** a partir do
   recebimento para trocar pelo mesmo modelo em outro tamanho ou cor,
   enquanto houver estoque. Se não houver, devolvemos o valor da peça.
3. **Veio com defeito?** Você tem **90 dias** a partir do recebimento. Envie
   fotos do defeito ao abrir o pedido. Trocamos a peça ou devolvemos o valor,
   e o frete é por nossa conta.
4. **Como pedir:** em *Perfil → Pedidos*, abra o pedido entregue e escolha
   "Trocar ou devolver". Acompanhe a resposta pelo sino de avisos.
5. **Condições:** a peça deve voltar sem uso, sem lavagem e com a etiqueta
   (exceto em caso de defeito).
6. **Reembolso:** no cartão, o estorno aparece na fatura em até 2 faturas,
   conforme o banco. No PIX ou boleto, devolvemos por PIX em até 10 dias úteis
   depois de recebermos a peça.

## Rascunho — política de privacidade

> Mesmo aviso: rascunho para o grupo revisar, sem revisão jurídica. Os
> serviços citados são os que a loja usa hoje.

**Privacidade na VESTRA ROOM**

1. **O que coletamos:**
   - **Cadastro:** nome, e-mail, telefone e endereço de entrega.
   - **Medidas do corpo:** altura, peso e medidas, só se você preencher o
     perfil de medidas.
   - **Compras:** pedidos, trocas e avaliações.
   - **Cartões salvos:** bandeira, 4 últimos números, validade e nome
     impresso. O número completo nunca fica com a loja; nas compras, o
     cartão é digitado na página do Stripe.
2. **Para que usamos:**
   - entregar seus pedidos;
   - montar o seu avatar no provador e recomendar tamanhos;
   - atender trocas;
   - cumprir obrigações legais.

   Não vendemos seus dados e não usamos suas medidas para publicidade.
3. **Com quem compartilhamos, só o necessário:**
   - Stripe (pagamento);
   - Melhor Envio e transportadoras (entrega);
   - ViaCEP e BrasilAPI (só o CEP digitado, para preencher o endereço);
   - Supabase (armazenamento);
   - Vercel (hospedagem do site).
4. **Medidas do corpo:** só você vê. A equipe da loja não tem acesso a elas,
   nem na tela de clientes.
5. **Seus direitos (LGPD):** ver, corrigir e baixar seus dados; apagar suas
   medidas a qualquer momento em *Perfil → Medidas*; e excluir a conta em
   *Perfil*.
6. **Cookies:** usamos só o necessário para manter você conectado. Não
   usamos cookies de propaganda.
7. **Por quanto tempo guardamos:** enquanto a conta existir. Ao excluir a
   conta, apagamos suas medidas, endereços e sacola e removemos seu nome,
   e-mail e telefone. O histórico de pedidos continua guardado, sem esses
   dados, pelo prazo que a lei fiscal exige.
8. **Contato:** pelo e-mail da loja (definido no item 25).

**Para conferir antes de publicar:**
- O item 5 promete "baixar seus dados", que a loja ainda não faz. O grupo
  pode tirar essa parte ou criar o download.
- **Achado, já corrigido:** excluir a conta não apagava os cartões salvos
  (nome impresso, final e validade ficavam no banco). Agora apaga (ver
  "Correções feitas nesta sprint").
