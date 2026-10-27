# Moldes do VESTRA FIT (Blender, sem interface)

Scripts que geram o avatar do provador e as peças "moldadas" nele. Rodam no
Blender 5.x em modo headless — ninguém precisa abrir o Blender. Explicação e
decisões em [`docs/VESTRA-FIT-MOLDES.md`](../../docs/VESTRA-FIT-MOLDES.md).

Rodar de dentro de `scripts/molde/`, com este atalho (macOS):

```bash
mb() { /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P "$@"; }
```

Use caminhos **absolutos** nos arquivos .glb/.npz (o Blender muda a pasta
atual; abaixo eles aparecem sem pasta só para facilitar a leitura).
Os arquivos de entrada "originais" são os de antes dos moldes, no commit
`cf099cf`: `git show cf099cf:public/models/avatar_base.glb > avatar_orig.glb`
(idem para `boxy_tee_01.glb` e `hoodie-core-v3.glb`).

## 1. Avatar (`public/models/avatar_base.glb`)

O primeiro passo precisa do MPFB instalado no Blender (Preferences → Get
Extensions → MPFB; feito com a 2.0.17) e roda **sem** `--factory-startup`
(que desligaria o MPFB):

```bash
# shape keys "male" e "female": corpo masculino/feminino do MakeHuman
/Applications/Blender.app/Contents/MacOS/Blender -b -P avatar_genero.py -- avatar_orig.glb avatar_g.glb
# peito, cintura e quadril viram "faixas" em cm, e elas e o peso são
# suavizados pela malha (a CALIBRACAO que imprime não vale mais: ver abaixo)
mb avatar_medidas.py -- avatar_g.glb avatar_v2.glb
# braços a 30° (pose padrão) + pesos dos braços para as roupas
mb avatar_pose.py -- avatar_v2.glb avatar_v3.glb pesos.npz
# altura, entrepernas, braço e ombros em cm; imprime CALIBRACAO lengths
mb avatar_comprimentos.py -- avatar_v3.glb
```

`avatar_v3.glb` → `public/models/avatar_base.glb`. Se as CALIBRACAO lengths
mudarem, atualizar `AVATAR_CALIBRATION.lengths` em `src/lib/avatar-builder.ts`.

Peito, cintura e quadril (lista 11, item 7) são medidos no próprio
`avatar_base.glb` com a fita de `src/lib/body-tape.ts` (só o tronco, sem o
braço; peito e quadril na parte mais cheia, cintura na mais fina):

```bash
npx tsx scripts/medir-avatar.ts            # tabela: pedido × corpo
npx tsx scripts/medir-avatar.ts calibrar   # novos base/gain das circunferências
```

A calibração é só o primeiro palpite: `shapeBody` mede o corpo e corrige os
pesos até a fita bater (< 0,2 cm). O teste `src/lib/avatar-measurements.test.ts`
confere 8 corpos com erro < 1 cm.

## 2. Camiseta (Boxy Tee 01) — molde M

A camiseta é encaixada no avatar original (braços abertos) e depois levada
para a pose padrão.

```bash
mb alinhar_camiseta.py -- avatar_orig.glb tee_orig.glb tee_a.glb
mb empurrar.py -- tee_a.glb tee_f.glb avatar_orig.glb
mb reduzir.py -- tee_f.glb tee_r.glb 0.25
mb posar_roupa.py -- tee_r.glb pesos.npz tee_p.glb
mb empurrar.py -- tee_p.glb tee_pe.glb avatar_v3.glb
mb marcar.py -- tee_pe.glb boxy_tee_molde.glb
```

`boxy_tee_molde.glb` → `public/models/boxy_tee_01.glb` e
`public/models/relugar-t-shirt-v1.glb` (mesmo modelo).

## 3. Moletom (Hoodie Core) — molde M

Manga longa: o corpo é posado na posição das mangas do arquivo (12° para
fora, 6° para a frente), o moletom é encaixado ali e só depois vai para a
pose padrão, painel por painel.

