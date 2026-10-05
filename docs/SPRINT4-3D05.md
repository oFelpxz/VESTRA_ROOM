# Sprint 4 — item 3D-05: avatar validado com medidas reais

> Registro para apresentação ao professor. Item do cronograma: *"Avatar
> gerado pelas medidas do cliente, validado em casos-limite."*
> O avatar em si (corpo MakeHuman com shape keys calibradas em centímetros)
> foi adiantado na Fase 2 — ver `docs/STATUS-FASE2.md` ("Bônus — Avatar 3D
> real") e `docs/VESTRA-FIT-MOLDES.md` ("Medidas do avatar em centímetros").
> Nesta sprint entram a **validação** e a **proteção contra medidas erradas**.

## O que mudou para o cliente

Antes, o formulário de medidas (`/perfil/medidas`) aceitava qualquer número
positivo. Quem digitava a altura em metros (`1,75`) ou um zero a mais
(`960`) salvava sem aviso, e o provador mostrava um avatar deformado.

Agora cada medida tem uma faixa aceita. Fora dela, o perfil **não é salvo**
e aparece a mensagem, por exemplo:

> Altura: informe um valor entre 100 e 230 cm.

A checagem é feita **no servidor** (vale mesmo se alguém burlar o navegador)
e também no próprio campo (`min`/`max`), para o aviso aparecer antes de
enviar. Campo vazio continua permitido: o avatar usa a medida de referência.

| Medida | Mínimo | Máximo |
|---|---|---|
| Altura | 100 cm | 230 cm |
| Peso | 25 kg | 250 kg |
| Tórax / Busto | 50 cm | 180 cm |
| Cintura | 40 cm | 180 cm |
| Quadril | 50 cm | 180 cm |
| Ombros | 25 cm | 70 cm |
| Braço | 30 cm | 100 cm |
| Perna | 40 cm | 120 cm |

As faixas são largas de propósito: barram erro de digitação, nunca um corpo
real.

## Validação do avatar

Para cada perfil de medidas, o avatar é gerado (`buildAvatarParams`) e as
medidas do corpo resultante são calculadas de volta
(`predictAvatarMeasurements`) e comparadas com o que o cliente pediu. Oito
perfis, nos três corpos (neutro, masculino, feminino):

| Caso | Altura | Peso | Peito | Cintura | Quadril | Ombro |
|---|---|---|---|---|---|---|
| normal | 175 | 75 | 96 | 82 | 100 | 45 |
| baixa | 150 | 48 | 82 | 64 | 88 | 37 |
| alto | 200 | 95 | 108 | 90 | 106 | 52 |
| magro | 178 | 58 | 84 | 68 | 86 | 42 |
| pesado | 175 | 130 | 125 | 120 | 125 | 50 |
| quadril largo | 165 | 80 | 96 | 78 | 130 | 42 |
| muito alto | 220 | 110 | 115 | 95 | 110 | 55 |
| muito baixo | 120 | 35 | 70 | 58 | 72 | 32 |

**Resultado:** altura, peito, cintura, quadril, braço e perna ficam a menos
de **0,5 cm** do pedido em todos os 24 casos (na prática, menos de 0,1 cm).

### Limitações encontradas

- **Ombros estreitos saem um pouco largos.** A shape key de ombro só varia
  cerca de ±3,8 cm. Pedindo ombro de 42 cm num corpo masculino magro, o avatar
  sai com até **+4 cm** (neutro: +2,6 cm; feminino: +1,3 cm). Peito, cintura e
  quadril não são afetados.
- **Corpos muito grandes param no máximo.** Acima de ~105 kg a shape key de
  peso chega ao limite; as de circunferência compensam até onde conseguem.
  Num perfil extremo (150 kg, peito 160, cintura 150, quadril 160) as medidas
  ficam até 5 cm abaixo do pedido — o avatar **nunca passa** do pedido, o que
  evitaria sugerir um tamanho maior que o necessário.
- **Perfil vazio ou com zeros** gera o corpo de referência (1,70 m), sem erro.
- **Nas pontas das faixas aceitas** (todos os mínimos ou todos os máximos),
  todos os pesos das shape keys continuam números válidos entre −2 e 2: o
  avatar nunca "explode".

### O que o teste prova e o que não prova

`predictAvatarMeasurements` usa a mesma calibração (cm por shape key) que o
gerador. O teste automático confirma a **conta e os limites** — que o gerador
pede ao corpo exatamente as medidas certas e que nenhum caso sai das faixas.
A calibração em si (se 1 unidade de shape key = X cm na malha real) foi
medida no Blender na Fase 2, com 5 a 7 corpos, erro de 0,5 a 1 cm
(`docs/VESTRA-FIT-MOLDES.md`).

## Onde está

| Parte | Arquivo |
|---|---|
| Faixas aceitas e mensagem de erro | `src/lib/measurement-limits.ts` |
| Checagem no servidor antes de salvar | `src/lib/measurement-actions.ts` |
| `min`/`max` nos campos | `src/components/profile/measurement-form.tsx` |
| Medidas do avatar gerado, em cm | `src/lib/avatar-builder.ts` (`predictAvatarMeasurements`) |
| Testes dos casos-limite | `src/lib/avatar-builder.test.ts` ("3D-05") |
| Testes das faixas | `src/lib/measurement-limits.test.ts` |

## Como testar

1. `npm test` — roda os casos acima (bloco "3D-05").
2. Logado, abrir `/perfil/medidas` e digitar a altura `1,75`: o campo avisa
   que o mínimo é 100. Com a checagem do navegador desligada, o servidor
   responde "Altura: informe um valor entre 100 e 230 cm." e nada é salvo.
3. Salvar medidas normais e abrir o provador: o avatar acompanha as medidas.
