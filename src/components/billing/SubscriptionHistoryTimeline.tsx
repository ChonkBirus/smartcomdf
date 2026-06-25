import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  CreditCard,
  TicketPercent,
  AlertTriangle,
  Undo2,
  PlayCircle,
  PauseCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSubscriptionCommercialHistory,
  getSubscriptionCommercialHistoryAdmin,
  type CommercialHistoryEntry,
  type CommercialHistorySource,
} from "@/lib/billing-history.functions";
import { Download } from "lucide-react";

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function iconFor(entry: CommercialHistoryEntry) {
  switch (entry.event_type) {
    case "plan_upgrade_requested":
    case "plan_upgrade_applied":
      return <ArrowUpCircle className="h-5 w-5 text-emerald-600" />;
    case "plan_downgrade_scheduled":
    case "plan_downgrade_applied":
      return <ArrowDownCircle className="h-5 w-5 text-amber-600" />;
    case "plan_changed":
      return <Sparkles className="h-5 w-5 text-blue-600" />;
    case "plan_change_canceled":
      return <Undo2 className="h-5 w-5 text-muted-foreground" />;
    case "cancellation_scheduled":
      return <Clock className="h-5 w-5 text-amber-600" />;
    case "cancellation_immediate":
    case "subscription_canceled":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "cancellation_reverted":
      return <Undo2 className="h-5 w-5 text-emerald-600" />;
    case "subscription_reactivated":
    case "subscription_activated":
      return <PlayCircle className="h-5 w-5 text-emerald-600" />;
    case "subscription_suspended":
      return <PauseCircle className="h-5 w-5 text-destructive" />;
    case "trial_started":
    case "trial_ended":
      return <Clock className="h-5 w-5 text-blue-600" />;
    case "payment_confirmed":
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    case "payment_pending":
      return <CreditCard className="h-5 w-5 text-amber-600" />;
    case "payment_overdue":
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case "payment_refunded":
      return <RefreshCw className="h-5 w-5 text-muted-foreground" />;
    case "payment_canceled":
      return <XCircle className="h-5 w-5 text-muted-foreground" />;
    case "coupon_redeemed":
    case "coupon_applied":
      return <TicketPercent className="h-5 w-5 text-purple-600" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

const actorLabel: Record<string, string> = {
  USER: "Você / equipe",
  ADMIN: "Suporte",
  SYSTEM: "Sistema",
  WEBHOOK: "Gateway de pagamento",
};

const PAGE_SIZE = 20;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(entries: CommercialHistoryEntry[]) {
  const header = [
    "data",
    "tipo",
    "origem",
    "titulo",
    "descricao",
    "valor",
    "responsavel",
    "nome",
  ];
  const lines = entries.map((e) =>
    [
      new Date(e.event_date).toISOString(),
      e.event_type,
      e.source,
      e.title,
      e.description ?? "",
      e.amount ?? "",
      e.actor_type,
      e.actor_name ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historico-comercial-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SubscriptionHistoryTimeline({
  subscriptionId,
  mode = "user",
}: {
  subscriptionId?: string;
  mode?: "user" | "admin";
}) {
  const userFn = useServerFn(getSubscriptionCommercialHistory);
  const adminFn = useServerFn(getSubscriptionCommercialHistoryAdmin);
  const [source, setSource] = useState<CommercialHistorySource | "ALL">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const callFn = (args: any) =>
    mode === "admin"
      ? adminFn({ data: { ...args, subscriptionId: subscriptionId! } })
      : userFn({ data: args });

  const { data, isLoading } = useQuery({
    queryKey: [
      "billing",
      "commercial-history",
      mode,
      subscriptionId ?? null,
      source,
      fromDate,
      toDate,
      page,
    ],
    queryFn: () =>
      callFn({
        subscriptionId,
        source,
        fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
        toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={source}
            onValueChange={(v) => {
              setSource(v as any);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="subscription_event">Plano / Assinatura</SelectItem>
              <SelectItem value="billing_charge">Cobranças e pagamentos</SelectItem>
              <SelectItem value="coupon_redemption">Cupons</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              setSource("ALL");
              setFromDate("");
              setToDate("");
              setPage(1);
            }}
          >
            Limpar
          </Button>
          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const all: CommercialHistoryEntry[] = [];
                let p = 1;
                const size = 500;
                // fetch up to 5000 rows respecting current filters
                for (let i = 0; i < 10; i++) {
                  const res = await callFn({
                    subscriptionId,
                    source,
                    fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
                    toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
                    page: p,
                    pageSize: size,
                  });
                  all.push(...(res.entries ?? []));
                  if ((res.entries ?? []).length < size) break;
                  p += 1;
                }
                downloadCsv(all);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando histórico...</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum evento encontrado para os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-6">
          {entries.map((e) => (
            <li key={`${e.source}-${e.id}`} className="relative">
              <span className="absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full bg-background ring-1 ring-border">
                {iconFor(e)}
              </span>
              <Card className="card-elevated">
                <CardContent className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{e.title}</div>
                    {e.amount !== null && e.amount !== undefined ? (
                      <div
                        className={`text-sm font-semibold ${
                          e.amount < 0 ? "text-emerald-600" : ""
                        }`}
                      >
                        {fmtMoney(Number(e.amount))}
                      </div>
                    ) : null}
                  </div>
                  {e.description ? (
                    <div className="text-sm text-muted-foreground">
                      {e.description}
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    {fmtDateTime(e.event_date)} ·{" "}
                    {actorLabel[e.actor_type] ?? e.actor_type}
                    {e.actor_name ? ` (${e.actor_name})` : ""}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Página {page} de {totalPages} · {total} evento(s)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
