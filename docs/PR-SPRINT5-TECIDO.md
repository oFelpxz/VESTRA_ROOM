# PR — Sprint 5: tecido de verdade no provador (listas 3 e 4)

Texto pronto para abrir o PR no GitHub e checklist do grupo antes da
apresentação de 26/10. Decisões item a item:
[SPRINT5-DECISOES.md](SPRINT5-DECISOES.md#apresentação-segura-e-acabamento-do-provador-lista-4).

## Antes de abrir

- **Branch:** `feat/sprint5-tecido` (ainda só no computador: publicar pelo
  GitHub Desktop → "Publish branch").
- **Base:** ela sai de `feat/sprint5-itens` (que está no GitHub até
  `6a28808`). São **15 commits novos** em cima dela.
- Se o PR for aberto contra a `main`, o GitHub vai mostrar ~100 commits,
  porque a `main` (`f046785`) ainda não tem a sprint 5. Para revisar só o que
  é novo, abra contra `feat/sprint5-itens`; ou junte a `feat/sprint5-itens`
  na `main` primeiro.
- **Volta segura:** a tag `apresentacao-estavel` (= `6a28808`) é o ponto
  testado antes desta branch. Se algo quebrar perto da apresentação, dá para
  apresentar a partir dela.

---

## Título

```
Provador: tecido de verdade, modo leve, "Tecido de perto" e tênis no avatar
```

## Descrição

```markdown
## O que muda

As roupas do provador deixam de parecer "massinha": cada peça ganha a trama e
o brilho do seu tecido, dobras de caimento, barra dobrada e pesponto. Também
entram um modo leve para celular fraco, o botão "Tecido de perto", o tecido
no 3D da página do produto, a escolha do tecido no upload do admin e um tênis
no avatar.

### Tecido e avatar (lista 3)
- f466c74 Tecido por peça (algodão, jeans, moletom, tricô, cetim, sarja) + luz de estúdio
- 26b880c Pele do avatar mais realista
- e307abe Quinas nítidas nas peças de baixo (pregas, cós, bolsos)
- eec2d37 Barra dobrada e pesponto perto da borda do tecido
- 56f467e Dobras de caimento no shader
- 386e569 Dobras da calça só em manchas fora da barra
- 99a009b Decisões da lista 3 e prints de antes/depois

### Apresentação segura e acabamento (lista 4)
- a3e7443 Testes: detecção saia × calça e a tira sem acabamento
- 60bfa05 Mesmo material de tecido no 3D da página do produto
- 0bfae6f Modo leve automático em celular fraco (`?leve=1` / `?leve=0` forçam)
- 372ca83 Botão "Tecido de perto" (peito → barra → volta)
- a403e6e Prints do plano B refeitos + passo do tecido no roteiro
- b3b9fe7 Admin: campo "Tecido no provador" no upload do modelo 3D
- 4526756 Tênis no avatar, feito no Blender (`scripts/molde/tenis.py`)
- 3415d30 Prints do plano B refeitos com o tênis

Sem migração no banco: o tecido escolhido no admin fica gravado no próprio `.glb`.

## Como testar

1. `npm install` e `npm run dev`.
2. Abrir o provador de algumas peças:
   - `/produto/boxy-tee-01/provador` (algodão)
   - `/produto/wide-denim/provador` (jeans: a barra cobre o tênis)
   - `/produto/saia-midi-plissada/provador` (pregas)
   - `/produto/hoodie-core/provador` (moletom)
   - `/produto/knit-beanie/provador` (tricô)
3. Clicar em **"Tecido de perto"**: a câmera vai ao peito, depois à barra e
   volta.
4. Repetir com `?leve=1` no fim da URL: some dobra, pesponto e sombra; a cor
   e a trama ficam.
5. Página do produto (`/produto/wide-denim`): o 3D usa o mesmo tecido.
6. Admin → upload de modelo 3D: o campo "Tecido no provador" aparece
   ("Automático" mantém o comportamento antigo).
7. `npm test`, `npx tsc --noEmit -p .` e `npx eslint .` sem erro.

## Limitações conhecidas
- Modo leve medido no Mac com tela de celular simulada, não num celular de verdade.
- Moletom continua sem pesponto (as emendas do arquivo não se tocam; o
  pesponto riscava o tricô e o cós).
- No celular, a ponta do tênis fica atrás dos botões de vista (igual ao pé
  descalço antes).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Checklist do grupo

- [ ] Publicar `feat/sprint5-tecido` pelo GitHub Desktop e abrir o PR com o
      texto acima
- [ ] Alguém além do Leonardo revisar o PR (rodar os passos de "Como testar")
- [ ] Abrir o provador num **celular de verdade** (Android e iPhone, se der)
      e anotar se travou ou se ficou leve sozinho
- [ ] Decidir se o moletom fica sem pesponto (sugestão: fica, ver item 8 das
      decisões)
- [ ] `npm test` passando na máquina de quem vai apresentar
- [ ] Juntar na `main` até **24/10** (último dia de mudança visual)
- [ ] **Ensaio em 25/10** seguindo o
      [roteiro](ROTEIRO-APRESENTACAO-26-10.md), com os prints do
      [plano B](apresentacao/README.md) à mão
- [ ] No dia, abrir os provadores do roteiro uma vez antes de começar (o
      primeiro carregamento do 3D é o mais lento)
- [ ] Se algo quebrar: voltar para a tag `apresentacao-estavel`
