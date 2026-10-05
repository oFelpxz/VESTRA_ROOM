# Sprint 4 — decisões, testes e pendências

> Registro para apresentação ao professor. Sprint 4 do cronograma (24/09 a
> 07/10, checkpoint em 08/10): compra completa com pagamento e frete reais em
> **modo de teste**, cancelamento com reembolso, dashboard e avatar do cliente.
>
> **Branches** (uma em cima da outra, como nas sprints anteriores):
> `feat/sprint4-cancelamento` (PR #9) → `feat/sprint4-dashboard` (PR #10) →
> `feat/sprint4-pagamento-frete` (PR #11).
>
> **Documentos irmãos:**
> - [`SPRINT4-3D05.md`](SPRINT4-3D05.md): validação do avatar (item 3D-05).
> - [`SPRINT4-CHAVES.md`](SPRINT4-CHAVES.md): como criar as contas de teste
>   do Stripe e do Melhor Envio e colocar as chaves no `.env`.

## Itens da sprint

| Item | Descrição | Situação |
|---|---|---|
| 16 | Pagamento real (Stripe, modo de teste) | ✅ Testado de ponta a ponta em 05/10 |
| 17 | Formas de pagamento: crédito, débito, boleto e carteira digital | ✅ Testado (as quatro); PIX segue simulado |
| 18 | Frete real por CEP (Melhor Envio, sandbox) | ✅ Testado em todas as compras |
| 19 | Cancelar pedido (cliente e Admin) com estoque de volta | ✅ Testado no banco real |
| 20 | Reembolso com aviso ao cliente | ✅ Testado (cartão automático, boleto manual) |
| 28 | Dashboard do Admin e visão do Operador | ✅ Testado na visão do Admin |
| 3D-05 | Avatar gerado pelas medidas, validado em casos-limite | ✅ Ver [`SPRINT4-3D05.md`](SPRINT4-3D05.md) |

Resultados detalhados em "Roteiro de testes → Resultados".

---

## Banco de dados (migration)

`prisma/migrations/20261005120000_sprint4_pagamento_frete_notificacoes`

Mesmas regras da Sprint 3, pelo mesmo motivo (banco **compartilhado pelo
grupo**, com outras branches rodando código antigo):

- **Só aditiva:** nenhum `DROP`, `DELETE` ou `UPDATE`. Todas as colunas novas
  aceitam vazio, então código antigo continua criando pedidos sem conhecê-las.
- **Aplicada com `prisma migrate deploy`**, nunca `migrate dev` (que pode
  oferecer apagar o banco).
- **SQL revisado antes de aplicar.**

| Mudança | Para |
|---|---|
| Valor `WALLET` no tipo `PaymentMethod` | Item 17 (carteira digital) |
| `Payment.checkoutSessionId` (único), `checkoutUrl` | Item 16 (sessão de pagamento do Stripe) |
| `Payment.boletoUrl`, `dueAt` | Item 17 (link e vencimento do boleto) |
| `Payment.refundId`, `refundedAt` | Item 20 (estorno) |
| `Order.shippingService`, `shippingDays` | Item 18 (transportadora e prazo cotados) |
| Tabela `Notification` (índice por usuário + data; apagada junto com o usuário) | Item 20 (avisos ao cliente) |

**Por que `checkoutSessionId` é único:** garante no próprio banco que uma
sessão de pagamento do Stripe nunca fica ligada a dois pedidos.

---

## Item 16 — Pagamento real (Stripe)

**Como funciona para o cliente:** ao finalizar o pedido, ele é levado à página
de pagamento do Stripe (Stripe Checkout). Depois de pagar, volta para a tela
"Pedido enviado" da loja, que mostra a situação do pagamento.

**Decisão: o pedido só vira "Pago" quando o próprio Stripe confirma.** O
navegador do cliente nunca diz "paguei". A confirmação chega por dois
caminhos, e qualquer um deles basta:

1. **Webhook** (`/api/webhooks/stripe`): o Stripe avisa a loja sozinho. A loja
   escuta 4 avisos: pagamento concluído, boleto pago, boleto vencido e página
   de pagamento expirada.
2. **Reconciliação:** quando o cliente volta do Stripe, ou quando abre a página
   do pedido, a loja pergunta ao Stripe como está a sessão. Isso cobre o caso
   de o webhook atrasar ou falhar.

**Decisão de segurança: o conteúdo do webhook não é usado direto.**
- A assinatura (`Stripe-Signature`) é conferida com a chave do webhook. Aviso
  sem assinatura válida é recusado, então ninguém marca pedido como pago
  chamando essa rota por fora.
- Mesmo com assinatura válida, a loja busca a sessão de novo no Stripe e aplica
  o que veio de lá, com a mesma função da reconciliação (`syncCheckoutSession`).
- Se der erro ao aplicar, a rota responde 500 e o Stripe reenvia o aviso depois.

**Decisão: tudo é idempotente.** Webhook e reconciliação podem chegar juntos,
repetidos ou fora de ordem, e o resultado é o mesmo: o pedido é marcado como
pago uma vez só, e só se ainda estiver aguardando pagamento.

**Decisão: a reconciliação tem limite de frequência.** No máximo uma consulta
ao Stripe a cada 10 segundos por pedido, para a tela de acompanhamento não
gerar uma consulta a cada atualização. Na volta do Stripe ela é forçada, para o
cliente ver "Pago" na hora.

**Decisão: a página de pagamento expira em 60 minutos.** Se o cliente abandonar
o pagamento, o pedido é cancelado e o estoque reservado volta. Enquanto não
expira, o pedido mostra o botão **"Pagar agora"** para retomar.

**Decisão: pagamento que chega depois do cancelamento é estornado sozinho.** Se
o cliente pagar uma sessão de um pedido que já foi cancelado (por exemplo, pagou
na mesma hora em que o Admin cancelou), a loja pede o estorno ao Stripe
automaticamente. Ao cancelar, a loja também encerra as sessões de pagamento
ainda abertas daquele pedido, para fechar essa janela.

**Decisão: integração sem a biblioteca oficial do Stripe.** A loja usa poucas
chamadas (criar, consultar e encerrar a sessão de pagamento, cancelar uma
cobrança pendente e estornar), feitas direto na API REST. A conferência de assinatura do webhook foi escrita seguindo
a documentação do Stripe e tem teste automático.

**Decisão do grupo: o pagamento simulado continua como alternativa.** Sem as
chaves do Stripe no `.env`, a loja volta ao pagamento simulado das sprints
anteriores. Assim ninguém do grupo fica travado por não ter conta no Stripe.

---

## Item 17 — Formas de pagamento

| Forma | Como é confirmada | Observação |
|---|---|---|
| Cartão de crédito | Na hora, pelo Stripe | |
| Cartão de débito | Na hora, pelo Stripe | O Stripe usa a mesma tela para crédito e débito; a loja descobre qual foi pelo cartão usado e grava "Cartão de débito" |
| Boleto | Quando o banco compensa (até 2 dias úteis) | Vence em **3 dias**. O pedido mostra o vencimento e o link **"Ver boleto"**. Se vencer sem pagamento, o pedido é cancelado sozinho, o estoque volta e o cliente recebe o aviso |
| Carteira digital | Na hora, pelo Stripe | **Link** (carteira do próprio Stripe), Google Pay e Apple Pay. Google/Apple Pay aparecem só em navegador e aparelho compatíveis. Aparece como "Carteira digital" |
| PIX | Simulado | Ver "Fora do escopo" |

**Decisão: se o Link estiver desligado na conta do Stripe**, a carteira digital
cai para "só cartão", em que o Google Pay e o Apple Pay continuam aparecendo.
A compra não trava por uma configuração do painel.

**Decisão: no modo de teste, o e-mail do boleto vem em branco.** No Stripe de
teste, é o e-mail digitado que decide se o boleto de teste sai **pago** ou
**vencido**. Se a loja preenchesse o e-mail do cliente, não daria para testar
o boleto vencido. Com chave real, o e-mail do cliente volta a ser preenchido.

**Textos em português em todas as telas:** "Cartão de crédito · Pago" em vez de
`CREDIT_CARD · PAID` (antes aparecia assim em "Meus pedidos").

---

## Item 18 — Frete real (Melhor Envio)

**Como funciona:** com o CEP do endereço de entrega, a loja pede ao Melhor
Envio (ambiente de teste, *sandbox*) os preços e prazos das transportadoras, e
mostra duas opções:

| Opção | Regra |
|---|---|
| Econômico | O serviço mais barato (empate: o mais rápido) |
| Expresso | O serviço mais rápido (empate: o mais barato). **Só aparece se chegar antes do Econômico**; senão não há o que oferecer como expresso |

**Decisão: o pedido grava a transportadora e o prazo** (por exemplo,
"Econômico · Jadlog .Com · até 7 dias úteis"). O cliente, o Admin e o Operador
veem exatamente o que foi cotado na compra.

**Decisão: pacote fixo por peça (20 × 4 × 30 cm, 0,4 kg).** Os produtos não têm
peso nem medidas cadastrados. O tamanho usado é o de uma peça de roupa dobrada,
multiplicado pela quantidade.

**Decisão: o checkout nunca trava por causa do frete.** Sem o token do Melhor
Envio, ou se a API cair ou demorar, a loja usa a tabela própria da Sprint 3.

**Decisão do grupo: frete Econômico grátis a partir de R$ 300 continua**, agora
sobre o preço real da transportadora (a loja paga).

**Decisão: cotação guardada por 10 minutos** para o mesmo CEP e carrinho. Evita
chamar o Melhor Envio a cada passo do checkout.

**Segurança (igual à Sprint 3):** o navegador envia só o nome da opção, nunca o
preço. O servidor cota de novo na criação do pedido.

---

## Item 19 — Cancelar pedido

As regras ficam num arquivo só, [`order-cancel.ts`](../src/lib/order-cancel.ts),
usado pelo cliente e pelo Admin.

| Quem | Quando pode cancelar | Estoque |
|---|---|---|
| Cliente | Antes da separação: "Aguardando pagamento" ou "Pago" | Sempre volta |
| Admin | A qualquer momento, inclusive Enviado ou Entregue (pede confirmação) | Antes do envio, sempre volta. Depois do envio, **só se o Admin marcar "A peça já voltou para o depósito"** |
| Operador de Estoque | Não cancela mais | — |

**Decisão: o Operador não cancela.** Cancelar mexe em dinheiro (reembolso), e
isso é papel do Admin. O Operador continua avançando a logística (preparar,
enviar, entregar). O servidor recusa o cancelamento de quem não é Admin, não
só esconde o botão.

**Decisão: o estoque só volta uma vez, mesmo com clique duplo.** A troca de
status é uma operação única no banco, condicionada ao status que a tela mostrou
("cancele só se ainda estiver Pago"). O segundo clique não acha mais o pedido
nesse status e não faz nada. A mesma trava impede que um pedido "ressuscite" se
o Operador avançar o status no mesmo instante em que o Admin cancela.

**Decisão do grupo: o cancelamento devolve o uso do cupom.** Um cupom com limite
de 100 usos volta a ter 1 uso disponível. Acontece uma vez só, e a contagem
nunca fica negativa.

**Decisão: ninguém marca "Pago" à mão.** Antes dava para mudar um pedido de
"Aguardando pagamento" para "Pago" pelo painel. Agora só a confirmação do
pagamento faz isso.

---

## Item 20 — Reembolso com aviso

**Cancelar um pedido pago dispara o reembolso:**

| Forma de pagamento | O que acontece |
|---|---|
| Cartão, débito, carteira | A loja pede o **estorno total ao Stripe** e grava o número do estorno. O pagamento vira "Reembolsado" |
| Boleto | O Stripe não estorna boleto. O pedido mostra **"Reembolso pendente"** e o Admin, depois de devolver o valor por PIX ou transferência, clica em **"Registrar reembolso manual"** |
| Simulado / PIX | Marcado como reembolsado (não há dinheiro de verdade) |

**Decisão: estorno sem risco de sair em dobro.** O pedido de estorno vai com
uma chave de idempotência: se for repetido (clique duplo, nova tentativa), o
Stripe devolve o mesmo estorno em vez de criar outro. Se o valor já tiver sido
estornado direto no painel do Stripe, a loja reconhece e só registra.

**Avisos ao cliente** (sino no cabeçalho e página `/perfil/notificacoes`):
pagamento confirmado, boleto gerado, pedido cancelado (inclusive por boleto
vencido ou pagamento não concluído), pedido cancelado pela loja e reembolso
feito. Cada aviso tem link para o pedido.

**Decisão: o aviso é gravado junto com a mudança do pedido**, na mesma
transação do banco. Não existe pedido cancelado sem aviso, nem aviso de algo
que não aconteceu.

**Decisão: avisos só dentro do site.** Ver "Fora do escopo".

---

## Item 28 — Dashboard

Painel em `/admin`, diferente para cada papel:

| Papel | O que vê |
|---|---|
| Admin | Faturamento, número de vendas e ticket médio (filtro de 7, 30 ou 90 dias); faturamento por dia; pedidos por status; 5 mais vendidos; alertas de estoque baixo; produtos com 3D |
| Operador de Estoque | Só logística: pedidos de hoje, a despachar, em trânsito e estoque baixo. **Não vê faturamento** |
| Equipe 3D | Só a fila de modelos esperando validação. Antes, essa conta via o faturamento da loja |

**Decisão: "venda" é pedido efetivado** (Pago, Preparando, Enviado ou Entregue),
o mesmo critério do "total gasto" da Sprint 3. Cancelados e aguardando
pagamento não contam.

**Decisão: os dias contam no horário de Brasília.** O servidor da Vercel roda
em outro fuso (UTC); sem esse ajuste, o "dia" do painel viraria às 21h.

**Decisão: estoque baixo usa o limite de cada variação** (cadastrável no
estoque, padrão 5), não um número fixo para a loja inteira.

**Decisão: os atalhos do painel só levam a telas que aquele papel pode abrir.**

---

## Item 3D-05 — Avatar do cliente

Documentado à parte em [`SPRINT4-3D05.md`](SPRINT4-3D05.md). Resumo:

- 8 perfis de corpo (de 1,20 m a 2,20 m, até 130 kg) × 3 corpos (neutro,
  masculino, feminino): altura, peito, cintura, quadril, braço e perna ficaram
  a menos de 0,5 cm do pedido nos 24 casos.
- Limitações registradas: ombro estreito sai até 4 cm mais largo; corpos acima
  de ~150 kg ficam até 5 cm abaixo do pedido.
- **Proteção nova:** o servidor recusa medidas fora de uma faixa larga (ex.:
  altura entre 100 e 230 cm). Antes, quem digitava "1,75" (em metros) salvava
  sem aviso e o avatar saía deformado.

---

## Versionamento

- Um commit por item, cada um feito depois de uma revisão linha a linha (o
  "pente fino"):

| Commit | Conteúdo |
|---|---|
| `0971599` | Item 19: cancelamento pelo cliente e pelo Admin |
| `daee4ae` | Correções da revisão do cancelamento |
| `3b3123d` | Item 19: cancelamento devolve o uso do cupom |
| `be9f462` | Item 28: dashboard |
| `26dbe64` | Item 3D-05: avatar validado |
| `b50d9ef` | Itens 16, 17, 18 e 20: Stripe, Melhor Envio, reembolso e avisos |
| `770e914` | Guia das chaves de teste |
| `6eb5131` | Correções achadas nos testes de ponta a ponta |

- **Nenhuma chave no GitHub.** As chaves ficam só no `.env` de cada um, que não
  sobe para o repositório. O GitGuardian (verificação automática de chaves
  vazadas) passou no PR #11.

---

## Problemas encontrados nas revisões e nos testes (e corrigidos)

| Onde | Problema | Gravidade |
|---|---|---|
| Item 19 | **Clique duplo em "Cancelar" devolvia o estoque duas vezes.** Corrigido com a troca de status condicionada (ver item 19). | Alta |
| Item 19 | **Dava para marcar um pedido como "Pago" pelo painel** com uma requisição montada à mão, sem pagamento confirmado. Agora só a confirmação do pagamento faz isso. | Alta |
| Item 19 | O pagamento simulado espera 3 segundos antes de confirmar. Se o cliente cancelasse nesse intervalo, o pedido **voltava para "Pago" com o estoque já devolvido**. | Alta |
| Item 19 | Se o Operador avançasse um pedido no mesmo instante em que o Admin cancelava, o pedido "ressuscitava". | Média |
| Item 19 | A tela "Pedido enviado" ficava para sempre em "Aguardando confirmação…" se o pedido fosse cancelado logo depois da compra. Agora mostra "Pedido cancelado" e para de consultar o servidor. | Média |
| Item 19 | Uma mensagem de erro antiga de cancelamento podia esconder o resultado de uma ação feita depois no painel do pedido. | Baixa |
| Item 28 | A conta da Equipe 3D via o faturamento da loja no painel. | Média |
| Item 28 | Sem o ajuste de fuso, o "dia" do painel virava às 21h (horário de Brasília). | Média |
| 3D-05 | Altura digitada em metros ("1,75") era salva e deformava o avatar. | Média |
| Testes 05/10 | O boleto de teste não deixava escolher o cenário "vencido", porque o e-mail vinha preenchido. | Baixa |
| Testes 05/10 | A tela de confirmação dizia "aguardando a confirmação do pagamento" mesmo quando o pagamento já tinha sido confirmado. | Baixa |
| Testes 05/10 | "Meus pedidos" mostrava `CREDIT_CARD · PAID` em vez de "Cartão de crédito · Pago". | Baixa |

---

## Fora do escopo (conscientemente)

| O quê | Por quê |
|---|---|
| **PIX real** | Decisão do grupo: o PIX continua simulado, como nas sprints anteriores. No Stripe, o PIX depende de liberação da conta da empresa, o que não cabe numa conta de teste acadêmica |
| Cartões salvos no perfil (item 04) ligados ao Stripe | Não cabia até a entrega. Decisão do grupo deixar para depois |
| Estorno automático de boleto | O Stripe não estorna boleto; o reembolso é manual e registrado pelo Admin |
| Peso e medidas por produto | O cadastro não tem esses campos; o frete usa um pacote fixo por peça |
| Avisos por e-mail | Os avisos ficam no site (sino e página de avisos). E-mail exige um serviço de envio, fora do escopo da sprint |
| Geração de etiqueta no Melhor Envio | O item 18 pede prazo e valor; a etiqueta é uma etapa da logística |

---

## Roteiro de testes

**Preparação** (passo a passo completo em [`SPRINT4-CHAVES.md`](SPRINT4-CHAVES.md)):

1. Colocar no `.env` as chaves de teste: `STRIPE_SECRET_KEY` (começa com
   `sk_test_`), `STRIPE_WEBHOOK_SECRET` e `MELHOR_ENVIO_TOKEN`.
2. Deixar uma janela do Terminal rodando o `stripe listen` (o comando completo
   está no guia). **Sem ele, o webhook não chega ao computador**; a
   reconciliação ainda confirma o cartão na volta do Stripe, mas o boleto
   vencido não é percebido.
3. Rodar a loja (`npm run dev`) e entrar com uma conta de cliente.

**Dados de teste do Stripe** (não cobram nada):

| Cenário | O que usar na página do Stripe |
|---|---|
| Cartão de crédito | `4242 4242 4242 4242`, validade futura, qualquer CVC |
| Cartão de débito | `4000 0566 5566 5556`, validade futura, qualquer CVC |
| Boleto pago | E-mail `succeed_immediately@teste.com` e um CPF válido |
| Boleto vencido | E-mail `expire_immediately@teste.com` e um CPF válido |
| Carteira digital | Escolher Link e informar um telefone; o código de confirmação no teste é `000000` |

**Passos:**

1. Adicionar uma peça à sacola e ir ao checkout. Conferir o frete com
   transportadora e prazo reais.
2. Pagar com cada forma da tabela acima, uma compra por vez. Depois de cada
   uma, conferir a tela "Pedido enviado", "Meus pedidos" e o sino de avisos.
3. Como Admin, cancelar o pedido pago com cartão: conferir o estorno e o aviso.
4. Como Admin, cancelar o pedido pago com boleto: conferir "Reembolso
   pendente" e registrar o reembolso manual.
5. Como cliente, cancelar um pedido "Aguardando pagamento" com clique duplo:
   o estoque volta uma vez só.
6. Abrir `/admin` como Admin e conferir os números com a lista de pedidos.

### Resultados (05/10/2026, banco real, localhost:3000, Stripe em modo de teste)

| Teste | Pedido | Resultado |
|---|---|---|
| Cartão de crédito | #8MLXGG94 | ✅ Pago |
| Cartão de débito | #PRVIPD2J | ✅ Pago, gravado como "Cartão de débito" |
| Boleto pago | #AJ69M56Z | ✅ Pago, com vencimento e link "Ver boleto" |
| Boleto vencido | #H2DPSRIX | ✅ Cancelado sozinho, pagamento "Não concluído", estoque de volta e aviso "O boleto venceu sem pagamento" |
| Carteira digital (Link) | #UY2W9NC8 | ✅ Pago, exibido como "Carteira digital" |
| Admin cancela o pedido pago no cartão | #8MLXGG94 | ✅ Estorno feito no Stripe, pedido "Reembolsado", 2 avisos ao cliente, estoque de volta |
| Admin cancela o boleto pago | #AJ69M56Z | ✅ "Reembolso pendente" → "Registrar reembolso manual" → "Reembolsado", estoque de volta |
| Frete (Melhor Envio) | Todos | ✅ "Econômico · Jadlog .Com · até 7 dias úteis", R$ 13,43 |
| Webhooks | Todos | ✅ Todos os avisos do Stripe aceitos pela loja (resposta 200) |

Testes anteriores do mesmo dia (antes do Stripe):

| Teste | Resultado |
|---|---|
| Cliente cancela pedido pago com clique duplo | ✅ Cancelado; estoque 7 → 8, uma vez só |
| Admin cancela pedido Enviado sem marcar "a peça voltou" | ✅ Pediu confirmação, cancelou e o estoque ficou em 7 |
| Dashboard do Admin | ✅ 7 vendas somando R$ 1.833,55, igual à soma dos pedidos pagos na lista de pedidos |

**Não testado no navegador:** as visões do Operador e da Equipe 3D no
dashboard, e a recusa de cancelamento pelo Operador, porque precisam do login
dessas contas. As regras de permissão estão cobertas pelos testes automáticos e
são conferidas no servidor.

**Pedidos de teste que ficaram no banco** (conta do Admin): os 7 pedidos acima,
mais #JNGCKP39 e #RYQ5AAEZ (testes de cancelamento). Todos cancelados ou pagos
em modo de teste; o estoque foi conferido depois de cada cancelamento.

---

## Validação automática

- **107 testes automáticos** passando (`npm test`), entre eles: regras de
  cancelamento, conferência de assinatura do webhook, decisão do pagamento a
  partir da sessão do Stripe, escolha de Econômico/Expresso e cálculo do
  dashboard.
- Checagem de tipos (TypeScript) e lint sem erros.

---

## Pendências

| O quê | Situação |
|---|---|
| **Chaves na Vercel** | A loja publicada ainda usa o pagamento simulado e a tabela de frete própria, porque as chaves estão só no `.env` local. Falta cadastrá-las na Vercel e registrar o webhook da loja publicada no painel do Stripe (com outro `whsec_`) |
| **Merge dos PRs** | Os PRs #2 a #11 seguem abertos; nada entrou na `main`. Precisam ser revisados e juntados em ordem, porque cada branch sai da anterior |
| Título do PR #11 | Ficou cortado pelo GitHub. Sugestão: `feat(sprint4): pagamento real (Stripe), frete real (Melhor Envio) e reembolso com aviso` |
