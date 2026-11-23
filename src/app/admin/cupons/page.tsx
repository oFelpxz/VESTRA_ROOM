import { prisma } from "@/lib/prisma";
import {
  COUPON_STATUS_LABEL,
  couponStatus,
  describeCoupon,
  toCouponLike,
  type CouponStatus,
} from "@/lib/coupons";
import { deleteCouponAction, setCouponActiveAction } from "@/lib/coupon-actions";
import { CouponForm } from "@/components/admin/coupon-form";

const STATUS_STYLE: Record<CouponStatus, string> = {
  ACTIVE: "bg-acid/30 text-foreground",
  DISABLED: "bg-secondary text-muted-foreground",
  EXPIRED: "bg-secondary text-muted-foreground",
  EXHAUSTED: "bg-secondary text-muted-foreground",
};

const buttonClass =
  "rounded-sm border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/70 transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default async function AdminCuponsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });
  const now = new Date();

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Cupons
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cupons de desconto aplicados pelo cliente no carrinho.
      </p>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Novo cupom
          </p>
          <div className="mt-4">
            <CouponForm />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Cupons existentes ({coupons.length})
          </p>

          {coupons.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum cupom criado ainda.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {coupons.map((c) => {
                const coupon = toCouponLike(c);
                const status = couponStatus(coupon, now);
                const everUsed = c.usedCount > 0 || c._count.orders > 0;

                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-mono font-medium">
                        {c.code}
                        <span
                          className={`rounded-sm px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] ${STATUS_STYLE[status]}`}
                        >
                          {COUPON_STATUS_LABEL[status]}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {describeCoupon(coupon)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <form action={setCouponActiveAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={c.active ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className={`${buttonClass} hover:border-foreground hover:text-foreground`}
                        >
                          {c.active ? "Desativar" : "Reativar"}
                        </button>
                      </form>
                      <form action={deleteCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          disabled={everUsed}
                          title={
                            everUsed
                              ? "Cupom já usado não pode ser removido — desative"
                              : "Remover cupom"
                          }
                          className={`${buttonClass} hover:border-destructive hover:text-destructive`}
                        >
                          Remover
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
