# Estudo: o provador 3D com cara profissional

27/10/2026. Pergunta: o que falta para o 3D do provador parecer **profissional**, do ajuste mais simples à solução mais cara? Quanto custa cada caminho e o que dá para entregar até o congelamento (13/11)?

Partida: o fim da lista 11 (commit a1c471a). O corpo segue as medidas com erro de até 1 cm, a pele tem tom quente, o cabelo é uma casca curta, o estúdio tem fundo em degradê e sombra no chão, e o enquadramento é o mesmo para qualquer altura.

---

## 1. Diagnóstico: o que ainda entrega que é 3D

Fotos de referência: as 6 alturas e os 6 looks no fim da lista 11.

| # | Ponto | O que se vê | Peso na impressão |
|---|---|---|---|
| D1 | **Olhos** | Buraco escuro sem íris nem brilho. É o primeiro lugar para onde se olha e o que mais deixa o rosto com cara de manequim. | Muito alto |
| D2 | **Lente da câmera** | A abertura de 38° faz a cabeça parecer grande e as pernas curtas. Foto de catálogo usa teleobjetiva, que dá corpo "achatado" e proporção real. | Alto (e barato) |
| D3 | **Pose** | Pose em "A" rígida, braços abertos, igual para todo mundo. Parece uma ficha técnica, não uma foto. | Alto (e caro) |
| D4 | **Cabelo** | Casca lisa, borda serrilhada na têmpora, sem brilho de fio. | Alto |
| D5 | **Tecido de perto** | A trama é desenhada no código: de longe convence, de perto parece "plástico com risquinhos". O cetim do vestido parece látex. | Médio-alto |
| D6 | **Barras** | A barra da calça e a da camiseta aparecem "desfiadas" ou serrilhadas em vários corpos. Parece defeito. | Médio |
| D7 | **Sombras** | A sombra do sol é dura e o contato entre as peças é fraco: falta sombra embaixo da barra da camiseta e na axila. | Médio |
| D8 | **Pele de perto** | Cor certa, mas lisa demais (sem poro). | Médio |
| D9 | **Rosto** | Sem sobrancelha, sem cor no lábio, sem pálpebra. | Médio |
| D10 | **Tênis** | Branco genérico, sem costura nem sola marcada. | Baixo |

**O que já está no nível certo:**
- Tone mapping Neutral, que preserva a cor da peça.
- Antisserrilhado MSAA.
- GTAO (oclusão de ambiente).
- Luz de estúdio com softboxes.
- Caimento pelo corpo medido.

Nada disso precisa ser refeito.

---

## 2. Todas as soluções, da mais simples à mais profissional

Esforço: **P** = horas, **M** = 1–2 dias, **G** = 3+ dias, **XG** = semanas ou meses.
Risco: a chance de não ficar pronto ou de quebrar algo antes de 13/11.

### Nível 0: ajustes de render (só configuração)

| Solução | Resolve | Esforço | Risco | Observação |
|---|---|---|---|---|
| Lente de catálogo (FOV 38° → ~22°) | D2 | P | Baixo | O enquadramento já é calculado em `studio-frame.ts`; basta trocar a constante e conferir os testes. |
| Sombras macias PCSS (drei `SoftShadows`) | D7 | P | Médio | Mexe no shader de sombra do three. É preciso testar com a versão 0.184. |
| Sombra acumulada no chão (`AccumulativeShadows` + `RandomizedLight`) | D7 | P | Baixo | Sombra suave "de verdade", sem custo depois que acumula. |
| Brilho por tecido (cetim menos especular, com anisotropia) | D5 | P | Baixo | Tira a cara de látex do vestido. |
| Tone mapping AgX | — | P | — | **Não recomendo.** O Neutral já é a escolha certa para cor de produto; o AgX tira saturação. |

### Nível 1: materiais e detalhe (shader e texturas livres)

| Solução | Resolve | Esforço | Risco | Observação |
|---|---|---|---|---|
| **Olho de verdade**: globo com íris, pupila, córnea brilhante e reflexo da luz | D1 | M | Baixo | Gerado no código, sem textura. Maior ganho por hora de todo o estudo. |
| Rosto: sobrancelha, cor do lábio e linha da pálpebra pintadas no shader | D9 | M | Baixo | Usa a mesma técnica da máscara do cabelo (atributo na malha). |
| Pele com poro: relevo fino gerado no shader, sem UV (triplanar) | D8 | M | Baixo | De perto deixa de ser "tinta". |
| Cabelo com fio: brilho anisotrópico (Kajiya-Kay), mechas no relevo, borda da têmpora lisa | D4 | M | Médio | Mantém a casca atual e melhora o que já existe. |
| Tecido com textura escaneada (CC0 do ambientCG / Poly Haven: jersey, moletom, denim, sarja, cetim) | D5 | G | Médio | Relevo e aspereza reais. Licença CC0, sem custo e sem crédito obrigatório. Cada molde precisa de escala certa. |
| Espessura do tecido na barra e na gola | D6 | M | Baixo | A borda vira uma "dobra" com volume em vez de uma folha fina. |

