# Provador — encaixe da roupa no avatar

> **Sessão de 2026-09-14.** Registra o que foi mexido no encaixe 3D do VESTRA FIT
> e, principalmente, **o que descobrimos sobre os assets de roupa** — que é a
> parte que muda o rumo do item. Complementa o `STATUS-FASE2.md`.

---

## Resumo em uma linha

O provador ganhou avatar, escala por eixo e variação por tamanho — mas o teste
visual revelou que **os `.glb` de roupa não seguem uma convenção única**, e por
isso o encaixe automático não tem como acertar. **Decisão do grupo: as roupas
passam a vir direto do Blender**, modeladas sobre o avatar.

---

## Problemas que motivaram o trabalho

1. A roupa parecia **"colocada" sobre o avatar**, não vestida.
2. As roupas estavam **grandes demais** e **não variavam com o tamanho**
   (P/M/G/GG mudavam só o texto do caimento, nunca o 3D).

---

## Causas encontradas no código

| # | Causa | Onde |
|---|---|---|
| 1 | **O avatar nunca era renderizado no provador.** A cena tinha só a peça e a sombra de contato — o corpo simplesmente não estava lá. O `<Avatar>` só existia em `avatar-preview.tsx` (`/teste-3d`, corpo sem roupa). | `tryon-scene.tsx` |
| 2 | **Escala uniforme e composta.** `baseScale` saía da altura do torso ×1.15 e depois era multiplicado por um `widthBoost` que reescalava **tudo junto**, inclusive o comprimento. Peça estreita em relação aos ombros → a peça inteira crescia. | `tryon-scene.tsx` |
| 3 | **`selectedSize` não chegava na cena 3D.** Só `avatarParams`, `garmentUrl` e `selectedColor` eram passados. | `tryon-experience.tsx` |

---

## O que foi implementado

### Novo módulo `src/lib/garment-fit.ts`

A matemática saiu do componente, seguindo o padrão de `avatar-builder.ts` /
`fit-calculator.ts` (lib pura, sem THREE, testável isolada).

- **Y (comprimento)** vem do corpo — ombro até ~8% da altura abaixo do quadril —
  para a barra cair no lugar certo em qualquer avatar. Tamanhos maiores ganham
  alongamento modesto (fator limitado a ±12%).
- **X/Z (largura)** vêm da `SizeChart`: circunferência de peito do tamanho +
  folga da preferência (**SLIM 4 cm · REGULAR 9 cm · OVERSIZED 16 cm**).
  X e Z andam juntos para não achatar a seção da peça.
- O `widthBoost` composto foi removido.

### Medição da malha — `measureGarment()` em `tryon-scene.tsx`

Esta foi a causa raiz do "grande demais", e **o aprendizado sobrevive mesmo se o
encaixe automático for aposentado**:

> A bounding box de uma peça modelada em **A-pose mede envergadura, não peito**.
> Comparar essa largura com a largura de ombro do avatar produz um fator de
> correção absurdo.

Solução: fatiar a malha em 24 faixas horizontais e tirar a **mediana da largura
das faixas centrais** (15%–75% da altura), o que ignora manga aberta, gola e
barra.

### Ancoragem

Mudou de "centro da peça no centro do torso" para **topo da peça na linha do
ombro** (+2% da altura para a gola) — é como roupa de verdade assenta.

### Plumbing do tamanho

`TryOnScene` passou a receber `sizeRow` e `preference`, repassados ao `Garment`.

---

## Validação numérica

Tabela real do seed + cliente demo (peito 96 cm; corpo renderizado com 33,6 cm
de largura), preferência REGULAR:

| Tamanho | Largura final | Folga sobre o corpo |
|---|---|---|
| P | 34,0 cm | +0,4 cm |
| M | 36,2 cm | +2,6 cm |
| G | 39,0 cm | +5,4 cm |
| GG | 41,8 cm | +8,2 cm |

Cresce monotonicamente e nunca fica mais estreito que o corpo. O P dá quase zero
de folga para quem tem 96 cm de peito — que é exatamente o que o `FitIndicator`
já dizia em texto (P cobre 86–90 cm). **O 3D e o texto passaram a concordar.**

`tsc --noEmit` e ESLint limpos (só o warning pré-existente de `_productId`).

---

## A descoberta que muda o rumo

O teste visual (Hoodie Core, tamanho G) mostrou a peça virando **um robe até a
coxa, com o capuz caído no pescoço e as mangas encolhidas para dentro dos
braços**. A conta estava certa — **a premissa é que estava errada**.

Inspecionando os `.glb` com `gltf-transform`:

