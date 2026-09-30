# VESTRA FIT — moldes, tamanhos independentes e caimento

> Registro do trabalho no provador virtual 3D (branch `feat/molde-camiseta`).
> Objetivo: deixar o 3D mais rápido de produzir e mais fiel — cada peça é
> preparada uma vez ("molde") por scripts, e o site só veste o molde no corpo
> do cliente.

## O que o cliente vê

No provador (`/produto/<id>/provador`), o avatar tem as medidas do cliente e
a peça aparece **no tamanho escolhido**, não sob medida:

- **Magro num GG:** a peça sobra (mais larga e mais comprida), mas apoiada
  nos ombros e com a frente e as costas caindo rente ao corpo, não "armada"
  em volta dele.
- **Grande num P:** o tecido fica esticado sobre o corpo.
- **Corpo perto do tamanho:** a peça cai como no molde.
- **Quadril ou barriga maiores que a peça:** o tecido desce reto a partir do
  ponto mais largo, em vez de "abraçar" o corpo por baixo.
- **Moletom:** a ribana da barra abraça o quadril, e o corpo do moletom
  franze um pouco por cima dela.

Hoje isso vale para o **Hoodie Core**, a **Boxy Tee 01** e a **Relugar
T-Shirt** (mesmo modelo da Boxy Tee). As outras peças continuam com o
encaixe aproximado antigo até ganharem molde.

A **cor** escolhida vale de verdade, mesmo sobre textura escura: o moletom
preto fica branco em "Branco", e o desenho do tricô continua aparecendo.

O avatar usa as 8 medidas do perfil em cm: altura, peso, peito, cintura,
quadril, ombros (de ombro a ombro), braço (do ombro ao pulso) e perna
(entrepernas). Ombro, braço e perna não informados acompanham a altura.

Em desenvolvimento, o painel **"Simular corpo (dev)"** do provador troca
essas medidas sem mexer no perfil salvo. Ele não aparece em produção.

## Como funciona

| Parte | Onde |
|---|---|
| Avatar com medidas em cm e braços a 30° | `public/models/avatar_base.glb` |
| Calibração das medidas (cm → shape keys) | `src/lib/avatar-builder.ts` (`AVATAR_CALIBRATION`) |
| Moletom moldado (tamanho M) | `public/models/hoodie-core-v3.glb` |
| Camiseta moldada (tamanho M) | `public/models/boxy_tee_01.glb` |
| Manequim de vitrine (avatar sem braços) | `public/models/manequim.glb` |
| Vestir: tamanho, apoio nos ombros, mangas no braço, ribana | `src/lib/garment-dress.ts` (`dress`) |
| Conta num Web Worker, sem travar a página | `src/lib/garment-fit.worker.ts` + `src/lib/fit-runner.ts` |
| Mostrar o avatar vestido | `src/components/viewer-3d/dressed-avatar.tsx` |
| Assentar, empurrar o tecido para fora do corpo e caimento | `src/lib/garment-fit.ts` (`settle`, `pushOut`, `drape`) |
| Graduação por tamanho a partir da tabela de medidas | `src/lib/garment-fit.ts` (`sizeGrade`) |
| Cor sobre a textura | `src/lib/garment-color.ts` (`tintMaterial`) |
| Nome da cor → tom | `src/lib/color-names.ts` (`colorToHex`) |
| Provador escolhe: peça moldada ou encaixe antigo | `src/components/viewer-3d/tryon-scene.tsx` |
| Scripts do Blender que geram avatar e moldes | `scripts/molde/` (ver o README de lá) |

A cada troca de tamanho ou de medida, o site:

1. aplica as medidas no corpo (shape keys);
2. gradua a peça pelo tamanho (ver "Graduação por tamanho") e a apoia nos
   ombros do cliente;
3. faz as mangas acompanharem o braço do cliente (atributo `_BRACO` gravado no
   molde);
4. encolhe a ribana da barra, se a peça tiver;
5. faz a frente e as costas recuarem onde o cliente é mais raso que o corpo
   de referência (ver "Peça maior não fica armada");
6. assenta a peça onde ela se apoiava no corpo de referência: ombros, costas
   altas, parte de cima do braço;
