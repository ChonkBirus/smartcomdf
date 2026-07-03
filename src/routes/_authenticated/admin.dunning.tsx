import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle, Mail, Play, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listDunningEvents,
  processDunningRulesNow,
  registerDunningContact,
  skipDunningEvent,
  type DunningEventRow,
} from "@/lib/billing-dunning.functions";

export const Route = createFileRoute("/_authenticated/admin/dunning")({
  head: () => ({ meta: [{ title: "Régua de Cobrança — Super Admin" }] }),
  component: AdminDunningPage,
});

const STATUS_OPTIONS = ["PENDING", "HANDLED", "SKIPPED", "FAILED", "CANCELED"];

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function fmtBRL(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusTone(s: string): "primary" | "success" | "neutral" {
  if (s === "PENDING") return "primary";
  if (s === "HANDLED") return "success";
  return "neutral";
}

function defaultMessage(ev: DunningEventRow) {
  const name = ev.company_name ?? "cliente";
  switch (ev.trigger_type) {
    case "TRIAL_ENDING":
      return `Olá ${name}! Seu período de teste do SmartPro termina em breve. Posso te ajudar a escolher o melhor plano?`;
    case "TRIAL_EXPIRED":
      return `Olá ${name}, seu trial expirou. Quer reativar com 10% de desconto no primeiro mês?`;
    case "PAYMENT_DUE":
      return `Olá ${name}, sua fatura do SmartPro vence em ${ev.charge_due_date ?? "breve"} (${fmtBRL(ev.charge_amount)}). Precisa de ajuda para pagar?`;
    case "PAYMENT_OVERDUE":
      return `Olá ${name}, identificamos pagamento em aberto (${fmtBRL(ev.charge_amount)}, venc. ${ev.charge_due_date}). Podemos regularizar agora?`;
    case "SUBSCRIPTION_SUSPENDED":
      return `Olá ${name}, sua assinatura está suspensa por falta de pagamento. Vamos reativar?`;
    case "CANCELLATION_DUE_SOON":
      return `Olá ${name}, sua assinatura será cancelada em breve. Quer revisar antes?`;
    case "REACTIVATED":
      return `Olá ${name}, que bom ter você de volta! Tudo certo com sua assinatura?`;
    default:
      return `Olá ${name}, podemos conversar sobre sua assinatura SmartPro?`;
  }
}

function AdminDunningPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDunningEvents);
  const processFn = useServerFn(processDunningRulesNow);
  const registerFn = useServerFn(registerDunningContact);
  const skipFn = useServerFn(skipDunningEvent);

  const [status, setStatus] = useState<string>("PENDING");
  const [selected, setSelected] = useState<DunningEventRow | null>(null);
  const [channel, setChannel] = useState<
    "WHATSAPP" | "PHONE" | "EMAIL" | "MANUAL"
  >("WHATSAPP");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const filters = useMemo(
    () => ({ status: status === "ALL" ? null : status }),
    [status],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dunning-events", filters],
    queryFn: () => listFn({ data: filters }),
  });

  const processMut = useMutation({
    mutationFn: () => processFn(),
    onSuccess: (rows) => {
      const total = (rows ?? []).reduce(
        (sum, r) => sum + (r.inserted_count ?? 0),
        0,
      );
      toast.success(`Régua processada: ${total} novos eventos.`);
      qc.invalidateQueries({ queryKey: ["admin", "dunning-events"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao processar régua."),
  });

  const registerMut = useMutation({
    mutationFn: registerFn,
    onSuccess: () => {
      toast.success("Contato registrado.");
      setSelected(null);
      setResult("");
      setMessage("");
      setNextFollowUp("");
      qc.invalidateQueries({ queryKey: ["admin", "dunning-events"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar."),
  });

  const skipMut = useMutation({
    mutationFn: skipFn,
    onSuccess: () => {
      toast.success("Evento ignorado.");
      qc.invalidateQueries({ queryKey: ["admin", "dunning-events"] });
    },
  });

  function openRegister(ev: DunningEventRow) {
    setSelected(ev);
    setChannel(ev.company_whatsapp ? "WHATSAPP" : "EMAIL");
    setMessage(defaultMessage(ev));
    setResult("");
    setNextFollowUp("");
  }

  function whatsappLink(ev: DunningEventRow) {
    const phone = (ev.company_whatsapp ?? "").replace(/\D/g, "");
    if (!phone) return null;
    const text = encodeURIComponent(defaultMessage(ev));
    return `https://wa.me/${phone}?text=${text}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => processMut.mutate(undefined)}
          disabled={processMut.isPending}
        >
          <Play className="mr-2 h-4 w-4" />
          {processMut.isPending ? "Processando…" : "Processar régua agora"}
        </Button>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criado</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Regra</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
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
                  Nenhum evento encontrado.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((ev) => {
              const wa = whatsappLink(ev);
              return (
                <TableRow key={ev.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(ev.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {ev.company_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ev.event_code}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{ev.rule_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {ev.charge_due_date ?? ev.due_date ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{fmtBRL(ev.charge_amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={ev.status} tone={statusTone(ev.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {wa && ev.status === "PENDING" && (
                        <Button asChild size="sm" variant="outline">
                          <a href={wa} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {ev.company_email && ev.status === "PENDING" && (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={`mailto:${ev.company_email}?subject=${encodeURIComponent(
                              "SmartPro — " + ev.event_code,
                            )}&body=${encodeURIComponent(defaultMessage(ev))}`}
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {ev.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openRegister(ev)}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Registrar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              skipMut.mutate({ data: { event_id: ev.id } })
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar contato</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {selected.company_name} · {selected.event_code}
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="PHONE">Telefone</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensagem enviada</Label>
                <Textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Resultado / Notas</Label>
                <Input
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Ex: cliente prometeu pagar até sexta"
                />
              </div>
              <div className="space-y-2">
                <Label>Próximo follow-up (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={nextFollowUp}
                  onChange={(e) => setNextFollowUp(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button
              disabled={registerMut.isPending}
              onClick={() => {
                if (!selected) return;
                registerMut.mutate({
                  data: {
                    event_id: selected.id,
                    channel,
                    result: result || undefined,
                    message: message || undefined,
                    next_follow_up_at: nextFollowUp
                      ? new Date(nextFollowUp).toISOString()
                      : null,
                  },
                });
              }}
            >
              {registerMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
