import { auth } from "@/auth";
import { getCartItemCount } from "@/lib/cart";
import { countUnreadNotifications } from "@/lib/notifications";
import { HeaderClient } from "@/components/layout/header-client";

export async function Header() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";
  const [cartCount, unreadCount] = isLoggedIn
    ? await Promise.all([
        getCartItemCount(session.user.id),
        countUnreadNotifications(session.user.id),
      ])
    : [0, 0];

  return (
    <HeaderClient
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      cartCount={cartCount}
      unreadCount={unreadCount}
    />
  );
}
