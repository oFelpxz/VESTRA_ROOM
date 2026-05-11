# Vestra Room

Loja online de roupas com **provador virtual 3D**. Navegue pelo catálogo, visualize cada peça em 360° e (em breve) experimente os produtos em um avatar antes da compra.

Projeto em desenvolvimento — MVP acadêmico.

---

## Pré-requisitos

- Node.js 20+
- npm 10+
- Git

---

## Como rodar localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/oFelpxz/VESTRA_ROOM.git
cd VESTRA_ROOM

# 2. Instalar dependências
npm install

# 3. Criar arquivo de variáveis de ambiente
cp .env.example .env

# 4. Rodar o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

> O `npm install` roda automaticamente `prisma generate`. Não é necessário ter um banco Postgres ativo nesta fase — a aplicação roda sem persistência por enquanto.

---

## Stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · Three.js (React Three Fiber + Drei) · Prisma · PostgreSQL
