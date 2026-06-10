"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type Model3DFormState = { error?: string; success?: boolean };

async function requireModelAccess() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "MODEL_3D") {
    throw new Error("Acesso negado.");
  }
  return session!.user!;
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

function str(v: FormDataEntryValue | null): string {
  return v === null ? "" : String(v).trim();
}

/**
 * Registra (ou substitui criando uma nova versão) o modelo 3D de um produto.
 * Chamada pelo client após o upload via /api/models-3d/upload.
 */
export async function registerModel3DAction(
  _prev: Model3DFormState,
  formData: FormData,
): Promise<Model3DFormState> {
  await requireModelAccess();

  const productId = str(formData.get("productId"));
  const fileUrl = str(formData.get("fileUrl"));
  const fileSizeRaw = str(formData.get("fileSizeMb"));
  const formatRaw = str(formData.get("format")).toUpperCase();

  if (!productId) return { error: "Produto inválido." };
  if (!fileUrl) return { error: "Arquivo inválido." };

  const format = formatRaw === "GLTF" ? "GLTF" : "GLB";
  const fileSizeMb = Number(fileSizeRaw) || null;

  const existing = await prisma.model3D.findUnique({ where: { productId } });

  if (existing) {
    await prisma.model3D.update({
      where: { productId },
      data: {
        fileUrl,
        format,
        fileSizeMb,
        version: existing.version + 1,
        status: "PENDING",
      },
    });
  } else {
    await prisma.model3D.create({
      data: {
        productId,
        fileUrl,
        format,
        fileSizeMb,
        version: 1,
        status: "PENDING",
      },
    });
  }

  // Quando entra uma versão nova, produto não está mais "com 3D validado".
  await prisma.product.update({
    where: { id: productId },
    data: { has3DModel: false },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${productId}`);
  revalidatePath(`/admin/produtos/${productId}`);
  return { success: true };
}

export async function validateModel3DAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.update({
    where: { id },
    data: { status: "VALIDATED" },
    select: { productId: true },
  });

  await prisma.product.update({
    where: { id: model.productId },
    data: { has3DModel: true },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${model.productId}`);
  revalidatePath(`/admin/produtos/${model.productId}`);
  revalidatePath("/catalogo");
}

export async function rejectModel3DAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.update({
    where: { id },
    data: { status: "REJECTED" },
    select: { productId: true },
  });

  await prisma.product.update({
    where: { id: model.productId },
    data: { has3DModel: false },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${model.productId}`);
  revalidatePath(`/admin/produtos/${model.productId}`);
}

export async function markOptimizedAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.update({
    where: { id },
    data: { status: "OPTIMIZED" },
    select: { productId: true },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${model.productId}`);
}

export async function deleteModel3DAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.delete({
    where: { id },
    select: { productId: true, fileUrl: true },
  });

  await prisma.product.update({
    where: { id: model.productId },
    data: { has3DModel: false },
  });

  // Remove arquivo físico se for local em public/models
  if (model.fileUrl.startsWith("/models/")) {
    try {
      const absolute = path.join(
        process.cwd(),
        "public",
        model.fileUrl.replace(/^\//, ""),
      );
      await unlink(absolute);
    } catch {
      // ignora se o arquivo não existir
    }
  }

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/produtos/${model.productId}`);
}
