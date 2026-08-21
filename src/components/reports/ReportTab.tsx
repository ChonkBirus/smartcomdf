import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePermissions } from "@/lib/permissions";
import {
  getReport,
  type ReportColumn,
  type ReportRow,
  type ReportType,
} from "@/lib/reports.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import { resolvePeriod, type ReportsFiltersValue } from "./ReportsFilters";

const STATUS_COL_KEYS = new Set(["status", "payment_status"]);

function formatCell(value: ReportRow[string], col: ReportColumn) {
  if (value === null || value === undefined || value === "") return "—";
  if (STATUS_COL_KEYS.has(col.key)) {
    return <StatusBadge status={String(value)} />;
  }
  if (col.format === "currency") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      Number(value),
    );
  }
  if (col.format === "number") return new Intl.NumberFormat("pt-BR").format(Number(value));
  if (col.format === "date") {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("pt-BR");
  }
  if (col.format === "datetime") {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString("pt-BR");
  }
  return String(value);
}

function toCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(";");
  const lines = rows.map((r) => columns.map((c) => esc(r[c.key])).join(";"));
  return [header, ...lines].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ReportTabProps {
  type: ReportType;
  filters: ReportsFiltersValue;
  title: string;
}

export function ReportTab({ type, filters, title }: ReportTabProps) {
  const { has } = usePermissions();
  const canExport = has("reports.export");
  const { from, to } = resolvePeriod(filters.period, filters.from, filters.to);

  const companyId = useCompanyId();
  const q = useQuery({
    queryKey: ["reports", type, companyId, filters.period, from, to],
    queryFn: () => getReport({ data: { type, filters: { from, to } } }),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const isEmpty = useMemo(
    () =>
      !q.data ||
      (q.data.rows.length === 0 &&
        q.data.kpis.every((k) => !k.value || k.value === 0 || k.value === "0")),
    [q.data],
  );

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Erro ao carregar"
        description={q.error instanceof Error ? q.error.message : "Tente novamente."}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="Nenhum dado encontrado"
        description="Não encontramos informações para os filtros selecionados. Ajuste o período ou cadastre novos registros para gerar relatórios."
      />
    );
  }

  const { kpis, columns, rows } = q.data!;

  return (
    <div className="space-y-4">
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} title={k.label} value={String(k.value)} />
          ))}
        </div>
      )}

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {canExport && rows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCsv(`${type}-${Date.now()}.csv`, toCsv(columns, rows))}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>{formatCell(row[c.key], c)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > 200 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Exibindo 200 de {rows.length} registros. Use os filtros para refinar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportTab;
