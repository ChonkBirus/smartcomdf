import { describe, it, expect } from "vitest";
import { assertCouponEligibleForPlan, type CouponRule } from "./coupon-eligibility";

const PLAN_STARTER = "00000000-0000-0000-0000-000000000001";
const PLAN_PRO = "00000000-0000-0000-0000-000000000002";
const PLAN_BUSINESS = "00000000-0000-0000-0000-000000000003";

const baseCoupon: CouponRule = {
  is_active: true,
  valid_from: null,
  valid_until: null,
  eligible_plan_ids: null,
  max_redemptions: null,
  redemption_count: 0,
};

describe("assertCouponEligibleForPlan (bloqueia criação de empresa)", () => {
  it("aceita quando não há restrição de plano", () => {
    expect(() => assertCouponEligibleForPlan(baseCoupon, PLAN_STARTER)).not.toThrow();
  });

  it("aceita quando o plano escolhido está na lista de elegíveis", () => {
    const coupon = { ...baseCoupon, eligible_plan_ids: [PLAN_PRO, PLAN_BUSINESS] };
    expect(() => assertCouponEligibleForPlan(coupon, PLAN_PRO)).not.toThrow();
    expect(() => assertCouponEligibleForPlan(coupon, PLAN_BUSINESS)).not.toThrow();
  });

  it("bloqueia quando o plano escolhido NÃO está na lista de elegíveis", () => {
    const coupon = { ...baseCoupon, eligible_plan_ids: [PLAN_PRO, PLAN_BUSINESS] };
    expect(() => assertCouponEligibleForPlan(coupon, PLAN_STARTER)).toThrow(
      /não aplicável a este plano/i,
    );
  });

  it.each([
    ["starter apenas", [PLAN_STARTER], PLAN_PRO],
    ["pro apenas", [PLAN_PRO], PLAN_BUSINESS],
    ["business apenas", [PLAN_BUSINESS], PLAN_STARTER],
  ])("bloqueia mismatch (%s)", (_label, eligible, chosen) => {
    const coupon = { ...baseCoupon, eligible_plan_ids: eligible };
    expect(() => assertCouponEligibleForPlan(coupon, chosen)).toThrow(
      /não aplicável a este plano/i,
    );
  });

  it("bloqueia cupom inativo", () => {
    expect(() =>
      assertCouponEligibleForPlan({ ...baseCoupon, is_active: false }, PLAN_STARTER),
    ).toThrow(/inválido ou inativo/i);
  });

  it("bloqueia cupom expirado", () => {
    const coupon = { ...baseCoupon, valid_until: "2020-01-01T00:00:00Z" };
    expect(() => assertCouponEligibleForPlan(coupon, PLAN_STARTER)).toThrow(/expirado/i);
  });

  it("bloqueia cupom esgotado", () => {
    const coupon = { ...baseCoupon, max_redemptions: 5, redemption_count: 5 };
    expect(() => assertCouponEligibleForPlan(coupon, PLAN_STARTER)).toThrow(/esgotado/i);
  });
});
