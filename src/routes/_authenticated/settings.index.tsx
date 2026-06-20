import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Users, Shield, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyContext } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsOverview,
});

function SettingsOverview() {
  const fetchCtx = useServerFn(getMyContext);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });

  const cards = [
    { to: "/settings/company", title: "Empresa", icon: Building2, desc: "Razão social, CNPJ, logo e contato." },
    { to: "/settings/team", title: "Equipe", icon: Users, desc: "Convide usuários e gerencie papéis." },
    { to: "/settings/roles", title: "Permissões", icon: Shield, desc: "Matriz de permissões por papel." },
    { to: "/profile", title: "Meu perfil", icon: UserCircle, desc: "Nome, telefone e avatar." },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" /> Empresa atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Razão Social</span>
              <span className="font-medium">{data?.company?.corporate_name}</span>
            </div>
            {data?.company?.trade_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome Fantasia</span>
                <span className="font-medium">{data.company.trade_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary">{data?.company?.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" /> Meus papéis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data?.roles?.length ? (
              data.roles.map((r, i) => (
                <Badge key={i} className="bg-primary text-primary-foreground">{r.role}</Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhum papel atribuído.</span>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group">
            <Card className="card-elevated transition-colors hover:border-primary">
              <CardContent className="space-y-2 p-4">
                <c.icon className="h-5 w-5 text-primary" />
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
