import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — SecureERP" }] }),
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings", label: "Visão geral", exact: true },
  { to: "/settings/company", label: "Empresa" },
  { to: "/settings/team", label: "Equipe" },
  { to: "/settings/roles", label: "Permissões" },
  { to: "/settings/subscription", label: "Assinatura" },
  { to: "/billing/invoices", label: "Faturas e Pagamentos" },
];

function SettingsLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Configurações" description="Empresa, equipe, permissões e preferências." />
      <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