```bash
mb reduzir.py -- hoodie_orig.glb mol_r.glb 0.35
mb avatar_pose.py -- avatar_v2.glb avatar_mol.glb pesos_mol.npz 12,6
mb alinhar_moletom.py -- avatar_mol.glb mol_r.glb mol_a.glb
mb empurrar.py -- mol_a.glb mol_e.glb avatar_mol.glb
mb posar_roupa.py -- mol_e.glb pesos.npz mol_p.glb 12,6
mb empurrar.py -- mol_p.glb mol_pe.glb avatar_v3.glb
# 0.10 = altura da ribana da barra (m), medida na costura
mb marcar.py -- mol_pe.glb hoodie_molde.glb 0.10
```

`hoodie_molde.glb` → `public/models/hoodie-core-v3.glb`.

### Jaqueta (Track Jacket) e colete (Tech Vest) — molde M

Os dois arquivos vêm encaixados no corpo original do MakeHuman (`avatar_orig`,
antes do gênero e das medidas). A jaqueta é tratada como o moletom: o corpo é
posado nos ângulos das mangas do arquivo (53° para fora, 9° para a frente).
O colete não tem manga e vai direto no `avatar_v3` (0.27 = altura da barra):

```bash
# jaqueta
mb avatar_pose.py -- avatar_orig.glb avatar_jaq.glb pesos_jaq.npz 53,9
mb alinhar_moletom.py -- avatar_jaq.glb jaq_orig.glb jaq_a.glb
mb empurrar.py -- jaq_a.glb jaq_e.glb avatar_jaq.glb
mb posar_roupa.py -- jaq_e.glb pesos.npz jaq_p.glb 53,9
mb empurrar.py -- jaq_p.glb jaq_pe.glb avatar_v3.glb
mb marcar.py -- jaq_pe.glb jaq_molde.glb
# o painel principal tem só ~3 mil vértices: entre eles o peito do corpo
# aparecia através do tecido. Subdivide os objetos com menos de 8000
mb subdiv.py -- jaq_molde.glb jaq_sub.glb 8000

# colete
mb alinhar_moletom.py -- avatar_v3.glb col_orig.glb col_a.glb 0.27
mb empurrar.py -- col_a.glb col_e.glb avatar_v3.glb
mb marcar.py -- col_e.glb col_molde.glb
```

`jaq_sub.glb` → `public/models/track_jacket.glb` e `col_molde.glb` →
`public/models/tech_vest.glb`; depois `npx tsx scripts/marcar-tecido.ts`.

Cuidados que apareceram na jaqueta:

- os botões vêm num objeto à parte, em triângulos soltos, sem painel grande:
  o `posar_roupa.py` classifica cada pedaço pela mediana do próprio peso, e
  pula o punho de objeto sem manga;
- o punho fecha até `PUNHO_RAIO` (6,5 cm). Mais fechado ele encosta na mão
  (~10,6 cm de largura), e o `empurrar.py` espalha esse empurrão pela manga
  inteira: o punho abre em sino;
- mesmo com 6,5 cm, o polegar e a mão dobrada ainda furam alguns pontos do
  punho. O `fora_da_mao` monta um envelope polar da mão em volta do eixo do
  pulso (fatias de 1 cm × 24 setores, o maior raio de cada) e afasta só os
  pontos que ficam a menos de `FOLGA_MAO` (1,5 cm) dele;
- o caimento do site (`drape`, em `src/lib/garment-fit.ts`) usa o meio da
  caixa do tronco como eixo, e não a média dos vértices: os botões, densos na
  frente, puxavam o eixo para o peito.

## 4. Manequim (`public/models/manequim.glb`, fora de uso)

> Desde 21/10/2026 o modo Manequim da página do produto usa o próprio avatar
> do provador (medidas de referência, com braços e tênis, acabamento cinza de
> manequim; ver `src/components/viewer-3d/mannequin.tsx`). O `manequim.glb`
> ficou no repositório só como histórico.

O manequim de vitrine era o avatar sem braços (`../manequim_sem_bracos.py`, o
mesmo script que roda na aba Scripting do Blender):

```bash
mb manequim.py -- avatar_v3.glb manequim.glb
```

Rodando tudo a partir dos originais, avatar, camiseta e moletom saem
idênticos (byte a byte) aos do repositório. O manequim sai com os mesmos
vértices; só as normais variam até 0,03° (invisível) desde que o avatar
ganhou as keys de gênero, então o do repositório foi mantido.

## 5. Calças, bermuda, saia e vestido (Cargo Pant 02, Wide Denim e Bermuda Utility no molde 40, Saia Midi Plissada e Vestido Slip no M)

