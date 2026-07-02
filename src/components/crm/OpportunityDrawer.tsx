import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileText, Link2, Trash2, Check, Circle, Plus, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  addOpportunityActivity,
  addOpportunityNote,
  completeActivity,
  convertLeadToCustomer,
  convertOpportunityToQuote,
  getOpportunityQuoteStatus,
  deleteActivity,
  deleteOpportunity,
  deleteOpportunityNote,
  getOpportunity,
  linkOpportunityCustomer,
  listCrmTeam,
  listOpportunityActivities,
  listOpportunityNotes,
  searchCustomersLite,
  updateOpportunity,
} from "@/lib/crm.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Props = {
  opportunityId: string | null;
  onOpenChange: (v: boolean) => void;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OpportunityDrawer({ opportunityId, onOpenChange }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOne = useServerFn(getOpportunity);
  const fetchTeam = useServerFn(listCrmTeam);
  const update = useServerFn(updateOpportunity);
  const remove = useServerFn(deleteOpportunity);
  const linkCustomer = useServerFn(linkOpportunityCustomer);
  const convertToQuote = useServerFn(convertOpportunityToQuote);
  const convertToCustomer = useServerFn(convertLeadToCustomer);

  const { data, isLoading } = useQuery({
    queryKey: ["crm", "opportunity", opportunityId],
    queryFn: () => fetchOne({ data: { id: opportunityId! } }),
    enabled: !!opportunityId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["crm", "team"],
    queryFn: () => fetchTeam(),
    enabled: !!opportunityId,
    staleTime: 60_000,
  });

  const fetchQuoteStatus = useServerFn(getOpportunityQuoteStatus);
  const { data: quoteStatus } = useQuery({
    queryKey: ["crm", "opportunity", opportunityId, "quote-status"],
    queryFn: () => fetchQuoteStatus({ data: { opportunity_id: opportunityId! } }),
    enabled: !!opportunityId,
    staleTime: 15_000,
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (data?.opportunity) {
      setForm({
        ...data.opportunity,
        estimated_value: String(data.opportunity.estimated_value ?? 0),
        next_follow_up_at: data.opportunity.next_follow_up_at
          ? new Date(data.opportunity.next_follow_up_at).toISOString().slice(0, 16)
          : "",
      });
    }
  }, [data?.opportunity]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["crm"] });
  };

  const save = useMutation({
    mutationFn: async () =>
      await update({
        data: {
          id: opportunityId!,
          lead_name: form.lead_name,
          lead_type: form.lead_type,
          company_name: form.company_name || null,
          phone: form.phone || null,
          email: form.email || null,
          service_interest: form.service_interest || null,
          description: form.description || null,
          estimated_value: Number(form.estimated_value || 0),
          temperature: form.temperature,
          source: form.source || null,
          customer_type: form.customer_type || null,
          assigned_to: form.assigned_to || null,
          next_action: form.next_action || null,
          next_follow_up_at: form.next_follow_up_at || null,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Lead atualizado.");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
  });

  const del = useMutation({
    mutationFn: async () => await remove({ data: { id: opportunityId! } }),
    onSuccess: () => {
      toast.success("Lead removido.");
      invalidateAll();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  const linkCust = useMutation({
    mutationFn: async (customer_id: string | null) =>
      await linkCustomer({ data: { id: opportunityId!, customer_id } }),
    onSuccess: (_r, v) => {
      toast.success(v ? "Cliente vinculado." : "Vínculo removido.");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular cliente."),
  });

  const convert = useMutation({
    mutationFn: async () => await convertToQuote({ data: { id: opportunityId! } }),
    onSuccess: (r: any) => {
      toast.success(r.already ? "Orçamento já existia." : "Orçamento gerado.");
      invalidateAll();
      onOpenChange(false);
      navigate({ to: "/quotes" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar orçamento."),
  });

  const [dupOpen, setDupOpen] = useState(false);
  const [dupList, setDupList] = useState<any[]>([]);

  const convertCust = useMutation({
    mutationFn: async (force?: boolean) =>
      await convertToCustomer({ data: { opportunity_id: opportunityId!, force: !!force } }),
    onSuccess: (r: any) => {
      if (r.duplicates?.length > 0 && !r.customer_id) {
        setDupList(r.duplicates);
        setDupOpen(true);
        return;
      }
      toast.success(r.already ? "Já havia cliente vinculado." : "Cliente criado a partir do lead.");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao converter em cliente."),
  });

  return (
    <Sheet open={!!opportunityId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{form?.lead_name ?? "Lead"}</SheetTitle>
        </SheetHeader>

        {isLoading || !form ? (
          <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{form.lead_type === "pj" ? "PJ" : "PF"}</Badge>
              <Badge variant="outline">{form.temperature}</Badge>
              {form.customer_id ? (
                <Badge className="bg-success text-success-foreground">Cliente vinculado</Badge>
              ) : (
                <Badge variant="outline">Sem cliente</Badge>
              )}
              <span className="text-muted-foreground">
                Valor: <span className="font-medium text-foreground">{brl(Number(form.estimated_value || 0))}</span>
              </span>
            </div>

            {quoteStatus && (
              <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Orçamento vinculado</div>
                    <div className="font-medium">
                      Nº {quoteStatus.quote_number} · {brl(Number(quoteStatus.total_amount || 0))}
                    </div>
                  </div>
                  <QuoteStatusBadge status={quoteStatus.status} />
                </div>
                <Button
                  size="sm"
                  variant="link"
                  className="mt-1 h-auto p-0"
                  onClick={() => {
                    onOpenChange(false);
                    navigate({ to: "/quotes/$id", params: { id: quoteStatus.id } });
                  }}
                >
                  Abrir orçamento →
                </Button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!form.customer_id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => convertCust.mutate(false)}
                  disabled={convertCust.isPending}
                >
                  <UserPlus className="mr-1 h-4 w-4" />
                  {convertCust.isPending ? "Convertendo…" : "Converter em cliente"}
                </Button>
              )}
              {!quoteStatus && (
                <Button
                  size="sm"
                  onClick={() => convert.mutate()}
                  disabled={convert.isPending || !form.customer_id}
                  title={!form.customer_id ? "Vincule ou converta em cliente primeiro." : ""}
                >
                  <FileText className="mr-1 h-4 w-4" />
                  {convert.isPending ? "Gerando…" : "Gerar orçamento"}
                </Button>
              )}
            </div>

            <AlertDialog open={dupOpen} onOpenChange={setDupOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cliente possivelmente já cadastrado</AlertDialogTitle>
                  <AlertDialogDescription>
                    Encontramos {dupList.length} cliente(s) parecido(s). Vincule a um existente para evitar duplicidade.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {dupList.map((c) => (
                    <li key={c.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{c.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {[c.cpf_cnpj, c.email, c.phone].filter(Boolean).join(" · ")}
                          </div>
                          <div className="mt-1 text-xs text-primary">
                            Coincide por: {c.reasons.join(", ")}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            linkCust.mutate(c.id);
                            setDupOpen(false);
                          }}
                        >
                          Vincular
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setDupOpen(false);
                      convertCust.mutate(true);
                    }}
                  >
                    Criar novo mesmo assim
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>


            <Tabs defaultValue="info" className="mt-4">
              <TabsList>
                <TabsTrigger value="info">Dados</TabsTrigger>
                <TabsTrigger value="customer">Cliente</TabsTrigger>
                <TabsTrigger value="activities">Atividades</TabsTrigger>
                <TabsTrigger value="notes">Notas</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={form.lead_name} onChange={(e) => setForm({ ...form, lead_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>E-mail</Label>
                    <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Interesse</Label>
                  <Input
                    value={form.service_interest ?? ""}
                    onChange={(e) => setForm({ ...form, service_interest: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Valor estimado</Label>
                    <Input
                      inputMode="decimal"
                      value={form.estimated_value}
                      onChange={(e) => setForm({ ...form, estimated_value: e.target.value.replace(/[^0-9.,]/g, "") })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Temperatura</Label>
                    <Select value={form.temperature} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold">Frio</SelectItem>
                        <SelectItem value="warm">Morno</SelectItem>
                        <SelectItem value="hot">Quente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Responsável</Label>
                    <Select value={form.assigned_to ?? ""} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                      <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                      <SelectContent>
                        {team.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Próxima ação</Label>
                    <Input
                      value={form.next_action ?? ""}
                      onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Follow-up em</Label>
                  <Input
                    type="datetime-local"
                    value={form.next_follow_up_at ?? ""}
                    onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Descrição / Notas</Label>
                  <Textarea
                    rows={4}
                    value={form.description ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (confirm("Remover este lead?")) del.mutate(); }}
                    disabled={del.isPending}
                  >
                    Excluir
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="customer" className="mt-4">
                <CustomerLinkPanel
                  linkedId={form.customer_id ?? null}
                  onLink={(id) => linkCust.mutate(id)}
                  pending={linkCust.isPending}
                />
              </TabsContent>

              <TabsContent value="activities" className="mt-4">
                <ActivitiesPanel opportunityId={opportunityId!} team={team as any[]} />
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <NotesPanel opportunityId={opportunityId!} />
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <ul className="space-y-2 text-sm">
                  {(data?.timeline ?? []).map((t: any) => (
                    <li key={t.id} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                      )}
                    </li>
                  ))}
                  {(data?.timeline ?? []).length === 0 && (
                    <li className="text-xs text-muted-foreground">Sem eventos ainda.</li>
                  )}
                </ul>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CustomerLinkPanel({
  linkedId,
  onLink,
  pending,
}: {
  linkedId: string | null;
  onLink: (id: string | null) => void;
  pending: boolean;
}) {
  const [q, setQ] = useState("");
  const search = useServerFn(searchCustomersLite);
  const { data = [], isFetching } = useQuery({
    queryKey: ["crm", "customer-search", q],
    queryFn: () => search({ data: { search: q } }),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-3">
      {linkedId ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Cliente vinculado
          </span>
          <Button size="sm" variant="outline" onClick={() => onLink(null)} disabled={pending}>
            Remover vínculo
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Vincule um cliente já cadastrado para poder gerar orçamento a partir deste lead.
        </p>
      )}
      <Input placeholder="Buscar cliente por nome, CPF/CNPJ, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border">
        {isFetching && <div className="p-3 text-xs text-muted-foreground">Buscando…</div>}
        {!isFetching && data.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">Nenhum cliente encontrado.</div>
        )}
        {data.map((c: any) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onLink(c.id)}
            disabled={pending || linkedId === c.id}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
              linkedId === c.id && "bg-primary/10",
            )}
          >
            <div>
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-muted-foreground">
                {[c.cpf_cnpj, c.email, c.phone].filter(Boolean).join(" · ")}
              </div>
            </div>
            {linkedId === c.id ? <Check className="h-4 w-4 text-primary" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotesPanel({ opportunityId }: { opportunityId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listOpportunityNotes);
  const add = useServerFn(addOpportunityNote);
  const remove = useServerFn(deleteOpportunityNote);
  const [text, setText] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["crm", "notes", opportunityId],
    queryFn: () => list({ data: { opportunity_id: opportunityId } }),
  });

  const addMut = useMutation({
    mutationFn: async () => await add({ data: { opportunity_id: opportunityId, note: text.trim() } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["crm"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar nota."),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => await remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });

  return (
    <div className="space-y-3">
      <Textarea rows={3} placeholder="Escreva uma nota…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => addMut.mutate()} disabled={!text.trim() || addMut.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
      <ul className="space-y-2">
        {data.map((n: any) => (
          <li key={n.id} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap">{n.note}</p>
              <button
                onClick={() => delMut.mutate(n.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("pt-BR")}
            </div>
          </li>
        ))}
        {data.length === 0 && <li className="text-xs text-muted-foreground">Sem notas ainda.</li>}
      </ul>
    </div>
  );
}

function ActivitiesPanel({ opportunityId, team }: { opportunityId: string; team: any[] }) {
  const qc = useQueryClient();
  const list = useServerFn(listOpportunityActivities);
  const add = useServerFn(addOpportunityActivity);
  const done = useServerFn(completeActivity);
  const remove = useServerFn(deleteActivity);

  const [form, setForm] = useState({
    activity_type: "follow_up",
    title: "",
    description: "",
    due_at: "",
    priority: "medium",
    assigned_to: "",
  });

  const { data = [] } = useQuery({
    queryKey: ["crm", "activities", opportunityId],
    queryFn: () => list({ data: { opportunity_id: opportunityId } }),
  });

  const addMut = useMutation({
    mutationFn: async () =>
      await add({
        data: {
          opportunity_id: opportunityId,
          activity_type: form.activity_type as any,
          title: form.title.trim(),
          description: form.description || null,
          due_at: form.due_at || null,
          priority: form.priority as any,
          assigned_to: form.assigned_to || null,
        },
      }),
    onSuccess: () => {
      setForm({ ...form, title: "", description: "", due_at: "" });
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Atividade criada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar atividade."),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; done: boolean }) => await done({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => await remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });

  const grouped = useMemo(() => {
    const now = Date.now();
    const overdue: any[] = [];
    const upcoming: any[] = [];
    const completed: any[] = [];
    for (const a of data as any[]) {
      if (a.status === "done") completed.push(a);
      else if (a.due_at && new Date(a.due_at).getTime() < now) overdue.push(a);
      else upcoming.push(a);
    }
    return { overdue, upcoming, completed };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Nova atividade</div>
        <div className="grid gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Select value={form.activity_type} onValueChange={(v) => setForm({ ...form, activity_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["call","whatsapp","email","meeting","visit","follow_up","task"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea rows={2} placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => addMut.mutate()} disabled={!form.title.trim() || addMut.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      <ActivityList title="Atrasadas" items={grouped.overdue} onToggle={toggle.mutate} onDelete={delMut.mutate} tone="destructive" />
      <ActivityList title="Próximas" items={grouped.upcoming} onToggle={toggle.mutate} onDelete={delMut.mutate} />
      <ActivityList title="Concluídas" items={grouped.completed} onToggle={toggle.mutate} onDelete={delMut.mutate} tone="muted" />
    </div>
  );
}

function ActivityList({
  title,
  items,
  onToggle,
  onDelete,
  tone,
}: {
  title: string;
  items: any[];
  onToggle: (v: { id: string; done: boolean }) => void;
  onDelete: (id: string) => void;
  tone?: "destructive" | "muted";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={cn(
        "mb-1 text-xs font-semibold uppercase tracking-wide",
        tone === "destructive" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-foreground",
      )}>
        {title} ({items.length})
      </div>
      <ul className="space-y-1.5">
        {items.map((a) => {
          const isDone = a.status === "done";
          return (
            <li key={a.id} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <button
                onClick={() => onToggle({ id: a.id, done: !isDone })}
                className="mt-0.5 text-muted-foreground hover:text-primary"
                aria-label={isDone ? "Marcar como pendente" : "Concluir"}
              >
                {isDone ? <Check className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={cn("truncate font-medium", isDone && "text-muted-foreground line-through")}>
                  {a.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.activity_type} · {a.priority}
                  {a.due_at && ` · ${new Date(a.due_at).toLocaleString("pt-BR")}`}
                </div>
                {a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
              </div>
              <button
                onClick={() => onDelete(a.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <Separator className="mt-3" />
    </div>
  );
}