7. empurra o tecido para fora onde o corpo atravessa, com folga de 8 mm;
8. aplica o caimento: no tronco, o tecido empurrado não volta para dentro
   abaixo do ponto mais largo.

A conta leva de 0,3 a 0,75 s no computador de desenvolvimento, mas roda num
Web Worker: a página continua respondendo e mostra a peça anterior até a nova
ficar pronta. Se o cliente trocar de tamanho várias vezes seguidas, só o
último pedido é calculado. Sem suporte a worker, a conta volta a rodar na
própria página.

## Decisões

### Tamanhos independentes do corpo

A primeira versão fazia a peça acompanhar as medidas do cliente, como uma
roupa sob medida. Isso esconde o que o provador existe para mostrar: um GG
num corpo magro tem que sobrar. Agora a peça tem a forma do tamanho, e o
corpo só a empurra onde for maior que ela.

### Graduação por tamanho

A peça não é o M esticado por igual. Cada parte segue a sua regra, a partir
da tabela de medidas do produto:

| Parte | Regra |
|---|---|
| Largura do tronco (peito) | peito da tabela ÷ peito do M; abaixo dos ombros, quase tudo vai para a largura (só 30% para a profundidade) |
| Largura da barra | quadril da tabela ÷ quadril do M (sem quadril: igual ao peito) |
| Comprimento da manga | braço da tabela − braço do M (sem braço: 1,5 cm por tamanho) |
| Comprimento do corpo | 2 cm por tamanho |
| Ombro a ombro | 1,2 cm por tamanho |
| Gola e capuz | quase não mudam (¼ da mudança do peito) |

A frente e as costas de uma peça são painéis planos que se apoiam no corpo:
um tamanho maior fica mais largo, não mais fundo. Por isso, abaixo dos
ombros, a mudança do peito vai quase toda para a largura, mantendo o
perímetro da peça.

Medido com a progressão padrão (moletom, corpo magro): do P ao GG a largura
vai de ×0,96 a ×1,10, a profundidade quase não muda (×0,99 a ×1,01), a barra
vai de 1,4 cm mais alta a 3,6 cm mais baixa e o capuz muda menos de 0,5 cm.
Hoje a tabela do Hoodie Core só tem tórax e cintura; preenchendo quadril e
braço no admin, barra e manga passam a seguir a tabela sem mudar código.

### Peça maior não fica armada

O molde tem a forma do corpo de referência (feminino, com busto). Num corpo
mais raso, a peça ficava no ar com essa forma, como uma tenda. Agora:

- **Frente e costas** pendem do ponto mais saliente do corpo acima delas
  (peito, barriga; omoplatas). Onde o cliente é mais raso que o corpo de
  referência nesse ponto, o painel recua o mesmo tanto, e o tecido que sobra
  vai para os lados, com o mesmo perímetro.
- **Ombros, costas altas e a parte de cima do braço** (pele virada para
  cima): onde o molde encostava no corpo de referência, a peça volta a
  encostar no cliente (`settle`). Embaixo do braço e abaixo da axila, a peça
  fica pendurada.

Corpo maior que o de referência não passa por aqui: quem cuida é o empurrão.

### Ribana da barra

A marca `vestra_ribana` do molde (altura da ribana, em m; o moletom usa
0,10) faz a ribana encolher até 88% do raio e o corpo da peça afinar até ela
nos 8 cm de cima. Quadril maior que isso estica a ribana de volta.

### Folga mínima, também na axila

Onde o tecido fica preso entre dois lados do corpo (braço e tronco na
axila), os empurrões para lados opostos quase se anulam no campo suave de
~3 cm. Uma fase final, com um campo de ~1 cm, resolve esses pontos: numa
camiseta num corpo pesado, os pontos a menos de 8 mm da pele caíram de ~900
(90 deles por dentro, até 6 mm) para ~200, nenhum por dentro. O
que sobra fica onde o braço encosta no tronco e não há 16 mm de espaço.

### Cor sobre a textura

O three.js multiplica a cor pela textura, e textura preta × branco continua
preto. `tintMaterial` mede o brilho médio da textura e usa a textura só como
desenho (claro/escuro em volta da média), com o tom vindo da cor escolhida.
Estampas coloridas viram tons da cor escolhida.

### Medidas do avatar em centímetros

