import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type FeatureCode =
  | "dashboard"
  | "products"
  | "inventory"
  | "customers"
  | "quotes"
  | "crm"
  | "financial"
  | "pix"
  | "service_orders"
  | "ocr"
  | "excel_import"
  | "nfe"
  | "reports"
  | "reports_basic"
  | "reports_advanced"
  | "settings"
  | "users"
  | "api_access"
  | "white_label"
  | "notifications"
  | "audit";

export type PlanInfo = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_storage_gb: number;
  max_customers?: number;
  max_products?: number;
  max_service_orders?: number;
} | null;

export type SubscriptionInfo = {
  trial: boolean;
  active: boolean;
  expiration_date: string | null;
  start_date: string;
} | null;

type Ctx = {
  features: Set<string>;
  plan: PlanInfo;
  subscription: SubscriptionInfo;
  isSuperAdmin: boolean;
  upgradeFor: FeatureCode | null;
  openUpgrade: (f?: FeatureCode) => void;
  closeUpgrade: () => void;
};

const FeaturesContext = createContext<Ctx>({
  features: new Set(),
  plan: null,
  subscription: null,
  isSuperAdmin: false,
  upgradeFor: null,
  openUpgrade: () => {},
  closeUpgrade: () => {},
});

export function FeaturesProvider({
  children,
  features,
  plan,
  subscription,
  isSuperAdmin,
}: {
  children: ReactNode;
  features: string[];
  plan: PlanInfo;
  subscription: SubscriptionInfo;
  isSuperAdmin: boolean;
}) {
  const [upgradeFor, setUpgradeForState] = useState<FeatureCode | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const value = useMemo<Ctx>(
    () => ({
      features: new Set(features),
      plan,
      subscription,
      isSuperAdmin,
      upgradeFor,
      upgradeOpen,
      openUpgrade: (f) => {
        setUpgradeForState((f ?? null) as FeatureCode | null);
        setUpgradeOpen(true);
      },
      closeUpgrade: () => {
        setUpgradeOpen(false);
        setUpgradeForState(null);
      },
    }),
    [features, plan, subscription, isSuperAdmin, upgradeFor, upgradeOpen],
  );

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures() {
  const { features, isSuperAdmin, openUpgrade } = useContext(FeaturesContext);
  const hasFeature = (code: FeatureCode | string) => isSuperAdmin || features.has(code);
  return { features, hasFeature, openUpgrade };
}

export function usePlan() {
  const { plan } = useContext(FeaturesContext);
  const getCurrentPlan = () => plan;
  const getPlanLimits = () => ({
    max_users: plan?.max_users ?? 0,
    max_storage_gb: plan?.max_storage_gb ?? 0,
    max_customers: plan?.max_customers ?? 0,
    max_products: plan?.max_products ?? 0,
    max_service_orders: plan?.max_service_orders ?? 0,
  });
  return { plan, getCurrentPlan, getPlanLimits };
}

export function useSubscription() {
  const { subscription, plan } = useContext(FeaturesContext);
  const expiresAt = subscription?.expiration_date ? new Date(subscription.expiration_date) : null;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const expired = expiresAt ? expiresAt.getTime() < Date.now() : false;
  const expiringSoon = daysLeft !== null && daysLeft <= 7 && !expired;
  return { subscription, plan, expiresAt, daysLeft, expired, expiringSoon };
}

export function useUpgradeDialog() {
  const { upgradeFor, openUpgrade, closeUpgrade } = useContext(FeaturesContext);
  return { upgradeFor, openUpgrade, closeUpgrade };
}