As peças de baixo saem do próprio avatar: `calca.py` corta o corpo entre a
cintura e a barra, afasta o tecido da pele, deixa as pernas retas e faz o cós
e os bolsos cargo. Marca a cena com `vestra_peca = "baixo"`; no site a peça
acompanha a pele do cliente e ganha a folga do tamanho escolhido
(`src/lib/bottom-fit.ts`).

```bash
mb calca.py -- avatar_base.glb cargo_pant_02.glb calca
mb calca.py -- avatar_base.glb bermuda_utility.glb bermuda
# Wide Denim: perna larga até o chão, sem bolsos cargo
mb calca.py -- avatar_base.glb wide_denim.glb wide
```

A saia (Saia Midi Plissada, molde M) sai do mesmo jeito com `saia.py`: justa
da cintura ao quadril, evasê com pregas até o meio da canela, sem entrar nas
pernas. No site, a parte solta segue as duas pernas juntas.

```bash
mb saia.py -- avatar_base.glb saia_midi_plissada.glb
```

O vestido (Vestido Slip Acetinado, molde M) segue o mesmo esquema com
`vestido.py`: corpete do decote reto (acima do busto) até a cintura, saia
evasê sem pregas até abaixo do joelho e duas alcinhas por cima dos ombros.
Também é marcado como peça de baixo: no site ele segue a pele inteira e
ocupa os dois lugares do look.

```bash
mb vestido.py -- avatar_base.glb vestido_slip.glb
```

Depois de copiar os .glb para `public/models/`, ligar aos produtos e criar a
tabela de medidas (cargo e bermuda 38–44, wide 38–42, saia e vestido P/M/G) no banco:

```bash
npx tsx scripts/attach-bottom-models.ts
```

## 6. Oversized Shirt — derivada da Boxy Tee 01 (sem Blender)

A Oversized Shirt sai do molde M da Boxy Tee 01: tronco mais largo dos
ombros para baixo, 6 cm mais comprido, manga 30% mais longa e 12% mais
aberta. As marcas do provador (`vestra_fit`, `_BRACO`) continuam as mesmas:

```bash
npx tsx scripts/derivar-oversized.ts public/models/boxy_tee_01.glb public/models/oversized_shirt.glb
npx tsx scripts/attach-top-models.ts   # liga ao produto + tabela P/M/G
```

O gltf-transform grava os atributos entrelaçados num buffer só; o provador
separa eles ao ler a peça (`src/lib/deinterleave.ts`).

### Camisa Studio — derivada da Oversized Shirt (sem Blender)

Mesmo corpo e mesmo caimento da Oversized Shirt (já alisada), mais três
malhas novas: gola (sai da borda da ribana, vira para fora e desce sobre os
ombros; ponta na frente), carcela (faixa de 3,2 cm no meio da frente) e
botões. Os botões usam o material `Botao`, que o provador não pinta com a
cor escolhida (`keepsOwnColor` em `src/lib/garment-color.ts`). Rodar
**depois** de refazer a Oversized (alisar-peito + alisar-barra):

```bash
npx tsx scripts/derivar-camisa.ts public/models/oversized_shirt.glb public/models/camisa_studio.glb
npx tsx scripts/attach-top-models.ts camisa-studio   # liga ao produto + tabela P/M/G/GG
```

## 7. Gorro (Knit Beanie) — acessório, tamanho único

`gorro.py` sai da cabeça do avatar: raios de dentro para fora acham o crânio,
o tecido fica 7 mm afastado (mais no topo), com canelado e barra dobrada de
4,5 cm. Marca a cena com `vestra_peca = "acessorio"`; no site ele acompanha a
cabeça do cliente e entra no look como 3ª peça ("Acessório").

```bash
mb gorro.py -- avatar_base.glb knit_beanie.glb
npx tsx scripts/attach-accessory-models.ts   # liga ao produto (sem tabela)
```

## 8. Tênis do avatar (`public/models/tenis.glb`) — não é produto

