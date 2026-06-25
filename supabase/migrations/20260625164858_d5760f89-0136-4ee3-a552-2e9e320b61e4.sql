CREATE TABLE public.billing_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  duration TEXT NOT NULL CHECK (duration IN ('once','repeating','forever')),
  duration_months INTEGER,
  max_redemptions INTEGER,
  max_redemptions_per_company INTEGER DEFAULT 1,
  eligible_plan_ids UUID[],
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_coupons_code ON public.billing_coupons(code);
CREATE INDEX idx_billing_coupons_active ON public.billing_coupons(is_active) WHERE is_active = TRUE;

GRANT SELECT ON public.billing_coupons TO authenticated;
GRANT ALL ON public.billing_coupons TO service_role;

ALTER TABLE public.billing_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active coupons"
  ON public.billing_coupons FOR SELECT TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "Super admins manage coupons"
  ON public.billing_coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_billing_coupons_updated_at
  BEFORE UPDATE ON public.billing_coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.billing_coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.billing_coupons(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  charge_id UUID REFERENCES public.billing_charges(id) ON DELETE SET NULL,
  checkout_session_id UUID REFERENCES public.billing_checkout_sessions(id) ON DELETE SET NULL,
  original_amount NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL,
  final_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupon_redemptions_coupon ON public.billing_coupon_redemptions(coupon_id);
CREATE INDEX idx_coupon_redemptions_company ON public.billing_coupon_redemptions(company_id);

GRANT SELECT ON public.billing_coupon_redemptions TO authenticated;
GRANT ALL ON public.billing_coupon_redemptions TO service_role;

ALTER TABLE public.billing_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read own redemptions"
  ON public.billing_coupon_redemptions FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Super admins manage redemptions"
  ON public.billing_coupon_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE public.billing_checkout_sessions
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.billing_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12,2);

ALTER TABLE public.billing_charges
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.billing_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12,2);