import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storageConfigured, uploadModelObject } from "@/lib/storage";

const MAX_SIZE_MB = 10;
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp"] as const;
const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Upload de textura separado do modelo (item 3D-02). Exige que o produto já
 * tenha um Model3D — a textura é anexada a ele via `Model3D.textureUrl`.
 */
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
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const file = form.get("file");
  const productId = String(form.get("productId") ?? "").trim();

  if (!productId) {
    return NextResponse.json({ error: "productId é obrigatório." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) {
    return NextResponse.json(
      { error: "Apenas .png, .jpg ou .webp são aceitos." },
      { status: 400 },
    );
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_SIZE_MB) {
    return NextResponse.json({ error: `Arquivo excede ${MAX_SIZE_MB}MB.` }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, model3D: { select: { id: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }
  if (!product.model3D) {
    return NextResponse.json(
      { error: "Envie o modelo 3D antes da textura." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = CONTENT_TYPE[ext];

  let textureUrl: string;
  if (storageConfigured()) {
    const objectName = `${product.slug}/texture${ext}`;
    try {
      await uploadModelObject(objectName, bytes, contentType);
      textureUrl = objectName;
    } catch (e) {
      console.error("Erro no upload de textura para o Storage:", e);
      return NextResponse.json(
        { error: "Falha ao enviar a textura para o Storage." },
        { status: 502 },
      );
    }
  } else {
    try {
      const fileName = `${product.slug}-texture${ext}`;
      const dir = path.join(process.cwd(), "public", "models");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), bytes);
      textureUrl = `/models/${fileName}`;
    } catch (e) {
      console.error("Erro ao gravar textura local:", e);
      return NextResponse.json(
        { error: "Falha ao salvar arquivo no servidor." },
        { status: 500 },
      );
    }
  }

  await prisma.model3D.update({
    where: { productId },
    data: { textureUrl },
  });

  return NextResponse.json({ textureUrl });
}

export const runtime = "nodejs";
