"use server";

import { randomUUID } from "node:crypto";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";

export type AuthFormState = { error?: string };

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "Preencha todos os campos." };
  }
  if (password.length < 6) {
    return { error: "A senha precisa de pelo menos 6 caracteres." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Esse e-mail já está cadastrado." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // Login automático após cadastro (redireciona para /perfil).
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/perfil",
  });

  return {};
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  // Todos vão para /perfil. O acesso ao /admin é feito apenas pelo
  // item "Admin" do menu, visível só para administradores logados.
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/perfil",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-mail ou senha inválidos." };
    }
    // Re-lança o redirect do Next (NEXT_REDIRECT) para funcionar.
    throw error;
  }

  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * Exclui a conta: anonimiza os dados pessoais do usuário (nome, e-mail,
 * telefone, senha) e apaga medidas/endereços/carrinho — mas mantém a linha
 * de User e o histórico de Pedidos intactos (registro fiscal). Pedidos
 * antigos perdem apenas o endereço de entrega vinculado (dado pessoal),
 * via onDelete: SetNull.
 */
export async function deleteAccountAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const confirmEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  if (confirmEmail !== session.user.email.toLowerCase()) {
    return { error: "Digite seu e-mail exatamente como cadastrado para confirmar." };
  }

  const userId = session.user.id;
  const anonymizedPasswordHash = await bcrypt.hash(randomUUID(), 10);

  await prisma.$transaction([
    prisma.measurementProfile.deleteMany({ where: { userId } }),
    prisma.address.deleteMany({ where: { userId } }),
    prisma.cart.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Usuário removido",
        email: `deleted-${userId}@vestra.room`,
        phone: null,
        passwordHash: anonymizedPasswordHash,
        status: "INACTIVE",
      },
    }),
  ]);

  await signOut({ redirectTo: "/" });
  return {};
}
