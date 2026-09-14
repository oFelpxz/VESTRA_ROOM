import { auth } from "@/auth";
import { getCartItemCount } from "@/lib/cart";
import { HeaderClient } from "@/components/layout/header-client";

export async function Header() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";
  const cartCount = isLoggedIn ? await getCartItemCount(session.user.id) : 0;

  return (
    <HeaderClient
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      cartCount={cartCount}
    />
  );
}