Antes o avatar ficava descalço. `tenis.py` faz o tênis a partir dos próprios
pés do `avatar_base.glb`: casco convexo de cada pé até o tornozelo (com
volume extra na biqueira), remesh, folga de 6 mm da pele, boca num plano
inclinado (mais baixa no calcanhar) e sola de 2,4 cm um pouco mais larga.
Atrás da biqueira o cabedal desce até o peito do pé e a folga cai para
2,5 mm na gola (o casco puro ficava um tamanco); a gola tem a borda virada
para dentro e, na frente, a língua sobe 1,4 cm acima da boca. Três malhas:
"Cabedal" (lona, com pesponto nas bordas), "Sola" (sola e biqueira de
borracha) e "Cadarco" (cinco passadas sobre o peito do pé, sem pesponto).
Marcas `vestra_fit = "avatar_base"` e `vestra_peca = "calcado"`: no site o
tênis segue a pele dos pés do corpo do cliente (`Shoes` em
`bottom-garment.tsx`) e entra em todo look do provador.

```bash
mb tenis.py -- avatar_base.glb tenis.glb
ORTHO=0.45 ALVO=0.19,-0.08,0.07 mb render.py -- tenis avatar_base.glb tenis.glb ""
```

## 9. Caimento com gravidade e espessura (depois do molde)

O molde dá a forma "de cabide". `cair.py` solta a peça com gravidade em cima
do `avatar_base.glb` (simulação de tecido do Blender, com chão) e grava onde
cada ponto parou num `.bin`; `scripts/aplicar-queda.ts` aplica isso no `.glb`
sem mexer em marcas, UV ou `_BRACO`. A parte que veste o corpo fica presa
(cós da saia, corpete do vestido, ombros da camiseta) e o resto cai.

```bash
mb cair.py -- avatar_base.glb saia_midi_plissada.glb /tmp/saia.bin saia
npx tsx scripts/aplicar-queda.ts public/models/saia_midi_plissada.glb /tmp/saia.bin public/models/saia_midi_plissada.glb
mb cair.py -- avatar_base.glb vestido_slip.glb /tmp/vestido.bin vestido
mb cair.py -- avatar_base.glb boxy_tee_01.glb /tmp/tee.bin camiseta
npx tsx scripts/aplicar-queda.ts public/models/boxy_tee_01.glb /tmp/tee.bin public/models/boxy_tee_01.glb 12
mb cair.py -- avatar_base.glb cargo_pant_02.glb /tmp/cargo.bin calca   # bermuda, wide: idem
mb cair.py -- avatar_base.glb hoodie-core-v3.glb /tmp/hoodie.bin moletom
npx tsx scripts/aplicar-queda.ts public/models/hoodie-core-v3.glb /tmp/hoodie.bin public/models/hoodie-core-v3.glb 12
```

A queda é feita uma vez, no corpo de referência. No site, `bottom-fit.ts`
leva as dobras para o corpo do cliente (cada ponto do tecido segue a pele
que estava embaixo dele). Duas regras de lá completam a gravidade:

- Tamanho maior cai reto: a folga a mais cresce do entrepernas para baixo
  (até 2,5 vezes na barra), em vez de inflar a perna por igual.
- O tecido nunca fica atrás da pele logo embaixo dele (até 8 mm a mais,
  fora do cós): em corpo grande com tamanho apertado a pele aparecia no
  gancho e no glúteo. Vale também no busto do vestido (até 2 cm abaixo do
  decote, fora a borda e as alcinhas): busto maior furava o tecido no mamilo.

- Camisetas: raio 12 (mm) no `aplicar-queda.ts`. A simulação une as camadas
  e costuras do CLO a 3 mm; com raio menor a manga da oversized furava a
  camada de baixo. A Relugar é o mesmo arquivo da Boxy Tee (copiar).
- Calças e bermuda (`calca`, `bermuda`, `wide`): presas no quadril e na
  barra, com `sobra` (negativa: o tecido fica mais comprido que a perna e
  franze entre os dois pinos, sobre o joelho e o tênis). A Wide Denim não
  usa pés nem chão (`pe_z`, `chao=False`): a barra presa já passa por eles.
- Ilhas soltas (bolso cargo, passante) saem da simulação: o
  `aplicar-queda.ts` move cada uma pelo ponto da simulação mais perto.
- Moletom do Hoodie Core (`moletom`): preso nos ombros, raio 12, costuras
  unidas a 5 mm na simulação. Sem espessura (não é uma folha só).
- `AJUSTE="mass=0.05,bending=2"` muda o tecido sem editar o script.

