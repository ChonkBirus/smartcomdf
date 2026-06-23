import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Topbar } from "@/components/app/Topbar";
import { getMyContext } from "@/lib/account.functions";
import { AuthLoadingScreen } from "@/components/app/AuthLoadingScreen";
import { PermissionsProvider } from "@/lib/permissions";
import { FeaturesProvider, useSubscription, type PlanInfo } from "@/lib/features";
import { UpgradeModal } from "@/components/app/UpgradeModal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const fetchCtx = useServerFn(getMyContext);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchCtx(),
    // Profile/permissions/plan rarely change; avoid the nested join query
    // (profiles → companies → plans) firing on every navigation/focus.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Redirect to onboarding if no company
  useEffect(() => {
    if (!isLoading && data && !data.company) {
      if (location.pathname !== "/onboarding") {
        navigate({ to: "/onboarding", replace: true });
      }
    }
  }, [data, isLoading, navigate]);

  if (isLoading) {
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
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar isSuperAdmin={data?.isSuperAdmin} />
            <SidebarInset className="flex min-h-screen flex-1 flex-col">
              <Topbar
                name={data?.profile?.full_name}
                email={data?.profile?.email}
                avatarUrl={data?.profile?.avatar_url}
                companyName={data?.company?.trade_name ?? data?.company?.corporate_name}
                userId={data?.profile?.id}
              />
              <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
          <UpgradeModal />
          <SubscriptionAlerts />
        </SidebarProvider>
      </FeaturesProvider>
    </PermissionsProvider>
  );
}

function SubscriptionAlerts() {
  const { expired, expiringSoon, daysLeft } = useSubscription();
  useEffect(() => {
    if (expired) {
      toast.error("Seu plano expirou. Faça upgrade para continuar usando o sistema.", {
        id: "plan-expired",
      });
    } else if (expiringSoon) {
      toast.warning(`Seu plano expira em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}.`, {
        id: "plan-expiring",
      });
    }
  }, [expired, expiringSoon, daysLeft]);
  return null;
}
