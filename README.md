# Loja 3D — MVP

Loja online de roupas com **provador virtual 3D**. Permite navegar pelo catálogo, visualizar peças em 360°, cadastrar medidas corporais e (futuramente) experimentar produtos em um avatar 3D antes da compra.

> **Status:** Semana 1 do MVP — fundação técnica, telas placeholder e prova de conceito 3D no navegador.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilização | Tailwind CSS v4 + shadcn/ui (preset Nova / Lucide / Geist) |
| 3D | Three.js + React Three Fiber + Drei |
| ORM | Prisma 7 (gerador `prisma-client` em `src/generated/prisma`) |
| Banco | PostgreSQL (não conectado ainda — ver seção *Banco de dados*) |
| Deploy | Vercel |
| Versionamento | GitHub |

---

## Pré-requisitos

- **Node.js** 20+ (recomendado 20 ou 22 LTS)
- **npm** 10+
- **Git**
- Editor de código (VS Code recomendado)

Verifica as versões:

```powershell
node -v
npm -v
git --version
```

---

## Setup do zero

### 1. Clonar o repositório

```powershell
git clone <URL_DO_REPO>
cd loja-3d
```

### 2. Instalar dependências

```powershell
npm install
```

O `npm install` roda automaticamente `prisma generate` no final (script `postinstall`), criando o Prisma Client em `src/generated/prisma/`.

### 3. Configurar variáveis de ambiente

Copia o `.env.example` para `.env`:

```powershell
Copy-Item .env.example .env
```

Edita o `.env` e ajusta o `DATABASE_URL` (formato Postgres). Exemplo para Postgres local:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/loja3d?schema=public"
```

> Nesta Semana 1, **o banco ainda não está conectado** — você pode deixar a string placeholder. O projeto roda localmente sem precisar de Postgres ativo, porque nenhuma rota faz query no banco ainda.

### 4. Rodar o servidor de desenvolvimento

```powershell
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Estrutura de pastas

```
loja-3d/
├── prisma/
│   └── schema.prisma           # Modelos do banco (User, Product, ProductVariant, ProductImage, Category, Model3D)
├── prisma.config.ts            # Config do Prisma 7 (carrega .env via dotenv)
├── public/
│   └── models/
│       └── Duck.glb            # Modelo 3D de teste (POC)
├── src/
│   ├── app/                    # Rotas (App Router)
│   │   ├── page.tsx            # Home
│   │   ├── login/              # Login (placeholder)
│   │   ├── cadastro/           # Cadastro (placeholder)
│   │   ├── perfil/             # Perfil (placeholder)
│   │   ├── catalogo/           # Catálogo com 6 produtos mock
│   │   ├── produto/[id]/       # Página dinâmica de produto
│   │   └── teste-3d/           # POC 3D (modelo .glb + OrbitControls)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui (button, input, label, card)
│   │   ├── layout/             # Header e Footer
│   │   └── viewer-3d/          # Visualizador 3D
│   ├── lib/
│   │   ├── utils.ts            # cn() do shadcn
│   │   └── prisma.ts           # Singleton do Prisma Client
│   └── generated/
│       └── prisma/             # Cliente gerado pelo Prisma (gitignored)
├── .env.example                # Template de env vars
├── components.json             # Config do shadcn/ui
└── package.json
```

---

## Páginas disponíveis

| Rota | Descrição | Status |
|---|---|---|
| `/` | Home com hero + CTAs | ✅ Funcional |
| `/login` | Formulário de login | 🟡 Placeholder (sem auth) |
| `/cadastro` | Formulário de cadastro | 🟡 Placeholder (sem auth) |
| `/perfil` | Área do usuário | 🟡 Placeholder |
| `/catalogo` | Grid de produtos | 🟡 Mock (6 produtos fake) |
| `/produto/[id]` | Detalhes do produto | 🟡 Placeholder dinâmico |
| `/teste-3d` | POC 3D (rotação + zoom) | ✅ Funcional |

---

## Banco de dados

O schema do Prisma já está definido em [`prisma/schema.prisma`](prisma/schema.prisma) com **6 entidades**:

- **User** — clientes, admins, operadores e modeladores 3D (campo `role`)
- **Category** — categorias de roupa
- **Product** — peças do catálogo
- **ProductVariant** — variação por cor + tamanho (com SKU e estoque)
- **ProductImage** — fotos do produto
- **Model3D** — arquivo `.glb` 1-pra-1 com produto

### Conectar ao Postgres (Semana 2)

Para rodar migrations e ter persistência real, escolha **uma** opção:

**Opção A — Supabase (mais rápido, free tier):**

1. Cria projeto em [supabase.com](https://supabase.com)
2. Vai em *Project Settings → Database → Connection string → URI*
3. Cola no `.env` (substitui `[YOUR-PASSWORD]`)
4. Roda:

```powershell
npx prisma migrate dev --name init
```

**Opção B — Postgres local via Docker:**

```powershell
docker run --name loja3d-postgres -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=loja3d -p 5432:5432 -d postgres:16
```

Atualiza `.env`:

```env
DATABASE_URL="postgresql://postgres:admin@localhost:5432/loja3d?schema=public"
```

E roda:

```powershell
npx prisma migrate dev --name init
```

---

## Comandos úteis

| Comando | Função |
|---|---|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Roda o build de produção |
| `npm run lint` | Roda o ESLint |
| `npx prisma generate` | Regenera o Prisma Client |
| `npx prisma migrate dev` | Cria/aplica migration (precisa de DB conectado) |
| `npx prisma studio` | Abre o GUI do banco (precisa de DB conectado) |
| `npx shadcn add <componente>` | Instala um componente shadcn (ex: `dialog`, `dropdown-menu`) |

---

## Modelos 3D

Os arquivos `.glb` ficam em `public/models/`. Para adicionar um novo modelo:

1. Coloca o `.glb` em `public/models/SeuModelo.glb`
2. No componente, usa:

```tsx
const { scene } = useGLTF("/models/SeuModelo.glb");
```

A POC atual carrega `public/models/Duck.glb` (modelo de referência do KhronosGroup).

---

## Roadmap

| Semana | Foco | Status |
|---|---|---|
| **1** | Setup técnico + POC 3D | ✅ Em andamento |
| **2** | Auth funcional (NextAuth) + Loja básica (catálogo real, página de produto, medidas) | ⏳ Pendente |
| **3** | Compra + Admin (carrinho, checkout simulado, cadastro de produto) | ⏳ Pendente |
| **4** | Provador virtual + Pedidos (avatar, recomendação de tamanho) | ⏳ Pendente |
| **5** | Polimento + Demo final | ⏳ Pendente |

---

## Deploy (Vercel)

O projeto está preparado para deploy direto na Vercel:

1. Importa o repo em [vercel.com/new](https://vercel.com/new)
2. Vercel detecta Next.js automaticamente
3. Adiciona `DATABASE_URL` em *Environment Variables* (quando tiver banco)
4. Clica *Deploy*

O `postinstall` script garante que `prisma generate` rode no build.

---

## Licença

Projeto acadêmico — MVP em desenvolvimento.
