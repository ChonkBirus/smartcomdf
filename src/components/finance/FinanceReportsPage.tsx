import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, TrendingUp, TrendingDown, Wallet, AlertTriangle, FileBarChart } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

import { getFinanceReport } from "@/lib/finance-reports.functions";
import { listFinancialTransactions, type FinancialTransaction } from "@/lib/finance.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import { usePermissions } from "@/lib/permissions";

const BRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Filters = { from?: string; to?: string };

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    toast.error("Nada para exportar nos filtros atuais.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",;\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Metric({ title, value, hint, tone, icon }: {
  title: string; value: string; hint?: string;
  tone?: "success" | "danger" | "warning"; icon: React.ReactNode;
}) {
  const t =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-destructive" :
    tone === "warning" ? "text-amber-500" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight ${t}`}>{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryTable({ title, rows }: { title: string; rows: Array<{ name: string; total: number; count: number }> }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {!rows.length ? (
          <div className="p-6">
            <EmptyState
              icon={<FileBarChart className="h-5 w-5" />}
              title="Sem dados no período"
              description="Ajuste o filtro para ver resultados."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right font-mono">{BRL(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FinanceReportsPage({ filters }: { filters: Filters }) {
  const companyId = useCompanyId();
  const { has } = usePermissions();
  const canExport = has("finance.reports.export") || has("finance.manage");

  const reportFn = useServerFn(getFinanceReport);
  const listFn = useServerFn(listFinancialTransactions);

  const report = useQuery({
    queryKey: ["fin-report", companyId, filters],
    queryFn: () => reportFn({ data: filters }),
    enabled: !!companyId,
  });

  const txs = useQuery({
    queryKey: ["fin-report-txs", companyId, filters],
    queryFn: () => listFn({ data: filters }),
    enabled: !!companyId,
  });

  const r = report.data;
  const list = useMemo<FinancialTransaction[]>(() => txs.data ?? [], [txs.data]);

  function handleExport() {
    if (!canExport) {
      toast.error("Sem permissão para exportar relatórios.");
      return;
    }
    const rows = list.map((t) => ({
      data: t.paid_at ? t.paid_at.slice(0, 10) : t.due_date ?? "",
      tipo: t.type === "INCOME" ? "Entrada" : "Saída",
      descricao: t.description,
      categoria: t.category_name ?? "",
      cliente: t.customer_name ?? "",
      fornecedor: t.supplier_name ?? "",
      valor: t.amount.toFixed(2).replace(".", ","),
      status: t.status,
      forma_pagamento: t.payment_method ?? "",
      origem: t.origin ?? "",
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`relatorio-financeiro-${stamp}.csv`, rows);
  }

  if (report.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Não foi possível carregar os relatórios"
        description="Tente novamente em alguns instantes."
        action={<Button variant="outline" onClick={() => report.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {r ? `${r.count} lançamento(s) no período selecionado.` : "Carregando…"}
        </p>
        <Button variant="outline" onClick={handleExport} disabled={!canExport || !list.length}>
          <Download className="mr-1 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Entradas" value={BRL(r?.income ?? 0)} tone="success" icon={<TrendingUp className="h-5 w-5" />} hint="Pagos no período" />
        <Metric title="Saídas" value={BRL(r?.expense ?? 0)} tone="danger" icon={<TrendingDown className="h-5 w-5" />} hint="Pagos no período" />
        <Metric title="Saldo" value={BRL(r?.balance ?? 0)} tone={(r?.balance ?? 0) >= 0 ? "success" : "danger"} icon={<Wallet className="h-5 w-5" />} />
        <Metric title="A receber" value={BRL(r?.receivables ?? 0)} icon={<TrendingUp className="h-5 w-5" />} />
        <Metric title="A pagar" value={BRL(r?.payables ?? 0)} icon={<TrendingDown className="h-5 w-5" />} />
        <Metric title="Recebimentos atrasados" value={BRL(r?.overdueReceivables ?? 0)} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
        <Metric title="Contas vencidas" value={BRL(r?.overduePayables ?? 0)} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
        <Metric title="Total de lançamentos" value={String(r?.count ?? 0)} icon={<FileBarChart className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryTable title="Entradas por categoria" rows={r?.incomeByCategory ?? []} />
        <CategoryTable title="Saídas por categoria" rows={r?.expenseByCategory ?? []} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Resumo mensal</h3>
          </div>
          {!r?.monthly?.length ? (
            <div className="p-6">
              <EmptyState
                icon={<FileBarChart className="h-5 w-5" />}
                title="Nenhum dado suficiente para o gráfico"
                description="Registre lançamentos pagos para ver a evolução mensal."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.monthly.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{m.month}</TableCell>
                      <TableCell className="text-right font-mono text-success">{BRL(m.income)}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{BRL(m.expense)}</TableCell>
                      <TableCell className="text-right font-mono">{BRL(m.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Lançamentos no período</h3>
            <Badge variant="outline">{list.length}</Badge>
          </div>
          {!list.length ? (
            <div className="p-6">
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="Nenhum lançamento encontrado"
                description="Ajuste os filtros ou registre novos lançamentos."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.slice(0, 100).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {(t.paid_at ?? t.due_date ?? "").slice(0, 10) || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={t.type === "INCOME" ? "text-success" : "text-destructive"}>
                          {t.type === "INCOME" ? "Entrada" : "Saída"}
                        </span>
                      </TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell>{t.category_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{BRL(t.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {list.length > 100 && (
                <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
                  Exibindo 100 de {list.length}. Use a exportação CSV para o conjunto completo.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
