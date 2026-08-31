import type { NextAuthConfig } from "next-auth";
import { isStaffRole, rolesForAdminPath } from "@/lib/admin-access";

// Config base — SEM Prisma e SEM bcrypt.
// É segura para rodar no edge (usada pelo middleware).
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Já logado não deve ver login/cadastro.
      if (isLoggedIn && (path === "/login" || path === "/cadastro")) {
        return Response.redirect(new URL("/perfil", nextUrl));
      }

      const isAdminArea = path.startsWith("/admin");
      const isProfileArea = path.startsWith("/perfil");

      if (isAdminArea) {
        const role = auth?.user?.role;
        if (!isLoggedIn || !isStaffRole(role)) return false;
        const allowed = rolesForAdminPath(path);
        const hasAccess = allowed.includes(role);
        // Staff autenticado mas sem acesso a esta sub-rota específica:
        // manda para o painel raiz (que ele pode ver) em vez de /login.
        if (!hasAccess && path !== "/admin") {
          return Response.redirect(new URL("/admin", nextUrl));
        }
        return hasAccess;
      }
      if (isProfileArea) {
        return isLoggedIn;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? "CUSTOMER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role =
          typeof token.role === "string" ? token.role : "CUSTOMER";
      }
      return session;
    },
  },
  providers: [], // adicionados em auth.ts (runtime Node)
} satisfies NextAuthConfig;
