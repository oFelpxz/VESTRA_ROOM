# Entrega final (26/10) — roteiro da apresentação

> Roteiro para mostrar a VESTRA ROOM ao professor em cerca de **12 minutos**,
> com foco no que a Sprint 5 trouxe: provador com peça de cima e de baixo,
> looks com foto, trocas e devoluções. Decisões e resultados dos testes em
> [`SPRINT5-DECISOES.md`](SPRINT5-DECISOES.md); o roteiro da Sprint 4
> (frete, cartão, boleto, reembolso) continua em
> [`SPRINT4-ROTEIRO-APRESENTACAO.md`](SPRINT4-ROTEIRO-APRESENTACAO.md).

## Antes de começar (15 min antes)

**Onde rodar:** no computador de quem apresenta, com `npm run dev` (o painel
"Simular corpo" do provador só aparece em modo dev). Se for mostrar cartão ou
boleto, deixar também o `stripe listen` aberto (comando em
[`SPRINT4-CHAVES.md`](SPRINT4-CHAVES.md)). O PIX simulado não precisa dele.

**Duas janelas do navegador, lado a lado:**

| Janela | Conta | Para quê |
|---|---|---|
| Normal | Cliente de teste (`cliente@vestra.room`) | Provador, looks, compra, devolução |
| Anônima | Admin de teste (`admin@vestra.room`) | Pedidos, trocas, relatórios, configurações |

As senhas ficam em `prisma/seed.ts` (não copiar para slides nem para este
arquivo).

**Conferir antes:**
- [ ] O cliente tem **medidas preenchidas** (`/perfil/medidas`) e um endereço.
- [ ] A peça da compra tem estoque (ex.: Boxy Tee 01 numa cor e tamanho com
  estoque).
- [ ] Abrir uma vez o provador da Boxy Tee 01, da Cargo Pant 02 e do Vestido
  Slip Acetinado: a primeira carga demora mais, depois fica em cache.
- [ ] Ter pelo menos **um look salvo** (com foto) para não depender de salvar
  ao vivo.
- [ ] Navegador em tela cheia, zoom 100%.

---

## Roteiro (≈ 12 min)

### 1. Catálogo com busca (1 min)

**Cliente:** abrir `/catalogo`.

- Digitar **"cargo"** na Pesquisa do topo → só a Cargo Pant 02.
- Clicar numa categoria: a busca continua valendo.
- O **Cesto** no topo mostra a quantidade real da sacola e leva para ela.
- **Falar:** a busca procura em nome, descrição, coleção e material, sem
  diferenciar maiúsculas.

### 2. Provador: peça de cima e de baixo juntas · 3D-06 (3 min)

**Cliente:** abrir a Boxy Tee 01 → "Experimentar virtualmente".

- O avatar já vem com as medidas do cliente e o **tamanho sugerido**
  (3D-08), com a frase de que é uma estimativa.
- Mostrar o **caimento por região** (tórax, ombros, cintura, quadril, manga,
  barra) e trocar de tamanho: as cores das regiões mudam.
- Em "Montar look", escolher a **Cargo Pant 02**: a calça aparece no avatar,
  por baixo da camiseta.
- Trocar a calça por **Bermuda Utility**, **Wide Denim** e **Saia Midi
  Plissada**.
- Em "Acessório", pôr o **Knit Beanie**: o gorro entra como 3ª peça do look.
- (Se der tempo) abrir o **Vestido Slip Acetinado**: ocupa cima e baixo do
  look; e a **Oversized Shirt**, mais larga e comprida que a Boxy Tee.
- Trocar o tamanho da calça: um tamanho maior fica mais largo e mais longo;
  um menor fica justo no quadril e mais curto.
- **Falar:** os moldes foram feitos no Blender a partir do próprio avatar, por
  script (`scripts/molde/`). A peça de baixo acompanha a pele do cliente, a
  folga vem da diferença de quadril e o comprimento vem da perna.

### 3. Corpo diferente (1 min)

No painel **"Simular corpo (dev)"**, trocar para corpo de **Mulher** e mexer em
quadril e altura: avatar, calça e saia acompanham.

- **Falar:** o caimento é uma aproximação geométrica, não uma simulação de
  tecido. Por isso abre rápido no navegador.

### 4. Comparar dois tamanhos · 3D-07 (1 min)

"Comparar lado a lado com" → escolher outro tamanho (ex.: Saia P × G, ou
Tee M × GG com a calça junto).

- Dois avatares, cada um num tamanho, e a tabela região por região embaixo.

### 5. Salvar o look com foto · item 15 (1,5 min)

- Dar um nome ao look e salvar.
- Abrir **Minha conta → Looks**: o look aparece com a **foto do avatar
  vestido**.
- Mostrar "Abrir no provador" (volta com as duas peças) e "Adicionar o look
  à sacola" (entram as duas, ou nenhuma se faltar estoque).

### 6. Compra com PIX simulado (1,5 min)

Com a peça na sacola: **Finalizar compra** → endereço → **PIX**.

- Na página de sucesso o pagamento vira **Pago em ~3 s**, sozinho.
- **Falar:** o PIX é simulado (não há provedor de PIX real); cartão e boleto
  passam pelo Stripe em modo teste (roteiro da Sprint 4).

### 7. Admin: pedido e logística (1 min)

**Admin:** `/admin/pedidos` → o pedido novo está **Pago**.

- **Iniciar preparação** → **Marcar como enviado** (exige código de
  rastreio, ex.: `BR123456789`).
- **Cliente:** o aviso do envio aparece e o pedido mostra a linha do tempo.

### 8. Troca ou devolução · itens 21 e 22 (1,5 min)

Usar um pedido **já entregue** do cliente.

- **Cliente:** pedir devolução. A tela mostra os prazos (arrependimento,
  tamanho/cor e defeito); no defeito a foto é obrigatória.
- **Admin:** aprovar → marcar peça recebida (o estoque volta se a peça está em
  bom estado) → devolver o valor.

### 9. Relatórios e configurações · itens 24 e 25 (0,5 min)

- `/admin/relatorios`: vendas, estoque e trocas por período; baixar um CSV.
- `/admin/configuracoes`: prazos de troca, frete grátis e tolerância do
  caimento. Os prazos aparecem na hora em `/trocas`.

---

## Se perguntarem

| Pergunta | Resposta curta |
|---|---|
| A roupa é simulada como tecido? | Não. É um encaixe geométrico em cima do corpo do cliente, que roda no navegador sem travar. |
| De onde vêm as medidas das peças? | Da tabela de medidas de cada produto (cadastrada no banco). |
| Por que "estimativa"? | O avatar é paramétrico (medidas digitadas, não escaneamento). |
| E as senhas e chaves? | Ficam fora do Git, em `.env`. As chaves do Stripe são de modo teste. |

## Limitações conhecidas (evitar ao vivo)

- A primeira carga do 3D é mais lenta; por isso abrir os provadores antes.
- Oversized Shirt e Vestido só têm P/M/G; o gorro é tamanho único.

## Plano B

- [x] Prints de cada passo: [`apresentacao/`](apresentacao/README.md)
  (13 prints, com a tabela de qual passo cada um mostra).
- [ ] Vídeo curto (~3 min) do provador e da compra.
