# Sprint 4 — roteiro da apresentação

> Roteiro para mostrar a Sprint 4 ao professor em cerca de **10 minutos**.
> As decisões e os resultados completos estão em
> [`SPRINT4-DECISOES.md`](SPRINT4-DECISOES.md); este arquivo é só a ordem do
> que mostrar e o que falar.

## Antes de começar (10 min antes)

**Onde rodar:**
- **Opção A, site publicado:** a prévia da Sprint 4 na Vercel
  (`vestra-room-git-feat-sprint4-pagamen-fcd197-o-felpxz-s-projects.vercel.app`).
  Só funciona depois que as chaves estiverem na Vercel e o login da Vercel nas
  prévias estiver desligado (ver "Pendências" no documento de decisões).
- **Opção B, computador de quem apresenta:** `npm run dev` e, numa janela do
  Terminal **que fica aberta**, o `stripe listen` (comando em
  [`SPRINT4-CHAVES.md`](SPRINT4-CHAVES.md)). Sem o `stripe listen` o cartão
  ainda é confirmado na volta do Stripe, mas o boleto não.

**Duas janelas do navegador, lado a lado:**

| Janela | Conta | Para quê |
|---|---|---|
| Normal | `cliente@vestra.room` | Comprar, ver avisos, cancelar |
| Anônima | `admin@vestra.room` | Painel, cancelar com reembolso |

As senhas das contas de teste estão em `prisma/seed.ts`. Contas do Operador e
da Equipe 3D: `estoque@vestra.room` e `modelador@vestra.room`.

**Conferir antes:**
- [ ] A peça que vai ser comprada tem estoque (ex.: Boxy Tee 01, numa cor e tamanho com estoque).
- [ ] A conta do cliente tem um endereço cadastrado.
- [ ] O painel do Stripe aberto numa aba, na **Área restrita** (para mostrar o
  pagamento e o estorno do lado do Stripe).
- [ ] A tabela de dados de teste abaixo à mão (impressa ou noutra tela).

**Dados de teste do Stripe** (nada é cobrado de verdade):

| Cenário | O que digitar na página do Stripe |
|---|---|
| Cartão de crédito | `4242 4242 4242 4242`, validade futura, qualquer CVC |
| Cartão de débito | `4000 0566 5566 5556`, validade futura, qualquer CVC |
| Boleto pago | E-mail `succeed_immediately@teste.com` e um CPF válido |
| Boleto vencido | E-mail `expire_immediately@teste.com` e um CPF válido |

---

## Roteiro (≈ 10 min)

### 1. Frete real · item 18 (1 min)

**Cliente:** colocar a peça na sacola e ir ao checkout.

- Mostrar o frete com **transportadora e prazo reais**, vindos do Melhor Envio
  pelo CEP (ex.: "Econômico · Jadlog .Com · até 7 dias úteis").
- **Falar:** se o Melhor Envio cair, a loja usa a tabela própria e o checkout
  não trava. O navegador nunca manda o preço do frete; o servidor cota de novo.

### 2. Pagamento com cartão · itens 16 e 17 (2 min)

**Cliente:** escolher cartão, finalizar e pagar no Stripe com o `4242…`.

- Na volta: "Pedido enviado … **e o pagamento já foi confirmado**".
- Mostrar o **sino** no cabeçalho: aviso "Pagamento confirmado · Pedido #…".
- **Falar:** o pedido só vira "Pago" quando o **Stripe** confirma, por aviso
  assinado (webhook) ou por consulta direta. O navegador do cliente nunca diz
  "paguei". Avisos repetidos não pagam duas vezes.
- (Opcional) Mostrar o pagamento no painel do Stripe.

### 3. Boleto · item 17 (1,5 min)

**Cliente:** nova compra com boleto e o e-mail `expire_immediately@…`.

- O pedido mostra o vencimento e o link "Ver boleto"; em instantes ele é
  **cancelado sozinho**, o estoque volta e chega o aviso "O boleto venceu sem
  pagamento".
- **Falar:** boleto vence em 3 dias; o e-mail de teste é o jeito do Stripe
  simular o banco. Débito e carteira digital (Link, Google Pay, Apple Pay)
  também foram testados; os resultados estão no documento.

