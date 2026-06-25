CREATE OR REPLACE VIEW public.subscription_commercial_history
WITH (security_invoker = true) AS
WITH events AS (
  SELECT
    se.id,
    se.company_id,
    se.subscription_id,
    se.created_at AS event_date,
    se.event_type,
    CASE se.event_type
      WHEN 'plan_upgrade_requested'   THEN 'Upgrade de plano solicitado'
      WHEN 'plan_upgrade_applied'     THEN 'Upgrade de plano concluído'
      WHEN 'plan_downgrade_scheduled' THEN 'Downgrade de plano agendado'
      WHEN 'plan_downgrade_applied'   THEN 'Downgrade de plano aplicado'
      WHEN 'plan_change_canceled'     THEN 'Alteração de plano cancelada'
      WHEN 'plan_changed'             THEN 'Plano alterado'
      WHEN 'cancellation_scheduled'   THEN 'Cancelamento solicitado'
      WHEN 'cancellation_immediate'   THEN 'Assinatura cancelada'
      WHEN 'cancellation_reverted'    THEN 'Cancelamento revertido'
      WHEN 'subscription_canceled'    THEN 'Assinatura cancelada'
      WHEN 'subscription_reactivated' THEN 'Assinatura reativada'
      WHEN 'subscription_activated'   THEN 'Assinatura ativada'
      WHEN 'subscription_suspended'   THEN 'Assinatura suspensa'
      WHEN 'trial_started'            THEN 'Período de teste iniciado'
      WHEN 'trial_ended'              THEN 'Período de teste encerrado'
      WHEN 'coupon_applied'           THEN 'Cupom aplicado'
      ELSE replace(initcap(replace(se.event_type, '_', ' ')), '  ', ' ')
    END AS title,
    se.description,
    NULL::numeric AS amount,
    CASE
      WHEN se.created_by IS NULL THEN 'SYSTEM'
      WHEN public.has_role(se.created_by, 'super_admin'::public.app_role) THEN 'ADMIN'
      ELSE 'USER'
    END AS actor_type,
    COALESCE(p.full_name, p.email) AS actor_name,
    'subscription_event'::text AS source
  FROM public.subscription_events se
  LEFT JOIN public.profiles p ON p.id = se.created_by
),
charges AS (
  SELECT
    bc.id,
    bc.company_id,
    bc.subscription_id,
    COALESCE(bc.paid_at, bc.created_at) AS event_date,
    CASE
      WHEN bc.status IN ('CONFIRMED','RECEIVED','PAID') THEN 'payment_confirmed'
      WHEN bc.status IN ('PENDING','AWAITING_PAYMENT')  THEN 'payment_pending'
      WHEN bc.status = 'OVERDUE'                         THEN 'payment_overdue'
      WHEN bc.status = 'REFUNDED'                        THEN 'payment_refunded'
      WHEN bc.status IN ('CANCELED','CANCELLED')         THEN 'payment_canceled'
      ELSE 'payment_' || lower(bc.status)
    END AS event_type,
    CASE
      WHEN bc.status IN ('CONFIRMED','RECEIVED','PAID') THEN 'Pagamento confirmado'
      WHEN bc.status IN ('PENDING','AWAITING_PAYMENT')  THEN 'Cobrança gerada (aguardando pagamento)'
      WHEN bc.status = 'OVERDUE'                         THEN 'Cobrança vencida'
      WHEN bc.status = 'REFUNDED'                        THEN 'Pagamento estornado'
      WHEN bc.status IN ('CANCELED','CANCELLED')         THEN 'Cobrança cancelada'
      ELSE 'Cobrança ' || bc.status
    END AS title,
    CASE WHEN bc.payment_method IS NOT NULL THEN 'Método: ' || bc.payment_method ELSE NULL END AS description,
    COALESCE(bc.final_amount, bc.amount) AS amount,
    'WEBHOOK'::text AS actor_type,
    NULL::text AS actor_name,
    'billing_charge'::text AS source
  FROM public.billing_charges bc
),
redemptions AS (
  SELECT
    r.id,
    r.company_id,
    r.subscription_id,
    r.created_at AS event_date,
    'coupon_redeemed'::text AS event_type,
    'Cupom aplicado: ' || c.code AS title,
    'Desconto de R$ ' || to_char(r.discount_amount, 'FM999G999G990D00') AS description,
    -r.discount_amount AS amount,
    'SYSTEM'::text AS actor_type,
    NULL::text AS actor_name,
    'coupon_redemption'::text AS source
  FROM public.billing_coupon_redemptions r
  JOIN public.billing_coupons c ON c.id = r.coupon_id
)
SELECT * FROM events
UNION ALL SELECT * FROM charges
UNION ALL SELECT * FROM redemptions;

GRANT SELECT ON public.subscription_commercial_history TO authenticated;
GRANT SELECT ON public.subscription_commercial_history TO service_role;