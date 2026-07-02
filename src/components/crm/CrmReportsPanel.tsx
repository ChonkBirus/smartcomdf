import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCrmReports } from "@/lib/crm.functions";
import { buildCrmReportCsv } from "@/lib/crm-reports-csv";


function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CrmReportsPanel() {
  const fn = useServerFn(getCrmReports);
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "reports", days],
    queryFn: () => fn({ data: { days } }),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const handleExport = () => {
    const hasData =
      data.bySource.length > 0 || data.byAssigned.length > 0 || data.lostReasons.length > 0;
    if (!hasData) {
      toast.info("Nenhum dado no período selecionado para exportar.");
      return;
    }
    const csv = buildCrmReportCsv(data, days);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`crm-relatorio-${days}d-${stamp}.csv`, csv);
    toast.success("CSV exportado com sucesso.");
  };



  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Período: últimos <span className="font-medium text-foreground">{days}</span> dias
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Últimos 365 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownCard
          title="Leads por origem"
          rows={data.bySource.map((r) => ({
            key: r.key, label: r.label, primary: `${r.count}`, secondary: brl(r.value), weight: r.count,
          }))}
        />
        <BreakdownCard
          title="Leads por temperatura"
          rows={data.byTemperature.map((r) => ({
            key: r.key, label: r.label, primary: `${r.count}`, secondary: brl(r.value), weight: r.count,
          }))}
        />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Performance por responsável</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.byAssigned.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            )}
            {data.byAssigned.map((r) => (
              <div key={r.key} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.count} leads · Ganhos: {r.won} · Perdidos: {r.lost}
                  </div>
                </div>
                <div className="text-right text-xs font-medium">{brl(r.value)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Motivos de perda</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.lostReasons.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum motivo registrado.</p>
            )}
            {data.lostReasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span className="line-clamp-2 pr-2">{r.reason}</span>
                <span className="text-xs font-medium text-muted-foreground">{r.count}x</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BreakdownCard({
  title, rows,
}: {
  title: string;
  rows: { key: string; label: string; primary: string; secondary: string; weight: number }[];
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.weight), 0) || 1;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
        {rows.map((r) => (
          <div key={r.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{r.label}</span>
              <span className="text-xs text-muted-foreground">
                {r.primary} · {r.secondary}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.weight / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
