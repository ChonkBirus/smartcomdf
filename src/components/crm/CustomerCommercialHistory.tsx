import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, TrendingUp, Trophy, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCustomerCommercialHistory } from "@/lib/crm.functions";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (s: string) => new Date(s).toLocaleString("pt-BR");

export function CustomerCommercialHistory({ customerId }: { customerId: string }) {
  const fetchHistory = useServerFn(getCustomerCommercialHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["crm", "commercial-history", customerId],
    queryFn: () => fetchHistory({ data: { customer_id: customerId } }),
    staleTime: 30_000,
  });

  const opps = data?.opportunities ?? [];
  const events = data?.events ?? [];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Histórico comercial (CRM)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : opps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade CRM vinculada a este cliente ainda.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricCard icon={TrendingUp} label="Oportunidades" value={String(opps.length)} />
              <MetricCard
                icon={Trophy}
                label="Ganhas"
                value={String(opps.filter((o: any) => o.won_at).length)}
              />
              <MetricCard
                icon={XCircle}
                label="Perdidas"
                value={String(opps.filter((o: any) => o.lost_at).length)}
              />
            </div>

            <div>
              <p className="mb-2 text-xs uppercase text-muted-foreground">Oportunidades</p>
              <ul className="space-y-2">
                {opps.map((o: any) => (
                  <li key={o.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{o.lead_name}</div>
                        {o.service_interest && (
                          <div className="text-xs text-muted-foreground">{o.service_interest}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          Criada em {fmt(o.created_at)}
                        </div>
                        {o.lost_reason && (
                          <div className="mt-1 text-xs text-destructive">
                            Motivo da perda: {o.lost_reason}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {brl(Number(o.estimated_value || 0))}
                        </div>
                        {o.won_at ? (
                          <Badge className="mt-1 bg-success text-success-foreground">Ganho</Badge>
                        ) : o.lost_at ? (
                          <Badge variant="destructive" className="mt-1">
                            Perdido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1">
                            Em aberto
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {events.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Timeline</p>
                <ul className="space-y-2">
                  {events.slice(0, 25).map((e: any) => (
                    <li key={e.id} className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{e.title}</span>
                        <span className="text-xs text-muted-foreground">{fmt(e.at)}</span>
                      </div>
                      {e.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
