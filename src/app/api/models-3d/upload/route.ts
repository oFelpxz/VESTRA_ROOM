import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_MB = 25;
const ALLOWED_EXT = [".glb", ".gltf"] as const;

export async function POST(request: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "MODEL_3D") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const productId = String(form.get("productId") ?? "").trim();

  if (!productId) {
    return NextResponse.json(
      { error: "productId é obrigatório." },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo não enviado." },
      { status: 400 },
    );
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
    return NextResponse.json(
      { error: "Apenas arquivos .glb ou .gltf são aceitos." },
      { status: 400 },
    );
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_SIZE_MB) {
    return NextResponse.json(
      { error: `Arquivo excede ${MAX_SIZE_MB}MB.` },
      { status: 400 },
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) {
    return NextResponse.json(
      { error: "Produto não encontrado." },
      { status: 404 },
    );
  }

  // Define a versão: incrementa se já existir modelo
  const existing = await prisma.model3D.findUnique({
    where: { productId },
    select: { version: true },
  });
  const nextVersion = (existing?.version ?? 0) + 1;

  const fileName = `${product.slug}-v${nextVersion}${ext}`;
  const dir = path.join(process.cwd(), "public", "models");
  const absolute = path.join(dir, fileName);
  const relative = `/models/${fileName}`;

  try {
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolute, buffer);
  } catch (e) {
    console.error("Erro ao gravar modelo 3D:", e);
    return NextResponse.json(
      { error: "Falha ao salvar arquivo no servidor." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    fileUrl: relative,
    fileSizeMb: Number(sizeMb.toFixed(2)),
    format: ext === ".gltf" ? "GLTF" : "GLB",
  });
}

export const runtime = "nodejs";
