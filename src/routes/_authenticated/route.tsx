import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Topbar } from "@/components/app/Topbar";
import { getMyContext } from "@/lib/account.functions";
import { AuthLoadingScreen } from "@/components/app/AuthLoadingScreen";
import { clearLocalAuthStorage, useAuth } from "@/lib/auth-context";
import { PermissionsProvider } from "@/lib/permissions";
import { FeaturesProvider, type PlanInfo } from "@/lib/features";
import { UpgradeModal } from "@/components/app/UpgradeModal";
import { SubscriptionGuard } from "@/components/billing/SubscriptionGuard";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { Button } from "@/components/ui/button";
import { classifyError } from "@/lib/error-messages";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const fetchCtx = useServerFn(getMyContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchCtx(),
    enabled: !authLoading && !!session,
    // Profile/permissions/plan rarely change; avoid the nested join query
    // (profiles → companies → plans) firing on every navigation/focus.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/auth", search: { redirectTo: undefined }, replace: true });
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!isError || classifyError(error) !== "session_expired") return;
    void queryClient.cancelQueries();
    queryClient.clear();
    clearLocalAuthStorage();
    navigate({ to: "/auth", search: { redirectTo: location.pathname }, replace: true });
  }, [error, isError, location.pathname, navigate, queryClient]);

  // Redirect to onboarding if no company
  useEffect(() => {
    if (!session || isLoading || !data || data.company) return;
      if (location.pathname !== "/onboarding") {
        navigate({ to: "/onboarding", replace: true });
      }
  }, [data, isLoading, location.pathname, navigate, session]);

  if (authLoading || !session || isLoading) {
    return <AuthLoadingScreen message="Carregando seu perfil..." />;
  }

  if (isError) {
    if (classifyError(error) === "session_expired") {
      return <AuthLoadingScreen message="Sessão expirada. Redirecionando..." />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Não foi possível carregar seu perfil</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente. O app não foi interrompido.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data?.company && location.pathname !== "/onboarding") {
    return <AuthLoadingScreen message="Redirecionando para configuração da empresa..." />;
  }

  const content = data?.company ? (
    <SubscriptionGuard isSuperAdmin={!!data?.isSuperAdmin}>
      <Outlet />
    </SubscriptionGuard>
  ) : (
    <Outlet />
  );

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
                  {content}
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
