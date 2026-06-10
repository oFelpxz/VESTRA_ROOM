# Tarefas Manuais

Coisas que precisam ser feitas **fora do código** (configuração, dados, ambiente, design)
para que o MVP funcione de ponta a ponta. Atualizado conforme aparecem novas pendências
durante a implementação.

---

## Infraestrutura / Ambiente

### [ ] Definir NEXT_PUBLIC_BASE_URL no .env (opcional)
- **Por quê**: o checkout dispara o webhook simulado em `${BASE_URL}/api/payments/simulate`. Em dev, default `http://localhost:3000` já funciona.
- **Quando**: antes de subir para staging/produção
- **Exemplo**: `NEXT_PUBLIC_BASE_URL=https://vestraroom.com`



### [ ] Restaurar projeto Supabase
- **Status**: pendente (banco estava pausado em 08/06)
- **Ação**: acessar https://supabase.com/dashboard, clicar em "Restore project" no projeto `gmegjohpfsmskfstlscf`
- **Quando**: agora, antes de continuar testando
- **Origem**: erro `tenant/user postgres.gmegjohpfsmskfstlscf not found`

### [ ] Garantir migrations aplicadas no banco atual
- **Ação**: rodar `npx prisma migrate deploy` (se trocou de projeto Supabase)
- **Quando**: assim que confirmar que o banco voltou
- **Origem**: schema atual depende das migrations existentes em `prisma/migrations`

### [ ] Rodar seed
- **Ação**: `npm run db:seed`
- **Quando**: após migrations rodarem
- **Origem**: cria usuários base, categorias, produtos demo

---

## Dados de teste / Seed

### [ ] Criar usuário ADMIN
- **Email**: definir (ex: `admin@vestraroom.com`)
- **Senha**: definir (forte, anotar em local seguro)
- **Onde**: editar `prisma/seed.ts` se não tiver
- **Quando**: antes da apresentação final

### [ ] Criar usuário STOCK_OPERATOR
- **Necessário para**: doc 06 (gestão de logística)
- **Email/senha**: definir

### [ ] Criar usuário MODEL_3D
- **Necessário para**: doc 02 (upload por equipe 3D sem ser ADMIN)
- **Email/senha**: definir

### [ ] Criar usuário CUSTOMER de demo
- **Com perfil de medidas preenchido** (necessário pro provador virtual da S4)
- **Necessário para**: doc 04 + roteiro da apresentação

### [ ] Cadastrar categorias reais
- **Quando**: antes de cadastrar produtos
- **Sugestão**: Camisetas, Moletons, Calças, Bermudas, Acessórios

### [ ] Cadastrar 5+ produtos demo
- **Pelo menos 2** com variantes, imagens e modelo 3D validado
- **Quando**: antes da S5
- **Quem**: admin via UI (já implementada)

---

## Modelos 3D / Assets

### Pós-MVP: trocar avatar primitivo por GLB com morph targets
- **Status atual**: avatar do provador é montado com primitivas Three.js (cápsulas/esferas escaladas pelas medidas) — funciona, mas é estilizado
- **Próximo passo**: substituir por modelo realista. Opções já discutidas:
  - **MakeHuman**: gerar avatar no app desktop, exportar GLB com morph targets → ~1h
  - **SMPL/SMPL-X pré-cozido**: gerar offline N variações via Python, baixar pesos da Max Planck → ~3-4h primeira vez
  - **Meshcapade API**: comercial, gera por API → instantâneo, custa US$ por avatar
- **Quando precisar**: ao decidir levar pra produção ou se feedback da demo pedir mais realismo
- **Arquitetura preparada**:
  - `src/lib/avatar-builder.ts` já calcula pesos por região do corpo
  - `src/components/viewer-3d/avatar.tsx` é o único arquivo que precisa trocar
  - Substituir as primitivas por `useGLTF` + `mesh.morphTargetInfluences` aplicando os mesmos pesos
- **Local final**: `public/models/avatar_base.glb`

### [ ] Modelar/exportar mais roupas em .glb
- **Necessário para**: ter variedade na demo do provador
- **Já temos**: `hoodie_black.glb`
- **Faltam**: mais 2-3 peças para mostrar troca de produto no provador

### [ ] Modelar/exportar roupas em .glb
- **Necessário para**: ter produtos com provador funcionando
- **Já temos**: `hoodie_black.glb`
- **Faltam**: mais 2-3 peças pra variedade na demo
- **Quem**: equipe 3D

### [ ] Hospedar imagens dos produtos
- **Status atual**: URL livre no banco (`ProductImage.url`)
- **Opções**:
  - Continuar com `public/images/...` (simples, MVP)
  - Subir pra Supabase Storage / Cloudinary (escalável)
- **Decisão**: definir até a S4

---

## UX / Conteúdo

### [ ] Definir copy oficial das telas críticas
- Home / hero
- Termos de uso do perfil de medidas
- Texto de boas-vindas pós-cadastro
- Emails transacionais (se implementar)

### [ ] Tabela de medidas padrão para os produtos
- **Onde**: `/admin/medidas` (já implementada)
- **Quem**: alguém com referência de modelagem
- **Necessário para**: indicador de caimento do provador virtual

---

## Pagamento

### [ ] Integração real de pagamento (pós-MVP)
- **Status**: doc 03 usa `provider = SIMULATED`
- **Quando real**: definir prazo pós-apresentação
- **Provider candidato**: Mercado Pago (PIX nativo, fácil onboarding BR)

### [ ] Cadastro nas plataformas de pagamento
- Necessário ANTES da integração real
- Documentos: CNPJ, conta bancária PJ