### 4. Cancelamento e reembolso · itens 19 e 20 (2 min)

**Admin:** abrir o pedido pago no cartão (passo 2) e clicar em **Cancelar
pedido**.

- Pede confirmação; o pagamento vira **"Reembolsado"** com o número do estorno.
- **Cliente:** o sino mostra "Pedido #… cancelado pela loja" e "Reembolso de R$ …".
- (Opcional) No painel do Stripe, o pagamento aparece estornado.
- **Falar:**
  - O cliente cancela sozinho até a separação; o Admin a qualquer momento.
    Depois do envio, o estoque só volta se o Admin marcar que a peça voltou.
  - Clique duplo não devolve estoque duas vezes nem estorna duas vezes.
  - O cupom usado volta a ter o uso disponível.
  - Boleto não tem estorno no Stripe: o Admin devolve por PIX e registra o
    reembolso manual.

### 5. Dashboard · item 28 (1,5 min)

**Admin:** abrir `/admin`.

- Faturamento, vendas e ticket médio com o filtro de **7, 30 e 90 dias**;
  gráfico por dia; pedidos por status; mais vendidos; estoque baixo; produtos
  com 3D.
- **Falar:** cada papel vê um painel diferente. O **Operador** vê só logística
  (sem faturamento) e não consegue cancelar pedido; a **Equipe 3D** vê só a
  fila de modelos. Os dias contam no horário de Brasília.
- (Se sobrar tempo) Entrar como `estoque@vestra.room` e mostrar o painel dele.

### 6. Avatar com as medidas · item 3D-05 (1,5 min)

**Cliente:** abrir `/perfil/medidas`.

- Digitar a altura `1,75` (em metros, um erro comum): a loja recusa e explica
  a faixa (100 a 230 cm).
- Abrir o provador (VESTRA FIT) e mostrar o avatar com as medidas do cliente.
- **Falar:** testado com 8 corpos diferentes nos 3 tipos de corpo, todos a
  menos de 0,5 cm das medidas pedidas. As limitações (ombro estreito e corpos
  acima de ~150 kg) estão em [`SPRINT4-3D05.md`](SPRINT4-3D05.md).

---

## Perguntas prováveis

| Pergunta | Resposta curta |
|---|---|
| Por que o PIX continua simulado? | Decisão do grupo: no Stripe, o PIX depende de liberação da conta da empresa, o que não cabe numa conta de teste acadêmica |
| E se o aviso do Stripe (webhook) não chegar? | A loja também consulta o Stripe quando o cliente volta e quando abre o pedido. Se der erro, o Stripe reenvia o aviso |
| Alguém consegue marcar um pedido como pago "por fora"? | Não. O aviso sem assinatura válida é recusado, e mesmo o assinado é conferido de novo no Stripe. Não existe mais botão "marcar como pago" |
| E se o cliente pagar um pedido que já foi cancelado? | A loja estorna sozinha |
| Onde ficam as chaves? | Só no `.env` de cada um e nas configurações da Vercel. Nunca no GitHub; o GitGuardian confere isso em cada PR |
| Por que o frete usa um pacote fixo? | Os produtos não têm peso e medidas cadastrados; usamos uma peça dobrada (20 × 4 × 30 cm, 0,4 kg) por item |
| Os avisos vão por e-mail? | Não, só no site (sino e página de avisos). E-mail ficou fora do escopo |

## Se algo falhar na hora

| Problema | O que fazer |
|---|---|
| O site publicado não abre ou pede login | Usar a Opção B (computador de quem apresenta) |
| O pagamento fica em "Aguardando confirmação" | Conferir se o `stripe listen` está rodando (Opção B). Recarregar a página do pedido força a consulta ao Stripe |
| Internet lenta ou Stripe fora do ar | Mostrar a tabela "Resultados" de [`SPRINT4-DECISOES.md`](SPRINT4-DECISOES.md), com os números dos pedidos testados em 05/10, e os mesmos pedidos no painel |
| A peça esgotou durante a demo | Usar outra cor ou tamanho; os cancelamentos devolvem o estoque |
