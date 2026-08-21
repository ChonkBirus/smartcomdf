import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, UserX, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCrmChurnRisk } from "@/lib/crm.functions";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CrmChurnRiskPanel() {
  const fn = useServerFn(getCrmChurnRisk);
  const [stalledDays, setStalledDays] = useState(14);
  const [wonSilenceDays, setWonSilenceDays] = useState(90);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "churn", stalledDays, wonSilenceDays],
    queryFn: () => fn({ data: { stalledDays, wonSilenceDays } }),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const stalled = data.rows.filter((r) => r.kind === "stalled_open");
  const churn = data.rows.filter((r) => r.kind === "won_no_followup");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Parada há</span>
          <Select value={String(stalledDays)} onValueChange={(v) => setStalledDays(Number(v))}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[7, 14, 21, 30, 45, 60].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Cliente sem contato há</span>
          <Select
            value={String(wonSilenceDays)}
            onValueChange={(v) => setWonSilenceDays(Number(v))}
          >
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[30, 60, 90, 120, 180, 365].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <AlertTriangle className="mr-2 inline h-4 w-4 text-warning" />
              Oportunidades paradas ({stalled.length})
            </CardTitle>
            <Badge variant="outline">≥ {stalledDays}d</Badge>
          </CardHeader>
          <CardContent>
            {stalled.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma oportunidade parada 🎉
              </p>
            ) : (
              <ul className="divide-y">
                {stalled.slice(0, 20).map((r) => (
                  <li
                    key={`s-${r.opportunity_id}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-xs font-medium">{brl(r.estimated_value)}</span>
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to="/crm"
                          search={{ opportunity: r.opportunity_id ?? undefined } as never}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <UserX className="mr-2 inline h-4 w-4 text-destructive" />
              Clientes em risco de churn ({churn.length})
            </CardTitle>
            <Badge variant="outline">≥ {wonSilenceDays}d</Badge>
          </CardHeader>
          <CardContent>
            {churn.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todos os clientes ganhos tiveram contato recente.
              </p>
            ) : (
              <ul className="divide-y">
                {churn.slice(0, 20).map((r) => (
                  <li
                    key={`c-${r.customer_id}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/clients/$id" params={{ id: r.customer_id ?? "" }}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
