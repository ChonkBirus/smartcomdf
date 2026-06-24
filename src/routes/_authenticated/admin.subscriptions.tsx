import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History, Pencil, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  listSubscriptions,
  updateSubscription,
  listSubscriptionEvents,
  listPlans,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: AdminSubscriptionsPage,
});

const STATUSES = ["TRIALING","ACTIVE","PAST_DUE","SUSPENDED","CANCELED","EXPIRED","MANUAL_REVIEW"] as const;

const statusClass: Record<string, string> = {
  TRIALING: "bg-blue-500/15 text-blue-600",
  ACTIVE: "bg-emerald-500/15 text-emerald-600",
  PAST_DUE: "bg-amber-500/15 text-amber-600",
  SUSPENDED: "bg-red-500/15 text-red-600",
  CANCELED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  MANUAL_REVIEW: "bg-purple-500/15 text-purple-600",
};

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubscriptions);
  const plansFn = useServerFn(listPlans);

  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [historyOf, setHistoryOf] = useState<any | null>(null);

  const filters = useMemo(
    () => ({ status: status === "ALL" ? null : status, search: search || null }),
    [status, search],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions", filters],
    queryFn: () => listFn({ data: filters }),
  });

  const { data: plans } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => plansFn(),
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setSearch(searchInput)}>Filtrar</Button>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Trial até</TableHead>
              <TableHead>Tolerância</TableHead>
              <TableHead>Próx. cobrança</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma assinatura encontrada.</TableCell></TableRow>
            )}
            {(data ?? []).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.company_name ?? "—"}</TableCell>
                <TableCell>{s.plan_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={statusClass[s.status] ?? "bg-muted"}>{s.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{s.billing_cycle ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(s.trial_ends_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(s.grace_period_ends_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(s.next_billing_date)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistoryOf(s)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Gerenciar" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <EditDialog
          subscription={editing}
          plans={plans ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {historyOf && (
        <HistoryDialog subscription={historyOf} onClose={() => setHistoryOf(null)} />
      )}
    </div>
  );
}

function EditDialog({ subscription, plans, onClose, onSaved }: { subscription: any; plans: any[]; onClose: () => void; onSaved: () => void; }) {
  const updateFn = useServerFn(updateSubscription);
  const [planId, setPlanId] = useState<string>(subscription.plan_id ?? "");
  const [status, setStatus] = useState<string>(subscription.status ?? "");
  const [cycle, setCycle] = useState<string>(subscription.billing_cycle ?? "MONTHLY");
  const [trialDays, setTrialDays] = useState<string>("");
  const [graceDays, setGraceDays] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const mutation = useMutation({
    mutationFn: () => updateFn({ data: {
      subscription_id: subscription.id,
      new_plan_id: planId && planId !== subscription.plan_id ? planId : null,
      new_status: status && status !== subscription.status ? (status as any) : null,
      new_billing_cycle: cycle && cycle !== subscription.billing_cycle ? (cycle as any) : null,
      extend_trial_days: trialDays ? Number(trialDays) : null,
      extend_grace_days: graceDays ? Number(graceDays) : null,
      description: description || null,
    } }),
    onSuccess: () => { toast.success("Assinatura atualizada"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar assinatura — {subscription.company_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ciclo</Label>
              <Select value={cycle} onValueChange={setCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estender trial (dias)</Label>
              <Input type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Estender tolerância (dias)</Label>
              <Input type="number" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo / Observação</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Registro do ajuste manual..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ subscription, onClose }: { subscription: any; onClose: () => void; }) {
  const fn = useServerFn(listSubscriptionEvents);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscription-events", subscription.id],
    queryFn: () => fn({ data: { subscription_id: subscription.id } }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico — {subscription.company_name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
          )}
          {(data ?? []).map((e: any) => (
            <div key={e.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{e.event_type}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {(e.previous_status || e.new_status) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Status: <span className="font-mono">{e.previous_status ?? "—"}</span> → <span className="font-mono">{e.new_status ?? "—"}</span>
                </p>
              )}
              {e.description && <p className="mt-1">{e.description}</p>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
