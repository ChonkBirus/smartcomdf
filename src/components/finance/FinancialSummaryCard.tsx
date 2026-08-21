import { Link } from "@tanstack/react-router";
import { Wallet, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FinancialLinkedBadge } from "./FinancialLinkedBadge";
import type { FinSummary } from "@/lib/finance-integrations.functions";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  summary: FinSummary | undefined;
  title?: string;
  loading?: boolean;
  showCosts?: boolean;
  emptyHint?: string;
};

export function FinancialSummaryCard({
  summary,
  title = "Resumo financeiro",
  loading = false,
  showCosts = true,
  emptyHint,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !summary || summary.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyHint ?? "Nenhum lançamento financeiro vinculado."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Kpi label="A receber" value={fmtBRL(summary.totalReceivable)} />
              <Kpi label="Recebido" value={fmtBRL(summary.totalReceived)} tone="ok" />
              <Kpi
                label="Vencido"
                value={fmtBRL(summary.totalOverdue)}
                tone={summary.totalOverdue > 0 ? "bad" : "muted"}
              />
              {showCosts && <Kpi label="A pagar" value={fmtBRL(summary.totalPayable)} />}
            </div>

            <div className="divide-y rounded-md border">
              {summary.transactions.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.type === "INCOME" ? "Entrada" : "Saída"} ·{" "}
                      {t.due_date
                        ? new Date(t.due_date).toLocaleDateString("pt-BR")
                        : "Sem vencimento"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className={t.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}>
                      {showCosts || t.type === "INCOME" ? fmtBRL(t.amount) : "—"}
                    </span>
                    <FinancialLinkedBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/finance">
                <ExternalLink className="mr-1 h-4 w-4" />
                Abrir financeiro
              </Link>
            </Button>
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
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "muted";
}) {
  const color =
    tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  );
}
