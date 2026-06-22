import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  BarChart3, DollarSign, ShoppingCart, Receipt, CheckCheck, Clock,
  Truck, TrendingUp, Users,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader } from "@/components/app/PageHeader";
import { KpiCard } from "@/components/app/KpiCard";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { purchaseAnalytics, type PurchaseAnalyticsRange } from "@/lib/purchases.functions";

export const Route = createFileRoute("/_authenticated/purchases-analytics")({
  head: () => ({ meta: [{ title: "Dashboard de Compras — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="purchases">
      <FeatureGate feature="purchases">
        <PurchasesAnalyticsPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nf = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const RANGE_LABEL: Record<PurchaseAnalyticsRange, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  ytd: "Ano corrente",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PARTIALLY_RECEIVED: "Parcial",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "hsl(var(--muted-foreground))",
  PENDING: "hsl(var(--chart-2, 38 92% 50%))",
  APPROVED: "hsl(var(--chart-3, 217 91% 60%))",
  PARTIALLY_RECEIVED: "hsl(var(--chart-4, 271 91% 65%))",
  RECEIVED: "hsl(var(--chart-1, 142 71% 45%))",
  CANCELLED: "hsl(var(--destructive))",
};

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

function PurchasesAnalyticsPage() {
  const [range, setRange] = useState<PurchaseAnalyticsRange>("90d");
  const fetchAnalytics = useServerFn(purchaseAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["purchase_analytics", range],
    queryFn: () => fetchAnalytics({ data: { range } }),
  });

  const monthly = (data?.monthly ?? []).map((m) => ({
    ...m,
    label: formatMonth(m.month),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard de Compras"
        description="KPIs, evolução e ranking de fornecedores e itens."
        actions={
          <Select value={range} onValueChange={(v) => setRange(v as PurchaseAnalyticsRange)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABEL) as PurchaseAnalyticsRange[]).map((k) => (
                <SelectItem key={k} value={k}>{RANGE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Sem dados.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total comprado" value={brl(data.kpis.totalAmount)} icon={<DollarSign className="h-5 w-5" />} />
            <KpiCard title="Pedidos" value={String(data.kpis.ordersCount)} icon={<ShoppingCart className="h-5 w-5" />} />
            <KpiCard title="Ticket médio" value={brl(data.kpis.avgTicket)} icon={<Receipt className="h-5 w-5" />} />
            <KpiCard title="Lead time médio" value={`${nf(data.kpis.avgLeadTime)} d`} icon={<Truck className="h-5 w-5" />} />
            <KpiCard title="Recebidos" value={String(data.kpis.receivedCount)} icon={<CheckCheck className="h-5 w-5" />} />
            <KpiCard title="Em aberto" value={String(data.kpis.pendingCount)} icon={<Clock className="h-5 w-5" />} />
            <KpiCard title="Taxa de conclusão" value={`${nf(data.kpis.fillRate)}%`} icon={<TrendingUp className="h-5 w-5" />} />
            <KpiCard title="Fornecedores ativos" value={String(data.kpis.suppliersActive)} icon={<Users className="h-5 w-5" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" /> Evolução mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => brl(Number(v)).replace("R$", "")} tick={{ fontSize: 11 }} width={80} />
                      <Tooltip
                        formatter={(v: any, name) =>
                          name === "total" ? brl(Number(v)) : String(v)
                        }
                        labelClassName="text-foreground"
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="total" name="Total comprado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="count" name="Pedidos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status dos pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusDist.map((s) => ({ ...s, label: STATUS_LABEL[s.status] ?? s.status }))}
                        dataKey="count"
                        nameKey="label"
                        outerRadius={90}
                        label
                      >
                        {data.statusDist.map((s) => (
                          <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? "hsl(var(--muted))"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top fornecedores</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 text-left">Fornecedor</th>
                        <th className="py-2 text-right">Pedidos</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSuppliers.map((s) => (
                        <tr key={s.supplier_id} className="border-t">
                          <td className="py-2 font-medium">{s.name}</td>
                          <td className="py-2 text-right">{s.orders}</td>
                          <td className="py-2 text-right">{brl(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top itens comprados</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 text-left">Item</th>
                        <th className="py-2 text-right">Qtde</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topItems.map((it) => (
                        <tr key={it.item_id} className="border-t">
                          <td className="py-2">
                            <div className="font-medium">{it.name}</div>
                            {it.sku && <Badge variant="outline" className="text-xs">{it.sku}</Badge>}
                          </td>
                          <td className="py-2 text-right">{nf(it.qty)}</td>
                          <td className="py-2 text-right">{brl(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
