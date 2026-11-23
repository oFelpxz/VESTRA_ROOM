import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedCoupons } from "./seed-data/coupons";

// Seed só da Sprint 3, para o banco compartilhado que já foi populado.
// NÃO rode o seed completo (npm run db:seed) de novo nesse banco: ele
// sobrescreve estoque, preços e modelos 3D que o grupo alterou pelo admin.
// Este script só cria os cupons de exemplo que ainda não existem.

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const codes = await seedCoupons(prisma);
  console.log(`Cupons de exemplo garantidos: ${codes.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
