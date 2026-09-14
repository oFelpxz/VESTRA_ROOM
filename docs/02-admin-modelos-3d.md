# 02 — Admin: Upload e Validação de Modelos 3D

**Semana 3** · Depende de: 01 · Pré-requisito para: 04
**Objetivo**: Permitir que `ADMIN` ou `MODEL_3D` envie um arquivo GLB/GLTF, associe a um produto e valide visualmente antes de publicar.

## Estrutura de arquivos

```
src/app/admin/modelos-3d/
  page.tsx                     # Lista de modelos por status
  [productId]/page.tsx         # Upload + preview + validação
src/app/api/models-3d/
  upload/route.ts              # POST multipart → grava em public/models/{slug}.glb
src/components/admin/
  model-3d-uploader.tsx        # Drag & drop + barra de progresso
  model-3d-validator.tsx       # Viewer com controles e botões Aprovar/Rejeitar
src/lib/
  model-3d-actions.ts          # createModel3D, validateModel3D, rejectModel3D, replaceModel3D
```

## Passo a passo

### 1. Endpoint de upload (`src/app/api/models-3d/upload/route.ts`)

- Aceitar `multipart/form-data` com campo `file` e `productId`
- Validar:
  - extensão `.glb` ou `.gltf`
  - tamanho máx (sugestão: 25 MB)
  - role do usuário (`ADMIN` ou `MODEL_3D`)
- Salvar em `public/models/{product-slug}-v{version}.glb`
- Retornar `{ fileUrl, fileSizeMb }`

> Nota MVP: filesystem local é OK. Para produção, trocar por S3/R2 sem mudar a action.

### 2. Server Actions (`src/lib/model-3d-actions.ts`)

- `createModel3D(productId, { fileUrl, format, fileSizeMb })` — cria com status `PENDING`, version=1; se já existir, incrementa version
- `validateModel3D(id)` — só `ADMIN`: status `PENDING` → `VALIDATED`; seta `Product.has3DModel = true`
- `rejectModel3D(id, reason)` — status → `REJECTED`
- `markOptimized(id)` — status → `OPTIMIZED` (pós-compressão draco, opcional)

### 3. Lista (`/admin/modelos-3d`)

- Tabs por status: PENDING, VALIDATED, REJECTED, OPTIMIZED
- Cada card: produto, thumbnail (renderiza GLB inline pequeno), versão, tamanho, data
- Ação: abrir validador

### 4. Validador (`/admin/modelos-3d/[productId]`)

- Componente `model-3d-validator.tsx`:
  - Usa `@react-three/fiber` + `drei` (mesma stack do `viewer-3d/viewer.tsx`)
  - Controles: orbit, zoom, reset, troca de fundo claro/escuro
  - Métricas exibidas: tamanho do arquivo, nº de triângulos (via `drei` helpers), nº de materiais
- Botões: **Aprovar** (→ `validateModel3D`) | **Rejeitar** (modal com motivo)
- Após aprovar: redireciona para `/admin/produtos/[id]` mostrando o badge "3D disponível"

### 5. Integração com produto

- No card de produto (`/admin/produtos/[id]`): seção "Modelo 3D"
  - Se nenhum: botão "Enviar modelo 3D" → vai pro uploader
  - Se PENDING: badge amarelo + link para validar
  - Se VALIDATED: preview + botão "Substituir" (cria nova versão)

### 6. Exibição na loja

- Em `/produto/[slug]`: usar `product-viewer.tsx` apenas se `product.has3DModel && model3D.status in (VALIDATED, OPTIMIZED)`
- Fallback: imagem do `ProductImage`

## Critérios de aceitação

- [ ] Admin/MODEL_3D faz upload de `.glb` < 25MB com sucesso
- [ ] Arquivo aparece em `public/models/` com nome versionado
- [ ] Modelo entra na lista como PENDING
- [ ] Validador carrega o modelo e permite girar/zoom
- [ ] Aprovar: `Product.has3DModel = true` e modelo aparece em `/produto/[slug]`
- [ ] Substituir cria version=2 mantendo histórico
- [ ] Arquivo com extensão inválida é rejeitado com mensagem clara
