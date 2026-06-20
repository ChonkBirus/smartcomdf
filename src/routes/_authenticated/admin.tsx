import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Users, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Shield } from "lucide-react";
import { getMyContext } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — SecureERP" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchCtx = useServerFn(getMyContext);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });

  if (!data?.isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={<Shield className="h-6 w-6" />} title="Acesso restrito" description="Apenas Super Admins podem ver este painel." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Super Admin" description="Painel da plataforma SecureERP." />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Empresas" value="—" icon={<Building2 className="h-5 w-5" />} hint="Gestão em breve" />
        <KpiCard title="Usuários" value="—" icon={<Users className="h-5 w-5" />} hint="Gestão em breve" />
        <KpiCard title="Assinaturas ativas" value="—" icon={<CreditCard className="h-5 w-5" />} hint="Gestão em breve" />
      </div>
    </div>
  );
}
