import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function check(email: string, password: string) {
  console.log(`\n=== ${email} ===`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log("ERRO: usuário NÃO encontrado no banco");
    return;
  }
  console.log("Encontrado:", user.name, "| role:", user.role, "| status:", user.status);
  console.log("Hash:", user.passwordHash.slice(0, 20), "...");
  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log(`bcrypt.compare("${password}", hash) =>`, ok ? "✅ CONFERE" : "❌ NÃO confere");
}

(async () => {
  await check("admin@vestra.room", "vestra123");
  await check("cliente@vestra.room", "cliente123");
  await prisma.$disconnect();
})();
