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
> Este documento tem duas partes: o que já foi feito, e as **decisões que o
> grupo precisa tomar** antes dos itens 21, 22 e 25 (com rascunhos das
> políticas de troca e de privacidade, para o grupo revisar).

## Itens da sprint

| Item | Descrição | Situação |
|---|---|---|
| 15 | Salvar looks (combinação de peças no provador) | ⏳ Grupo decidiu: **uma peça de cima + uma de baixo, sem camadas**. Depende de a Equipe 3D entregar uma parte de baixo com molde |
| 21 | Cliente pede troca ou devolução | ⏳ Esperando as decisões abaixo |
| 22 | Admin aprova ou nega a troca | ⏳ Esperando as decisões abaixo |
| 24 | Relatórios por período com CSV | ✅ Vendas e estoque feitos (`6702237`). O de **trocas** fica para depois do item 21 |
| 25 | Configurações da loja | ⏳ Esperando as decisões abaixo |
| 3D-06, 3D-07, 3D-08 | Provador | ⏳ Equipe 3D |

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

---

## Decisões que o grupo precisa tomar

Cada linha tem uma **sugestão**. Basta o grupo aprovar ou trocar.

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
Devolver uma peça só precisa de **reembolso parcial** (o Stripe aceita, mas
o código ainda não faz). Também é preciso decidir se o frete da ida é
devolvido; a sugestão é devolver só no arrependimento e no defeito.

### Item 24 — falta o relatório de trocas

Depois do item 21: trocas e devoluções por período, com motivo, situação,
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
(migration). Quem pode mexer: só o Admin, como o cronograma pede ("nenhum dos
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
