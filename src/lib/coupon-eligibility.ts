// Pure helpers for coupon validation used by signup/checkout.
// Kept dependency-free so it can be unit tested without the DB.

export type CouponRule = {
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  eligible_plan_ids: string[] | null;
  max_redemptions: number | null;
  redemption_count: number;
};

export function assertCouponEligibleForPlan(
  coupon: CouponRule | null | undefined,
  planId: string,
  now: Date = new Date(),
): asserts coupon is CouponRule {
  if (!coupon || !coupon.is_active) throw new Error("Cupom inválido ou inativo.");
  if (coupon.valid_from && new Date(coupon.valid_from) > now)
    throw new Error("Cupom ainda não está disponível.");
  if (coupon.valid_until && new Date(coupon.valid_until) < now)
    throw new Error("Cupom expirado.");
  if (
    Array.isArray(coupon.eligible_plan_ids) &&
    coupon.eligible_plan_ids.length > 0 &&
    !coupon.eligible_plan_ids.includes(planId)
  )
    throw new Error("Cupom não aplicável a este plano.");
  if (
    coupon.max_redemptions != null &&
    coupon.redemption_count >= coupon.max_redemptions
  )
    throw new Error("Cupom esgotado.");
}