### Nível 2: geometria (forma do corpo e da roupa)

| Solução | Resolve | Esforço | Risco | Observação |
|---|---|---|---|---|
| Barras limpas: suavizar a borda da calça e da camiseta depois do caimento | D6 | M | Baixo | Na calça, só a correção mínima (regra: calças e shorts mínimos). |
| **Pose relaxada**: braços mais baixos, como numa foto | D3 | G | **Alto** | O caimento todo é calculado em pose "A". Precisa de uma shape key "braços abaixados" no avatar e de as mangas acompanharem pelo atributo `_braco`. Pode quebrar mangas largas (moletom). |
| Cabelo em "cards" (tiras com transparência, como nos jogos) | D4 | G | Médio | Fica bem melhor, mas exige modelar no Blender e ordenar a transparência. |
| Tênis remodelado: sola, costura, cadarço | D10 | M | Baixo | Continua genérico, sem marca. |
| Simulação de tecido no Blender, pré-calculada por tamanho | — | XG | Alto | Foi cortada na lista 3. São 6 corpos × N tamanhos × N peças, e não vale para o corpo do cliente. |

### Nível 3: foto realista a partir do próprio 3D

| Solução | Resolve | Esforço | Risco | Observação |
|---|---|---|---|---|
| **Botão "Foto em alta"**: path tracing no navegador (`@react-three/gpu-pathtracer`, MIT) | Tudo junto (luz, sombra, reflexo) | G | Médio-alto | Em ~10–30 s gera uma foto com luz física da mesma cena. Limite: os shaders próprios (pele, trama) não entram no path tracer, então cada material precisa de uma versão "física" aproximada. |
| Render no Blender Cycles no servidor | Tudo | XG | Alto | Precisa de servidor com GPU; não cabe na Vercel. Serviria só para imagens prontas da apresentação. |

### Nível 4: IA generativa (foto, não 3D)

| Solução | Resolve | Esforço | Risco | Observação |
|---|---|---|---|---|
| API de provador por IA (FASHN ~US$0,075–0,30 por imagem; Google Vertex "Virtual Try-On" ~US$0,06 por imagem) | Foto realista | M | Alto | Precisa de chave paga (decisão de negócio). A IA **inventa** o caimento, o que contradiz a promessa do VESTRA FIT ("medida real"). |
| Modelos abertos (IDM-VTON, CatVTON) | Foto realista | G | Alto | O IDM-VTON é **não comercial** (CC BY-NC-SA). Precisa de GPU para rodar. |
| "Render → foto" com difusão guiada pela profundidade do 3D | Foto realista | G | Alto | Mantém a silhueta do 3D, mas pode mudar cor e detalhe da peça. Mesmo problema de confiança. |

### Nível 5: pipeline de estúdio profissional

| Solução | O que é | Esforço | Por que não agora |
|---|---|---|---|
| Roupas no CLO3D / Marvelous Designer | Padrão da indústria de moda digital. O Marvelous 2026 já exporta glTF. | XG | Licença paga, alguém que saiba modelar as peças, e refazer os moldes `vestra_fit`. |
| Avatar MetaHuman / Character Creator | Humanos fotorrealistas | XG | Arquivos de centenas de MB, pesados para web. Todo o ajuste por medidas (`shapeBody`, fita métrica) teria de ser refeito. Character Creator exige licença para distribuir. |
| Corpo paramétrico SMPL-X | Modelo de corpo usado na pesquisa | G | Licença **não comercial**; a licença comercial é paga. O nosso corpo já mede com erro de 1 cm. |
| Avatar por Gaussian Splatting (escaneado) | Pessoa "fotográfica" em 3D | XG | Precisa de escaneamento por celular (fora da regra "sem celular") e trocar roupa em splat ainda é pesquisa. |
| Simulação de tecido em tempo real (WebGPU, XPBD) | Tecido que cai e balança de verdade | XG | Existem demos, mas nada pronto para roupa em avatar. São meses de trabalho e não roda em todo navegador. |

---

## 3. Conclusão

