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

```bash
# peito, cintura e quadril viram "faixas" em cm; imprime CALIBRACAO
mb avatar_medidas.py -- avatar_orig.glb avatar_v2.glb
# braços a 30° (pose padrão) + pesos dos braços para as roupas
mb avatar_pose.py -- avatar_v2.glb avatar_v3.glb pesos.npz
# altura, entrepernas, braço e ombros em cm; imprime CALIBRACAO lengths
mb avatar_comprimentos.py -- avatar_v3.glb
```

`avatar_v3.glb` → `public/models/avatar_base.glb`. Se as CALIBRACAO impressas
mudarem, atualizar `AVATAR_CALIBRATION` em `src/lib/avatar-builder.ts`.

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

## 4. Manequim (`public/models/manequim.glb`)

O manequim de vitrine é o avatar sem braços (`../manequim_sem_bracos.py`, o
mesmo script que roda na aba Scripting do Blender):

```bash
mb manequim.py -- avatar_v3.glb manequim.glb
```

Rodando tudo a partir dos originais, avatar, camiseta, moletom e manequim
saem idênticos (byte a byte) aos do repositório.

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
3. Conferir com `render.py` e no provador (`/produto/<id>/provador`, painel
   "Simular corpo (dev)").
