import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Topbar } from "@/components/app/Topbar";
import { getMyContext } from "@/lib/account.functions";

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar isSuperAdmin={data?.isSuperAdmin} />
        <SidebarInset className="flex min-h-screen flex-1 flex-col">
          <Topbar
            name={data?.profile?.full_name}
            email={data?.profile?.email}
            avatarUrl={data?.profile?.avatar_url}
            companyName={data?.company?.trade_name ?? data?.company?.corporate_name}
          />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