As shape keys originais (MakeHuman) não correspondiam a circunferências: a de
cintura criava uma "barriga de grávida" e a de peito mudava menos de 1 cm.
`avatar_medidas.py` refaz peito, cintura e quadril como faixas que crescem
por igual em volta do tronco, e mede quantos cm cada uma muda. O site resolve
um sistema 3×3 para acertar as três medidas ao mesmo tempo, já descontando o
que a altura e o peso corporal acrescentam.

A shape key de altura aumenta o corpo inteiro, inclusive as circunferências
(+1 de altura = +25,8 cm de peito). Antes isso não era descontado: um cliente
de 1,88 m ganhava uns 5 cm a mais em cintura e quadril, e um baixo ficava
mais fino. Ombros, braço e perna também são calibrados em cm
(`avatar_comprimentos.py`); perna e altura são resolvidas juntas, porque a
perna mais longa também deixa o corpo mais alto.

Conferido no Blender em 5 corpos (de 1,55 m a 1,88 m): altura, entrepernas,
braço e ombros ficam a até 1 cm do pedido. Antes, cintura e quadril saíam 4
a 6 cm maiores e braço e perna erravam até 7 cm.

Todas as circunferências são medidas **na mesma faixa de pele** (os mesmos
vértices do corpo de referência), não numa altura fixa: a altura sobe e
desce cada medida, e o peso também desce o busto. Medindo o peso numa altura
fixa, a calibração achava que ele aumentava o peito 7 cm, quando na faixa do
peito são 3 cm, e o peito errava até ~4 cm. Em 7 corpos (normal, magro,
baixa, quadril 130 e 140, barriga, peito 118), peito, cintura e quadril
ficam a até 0,5 cm do pedido.

`avatar_medidas.py` também **suaviza** o deslocamento de peso, peito,
cintura e quadril pela malha (15 passadas). A faixa copiava os detalhes da
pele, e o peso do MakeHuman veio irregular: com quadril de 130 cm já
apareciam gomos e um vinco em volta do quadril, e a barriga do corpo pesado
tinha calombos que a roupa copiava. Suavizado, a pele do tronco fica ~3,5×
mais lisa nesses corpos. O corpo de referência (sem medidas) não muda: os
moldes, os pesos dos braços e o manequim continuam idênticos.

### Braços abaixados (30°)

Na pose original, com braços abertos e dobrados para a frente, nenhuma manga
de catálogo servia. `avatar_pose.py` monta um esqueleto simples, deixa o
Blender calcular os pesos e aplica a pose no corpo e em cada medida, com as
articulações no lugar de cada corpo.

### Moletom encaixado na pose das mangas

As mangas longas do arquivo estão quase coladas ao corpo (12° para fora). O
corpo é posado nessa posição, o moletom é encaixado ali e só depois vai para
a pose padrão. Isso é feito **painel por painel**: cada painel do arquivo é
classificado como manga esquerda, manga direita ou tronco, e as costuras
recebem o mesmo movimento dos dois lados, senão a manga rasgava ou abria em
sino. Quando a manga passa do pulso, o excesso "embola" no antebraço.

### Caimento simplificado, não simulação

Uma simulação de tecido de verdade seria lenta demais para rodar a cada
clique. O caimento trabalha em colunas verticais em volta do tronco:

- **Pouco empurrão** (até ~1 cm): a peça mantém a forma do molde; o tecido
  empurrado só não volta para dentro logo abaixo.
- **Muito empurrão** (a partir de ~4 cm): a lateral fica esticada em linha
  reta da axila até o ponto mais largo e cai reta dali.

Os testes automáticos acharam dois defeitos, já corrigidos: uma célula vazia
na grade (linha sem ponto) e uma coluna inteira vazia faziam o tecido logo
abaixo do ponto mais largo voltar ~2 cm para dentro (um "vinco").

No lado esticado, cada vértice andava até a reta medido contra o raio da
própria célula da grade. Células vizinhas têm raios um pouco diferentes, e o
tecido saía "amassado", com estrias e degraus, nos corpos grandes. Agora o
raio medido é interpolado entre as células vizinhas, como a própria reta
(sem passar do raio da linha do vértice, para não reabrir o vinco). A
aspereza do tecido caiu cerca de 40% (camiseta no corpo com barriga ou
quadril de 130 cm).

