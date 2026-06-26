import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText, Plus, Pencil, Trash2, Copy, Search, Send, XCircle, CheckCircle2, Share2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { KpiCard } from "@/components/app/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { QuoteFormSheet } from "@/components/quotes/QuoteFormSheet";
import { QuoteSendSheet } from "@/components/quotes/QuoteSendSheet";
import {
  listQuotes, quoteMetrics, deleteQuote, duplicateQuote,
  markQuoteSent, cancelQuote,
  type QuoteStatus, type QuotePaymentStatus,
} from "@/lib/quotes.functions";

export const Route = createFileRoute("/_authenticated/quotes")({
  head: () => ({ meta: [{ title: "Orçamentos — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="quotes">
      <FeatureGate feature="quotes">
        <QuotesPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Rascunho", SENT: "Enviado", VIEWED: "Visualizado",
  APPROVED: "Aprovado", REJECTED: "Rejeitado",
  CANCELLED: "Cancelado", EXPIRED: "Expirado", CONVERTED: "Convertido",
};

const PAY_STATUS_LABEL: Record<QuotePaymentStatus, string> = {
  NOT_STARTED: "Não iniciado",
  WAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PAYMENT_REJECTED: "Pagamento recusado",
  PAYMENT_CANCELLED: "Pagamento cancelado",
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

function QuotesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "ALL">("ALL");
  const [payFilter, setPayFilter] = useState<QuotePaymentStatus | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; number: string } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchList = useServerFn(listQuotes);
  const fetchMetrics = useServerFn(quoteMetrics);
  const remove = useServerFn(deleteQuote);
  const dup = useServerFn(duplicateQuote);
  const sendIt = useServerFn(markQuoteSent);
  const cancel = useServerFn(cancelQuote);

  const { data: metrics } = useQuery({
    queryKey: ["quote-metrics"],
    queryFn: () => fetchMetrics(),
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["quotes", { search, statusFilter, payFilter }],
    queryFn: () =>
      fetchList({
        data: {
          search: search.trim() || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          payment_status: payFilter === "ALL" ? undefined : payFilter,
        },
      }),
  });

  const list = rows ?? [];
  const filtered = useMemo(() => list, [list]);

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Orçamento excluído.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote-metrics"] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: (r) => {
      toast.success("Orçamento duplicado.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setEditing(r.id); setOpen(true);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const sendMut = useMutation({
    mutationFn: (id: string) => sendIt({ data: { id } }),
    onSuccess: () => {
      toast.success("Orçamento marcado como enviado.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote-metrics"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Orçamento cancelado.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote-metrics"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(id: string) { setEditing(id); setOpen(true); }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Orçamentos"
        description="Crie, envie e acompanhe orçamentos."
        actions={
          <Can module="quotes" action="create">
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />Novo orçamento
            </Button>
          </Can>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total" value={metrics?.total ?? 0} icon={<FileText className="h-5 w-5" />} hint="Histórico geral" />
        <KpiCard title="Em aberto" value={metrics?.open ?? 0} hint={`Valor: ${fmtBRL(metrics?.open_value ?? 0)}`} />
        <KpiCard title="Aprovados" value={metrics?.approved ?? 0} hint={`Valor: ${fmtBRL(metrics?.approved_value ?? 0)}`} />
        <KpiCard title="No mês" value={metrics?.this_month ?? 0} hint="Criados em " />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número ou título..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payFilter} onValueChange={(v) => setPayFilter(v as any)}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos pagamentos</SelectItem>
            {(Object.keys(PAY_STATUS_LABEL) as QuotePaymentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PAY_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Nenhum orçamento"
          description="Crie seu primeiro orçamento para começar."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 hidden md:table-cell">Emissão</th>
                <th className="px-3 py-2 hidden md:table-cell">Validade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 hidden lg:table-cell">Pagamento</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">
                    {q.quote_number}
                    {q.title && (
                      <p className="text-xs text-muted-foreground">{q.title}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">{q.customer_name ?? "—"}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{fmtDate(q.issue_date)}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{fmtDate(q.valid_until)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={q.status} label={STATUS_LABEL[q.status]} />
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <StatusBadge status={q.payment_status} label={PAY_STATUS_LABEL[q.payment_status]} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmtBRL(q.total_amount)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Can module="quotes" action="edit">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(q.id)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Can>
                      <Can module="quotes" action="edit">
                        <Button size="icon" variant="ghost" onClick={() => setSendingId(q.id)} title="Enviar / compartilhar">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </Can>
                      {["DRAFT", "VIEWED"].includes(q.status) && (
                        <Can module="quotes" action="edit">
                          <Button size="icon" variant="ghost" onClick={() => sendMut.mutate(q.id)} title="Marcar como enviado">
                            <Send className="h-4 w-4" />
                          </Button>
                        </Can>
                      )}
                      <Can module="quotes" action="create">
                        <Button size="icon" variant="ghost" onClick={() => dupMut.mutate(q.id)} title="Duplicar">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </Can>
                      {!["CANCELLED", "EXPIRED"].includes(q.status) && (
                        <Can module="quotes" action="edit">
                          <Button size="icon" variant="ghost" onClick={() => cancelMut.mutate(q.id)} title="Cancelar">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </Can>
                      )}
                      <Can module="quotes" action="delete">
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => setConfirmDel({ id: q.id, number: q.quote_number })}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QuoteFormSheet open={open} onOpenChange={setOpen} quoteId={editing} />
      <QuoteSendSheet open={!!sendingId} onOpenChange={(o) => !o && setSendingId(null)} quoteId={sendingId} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento {confirmDel?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas rascunhos ou cancelados podem ser excluídos. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel.id)}>
              <CheckCircle2 className="mr-1 h-4 w-4" />Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
