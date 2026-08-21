import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { getProjectMarginSummary } from "@/lib/finance-integrations.functions";
import { usePermissions } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const fmtPct = (n: number | null) =>
  n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function ProjectMarginSummary({ projectId }: { projectId: string }) {
  const { has } = usePermissions();
  const canView = has("finance.view") || has("finance.manage");
  const showCosts = has("finance.view_costs") || has("finance.manage");
  const fn = useServerFn(getProjectMarginSummary);
  const [openBreakdown, setOpenBreakdown] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project-margin", projectId],
    queryFn: () => fn({ data: { project_id: projectId } }),
    enabled: canView,
  });

  if (!canView) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Resumo financeiro e margem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {!data.hasQuote && (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Sem orçamento vinculado. Custos aparecem se houver OS ou lançamentos ligados ao
                projeto.
              </p>
            )}

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Receita
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Kpi label="Receita total" value={formatCurrency(data.revenue.total)} />
                <Kpi label="Recebido" value={formatCurrency(data.revenue.received)} tone="ok" />
                <Kpi
                  label="Saldo a receber"
                  value={formatCurrency(data.revenue.remaining)}
                  tone={data.revenue.remaining > 0 ? "warn" : "muted"}
                />
              </div>
            </section>

            {showCosts && (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Custos
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Kpi
                    label="Custo estimado"
                    value={
                      data.cost.estimatedHasData ? formatCurrency(data.cost.estimated ?? 0) : "—"
                    }
                    hint={!data.cost.estimatedHasData ? "Não informado" : undefined}
                  />
                  <Kpi
                    label="Custo realizado"
                    value={formatCurrency(data.cost.realized)}
                    tone={data.cost.realized > 0 ? "bad" : "muted"}
                  />
                  <Kpi label="Materiais" value={formatCurrency(data.cost.realizedMaterials)} />
                  <Kpi
                    label="Equipe / mão de obra"
                    value={formatCurrency(data.cost.realizedEmployees)}
                  />
                  <Kpi label="Custos avulsos" value={formatCurrency(data.cost.realizedExtras)} />
                </div>
              </section>
            )}

            {showCosts && (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Lucro e margem
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Kpi
                    label="Lucro estimado"
                    value={
                      data.profit.estimated != null ? formatCurrency(data.profit.estimated) : "—"
                    }
                    hint={data.profit.estimated == null ? "Sem dados suficientes" : undefined}
                    tone={
                      data.profit.estimated != null && data.profit.estimated < 0 ? "bad" : "muted"
                    }
                  />
                  <Kpi label="Margem estimada" value={fmtPct(data.margin.estimatedPct)} />
                  <Kpi
                    label="Lucro realizado"
                    value={
                      data.profit.realized != null ? formatCurrency(data.profit.realized) : "—"
                    }
                    hint={data.profit.realized == null ? "Aguardando recebimento" : undefined}
                    tone={
                      data.profit.realized != null && data.profit.realized < 0
                        ? "bad"
                        : data.profit.realized != null
                          ? "ok"
                          : "muted"
                    }
                  />
                  <Kpi label="Margem realizada" value={fmtPct(data.margin.realizedPct)} />
                </div>
              </section>
            )}

            {showCosts &&
              (data.estimatedBreakdown.length > 0 || data.realizedBreakdown.length > 0) && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenBreakdown((v) => !v)}
                    className="px-2"
                  >
                    {openBreakdown ? (
                      <ChevronUp className="mr-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="mr-1 h-4 w-4" />
                    )}
                    Ver composição dos custos
                  </Button>
                  {openBreakdown && (
                    <div className="mt-3 space-y-4">
                      {data.estimatedBreakdown.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                            Custos estimados (Orçamento)
                          </p>
                          <div className="divide-y rounded-md border text-sm">
                            {data.estimatedBreakdown.map((it) => (
                              <div
                                key={it.id}
                                className="flex flex-wrap items-center justify-between gap-2 p-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{it.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {it.quantity} ×{" "}
                                    {it.has_cost ? (
                                      formatCurrency(it.unit_cost)
                                    ) : (
                                      <span className="italic">custo não informado</span>
                                    )}
                                  </p>
                                </div>
                                <span
                                  className={it.has_cost ? "font-medium" : "text-muted-foreground"}
                                >
                                  {it.has_cost ? formatCurrency(it.total_cost) : "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.realizedBreakdown.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                            Custos realizados
                          </p>
                          <div className="divide-y rounded-md border text-sm">
                            {data.realizedBreakdown.map((r) => (
                              <div
                                key={r.id}
                                className="flex flex-wrap items-center justify-between gap-2 p-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{r.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    <Badge variant="outline" className="mr-1">
                                      {r.kind === "MATERIAL"
                                        ? "Material (OS)"
                                        : r.kind === "EMPLOYEE"
                                          ? "Equipe"
                                          : "Custo avulso"}
                                    </Badge>

                                    {r.service_order_number ? `OS ${r.service_order_number}` : ""}
                                    {r.date
                                      ? ` · ${new Date(r.date).toLocaleDateString("pt-BR")}`
                                      : ""}
                                  </p>
                                </div>
                                <span className="font-medium text-rose-600">
                                  {formatCurrency(r.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {showCosts && data.serviceOrders.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Impacto por OS
                </h4>
                <div className="divide-y rounded-md border text-sm">
                  {data.serviceOrders.map((so) => (
                    <div
                      key={so.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          OS {so.service_order_number}{" "}
                          <Badge variant="outline" className="ml-1 align-middle">
                            {so.status}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {so.technician_name ?? "Sem técnico"}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span>Estimado: {formatCurrency(so.estimatedCost)}</span>
                        {" · "}
                        <span>Realizado: {formatCurrency(so.realizedCost)}</span>
                        {so.extrasCost > 0 && (
                          <>
                            {" "}
                            {" · "}
                            <span>Avulsos: {formatCurrency(so.extrasCost)}</span>
                          </>
                        )}
                        {so.employeesCost > 0 && (
                          <>
                            {" "}
                            {" · "}
                            <span>Equipe: {formatCurrency(so.employeesCost)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  tone = "muted",
  hint,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "warn" | "muted";
  hint?: string;
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-rose-600"
        : tone === "warn"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground italic">{hint}</p>}
    </div>
  );
}