O caimento não cria dobras: o tecido que sobra num tamanho maior aparece
como largura, não como pregas.

### Scripts reproduzíveis

Todo o processo roda no Blender sem interface. Rodando os scripts de
`scripts/molde/` a partir dos arquivos originais, o avatar, as peças e o
manequim saem idênticos, byte a byte, aos do repositório.

## Arquivos que mudam juntos

O moletom moldado só serve no avatar novo (braços a 30°), e o moletom antigo
não serve nele. Por isso `avatar_base.glb` e `hoodie-core-v3.glb` entram
juntos. Não há mudança no banco: o `Model3D` do Hoodie Core continua
apontando para `/models/hoodie-core-v3.glb`.

O modo **Manequim** da página do produto usa `manequim.glb`, gerado do avatar
novo (o tronco mudou no máximo 0,9 cm, perto das axilas). A Boxy Tee 01 passa
a ter o modo Manequim também, porque o molde dela tem a marca `vestra_fit`.

A **Relugar T-Shirt** usa o mesmo modelo da Boxy Tee com outro arquivo:
`relugar-t-shirt-v1.glb` recebeu o mesmo molde.

## Como testar

`npm test` roda os testes automáticos (sem navegador nem banco): graduação,
empurrão (inclusive preso entre dois lados), assentamento, caimento, altura,
calibração, nomes de cor e o Web Worker. No navegador:

1. `npm run dev` e entrar com um cliente que tenha medidas no perfil.
2. Abrir o provador do Hoodie Core e trocar P / M / G / GG.
3. Em "Simular corpo (dev)", testar por exemplo:
   - normal: 175 cm, 75 kg, peito 96, cintura 82, quadril 100;
   - quadril grande: quadril 130;
   - barriga: 110 kg, peito 112, cintura 120, quadril 112;
   - magro num GG: 178 cm, 58 kg, peito 84, cintura 68, quadril 86 (ver de
     lado: a frente cai rente ao peito).
4. O console do navegador mostra o tempo do caimento e quantos pontos ainda
   encostam na pele.

## Limitações conhecidas

- **Uma pose só** (braços a 30°); sem animação.
- **Corpo base único** (feminino, 1,66 m). Corpos masculinos são aproximados,
  e o busto cresce junto com o peito.
- **Ombros mudam pouco:** a shape key de ombro só vai de −3,8 a +3,8 cm.
- **Graduação por regra, não molde real por tamanho.** As regras são as de
  confecção e da tabela de medidas; a loja não tem as medidas da peça pronta
  de cada tamanho.
- **O caimento não é física.** Não surgem dobras novas (a sobra de um
  tamanho maior vira largura, não pregas), e uma peça apertada no quadril
  não "sobe". Mangas e capuz não têm caimento; a manga só assenta onde o
  molde encostava no braço, o que é pouco nas duas peças de hoje.
- **Não há colisão tecido com tecido.** Em corpos muito grandes, o tronco
  pode atravessar a manga.
- **Moletom:** dobra pequena na axila e punho embolado aproximado. O punho
  não abraça o pulso: a manga do molde passa do pulso e cobre o começo da
  mão, que é mais larga; corrigir pede encurtar a manga no Blender.
- **Corpos muito pesados** (perto do máximo do painel): o braço encosta no
  tronco e o tecido da axila fica colado na pele, ou alguns milímetros por
  dentro, embaixo do braço. Com quadril grande, a mão também encosta no
  quadril (braços a 30°).
- **Aspereza que sobra:** nos corpos grandes o tecido ainda tem pequenas
  ondulações onde é empurrado para fora do corpo.
- **Cor:** estampas coloridas viram um tom só (o da cor escolhida). O nome
  da cor vira um tom por uma lista (`src/lib/color-names.ts`): aceita nomes
  compostos ("Azul Marinho"), a cor base de um nome fora da lista ("Rosa
  Chiclete" → rosa) e o código da cor ("#6b1f2a"); o que não reconhece fica
  cinza escuro.
- **Desempenho:** a conta não trava mais a página, mas a peça nova demora de
  0,3 a 0,75 s para aparecer. Feito e testado para computador (o foco do
  projeto agora); não foi testado no celular.

## Pendências

- **Preencher quadril e braço** na tabela de medidas do Hoodie Core.
