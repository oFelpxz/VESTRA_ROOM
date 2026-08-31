import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { optimizeGlb } from "@/lib/model-optimizer";
import {
  MODELS_BUCKET,
  storageConfigured,
  uploadModelObject,
} from "@/lib/storage";

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

  const uploadSizeMb = file.size / (1024 * 1024);
  if (uploadSizeMb > MAX_SIZE_MB) {
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

  // Versão: incrementa se já existir modelo
  const existing = await prisma.model3D.findUnique({
    where: { productId },
    select: { version: true },
  });
  const nextVersion = (existing?.version ?? 0) + 1;
  const format = ext === ".gltf" ? "GLTF" : "GLB";

  // --- Compressão automática (item 3D-01) ---
  // Só .glb (binário). .gltf externo passa direto.
  const rawBytes = Buffer.from(await file.arrayBuffer());
  let bytes: Buffer = rawBytes;
  let originalBytes = rawBytes.byteLength;
  let optimizedPct = 0;
  let wasOptimized = false;

  if (ext === ".glb") {
    const result = await optimizeGlb(rawBytes);
    bytes = Buffer.from(result.data);
    originalBytes = result.originalBytes;
    optimizedPct = Math.round(result.ratio * 100);
    wasOptimized = result.optimized;
  }

  const finalSizeMb = Number((bytes.byteLength / (1024 * 1024)).toFixed(2));
  const originalSizeMb = Number((originalBytes / (1024 * 1024)).toFixed(2));

  // --- Armazenamento (item 26) ---
  // Preferência: Supabase Storage (bucket privado). Fallback: public/models.
  const objectName = `${product.slug}/v${nextVersion}${ext}`;
  const contentType =
    ext === ".gltf" ? "model/gltf+json" : "model/gltf-binary";

  let fileUrl: string;
  let storage: "cloud" | "local";

  if (storageConfigured()) {
    try {
      await uploadModelObject(objectName, bytes, contentType);
      fileUrl = objectName; // caminho do objeto — sem "/" inicial
      storage = "cloud";
    } catch (e) {
      console.error("Erro no upload para o Storage:", e);
      return NextResponse.json(
        { error: "Falha ao enviar o modelo para o Storage." },
        { status: 502 },
      );
    }
  } else {
    try {
      const fileName = `${product.slug}-v${nextVersion}${ext}`;
      const dir = path.join(process.cwd(), "public", "models");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), bytes);
      fileUrl = `/models/${fileName}`;
      storage = "local";
    } catch (e) {
      console.error("Erro ao gravar modelo 3D local:", e);
      return NextResponse.json(
        { error: "Falha ao salvar arquivo no servidor." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    fileUrl,
    fileSizeMb: finalSizeMb,
    originalSizeMb,
    optimizedPct,
    wasOptimized,
    format,
    storage,
    bucket: storage === "cloud" ? MODELS_BUCKET : null,
  });
}

export const runtime = "nodejs";