Depois da queda, as peças de baixo (uma folha só) ganham espessura na
barra, no cós, na cava e nas alças: uma faixa dobrada para dentro com a
espessura do tecido (sarja 2,5 mm, cetim 1,2 mm, denim 3 mm). O script grava
`vestra_espessura` na cena e pula a peça que já tem. Pedaços costurados por
cima (bolso da cargo, passante) ficam sem faixa: dobrada para dentro, ela
encostava na perna e riscava uma linha escura em volta do bolso. Uso:

```bash
npx tsx scripts/espessura.ts public/models/saia_midi_plissada.glb
```

Camisetas (Boxy Tee, Relugar, Oversized), por último: o peito vinha do
arquivo com calombos, um vinco e um serrilhado no lado esquerdo.
`alisar-peito.ts` alisa o tronco entre a barra e a gola, só na camada de
fora (o provador joga o avesso fora) e fora das mangas, e deixa o tecido a
pelo menos 9 mm da pele do `avatar_base` (abaixo de 8 mm o provador empurra
ponto a ponto e o peito volta manchado). O `_BRACO` vaza 5–50% pelo peito
todo; só a partir de 25% o ponto conta como manga. Rodar uma vez em cada
arquivo:

```bash
npx tsx scripts/alisar-peito.ts public/models/boxy_tee_01.glb public/models/boxy_tee_01.glb
cp public/models/boxy_tee_01.glb public/models/relugar-t-shirt-v1.glb
npx tsx scripts/alisar-peito.ts public/models/oversized_shirt.glb public/models/oversized_shirt.glb
```

Depois dele, `alisar-barra.ts` cuida do que fica abaixo de 0,95 m (onde o
`alisar-peito.ts` para e prende as bordas): a queda deixou uma dobra
vertical de 3–4 cm no meio da frente e um sulco de ~1 cm na linha da coluna,
e de baixo os dois pareciam a barra abrindo. Em faixas de 1 cm, leva o meio
(|x| < 4 cm) até a reta que liga os dois lados dele; a correção vale para
todas as camadas juntas, então a barra continua fechada:

```bash
npx tsx scripts/alisar-barra.ts public/models/boxy_tee_01.glb public/models/boxy_tee_01.glb
cp public/models/boxy_tee_01.glb public/models/relugar-t-shirt-v1.glb
npx tsx scripts/alisar-barra.ts public/models/oversized_shirt.glb public/models/oversized_shirt.glb
```

Ordem ao refazer uma peça: molde → `marcar-tecido.ts` → `cair.py` +
`aplicar-queda.ts` → `espessura.ts` (por último: a simulação não conhece a
faixa da espessura) ou, nas camisetas, `alisar-peito.ts` + `alisar-barra.ts`.

## Ferramentas de conferência

| Script | Para quê |
|---|---|
| `render.py` | Imagens de frente/lado/costas/3/4 do corpo com a roupa, com medidas (`"hip=1"`) |
| `circ.py` | Circunferências do avatar (use no `avatar_v2.glb`, antes da pose) |
| `juntas.py` | Linha central do braço; origem de `OMBRO`/`COTOVELO`/`PUNHO` em `pose_lib.py` |

## Peça nova

1. Vestir no corpo certo: `alinhar_camiseta.py` serve de exemplo para peças
   de manga curta; `alinhar_moletom.py` + `avatar_pose.py … abertura,frente`
   para manga longa (medir o ângulo das mangas do arquivo).
2. `empurrar.py` → `posar_roupa.py` → `empurrar.py` (no `avatar_v3.glb`) →
   `marcar.py` (com a altura da ribana da barra, em m, se a peça tiver).
3. Dizer o tecido: adicionar o `.glb` em `TECIDO` no
   `scripts/marcar-tecido.ts` (algodao, sarja, denim, trico, cetim ou moletom)
   e rodar `npx tsx scripts/marcar-tecido.ts`. Sem isso, a peça sai de algodão.
4. Se for saia, vestido ou camiseta: queda com gravidade e, nas peças de
   baixo, espessura; nas camisetas, `alisar-peito.ts` e `alisar-barra.ts` (seção 9).
5. Conferir com `render.py` e no provador (`/produto/<id>/provador`, painel
   "Simular corpo (dev)").
