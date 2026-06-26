import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, MessageCircle, Mail, Trash2, History, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  PILOT_STATUSES,
  type CommercialPilotRow,
  listCommercialPilots,
  createCommercialPilot,
  updateCommercialPilot,
  deleteCommercialPilot,
  listPilotContactLogs,
  addPilotContactLog,
  getCommercialPilotMetrics,
  listCompaniesForPilot,
} from "@/lib/commercial-pilots.functions";

export const Route = createFileRoute("/_authenticated/admin/pilots")({
  head: () => ({ meta: [{ title: "Pilotos Comerciais — Super Admin" }] }),
  component: AdminPilotsPage,
});

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
function fmtDateTime(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "converted") return "default";
  if (s === "lost") return "destructive";
  if (s === "paused") return "outline";
  return "secondary";
}

function AdminPilotsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCommercialPilots);
  const metricsFn = useServerFn(getCommercialPilotMetrics);
  const companiesFn = useServerFn(listCompaniesForPilot);
  const createFn = useServerFn(createCommercialPilot);
  const updateFn = useServerFn(updateCommercialPilot);
  const deleteFn = useServerFn(deleteCommercialPilot);
  const logsFn = useServerFn(listPilotContactLogs);
  const addLogFn = useServerFn(addPilotContactLog);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editPilot, setEditPilot] = useState<CommercialPilotRow | null>(null);
  const [historyPilot, setHistoryPilot] = useState<CommercialPilotRow | null>(null);
  const [contactPilot, setContactPilot] = useState<CommercialPilotRow | null>(null);

  const filters = useMemo(() => ({ status: statusFilter }), [statusFilter]);

  const { data: pilots, isLoading } = useQuery({
    queryKey: ["admin", "pilots", filters],
    queryFn: () => listFn({ data: filters }),
  });

  const { data: metrics } = useQuery({
    queryKey: ["admin", "pilot-metrics"],
    queryFn: () => metricsFn(),
  });

  const { data: companies } = useQuery({
    queryKey: ["admin", "pilot-companies"],
    queryFn: () => companiesFn(),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "pilots"] });
    qc.invalidateQueries({ queryKey: ["admin", "pilot-metrics"] });
  }

  const createMut = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      toast.success("Piloto criado.");
      setCreateOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar piloto."),
  });

  const updateMut = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      toast.success("Piloto atualizado.");
      setEditPilot(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  const deleteMut = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      toast.success("Piloto removido.");
      invalidate();
    },
  });

  const addLogMut = useMutation({
    mutationFn: addLogFn,
    onSuccess: () => {
      toast.success("Contato registrado.");
      setContactPilot(null);
      qc.invalidateQueries({ queryKey: ["admin", "pilot-logs"] });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar contato."),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Total" value={metrics?.total ?? 0} />
        <MetricCard label="Ativos" value={metrics?.active ?? 0} />
        <MetricCard label="Em progresso" value={metrics?.inProgress ?? 0} />
        <MetricCard label="Convertidos" value={metrics?.converted ?? 0} />
        <MetricCard label="Perdidos" value={metrics?.lost ?? 0} />
        <MetricCard label="Conversão" value={`${metrics?.conversionRate ?? 0}%`} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {PILOT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          {metrics?.pendingFollowUps ?? 0} follow-ups pendentes
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo piloto
          </Button>
        </div>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Conversão esperada</TableHead>
              <TableHead>Último contato</TableHead>
              <TableHead>Próximo follow-up</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (pilots ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum piloto cadastrado.
                </TableCell>
              </TableRow>
            )}
            {(pilots ?? []).map((p) => {
              const phone = (p.company_whatsapp ?? "").replace(/\D/g, "");
              const waText = encodeURIComponent(
                `Olá ${p.company_name ?? ""}, tudo bem? Estamos acompanhando seu piloto no SecureERP.`,
              );
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.company_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{p.source ?? "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.expected_conversion_date)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(p.last_contact_at)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(p.next_follow_up_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {phone && (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={`https://wa.me/${phone}?text=${waText}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {p.company_email && (
                        <Button asChild size="sm" variant="outline">
                          <a href={`mailto:${p.company_email}`}>
                            <Mail className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setHistoryPilot(p)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="default" onClick={() => setContactPilot(p)}>
                        Registrar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditPilot(p)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover piloto?"))
                            deleteMut.mutate({ data: { id: p.id } });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <CreatePilotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={companies ?? []}
        onSubmit={(payload) => createMut.mutate({ data: payload })}
        pending={createMut.isPending}
      />

      <EditPilotDialog
        pilot={editPilot}
        onClose={() => setEditPilot(null)}
        onSubmit={(payload) => updateMut.mutate({ data: payload })}
        pending={updateMut.isPending}
      />

      <ContactDialog
        pilot={contactPilot}
        onClose={() => setContactPilot(null)}
        onSubmit={(payload) => addLogMut.mutate({ data: payload })}
        pending={addLogMut.isPending}
      />

      <HistoryDialog
        pilot={historyPilot}
        onClose={() => setHistoryPilot(null)}
        logsFn={logsFn}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="card-elevated p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function CreatePilotDialog({
  open,
  onOpenChange,
  companies,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companies: Array<{ id: string; name: string }>;
  onSubmit: (p: {
    company_id: string;
    status: string;
    source?: string | null;
    notes?: string | null;
    expected_conversion_date?: string | null;
  }) => void;
  pending: boolean;
}) {
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [expected, setExpected] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setCompanyId("");
          setSource("");
          setNotes("");
          setExpected("");
          setStatus("active");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo piloto comercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PILOT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Indicação, evento…" />
          </div>
          <div className="space-y-2">
            <Label>Conversão esperada</Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending || !companyId}
            onClick={() =>
              onSubmit({
                company_id: companyId,
                status,
                source: source || null,
                notes: notes || null,
                expected_conversion_date: expected || null,
              })
            }
          >
            {pending ? "Salvando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPilotDialog({
  pilot,
  onClose,
  onSubmit,
  pending,
}: {
  pilot: CommercialPilotRow | null;
  onClose: () => void;
  onSubmit: (p: {
    id: string;
    status: string;
    source?: string | null;
    notes?: string | null;
    expected_conversion_date?: string | null;
    loss_reason?: string | null;
  }) => void;
  pending: boolean;
}) {
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [expected, setExpected] = useState("");
  const [lossReason, setLossReason] = useState("");

  useEffect(() => {
    if (pilot) {
      setStatus(pilot.status);
      setSource(pilot.source ?? "");
      setNotes(pilot.notes ?? "");
      setExpected(pilot.expected_conversion_date ?? "");
      setLossReason(pilot.loss_reason ?? "");
    }
  }, [pilot?.id]);

  return (
    <Dialog open={!!pilot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar piloto</DialogTitle>
        </DialogHeader>
        {pilot && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{pilot.company_name}</div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILOT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conversão esperada</Label>
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {status === "lost" && (
              <div className="space-y-2">
                <Label>Motivo da perda</Label>
                <Input value={lossReason} onChange={(e) => setLossReason(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (!pilot) return;
              onSubmit({
                id: pilot.id,
                status,
                source: source || null,
                notes: notes || null,
                expected_conversion_date: expected || null,
                loss_reason: status === "lost" ? lossReason || null : null,
              });
            }}
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({
  pilot,
  onClose,
  onSubmit,
  pending,
}: {
  pilot: CommercialPilotRow | null;
  onClose: () => void;
  onSubmit: (p: {
    company_id: string;
    contact_channel: string;
    subject?: string | null;
    message?: string | null;
    result?: string | null;
    next_follow_up_at?: string | null;
  }) => void;
  pending: boolean;
}) {
  const [channel, setChannel] = useState("WHATSAPP");
  const [subject, setSubject] = useState("Acompanhamento piloto");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [next, setNext] = useState("");

  return (
    <Dialog
      open={!!pilot}
      onOpenChange={(o) => {
        if (!o) {
          setMessage("");
          setResult("");
          setNext("");
        }
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
        </DialogHeader>
        {pilot && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{pilot.company_name}</div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="PHONE">Telefone</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="MEETING">Reunião</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Resultado / Notas</Label>
              <Input value={result} onChange={(e) => setResult(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Próximo follow-up</Label>
              <Input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (!pilot) return;
              onSubmit({
                company_id: pilot.company_id,
                contact_channel: channel,
                subject: subject || null,
                message: message || null,
                result: result || null,
                next_follow_up_at: next ? new Date(next).toISOString() : null,
              });
            }}
          >
            {pending ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  pilot,
  onClose,
  logsFn,
}: {
  pilot: CommercialPilotRow | null;
  onClose: () => void;
  logsFn: (args: { data: { company_id: string } }) => Promise<Array<{ id: string; contact_type: string | null; contact_channel: string | null; subject: string | null; message: string | null; result: string | null; contacted_at: string; next_follow_up_at: string | null }>>;
}) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin", "pilot-logs", pilot?.company_id],
    queryFn: () => logsFn({ data: { company_id: pilot!.company_id } }),
    enabled: !!pilot,
  });

  return (
    <Dialog open={!!pilot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de contatos · {pilot?.company_name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[400px] space-y-3 overflow-y-auto">
          {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && (logs ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum contato registrado.</div>
          )}
          {(logs ?? []).map((l) => (
            <Card key={l.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{fmtDateTime(l.contacted_at)}</div>
                <Badge variant="outline">{l.contact_channel ?? "—"}</Badge>
              </div>
              {l.subject && <div className="mt-1 text-sm font-medium">{l.subject}</div>}
              {l.message && <div className="mt-1 text-sm">{l.message}</div>}
              {l.result && (
                <div className="mt-1 text-xs text-muted-foreground">→ {l.result}</div>
              )}
              {l.next_follow_up_at && (
                <div className="mt-1 text-xs">
                  Próximo follow-up: {fmtDateTime(l.next_follow_up_at)}
                </div>
              )}
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
