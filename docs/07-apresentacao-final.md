# 07 — Apresentação Final do MVP

**Semana 5**
**Objetivo**: Demo end-to-end mostrando todos os atores e fluxos integrados.

## Roteiro da demo

### Cenário: Visitante → Cliente → Compra com provador 3D

**Ator 1 — Visitante** (não logado)
1. Abre home → vê hero + destaques
2. Navega pro `/catalogo`, filtra por categoria
3. Clica em produto → vê página com viewer 3D estático
4. Tenta adicionar ao carrinho → redirecionado pra login
5. Faz cadastro (`/cadastro`) → preenche dados básicos

**Ator 2 — Cliente novo**
6. Preenche perfil de medidas em `/perfil/medidas` + aceita termos
7. Volta no produto → clica "Experimentar virtualmente"
8. Provador carrega: avatar escalado + roupa
9. Troca tamanho → vê indicador de caimento mudar
10. Caimento "IDEAL" → adiciona ao carrinho
11. Vai pro carrinho → "Finalizar compra"
12. Cadastra endereço → revisa → escolhe PIX
13. Tela de sucesso: aguarda ~3s → status muda pra PAID

**Ator 3 — Admin** (em outra aba/janela)
14. Acessa `/admin` → dashboard mostra +1 pedido
15. Vai em `/admin/pedidos` → vê pedido novo em PAID
16. Clica "Iniciar preparação" → status PREPARING
17. Adiciona tracking code "BR123456789" → "Marcar como enviado"

**Ator 4 — Cliente (de volta)**
18. Vai em `/perfil/pedidos/[id]` → timeline mostra SHIPPED + código rastreio

**Bônus — Admin de catálogo/3D**
19. `/admin/produtos/novo` → cadastra produto + variante
20. `/admin/modelos-3d/[productId]` → upload de novo `.glb`
21. Valida o modelo → produto vira disponível na loja

## Pré-demo: checklist técnico

### Dados de seed
- [ ] Usuário ADMIN (admin@loja.com / senha)
- [ ] Usuário STOCK_OPERATOR
- [ ] Usuário MODEL_3D
- [ ] Usuário CUSTOMER de teste (com medidas preenchidas)
- [ ] 3+ categorias
- [ ] 5+ produtos, ao menos 2 com modelo 3D VALIDATED
- [ ] Variantes com estoque suficiente pra demo
- [ ] 1 pedido histórico já entregue (pra mostrar timeline)

### Ambiente
- [ ] `.env` com `DATABASE_URL` apontando pra banco limpo da demo
- [ ] `npm run db:seed` rodado
- [ ] `npm run build` passando sem erro
- [ ] `npm run start` em produção (não dev) — performance melhor
- [ ] Modelos `.glb` em `public/models/` carregados
- [ ] Browser testado: Chrome desktop, resolução 1920×1080

### Smoke test (rodar antes da apresentação)
- [ ] Login/logout em <3s
- [ ] Catálogo carrega em <2s
- [ ] Viewer 3D inicia em <3s sem erro de console
- [ ] Checkout completo sem erro
- [ ] Webhook simulado fecha o pagamento
- [ ] Admin avança status do pedido
- [ ] Logout/Login em outra role funciona

### Plano B (se algo quebrar)
- [ ] Screenshots de cada tela como backup
- [ ] Vídeo gravado do fluxo completo (~3 min) como fallback
- [ ] Banco de dados snapshot pra reset rápido

## Pós-demo: o que mostrar como "próximos passos"

- Integração real de pagamento (Mercado Pago / Stripe)
- Avatar mais preciso (ReadyPlayerMe / scan corporal)
- Compressão de modelos 3D (Draco)
- Mobile responsivo
- Email transacional
- Analytics e funil de conversão
- Recomendações por similaridade de medidas