| Modelo | Faixa em Y | Convenção |
|---|---|---|
| `hoodie_core.glb` | 0,913 → 1,741 | **já vestido** — barra no quadril, capuz na altura da cabeça |
| `boxy_tee_01.glb` | 0,936 → 1,638 | **já vestido** |
| `relugar-t-shirt-v1.glb` | 0,936 → 1,638 | **já vestido** (byte a byte idêntico ao `boxy_tee_01.glb`) |
| `track_jacket.glb` | −0,506 → 0,506 | centrado na origem, unidades arbitrárias |
| `tech_vest.glb` | −0,950 → 0,949 | centrado na origem, unidades arbitrárias |

O `hoodie_core.glb` é um modelo do **Sketchfab** (nós `Sketchfab_model`,
`Hoodie_Scene_Node_0`, `Cloth_1`), já modelado **em metros e na posição de quem
está vestindo**. Ele não precisava de encaixe nenhum — bastava renderizar 1:1.
O código pegou uma peça já posicionada corretamente e espremeu num "vão de
torso" calculado.

E `track_jacket` / `tech_vest` são o caso oposto: centrados na origem, sem escala
humana — esses *precisam* de encaixe.

**Conclusão:** nenhuma heurística única serve bem para as duas convenções ao
mesmo tempo. O encaixe automático por bounding box trata a malha como um bloco
sem semântica, mas a peça tem partes (capuz, manga, torso) que precisam cair
cada uma no lugar certo do corpo — e isso escalar caixa não resolve.

---

## Decisão do grupo

**As roupas passam a vir direto do Blender**, modeladas sobre o avatar
(`public/models/avatar_base.glb`), em coordenadas de "já vestido" — mesma
convenção que `hoodie_core` e `boxy_tee_01` já usam por acaso.

Consequências:

- O encaixe automático deixa de ser o caminho principal. A peça é renderizada
  na escala em que foi modelada, ajustada apenas pela razão de altura do usuário.
- Variação de tamanho passa a ser **shape key por tamanho** na própria peça
  (`size_P`, `size_M`, …), no mesmo mecanismo de morph target que o avatar já
  usa — casando por nome, com fallback (ver `MORPH_ALIASES` em `avatar.tsx`).
- `garment-fit.ts` fica como caminho de compatibilidade para os assets legados
  centrados na origem, ou pode ser removido quando todos forem refeitos.

### Sobre gravidade / caimento

Discutido e **decidido ficar de fora por ora** (fora do escopo, sem boneco
animado). Registro do que foi levantado, para quando voltar ao tema:

- Morph target é deformação **estática** — não dá sensação de peso sozinha.
- Como o avatar é estático (só a câmera gira), dá para **assar a gravidade**: rodar
  a simulação de tecido no Blender, deixar assentar, e exportar já assentado.
  Visualmente equivale a simular ao vivo, com custo zero em runtime.
- Gravidade assada vale para **uma pose só**. Se um dia o avatar animar, o
  caimento assado fica errado.
- Meio-termo futuro: *spring bones* na barra, para a peça balançar de leve.

---

## Achados laterais

- **`hoodie_core.glb` tem 55 MB**, sendo ~24 MB só de texturas PNG
  (17,9 MB + 6,2 MB). O otimizador de upload (`model-optimizer.ts`) **não
  recomprime textura por design** — o comentário no arquivo diz que WebP/KTX2
  ficou fora de escopo porque exigiria `sharp` no build. Vale revisitar: é de
  longe o maior ganho de peso disponível nos assets atuais.
- **`relugar-t-shirt-v1.glb` e `boxy_tee_01.glb` são o mesmo arquivo** (mesmo
  tamanho em bytes, mesma bbox). Dois produtos diferentes apontando para a mesma
  malha.
- A senha do banco Supabase **rotacionou de novo** nesta sessão (sintoma:
  `P1000: Authentication failed` com credenciais que funcionavam minutos antes).
  Confirma o risco recorrente já registrado no `STATUS-FASE2.md` — pegar a nova
  em Project Settings → Database.
- O `.env` é gitignored, então **`NEXT_PUBLIC_AVATAR_MODEL_URL` não viaja entre
  máquinas**. Sem essa linha o avatar cai silenciosamente no boneco de
  primitivas, mesmo com o `avatar_base.glb` presente. Foi o que aconteceu ao
  clonar o projeto numa máquina nova.

---

## Estado do código

As mudanças desta sessão estão **no working tree, não commitadas**:

```
 M src/components/viewer-3d/tryon-experience.tsx
 M src/components/viewer-3d/tryon-scene.tsx
?? src/lib/garment-fit.ts
```

Decidir antes de commitar: manter como caminho de compatibilidade para os assets
legados, ou descartar já que as roupas serão refeitas no Blender. O fix do avatar
na cena (`<Avatar>` no `TryOnScene`) vale em qualquer cenário e deve ser mantido.
