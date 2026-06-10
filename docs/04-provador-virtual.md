# 04 — Provador Virtual

**Semana 4** · Depende de: 02 (modelo 3D validado), perfil de medidas
**Objetivo**: Cliente carrega seu avatar baseado em medidas, veste a peça em 3D, vê indicador de caimento e adiciona o look ao carrinho.

## Estrutura de arquivos

```
src/app/produto/[slug]/provador/page.tsx   # Tela cheia com avatar + roupa
src/components/viewer-3d/
  avatar.tsx                   # Componente do avatar (base genérico parametrizado)
  fit-indicator.tsx            # Badge de caimento (Justo / Ideal / Folgado)
  tryon-controls.tsx           # Variante (cor/tamanho), girar, zoom, add ao carrinho
src/lib/
  fit-calculator.ts            # Calcula caimento comparando medidas do user × SizeChart
  avatar-builder.ts            # Constrói parâmetros do avatar a partir do MeasurementProfile
public/models/
  avatar_base_male.glb         # (precisa adquirir/gerar)
  avatar_base_female.glb       # (opcional MVP)
```

## Passo a passo

### 1. Avatar base

Para MVP, escolher uma das opções:
- **Opção A (mais simples)**: usar um modelo base único parametrizado por escala (altura/peso). Não anatomicamente preciso, mas suficiente pra demo.
- **Opção B**: ReadyPlayerMe / MakeHuman pré-gerados (3 silhuetas: P/M/G).

Recomendação MVP: **Opção A** com escala por eixo (Y=altura, X/Z=largura proporcional ao peso).

### 2. Cálculo de caimento (`src/lib/fit-calculator.ts`)

```ts
type FitResult = { label: 'JUSTO' | 'IDEAL' | 'FOLGADO' | 'NAO_SERVE', score: number, details: string[] };

export function calculateFit(
  userMeasures: MeasurementProfile,
  sizeMeasure: SizeChartMeasure,
  fitPreference: FitPreference
): FitResult {
  // Para cada medida (chest, waist, hip): verificar se está dentro do min-max da size
  // Score: distância normalizada do ponto ideal (meio do intervalo)
  // Label: baseado no score + fitPreference (SLIM tolera mais justo, OVERSIZED mais folgado)
}
```

### 3. Builder de avatar (`src/lib/avatar-builder.ts`)

```ts
export function buildAvatarParams(profile: MeasurementProfile) {
  return {
    scaleY: profile.heightCm / 170,           // referência 1.70m
    scaleXZ: Math.sqrt(profile.weightKg / 70), // referência 70kg
    shoulderRatio: profile.shoulderCm / 45,
    // ...
  };
}
```

### 4. Componente Avatar (`src/components/viewer-3d/avatar.tsx`)

- Carrega `avatar_base.glb` com `useGLTF`
- Aplica escalas calculadas
- Expõe pontos de ancoragem (ombros, peito, quadril) para posicionar a roupa

### 5. Composição Avatar + Roupa

Em `provador/page.tsx`:
- Carrega avatar (escalado pelo perfil)
- Carrega `Model3D` do produto via `useGLTF`
- Posiciona a roupa nas ancoragens do avatar
- Aplica escala/ajuste baseado no tamanho selecionado

> Truque MVP: se a posição precisa for muito complexa, fixar a roupa em coordenadas relativas ao avatar base e aceitar pequenas imperfeições.

### 6. UI / Controles (`tryon-controls.tsx`)

Painel lateral:
- Select de **tamanho** (P, M, G — vem das variantes do produto)
- Select de **cor**
- `fit-indicator.tsx`: badge colorido + tooltip com detalhes (peito 2cm acima, quadril ok…)
- Slider de "preferência de caimento" (slim/regular/oversized) — atualiza temporariamente sem salvar no perfil
- Botões: girar 360°, zoom in/out, reset
- CTA grande: **"Adicionar ao carrinho"** (chama a action existente de cart)

### 7. Guard de acesso

- Se user não tem `MeasurementProfile` completo: redirecionar pra `/perfil/medidas` com aviso
- Se produto não tem modelo 3D VALIDATED: ocultar botão "Experimentar" na página do produto
- Se user não aceitou termos: modal de aceite antes de entrar

### 8. Botão de entrada

Em `/produto/[slug]`, adicionar botão "Experimentar virtualmente" → `/produto/[slug]/provador`
(só visível se `product.availableForVirtualTryOn && product.has3DModel`)

## Critérios de aceitação

- [ ] User com medidas preenchidas acessa o provador e vê avatar escalado
- [ ] Roupa carrega sobre o avatar (mesmo que com posição aproximada)
- [ ] Trocar tamanho atualiza o caimento em <500ms
- [ ] Indicador mostra "JUSTO", "IDEAL" ou "FOLGADO" coerente com as medidas
- [ ] Trocar cor atualiza textura/material
- [ ] Adicionar ao carrinho leva a variante correta (tamanho+cor escolhidos)
- [ ] User sem medidas é redirecionado pra cadastrá-las
- [ ] Funciona em desktop (mobile é nice-to-have)
