import { auth } from "@/auth";
import { getCartItemCount } from "@/lib/cart";
import { isStaffRole } from "@/lib/admin-access";
import { HeaderClient } from "@/components/layout/header-client";

export async function Header() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isStaff = isStaffRole(session?.user?.role);
  const cartCount = isLoggedIn ? await getCartItemCount(session.user.id) : 0;

  return (
    <HeaderClient
      isLoggedIn={isLoggedIn}
      isStaff={isStaff}
      cartCount={cartCount}
    />
  );
}
