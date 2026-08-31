# VESTRA ROOM

Loja online de roupas com **provador virtual 3D (VESTRA FIT)**. Navegue pelo catálogo, visualize peças em 3D, cadastre suas medidas e gerencie a loja por uma área administrativa.

Projeto em desenvolvimento — MVP acadêmico.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Three.js (React Three Fiber + Drei) · Prisma 7 · PostgreSQL (Supabase) · Auth.js (NextAuth v5) · Vercel

---

## Pré-requisitos

- **Node.js 20+**
- **npm 10+**
- **Git**

Verifique:

```bash
node -v
npm -v
git --version
```

---

## Como rodar em outra máquina (passo a passo)

### 1. Clonar

```bash
git clone https://github.com/oFelpxz/VESTRA_ROOM.git
cd VESTRA_ROOM
```

> Garanta que o repositório no GitHub está atualizado (faça `git push` na máquina principal antes). O outro computador roda exatamente o que está no GitHub.

### 2. Instalar dependências

```bash
npm install
```

O `npm install` roda automaticamente `prisma generate` (script `postinstall`), gerando o Prisma Client em `src/generated/prisma/`. Não precisa de banco para isso.

### 3. Criar o arquivo `.env`

O `.env` **não vai para o Git** (contém credenciais). Crie-o na raiz copiando o modelo:

```bash
cp .env.example .env
```

Preencha as variáveis (detalhes na seção [Variáveis de ambiente](#variáveis-de-ambiente)):

```env
DATABASE_URL="postgresql://postgres.SEU_REF:SUA_SENHA@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.SEU_REF:SUA_SENHA@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="um-segredo-aleatorio"

# Storage dos modelos 3D (item 26). Sem estas, o upload cai no filesystem local.
SUPABASE_URL="https://SEU_REF.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."      # Project Settings → API (chave secreta)
SUPABASE_MODELS_BUCKET="models-3d"              # bucket privado
```

> Use **os mesmos valores** da máquina principal (mesmo banco Supabase). Se não tiver o `AUTH_SECRET`, gere um novo com `npx auth secret` — só invalida sessões antigas, nada quebra.

### 4. Banco de dados

**Caso A — usando o mesmo Supabase da máquina principal (mais comum):**
O banco já está migrado e populado. **Não precisa rodar migration nem seed.** Pule para o passo 5.

**Caso B — banco Supabase novo/vazio:**

```bash
npx prisma migrate deploy   # aplica as migrations existentes
npm run db:seed             # popula categorias, produtos e usuários de teste
```

### 5. Rodar

```bash
npm run dev
```

Abra **http://localhost:3000**.

---

## Variáveis de ambiente

| Variável | Para que serve | Onde obter |
|---|---|---|
| `DATABASE_URL` | Conexão do app em runtime (pooler, porta **6543**, com `?pgbouncer=true`) | Supabase → Project Settings → Database → Connection string → **Transaction** |
| `DIRECT_URL` | Conexão direta para migrations (porta **5432**) | Supabase → mesma tela → **Session** / direct |
| `AUTH_SECRET` | Assina o JWT da sessão (Auth.js) | Gere: `npx auth secret` ou `openssl rand -base64 32` |
| `SUPABASE_URL` | Base do projeto para o Storage 3D | Supabase → Project Settings → API → **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso de servidor ao Storage (upload/assinatura). **Secreta.** | Supabase → Project Settings → API → chave `service_role` / `sb_secret_…` |
| `SUPABASE_MODELS_BUCKET` | Nome do bucket **privado** dos modelos (default `models-3d`) | Supabase → Storage → criar bucket |

> A senha do banco fica em Supabase → Project Settings → Database → **Reset database password** (use só letras e números para evitar problemas de URL).
>
> **Sem as variáveis `SUPABASE_*`** o upload de modelos 3D continua funcionando, mas grava em `public/models/` (fallback local) em vez do Storage em nuvem.

---

## Usuários de teste (criados pelo seed)

| Papel | E-mail | Senha |
|---|---|---|
| Admin | `admin@vestra.room` | `vestra123` |
| Operador de Estoque | `estoque@vestra.room` | `estoque123` |
| Modelador 3D | `modelador@vestra.room` | `modelo123` |
| Cliente | `cliente@vestra.room` | `cliente123` |

Todos os três perfis de staff acessam `/admin`, mas cada um só enxerga (e só consegue abrir) as sub-rotas do seu escopo — controlado em [`src/lib/admin-access.ts`](src/lib/admin-access.ts), a fonte única usada tanto pelo middleware (`src/auth.config.ts`) quanto pela navegação (`src/components/admin/admin-nav.tsx`):

| Perfil | Painel | Categorias | Produtos | Modelos 3D | Pedidos | Estoque | Tabela de medidas |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Operador de Estoque | ✅ | – | – | – | ✅ | ✅ | – |
| Modelador 3D | ✅ | – | – | ✅ | – | – | – |

---

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Roda o build de produção |
| `npm run lint` | ESLint |
| `npm run db:seed` | Popula o banco (categorias, produtos, usuários) |
| `npx prisma generate` | Regenera o Prisma Client |
| `npx prisma migrate deploy` | Aplica migrations num banco novo |
| `npx prisma migrate dev --name X` | Cria nova migration (após mudar o schema) |
| `npx prisma studio` | GUI do banco (no Prisma 7 pode ter instabilidade; use o Table Editor do Supabase como alternativa) |

---

## Estrutura (resumo)

```
prisma/
  schema.prisma        # 9 modelos (User, Product, Variant, Image, Category,
  seed.ts              #  Model3D, SizeChart, SizeChartMeasure, MeasurementProfile)
prisma.config.ts       # Config Prisma 7 (usa DIRECT_URL nas migrations)
public/models/         # Modelos .glb (hoodie_black.glb)
src/
  app/                 # Rotas: /, /catalogo, /produto/[id], /teste-3d,
                        #        /login, /cadastro, /perfil, /perfil/medidas,
                        #        /admin, /admin/categorias, /admin/medidas, /sobre, /lookbook
  auth.ts              # Auth.js (Credentials + Prisma + bcrypt)
  auth.config.ts       # Config edge-safe (callbacks, proteção de rota)
  proxy.ts             # Middleware (Next.js 16) — protege /perfil e /admin
  components/          # ui/, layout/, product/, marketing/, viewer-3d/, admin/, profile/
  lib/                 # prisma.ts, products.ts, *-actions.ts, format.ts, utils.ts
  generated/prisma/    # Prisma Client gerado (gitignored — recriado no install)
```

---

## Notas técnicas

- **Prisma 7**: usa driver adapter (`@prisma/adapter-pg`). Em runtime conecta pelo pooler do Supabase; migrations usam `DIRECT_URL`.
- **Next.js 16**: o antigo `middleware.ts` foi renomeado para `proxy.ts`.
- **3D**: `Viewer3D` é model-agnostic (auto-centraliza e enquadra qualquer `.glb`). O modelo vem do banco (`Model3D.fileUrl`) por produto.
- **Deploy (Vercel)**: configurar `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` e as `SUPABASE_*` em Settings → Environment Variables. O `postinstall` cuida do `prisma generate` no build.
- **Modelos 3D**: upload em `/admin/modelos-3d` já **otimiza o `.glb` automaticamente** (dedup, weld, quantize) e envia para o **Supabase Storage** (bucket privado, servido por signed URL de 2h). Modelos antigos em `public/models/*.glb` continuam funcionando.

---

## Licença

Projeto acadêmico — MVP em desenvolvimento.
