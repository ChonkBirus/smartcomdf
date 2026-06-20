import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings as SettingsIcon, Building2, Users, Shield } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyContext } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — SecureERP" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const fetchCtx = useServerFn(getMyContext);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Configurações" description="Empresa, usuários, permissões e preferências." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" /> Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Razão Social</span><span className="font-medium">{data?.company?.corporate_name}</span></div>
            {data?.company?.trade_name && <div className="flex justify-between"><span className="text-muted-foreground">Nome Fantasia</span><span className="font-medium">{data.company.trade_name}</span></div>}
            {data?.company?.cnpj && <div className="flex justify-between"><span className="text-muted-foreground">CNPJ</span><span className="font-medium">{data.company.cnpj}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="secondary">{data?.company?.status}</Badge></div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" /> Meus papéis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data?.roles?.length ? data.roles.map((r, i) => (
              <Badge key={i} className="bg-primary text-primary-foreground">{r.role}</Badge>
            )) : <span className="text-sm text-muted-foreground">Nenhum papel atribuído.</span>}
          </CardContent>
        </Card>

        <Card className="card-elevated md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Equipe e permissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gestão de usuários, convites por e-mail e matriz de permissões serão liberados na próxima fase.
            </p>
          </CardContent>
        </Card>

        <Card className="card-elevated md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="h-4 w-4 text-primary" /> Preferências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Idioma, moeda, timezone e tema serão configuráveis aqui.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