---

## Apresentação Final (S5)

### [ ] Banco de dados snapshot
- **Por quê**: poder dar reset rápido se algo quebrar na demo
- **Como**: dump SQL antes de começar a apresentação

### [ ] Vídeo de fallback
- **Gravar** o fluxo completo (~3 min) na véspera
- **Por quê**: se internet ou banco falhar ao vivo

### [ ] Screenshots de cada tela
- **Por quê**: backup pro slide deck

### [ ] Roteiro impresso
- Imprimir o checklist do [07-apresentacao-final.md](./07-apresentacao-final.md)

---

## Decisões pendentes (revisar com o time)

### [ ] Prazo real da apresentação
- **Original**: 08/06
- **Hoje**: 08/06 — execução está em fim de S2 / começo de S3
- **Decisão necessária**: empurrar data OU reduzir escopo da demo

### [ ] Escopo do provador virtual no MVP
- Avatar **fiel** (precisa equipe 3D mais tempo) vs **escala simples** (mais rápido, menos preciso)
- **Recomendação atual**: escala simples, marcar precisão como melhoria pós-MVP

### [ ] Pagamento sandbox vs simulado
- **Sandbox** = Mercado Pago/Stripe em modo teste com API real
- **Simulado** = só `SIMULATED` no banco, sem chamada externa
- **Decisão atual no doc 03**: simulado (mais simples pra MVP)

---

## Testes manuais a executar

Conforme docs são entregues, validar manualmente os fluxos.
Marcar quando rodar e confirmar OK.

### Doc 01 — Admin Produtos
- [ ] Criar produto em DRAFT (admin)
- [ ] Adicionar variantes + imagens
- [ ] Publicar e ver no /catalogo
- [ ] SKU duplicado → erro
- [ ] URL de imagem inválida → erro
- [ ] CUSTOMER bloqueado em /admin/produtos

### Doc 02 — Admin Modelos 3D
- [ ] Upload de .glb < 25MB OK
- [ ] Arquivo salvo em public/models/{slug}-v1.glb
- [ ] Viewer carrega e mostra triângulos/materiais
- [ ] Aprovar → Product.has3DModel = true
- [ ] Reupload cria v2 e zera has3DModel
- [ ] .png rejeitado
- [ ] CUSTOMER bloqueado em /admin/modelos-3d

### Doc 03 — Checkout Sandbox
- [ ] Stepper navega entre as 3 etapas
- [ ] Endereço novo é criado e selecionado automaticamente
- [ ] Frete grátis acima de R$ 300
- [ ] Estoque insuficiente bloqueia a finalização e lista itens
- [ ] PIX simulado → status muda pra PAID em ~3s sem refresh manual
- [ ] Estoque das variantes decrementa após confirmar
- [ ] Carrinho original vira CONVERTED e novo carrinho criado vazio
- [ ] Não logado vai pra /login?next=/checkout

### Doc 04 — Provador virtual
- [ ] Cliente sem medidas é levado para /perfil/medidas
- [ ] Cliente sem aceite de termos é levado para /perfil/medidas
- [ ] Produto sem 3D validado → tela "Provador indisponível"
- [ ] Avatar carrega e escala visivelmente conforme medidas do usuário
- [ ] Roupa carrega sobre o avatar
- [ ] Trocar cor altera a cor do tecido na cena
- [ ] Trocar tamanho atualiza o indicador de caimento (Justo/Ideal/Folgado)
- [ ] Preferência Slim/Regular/Oversized desloca a percepção de caimento
- [ ] Detalhes do caimento mostram diferença em cm por eixo (peito/cintura/quadril)
- [ ] "Adicionar à sacola" usa a variante (cor+tamanho) correta
- [ ] CTA "Experimentar no VESTRA FIT" só aparece em produtos com 3D validado

### Doc 06 — Gestão de logística
- [ ] STOCK_OPERATOR consegue logar e ver apenas Painel/Pedidos/Estoque (menu filtrado)
- [ ] Lista de pedidos default mostra apenas PAID/PREPARING/SHIPPED
- [ ] Busca por nome/email do cliente funciona
- [ ] PAID → PREPARING via botão
- [ ] PREPARING → SHIPPED exige tracking code (sem código → erro)
- [ ] SHIPPED → DELIVERED OK
- [ ] Transição inválida (ex: PAID → DELIVERED) bloqueada
- [ ] Cancelar via admin devolve estoque
- [ ] Estoque editado inline atualiza o painel (estoque baixo desaparece)
- [ ] Mudança no admin reflete em /perfil/pedidos do cliente em até 10s
- [ ] Dashboard mostra Pedidos hoje, A despachar, Estoque baixo, Faturamento mês
- [ ] CUSTOMER não acessa /admin/pedidos nem /admin/estoque

### Doc 05 — Acompanhamento de pedido
- [ ] /perfil/pedidos lista todos os pedidos do user
- [ ] Filtros funcionam (Pago / Enviado / etc)
- [ ] Detalhe mostra timeline coerente com o status
- [ ] Refresh automático puxa novos status sem F5
- [ ] Cancelar pedido devolve estoque
- [ ] User não vê pedidos de outros users
- [ ] /perfil mostra contagem real de pedidos/endereços

---

## Como manter este arquivo

- Quando aparecer algo manual durante a implementação, **adicionar aqui imediatamente**
- Marcar `[x]` quando concluído
- Mover seções para a parte de baixo (ou deletar) quando virarem realidade no código
- Antes de cada apresentação/entrega, varrer este arquivo do topo
