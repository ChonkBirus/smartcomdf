import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Building2, Package, CreditCard, Receipt, LayoutDashboard, Activity, Ticket, AlertTriangle, Rocket, Target, Bug } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getMyContext } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — SecureERP" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const fetchCtx = useServerFn(getMyContext);
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });

  if (isLoading) return null;
  if (!data?.isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Shield className="h-6 w-6" />}
          title="Acesso restrito"
          description="Apenas Super Admins podem ver este painel."
        />
      </div>
    );
  }

  const tabs = [
    { to: "/admin/overview", label: "Visão Geral", icon: LayoutDashboard },
    { to: "/admin", label: "Empresas", icon: Building2, exact: true },
    { to: "/admin/plans", label: "Planos", icon: Package },
    { to: "/admin/subscriptions", label: "Assinaturas", icon: CreditCard },
    { to: "/admin/billing", label: "Cobranças", icon: Receipt },
    { to: "/admin/coupons", label: "Cupons", icon: Ticket },
    { to: "/admin/dunning", label: "Cobrança", icon: AlertTriangle },
    { to: "/admin/launch", label: "Lançamento", icon: Rocket },
    { to: "/admin/pilots", label: "Pilotos", icon: Target },
    { to: "/admin/events", label: "Eventos", icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Super Admin" description="Painel da plataforma SecureERP." />
      <nav className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact }}
            className="flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:border-primary [&.active]:text-foreground"
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