1. **O maior salto por hora está nos níveis 0 e 1.** Olho, lente, cabelo, tecido e sombra são o que um avaliador vê em 5 segundos. Tudo isso é melhoria do que já existe, como manda a regra "melhorar o 3D antes de coisa nova".
2. **A pose relaxada é o item que mais aproxima de uma foto de catálogo, e também o mais arriscado.** Entra na lista com uma saída: se as mangas largas quebrarem, fica a pose atual.
3. **"Foto em alta" com path tracing** é o "uau" da apresentação: o mesmo look, com luz de cinema, gerado no navegador e sem custo por imagem.
4. **IA generativa e pipeline profissional ficam de fora até 13/11.** O motivo não é só o tempo: a IA desenha um caimento que não é medido, e o diferencial do VESTRA é justamente a medida real. Os dois podem virar o "próximo passo" no roteiro.

---

## 4. Proposta: lista 12, "foto de catálogo"

Um tema só: o provador deixa de parecer 3D de jogo e passa a parecer foto de catálogo. São 10 itens pesados, na ordem do maior ganho para o maior risco.

| # | Item | Ganho na apresentação |
|---|---|---|
| 1 | **Lente de catálogo**: FOV ~22°, enquadramento e testes ajustados | Proporção real do corpo: cabeça menor, pernas compridas, como uma foto de loja |
| 2 | **Olhos de verdade**: globo, íris (tom ligado à pele), pupila, córnea e reflexo | O rosto "acorda", sem o buraco escuro |
| 3 | **Rosto**: sobrancelha, cor do lábio, linha da pálpebra (no shader, sem textura) | Deixa de ser manequim; continua neutro e sem retrato de ninguém |
| 4 | **Cabelo com fio**: brilho anisotrópico, mechas, borda da têmpora lisa | Cabelo deixa de ser "touca" |
| 5 | **Pele com poro** e brilho variando por região (testa, nariz) | Close-up convincente |
| 6 | **Tecido escaneado** (CC0) para algodão, moletom, denim, sarja e cetim; cetim com anisotropia | Tecido de perto parece tecido; vestido deixa de parecer látex |
| 7 | **Barras e golas com espessura**, barra limpa (na calça, só a correção mínima) | Some o "desfiado" que parece defeito |
| 8 | **Sombras macias**: PCSS no corpo, sombra acumulada no chão, contato na barra e na axila | Volume de estúdio fotográfico |
| 9 | **Pose relaxada** com braços mais baixos (com saída de volta para a pose A) | Parece foto, não ficha técnica |
| 10 | **"Foto em alta"**: path tracing no navegador, com revisão final de todos os corpos e looks | Final da demonstração: "e se quiser a foto do look…" |

Cada item fecha com o mesmo controle de sempre: testes, tsc, lint, uma imagem de antes e depois, e um commit.

Itens 1–8 devem caber até ~08/11. Os itens 9 e 10 têm saída: se não ficarem bons até 12/11, ficam de fora sem afetar o resto.

### Fontes consultadas
- three.js: [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [SSSLightingModel](https://threejs.org/docs/pages/SSSLightingModel.html), [AgX × ACES](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609)
- drei: [AccumulativeShadows](https://drei.docs.pmnd.rs/staging/accumulative-shadows)
- [@react-three/gpu-pathtracer](https://www.npmjs.com/package/@react-three/gpu-pathtracer)
- IA de provador: [comparação de provadores abertos (FASHN)](https://fashn.ai/blog/comparing-the-top-4-open-source-virtual-try-on-viton-models), [IDM-VTON (licença)](https://huggingface.co/ompatel245/IDM-VTON/blob/main/README.md), [APIs de provador 2026 (fal)](https://fal.ai/learn/tools/best-virtual-try-on-apis-2026), [Google Virtual Try-On](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/virtual-try-on-001)
- Avatares e corpo: [licença SMPL-X](https://smpl-x.is.tue.mpg.de/modellicense.html), [licença Character Creator](https://forum.reallusion.com/Topic551927.aspx), [Spark / Gaussian splats](https://sparkjs.dev/docs/overview/), [avatares em splat](https://arxiv.org/html/2510.13978v2)
- Roupas e tecido: [Marvelous Designer 2026 com glTF](https://www.cgchannel.com/tag/everywear/), [CLO3D → three.js](https://support.clo3d.com/hc/ja/community/posts/4417190359449-CLO3D-Blender-Three-js-workflow), [tecido em WebGPU](https://arxiv.org/html/2507.11794v1)

### Resultado (28/10/2026)

Itens 1–6, 8 e 9 entraram. O item 7 não precisou de mudança. O item 10 ficou de fora: no protótipo (three-gpu-pathtracer 0.0.24, 160 amostras, ~26 s por imagem) o path tracer ignora os shaders próprios dos itens 2–5, e a foto saiu pior que o desenho normal, com o cabelo como uma touca branca, os olhos pretos, a pele lisa e grão no tecido. Refazer cada material numa versão "física" repetiria o trabalho desses itens; o botão "Baixar foto do look" continua com o desenho normal.
