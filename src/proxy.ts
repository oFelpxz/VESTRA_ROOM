import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renomeou "middleware" para "proxy".
// Usa a config edge-safe (sem Prisma). O callback `authorized`
// em auth.config.ts decide o acesso a /perfil e /admin.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/perfil/:path*", "/admin/:path*"],
};
