import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, RotateCw, Search, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminListBillingCharges,
  adminListWebhookEvents,
  adminGetWebhookEvent,
  adminRetryWebhookEvent,
  adminSyncCharge,
  adminGetCharge,
} from "@/lib/billing-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  component: AdminBillingPage,
});

const CHARGE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RECEIVED",
  "OVERDUE",
  "REFUNDED",
  "CHARGEBACK_REQUESTED",
  "DELETED",
];
const EVENT_STATUSES = ["PROCESSED", "ERROR", "DUPLICATE", "RECEIVED"];

const chargeStatusClass: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  CONFIRMED: "bg-emerald-500/15 text-emerald-600",
  RECEIVED: "bg-emerald-500/15 text-emerald-600",
  OVERDUE: "bg-red-500/15 text-red-600",
  REFUNDED: "bg-muted text-muted-foreground",
  DELETED: "bg-muted text-muted-foreground",
};

const eventStatusClass: Record<string, string> = {
  PROCESSED: "bg-emerald-500/15 text-emerald-600",
  ERROR: "bg-red-500/15 text-red-600",
  DUPLICATE: "bg-muted text-muted-foreground",
  RECEIVED: "bg-blue-500/15 text-blue-600",
};

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}
function fmtMoney(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminBillingPage() {
  return (
    <Tabs defaultValue="charges" className="space-y-4">
      <TabsList>
        <TabsTrigger value="charges">Cobranças</TabsTrigger>
        <TabsTrigger value="events">Eventos do Webhook</TabsTrigger>
      </TabsList>
      <TabsContent value="charges">
        <ChargesTab />
      </TabsContent>
      <TabsContent value="events">
        <EventsTab />
      </TabsContent>
    </Tabs>
  );
}

function ChargesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListBillingCharges);
  const syncFn = useServerFn(adminSyncCharge);

  const [status, setStatus] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [viewingCharge, setViewingCharge] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      status: status === "ALL" ? null : status,
      search: search || null,
    }),
    [status, search],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing-charges", filters],
    queryFn: () => listFn({ data: filters }),
  });

  const sync = useMutation({
    mutationFn: (id: string) => syncFn({ data: { charge_id: id } }),
    onSuccess: (r: any) => {
      toast.success(`Sincronizado (${r.status})`);
      qc.invalidateQueries({ queryKey: ["admin", "billing-charges"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao sincronizar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por provider_charge_id ou UUID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput);
            }}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {CHARGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setSearch(searchInput)}>
          Filtrar
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nenhuma cobrança encontrada.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.company_name ?? "—"}</TableCell>
                <TableCell>{c.plan_name ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.payment_method ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={chargeStatusClass[c.status] ?? "bg-muted"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell>{fmtMoney(c.amount)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.due_date ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(c.paid_at)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(c.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.invoice_url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Abrir fatura"
                        asChild
                      >
                        <a href={c.invoice_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Sincronizar com Asaas"
                      disabled={sync.isPending}
                      onClick={() => sync.mutate(c.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EventsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListWebhookEvents);
  const retryFn = useServerFn(adminRetryWebhookEvent);

  const [status, setStatus] = useState("ALL");
  const [viewing, setViewing] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ status: status === "ALL" ? null : status }),
    [status],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing-webhook-events", filters],
    queryFn: () => listFn({ data: filters }),
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Evento reprocessado");
      qc.invalidateQueries({ queryKey: ["admin", "billing-webhook-events"] });
      qc.invalidateQueries({ queryKey: ["admin", "billing-charges"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reprocessar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Cobrança</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Processado</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum evento recebido ainda.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{e.provider}</TableCell>
                <TableCell className="text-xs font-mono">{e.event_type}</TableCell>
                <TableCell className="text-xs font-mono">
                  {e.provider_object_id ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge className={eventStatusClass[e.status] ?? "bg-muted"}>
                    {e.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(e.processed_at)}
                </TableCell>
                <TableCell className="text-xs text-red-600 max-w-[240px] truncate">
                  {e.error_message ?? ""}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(e.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver payload"
                      onClick={() => setViewing(e.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Reprocessar"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(e.id)}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {viewing && <PayloadDialog id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function PayloadDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const fn = useServerFn(adminGetWebhookEvent);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing-webhook-event", id],
    queryFn: () => fn({ data: { id } }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payload do evento</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/40 p-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <pre className="text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(data ?? {}, null, 2)}
            </pre>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
