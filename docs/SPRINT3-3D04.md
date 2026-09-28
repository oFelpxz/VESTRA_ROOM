# Sprint 3 — item 3D-04: peça vestida no manequim

> Registro para apresentação ao professor. Item do cronograma: *"Peça em
> avatar padrão: renderizar a roupa vestida em um manequim genérico na página
> do produto, disponível inclusive para o Visitante não autenticado."*
> Branch: `feat/sprint3-3d`, criada a partir da `feat/sprint3` — separada de
> propósito, para poder ser desfeita sem mexer nas outras entregas da sprint.

## O que o cliente vê

Na página do produto, o visualizador 3D ganha o seletor **Peça | Manequim**
(canto superior direito). "Peça" é o que já existia; "Manequim" mostra a roupa
vestida num manequim de vitrine. As vistas Frente / Lateral / Costas, o fundo
claro/escuro e a tela cheia funcionam nos dois modos.

- **Visitante:** funciona sem login. O manequim é um corpo padrão e não lê
  nenhum dado do cliente (o provador com as medidas do cliente é outro item).
- **Só aparece para peças ajustadas.** O seletor só é mostrado quando o
  arquivo da peça traz a marca de ajuste (ver abaixo). Peças ainda não
  ajustadas continuam exatamente como antes, sem o botão.
- **Não pesa para quem não usa:** o manequim (0,4 MB) e o código dele só são
  baixados quando o cliente clica em "Manequim".

Hoje a peça ajustada é o **Hoodie Core**. As outras seguem no modo "Peça".

## Como funciona

| Parte | Onde |
|---|---|
| Manequim sem braços, gerado do `avatar_base.glb` | `public/models/manequim.glb`, gerado por `scripts/manequim_sem_bracos.py` |
| Marca de "peça ajustada" | `src/components/viewer-3d/mannequin-mark.ts` |
| Manequim + peça juntos, na mesma escala | `src/components/viewer-3d/mannequin.tsx` |
| Seletor Peça/Manequim e carregamento sob demanda | `src/components/viewer-3d/viewer.tsx` |
| Ligado só na página do produto | `src/app/produto/[id]/page.tsx` (prop `mannequin`) |

Cada peça é ajustada **uma vez, no Blender**, sobre o mesmo corpo do
manequim, e exportada já nas coordenadas dele. O site só coloca os dois
arquivos lado a lado, 1:1 — não há cálculo de encaixe no navegador.

## Decisões

### Manequim sem braços, como os de vitrine

O `avatar_base.glb` está em pose "A", com os braços abertos e dobrados para a
frente. As peças do catálogo foram modeladas com as mangas caindo retas.
Antes de chegar ao manequim sem braços, três caminhos foram testados e
descartados:

1. **Encaixe automático no navegador** (escala e posição calculadas pela
   caixa de cada peça): o moletom virava uma túnica cobrindo a cabeça e a
   jaqueta ficava atrás do corpo. As peças do catálogo vêm de fontes
   diferentes, com escalas e origens arbitrárias; não há conta genérica que
   acerte todas.
2. **Girar as mangas da roupa até os braços** (script no Blender): a manga
   ficava acima do braço ou criava "chifres" no ombro, porque o braço do
   avatar é dobrado e inclinado para a frente — uma rotação só não acompanha.
3. **Abaixar os braços do avatar**: os braços iam para trás e os ombros
   deformavam.

Sem braços, a manga cai do jeito que foi modelada e nada atravessa o tecido.
É também o que as lojas usam na vitrine.

**Axilas afinadas.** Com a roupa vestida, a lateral do tronco aparecia entre
a manga e o corpo da peça. O script afina o tronco só na altura das axilas
(suave, sem degrau). Faz parte do mesmo script, então o manequim pode ser
gerado de novo a qualquer momento.

### A marca `vestra_fit`

Quem ajusta a peça no Blender cria, nas propriedades da cena, `vestra_fit` =
`avatar_base` (tipo texto). O exportador glTF grava isso no arquivo e o site
lê ao carregar a peça. Foi conferido que a marca **sobrevive à compressão
automática do upload** (item 3D-01) e que a compressão não mexe na posição da
peça.

Por que uma marca, e não um campo no banco: a informação "esta peça foi
ajustada ao manequim" é do arquivo, não do produto. Se alguém subir uma nova
versão sem ajuste, o botão some sozinho — não há como o banco dizer "ajustada"
para um arquivo que não está.

### Ajuste do Hoodie Core

