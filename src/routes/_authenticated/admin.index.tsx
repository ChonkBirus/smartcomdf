import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listCompanies, listPlans, updateSubscription } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminCompaniesPage,
});

type SubStatus =
  | "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED"
  | "CANCELED" | "EXPIRED" | "MANUAL_REVIEW";

const SUB_STATUS_LABEL: Record<string, string> = {
  TRIALING: "Trial",
  ACTIVE: "Ativa",
  PAST_DUE: "Pendente",
  SUSPENDED: "Suspensa",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
  MANUAL_REVIEW: "Em análise",
};

const SUB_STATUS_COLOR: Record<string, string> = {
  TRIALING: "bg-warning/15 text-warning",
  ACTIVE: "bg-success/15 text-success",
  PAST_DUE: "bg-warning/15 text-warning",
  SUSPENDED: "bg-destructive/15 text-destructive",
  CANCELED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  MANUAL_REVIEW: "bg-primary/15 text-primary",
};

type Company = {
  id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string | null;
  plan_id: string | null;
  plan_name: string | null;
  users_count: number;
  created_at: string;
  subscription_id: string | null;
  subscription_status: SubStatus | null;
  trial_ends_at: string | null;
  next_billing_date: string | null;
  last_paid_at: string | null;
};

type ActionKind = "plan" | "trial" | "status" | "suspend" | "reactivate";
type ActionState = { kind: ActionKind; company: Company } | null;

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

function AdminCompaniesPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listCompanies);
  const fetchPlans = useServerFn(listPlans);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "companies"], queryFn: () => fetchFn() });
  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: () => fetchPlans() });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [action, setAction] = useState<ActionState>(null);

  const filtered = useMemo(() => {
    const rows = (data ?? []) as Company[];
    const s = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (statusFilter !== "all" && (c.subscription_status ?? "") !== statusFilter) return false;
      if (!s) return true;
      return (
        c.corporate_name?.toLowerCase().includes(s) ||
        (c.trade_name ?? "").toLowerCase().includes(s) ||
        (c.cnpj ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(SUB_STATUS_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Fim do trial</TableHead>
              <TableHead>Próx. cobrança</TableHead>
              <TableHead>Último pagamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma empresa encontrada.</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.corporate_name}</div>
                  {c.trade_name && <div className="text-xs text-muted-foreground">{c.trade_name}</div>}
                </TableCell>
                <TableCell>{c.plan_name ?? "—"}</TableCell>
                <TableCell>
                  {c.subscription_status ? (
                    <Badge className={SUB_STATUS_COLOR[c.subscription_status] ?? ""} variant="secondary">
                      {SUB_STATUS_LABEL[c.subscription_status]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem assinatura</span>
                  )}
                </TableCell>
                <TableCell>{c.users_count}</TableCell>
                <TableCell>{fmtDate(c.trial_ends_at)}</TableCell>
                <TableCell>{fmtDate(c.next_billing_date)}</TableCell>
                <TableCell>{fmtDate(c.last_paid_at)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!c.subscription_id}>Ações</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAction({ kind: "plan", company: c })}>
                        Alterar plano
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAction({ kind: "trial", company: c })}>
                        Estender trial
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAction({ kind: "status", company: c })}>
                        Alterar status
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {c.subscription_status !== "SUSPENDED" ? (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setAction({ kind: "suspend", company: c })}
                        >
                          Suspender assinatura
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setAction({ kind: "reactivate", company: c })}>
                          Reativar assinatura
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ActionDialog
        state={action}
        plans={plansQ.data ?? []}
        onClose={() => setAction(null)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["admin", "companies"] });
          qc.invalidateQueries({ queryKey: ["admin", "billing-overview"] });
          setAction(null);
        }}
      />
    </div>
  );
}

function ActionDialog({
  state, plans, onClose, onDone,
}: {
  state: ActionState;
  plans: any[];
  onClose: () => void;
  onDone: () => void;
}) {
  const updateFn = useServerFn(updateSubscription);
  const [reason, setReason] = useState("");
  const [planId, setPlanId] = useState<string>("");
  const [status, setStatus] = useState<SubStatus>("ACTIVE");
  const [days, setDays] = useState<number>(7);

  useEffect(() => {
    if (!state) return;
    setReason("");
    setPlanId(state.company.plan_id ?? "");
    setStatus((state.company.subscription_status as SubStatus) ?? "ACTIVE");
    setDays(7);
  }, [state]);

  const mut = useMutation({
    mutationFn: (payload: any) => updateFn({ data: payload }),
    onSuccess: () => { toast.success("Assinatura atualizada."); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!state) return null;
  const { kind, company } = state;
  const subId = company.subscription_id!;
  const reasonOk = reason.trim().length >= 3;

  const TITLES: Record<ActionKind, string> = {
    plan: "Alterar plano",
    trial: "Estender trial",
    status: "Alterar status da assinatura",
    suspend: "Suspender assinatura",
    reactivate: "Reativar assinatura",
  };

  const submit = () => {
    if (!reasonOk) return toast.error("Informe um motivo (mínimo 3 caracteres).");
    if (kind === "plan") {
      if (!planId) return toast.error("Selecione um plano.");
      mut.mutate({ subscription_id: subId, new_plan_id: planId, description: reason });
    } else if (kind === "trial") {
      if (!days || days <= 0) return toast.error("Dias deve ser maior que zero.");
      mut.mutate({ subscription_id: subId, extend_trial_days: days, description: reason });
    } else if (kind === "status") {
      mut.mutate({ subscription_id: subId, new_status: status, description: reason });
    } else if (kind === "suspend") {
      mut.mutate({ subscription_id: subId, new_status: "SUSPENDED", description: reason });
    } else if (kind === "reactivate") {
      mut.mutate({ subscription_id: subId, new_status: "ACTIVE", description: reason });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[kind]}</DialogTitle>
          <DialogDescription>
            Empresa: <span className="font-medium text-foreground">{company.corporate_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {kind === "plan" && (
            <div className="space-y-2">
              <Label>Novo plano</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "trial" && (
            <div className="space-y-2">
              <Label>Dias para estender</Label>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value || "0", 10))}
              />
            </div>
          )}

          {kind === "status" && (
            <div className="space-y-2">
              <Label>Novo status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SubStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SUB_STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(kind === "suspend" || kind === "reactivate") && (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {kind === "suspend"
                ? "A empresa perderá acesso operacional ao SmartCom Pro. Confirme o motivo para auditoria."
                : "A empresa voltará a ter acesso ao SmartCom Pro. Confirme o motivo para auditoria."}
            </p>
          )}

          <div className="space-y-2">
            <Label>Motivo (obrigatório)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: solicitação do cliente, inadimplência, ajuste comercial…"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={!reasonOk || mut.isPending}>
            {mut.isPending ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

