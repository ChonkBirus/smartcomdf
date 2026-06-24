import { useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { type ReactNode } from "react";
import { getCurrentCompanySubscription } from "@/lib/billing.functions";
import { useFeatures } from "@/lib/features";
import { SubscriptionBanner } from "./SubscriptionBanner";
import { SubscriptionBlockedScreen } from "./SubscriptionBlockedScreen";

const BLOCKING_STATUSES = new Set(["SUSPENDED", "CANCELED", "EXPIRED"]);

// Routes that remain accessible even when blocked (so users can recover).
const ALLOW_PATHS = ["/billing/plans", "/settings/subscription", "/settings", "/profile"];

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const fetchSub = useServerFn(getCurrentCompanySubscription);
  const location = useLocation();
  const { hasFeature } = useFeatures();
  const isSuperAdmin = hasFeature("__superadmin__"); // never true; superadmin handled below

  const { data: sub } = useQuery({
    queryKey: ["billing", "current-subscription"],
    queryFn: () => fetchSub(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const blocked = !!sub && BLOCKING_STATUSES.has(sub.status);
  const onAllowedPath = ALLOW_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <>
      <SubscriptionBanner sub={sub ?? null} />
      {blocked && !onAllowedPath && !isSuperAdmin ? (
        <SubscriptionBlockedScreen sub={sub!} />
      ) : (
        children
      )}
    </>
  );
}