Feito no Blender pelo grupo, sobre o manequim: descer 8 cm, alongar 8% na
altura, e dar folga de **5% na largura e 15% na profundidade**, a partir do
centro do corpo. A folga foi medida, não só vista: o corpo do avatar
atravessava o moletom em 198 pontos do tronco (peito e axilas); depois do
ajuste, sobrou só o pescoço, que fica mesmo à mostra pelo capuz aberto.

### Texturas reduzidas (53 MB → 5,6 MB)

O moletom exportado tinha 53 MB — 47 MB eram três texturas 4K em PNG — e o
upload aceita até 25 MB. As texturas foram convertidas para 2K em JPEG
(qualidade 90): o arquivo caiu para 7,8 MB, e a compressão do upload levou a
5,6 MB. A diferença não aparece no visualizador (a trama do tecido continua
visível) e a página carrega muito mais rápido.

### Publicação pelo painel (fluxo do 3D-01/3D-02)

O moletom ajustado entrou pelo **painel Admin**, como qualquer modelo novo:
upload → versão pendente (3D desligado na loja) → aprovação do Admin. Virou a
**versão 3** do Hoodie Core (`/models/hoodie-core-v3.glb`), aprovada em
28/09/2026.

Como o Storage na nuvem não está configurado no `.env` local, o upload grava o
arquivo em `public/models/`. Por isso **o `hoodie-core-v3.glb` vai junto no
commit**: o banco compartilhado já aponta para ele, e sem o arquivo no
repositório o 3D do moletom ficaria quebrado para quem roda o site de outra
máquina. **Até este commit chegar a cada máquina do grupo, o 3D do Hoodie
Core aparece quebrado nelas.**

**Para voltar atrás:** admin → Modelos 3D → Hoodie Core → Histórico →
"Restaurar" a versão 2 (`/models/hoodie_core.glb`, o arquivo original, que
continua no repositório) e aprovar.

## Bug encontrado e corrigido

**As vistas Frente/Lateral/Costas paravam de funcionar.** O enquadramento
automático do visualizador (`Bounds` com `observe`, da biblioteca drei)
reenquadra a câmera a cada novo desenho da cena — e todo clique num botão
redesenha a cena. As vistas moviam a câmera por fora do `Bounds`, que no
quadro seguinte a animava de volta ao ângulo anterior. Na versão anterior o
problema não aparecia nos testes; com o seletor Peça/Manequim, passou a
acontecer sempre.
Correção: as vistas agora movem a câmera **pela própria API do `Bounds`**
(`moveTo`/`lookAt`), que passa a animar até o ângulo pedido.

## Como ajustar outra peça

1. No Blender, importar `public/models/avatar_base.glb` e a peça.
2. Rodar `scripts/manequim_sem_bracos.py` (aba Scripting → New → colar → Run).
3. Posicionar a peça sobre o manequim só com mover (G) e escalar (S).
   Para folga no tronco, escalar em X e Y com o pivô no **3D Cursor** no
   centro do mundo (Shift+C), para o corpo continuar centralizado.
4. Nas propriedades da **cena** → Custom Properties → New: nome `vestra_fit`,
   tipo **String**, valor `avatar_base`. Atenção: mudar o tipo na engrenagem
   não troca o valor atual — conferir que o campo mostra `avatar_base`.
5. Selecionar só a peça (botão direito → Select Hierarchy) e exportar em
   glTF Binary com *Selected Objects*, *Custom Properties* e *+Y Up*.
6. Texturas acima de 2K: reduzir antes do upload (limite de 25 MB).
7. Subir pelo painel Admin e aprovar.

## Testes (28/09/2026, `localhost:3000`, banco real)

| Teste | Resultado |
|---|---|
| Hoodie Core: seletor aparece, "Manequim" mostra a peça vestida | ✅ |
| Frente / Lateral / Costas nos dois modos, e ao voltar para "Peça" | ✅ (depois da correção acima) |
| Nada do manequim atravessando o moletom (frente, costas, 3/4) | ✅ |
| Peça sem a marca (Track Jacket): sem seletor, 3D como antes | ✅ |
| Visitante: página do produto e `manequim.glb` abrem sem login | ✅ |
| Marca e posição sobrevivem à compressão do upload | ✅ |
| Typecheck e lint | ✅ (lint: só o aviso antigo em `tryon-experience.tsx`) |

## Pendências

- **Boxy Tee 01 / Relugar T-Shirt** (mesma malha: um ajuste serve às duas),
  **Track Jacket** e **Tech Vest** ainda não foram ajustadas — funcionam só no
  modo "Peça". A jaqueta e o colete vêm em escala e posição arbitrárias e vão
  exigir mais posicionamento no Blender.
- O `hoodie_core.glb` original (53 MB) continua no repositório, porque é a
  versão 2 do histórico (a do "Restaurar").
