# VESTRA FIT — moldes, tamanhos independentes e caimento

> Registro do trabalho no provador virtual 3D (branch `feat/molde-camiseta`).
> Objetivo: deixar o 3D mais rápido de produzir e mais fiel — cada peça é
> preparada uma vez ("molde") por scripts, e o site só veste o molde no corpo
> do cliente.

## O que o cliente vê

No provador (`/produto/<id>/provador`), o avatar tem as medidas do cliente e
a peça aparece **no tamanho escolhido**, não sob medida:

- **Magro num GG:** a peça sobra (mais larga e mais comprida).
- **Grande num P:** o tecido fica esticado sobre o corpo.
- **Corpo perto do tamanho:** a peça cai como no molde.
- **Quadril ou barriga maiores que a peça:** o tecido desce reto a partir do
  ponto mais largo, em vez de "abraçar" o corpo por baixo.

Hoje isso vale para o **Hoodie Core**. As outras peças continuam com o encaixe
aproximado antigo até ganharem molde (o da Boxy Tee 01 já existe, ver
"Pendências").

Em desenvolvimento, o painel **"Simular corpo (dev)"** do provador troca
altura, peso, peito, cintura e quadril sem mexer no perfil salvo. Ele não
aparece em produção.

## Como funciona

| Parte | Onde |
|---|---|
| Avatar com medidas em cm e braços a 30° | `public/models/avatar_base.glb` |
| Calibração das medidas (cm → shape keys) | `src/lib/avatar-builder.ts` (`AVATAR_CALIBRATION`) |
| Moletom moldado (tamanho M) | `public/models/hoodie-core-v3.glb` |
| Vestir: tamanho, apoio nos ombros, mangas no braço | `src/components/viewer-3d/dressed-avatar.tsx` |
| Empurrar o tecido para fora do corpo + caimento | `src/lib/garment-fit.ts` (`pushOut`, `drape`) |
| Escala por tamanho a partir da tabela de medidas | `src/lib/garment-fit.ts` (`sizeScale`) |
| Provador escolhe: peça moldada ou encaixe antigo | `src/components/viewer-3d/tryon-scene.tsx` |
| Scripts do Blender que geram avatar e moldes | `scripts/molde/` (ver o README de lá) |

A cada troca de tamanho ou de medida, o site:

1. aplica as medidas no corpo (shape keys);
2. aumenta ou diminui a peça pelo tamanho (peito da tabela ÷ peito do M; o
   comprimento cresce metade disso) e a apoia nos ombros do cliente;
3. faz as mangas acompanharem o braço do cliente (atributo `_BRACO` gravado no
   molde);
4. empurra o tecido para fora onde o corpo atravessa;
5. aplica o caimento: no tronco, o tecido empurrado não volta para dentro
   abaixo do ponto mais largo.

Leva de 0,3 a 0,7 s no computador de desenvolvimento.

## Decisões

### Tamanhos independentes do corpo

A primeira versão fazia a peça acompanhar as medidas do cliente, como uma
roupa sob medida. Isso esconde o que o provador existe para mostrar: um GG
num corpo magro tem que sobrar. Agora a peça tem a forma do tamanho, e o
corpo só a empurra onde for maior que ela.

### Medidas do avatar em centímetros

As shape keys originais (MakeHuman) não correspondiam a circunferências: a de
cintura criava uma "barriga de grávida" e a de peito mudava menos de 1 cm.
`avatar_medidas.py` refaz peito, cintura e quadril como faixas que crescem
por igual em volta do tronco, e mede quantos cm cada uma muda. O site resolve
um sistema 3×3 para acertar as três medidas ao mesmo tempo, já descontando o
que o peso corporal acrescenta.

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

### Scripts reproduzíveis

Todo o processo roda no Blender sem interface. Rodando os scripts de
`scripts/molde/` a partir dos arquivos originais, o avatar e o moletom saem
idênticos, byte a byte, aos do repositório.

## Arquivos que mudam juntos

O moletom moldado só serve no avatar novo (braços a 30°), e o moletom antigo
não serve nele. Por isso `avatar_base.glb` e `hoodie-core-v3.glb` entram
juntos. Não há mudança no banco: o `Model3D` do Hoodie Core continua
apontando para `/models/hoodie-core-v3.glb`.

O modo **Manequim** da página do produto continua funcionando: o manequim não
tem braços, e o tronco do avatar não mudou de lugar.

## Como testar

1. `npm run dev` e entrar com um cliente que tenha medidas no perfil.
2. Abrir o provador do Hoodie Core e trocar P / M / G / GG.
3. Em "Simular corpo (dev)", testar por exemplo:
   - normal: 175 cm, 75 kg, peito 96, cintura 82, quadril 100;
   - quadril grande: quadril 130;
   - barriga: 110 kg, peito 112, cintura 120, quadril 112.
4. O console do navegador mostra o tempo do caimento e quantos pontos ainda
   encostam na pele.

## Limitações conhecidas

- **Uma pose só** (braços a 30°); sem animação.
- **Corpo base único** (feminino, 1,66 m). Corpos masculinos são aproximados,
  e o busto cresce junto com o peito.
- **Só 5 medidas entram.** Ombro, braço e perna são deduzidos.
- **Tamanhos são o M em escala.** A graduação real entre tamanhos não é
  proporcional assim.
- **O caimento não é física.** Não surgem dobras novas, e uma peça apertada
  no quadril não "sobe". Mangas e capuz não têm caimento.
- **Não há colisão tecido com tecido.** Em corpos muito grandes, o tronco
  pode atravessar a manga.
- **Moletom:** dobra pequena na axila, punho embolado aproximado, ribana da
  barra que não aperta.
- **Cor:** a troca de cor não clareia textura escura (já era assim antes).
- **Desempenho:** o cálculo roda na mesma thread da página e trava a tela por
  um instante. Não foi testado no celular.

## Pendências

- **Publicar o molde da camiseta:** gerado e testado no provador, mas ainda
  não publicado.
- **Regenerar o `manequim.glb`** com o avatar novo (opcional).
- **Levar o caimento para um Web Worker,** para não travar a tela.
- **Corrigir a cor sobre texturas escuras.**
