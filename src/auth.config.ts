import type { NextAuthConfig } from "next-auth";

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
        return isLoggedIn && auth?.user?.role === "ADMIN";
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
