import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Topbar } from "@/components/app/Topbar";
import { getMyContext } from "@/lib/account.functions";
import { AuthLoadingScreen } from "@/components/app/AuthLoadingScreen";
import { useAuth } from "@/lib/auth-context";
import { PermissionsProvider } from "@/lib/permissions";
import { FeaturesProvider, type PlanInfo } from "@/lib/features";
import { UpgradeModal } from "@/components/app/UpgradeModal";
import { SubscriptionGuard } from "@/components/billing/SubscriptionGuard";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { OfflineBanner } from "@/components/app/OfflineBanner";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const fetchCtx = useServerFn(getMyContext);
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchCtx(),
    enabled: !!session,
    // Profile/permissions/plan rarely change; avoid the nested join query
    // (profiles → companies → plans) firing on every navigation/focus.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/auth", search: { redirectTo: undefined }, replace: true });
    }
  }, [authLoading, session, navigate]);

  // Redirect to onboarding if no company
  useEffect(() => {
    if (!session || isLoading || !data || data.company) return;
      if (location.pathname !== "/onboarding") {
        navigate({ to: "/onboarding", replace: true });
      }
  }, [data, isLoading, navigate, session]);

  if (authLoading || !session || isLoading) {
    return <AuthLoadingScreen message="Carregando seu perfil..." />;
  }

  return (
    <PermissionsProvider
      permissions={data?.permissions ?? []}
      isSuperAdmin={!!data?.isSuperAdmin}
      isOwner={!!data?.isOwner}
    >
      <FeaturesProvider
        features={data?.features ?? []}
        plan={(data?.plan as PlanInfo) ?? null}
        subscription={data?.subscription ?? null}
        isSuperAdmin={!!data?.isSuperAdmin}
      >
        <OnboardingProvider enabled={!!data?.company}>
          <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background">
              <AppSidebar isSuperAdmin={data?.isSuperAdmin} />
              <SidebarInset className="flex min-h-screen flex-1 flex-col">
                <OfflineBanner />
                <Topbar
                  name={data?.profile?.full_name}
                  email={data?.profile?.email}
                  avatarUrl={data?.profile?.avatar_url}
                  companyName={data?.company?.trade_name ?? data?.company?.corporate_name}
                  userId={data?.profile?.id}
                />
                <main className="flex-1 p-4 md:p-6 lg:p-8">
                  <SubscriptionGuard isSuperAdmin={!!data?.isSuperAdmin}>
                    <Outlet />
                  </SubscriptionGuard>
                </main>
              </SidebarInset>
            </div>
            <UpgradeModal />
          </SidebarProvider>
        </OnboardingProvider>

      </FeaturesProvider>
    </PermissionsProvider>
  );
}
