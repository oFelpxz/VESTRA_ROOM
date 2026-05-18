import "dotenv/config";
import { Client } from "pg";

function mask(url: string | undefined) {
  if (!url) return "(vazio)";
  return url.replace(/:([^:@/]+)@/, ":***@");
}

async function test(label: string, url: string | undefined) {
  console.log(`\n=== ${label} ===`);
  console.log("URL:", mask(url));
  if (!url) {
    console.log("ERRO: variável não definida no .env");
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const r = await client.query("select version()");
    console.log("OK ->", r.rows[0].version);
  } catch (e) {
    console.log("ERRO ->", (e as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}

(async () => {
  await test("DIRECT_URL (5432 / migrations)", process.env.DIRECT_URL);
  await test("DATABASE_URL (6543 / runtime)", process.env.DATABASE_URL);
})();
