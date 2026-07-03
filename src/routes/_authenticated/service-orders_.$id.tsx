import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Package, User2, MapPin, FileText, Briefcase, XCircle, Save, Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getServiceOrder, updateServiceOrder, cancelServiceOrder, listCompanyTechnicians,
  type ServiceOrderStatus, type ServiceOrderPriority,
} from "@/lib/service-orders.functions";
import { ServiceOrderFinancialSummary } from "@/components/finance/ServiceOrderFinancialSummary";

export const Route = createFileRoute("/_authenticated/service-orders_/$id")({
  head: () => ({ meta: [{ title: "Detalhe da OS — SmartPro" }] }),
  component: () => (
    <FeatureGate feature="service_orders">
      <PermissionRoute module="service_orders">
        <ServiceOrderDetailPage />
      </PermissionRoute>
    </FeatureGate>
  ),
});

const STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  DRAFT: "Rascunho", SCHEDULED: "Agendada", IN_PROGRESS: "Em execução",
  PAUSED: "Pausada", COMPLETED: "Concluída", CANCELLED: "Cancelada",
};
const STATUS_VARIANT: Record<ServiceOrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", SCHEDULED: "secondary", IN_PROGRESS: "default",
  PAUSED: "outline", COMPLETED: "default", CANCELLED: "destructive",
};
const PRIORITY_LABEL: Record<ServiceOrderPriority, string> = {
  LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente",
};

function ServiceOrderDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchFn = useServerFn(getServiceOrder);
  const updateFn = useServerFn(updateServiceOrder);
  const cancelFn = useServerFn(cancelServiceOrder);
  const techFn = useServerFn(listCompanyTechnicians);

  const { data, isLoading } = useQuery({
    queryKey: ["service-order", id],
    queryFn: () => fetchFn({ data: { id } }),
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ["company-technicians"],
    queryFn: () => techFn({}),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (data?.so && !editing) {
      setForm({
        assigned_technician_id: data.so.assigned_technician_id,
        scheduled_date: data.so.scheduled_date ?? "",
        scheduled_start_time: data.so.scheduled_start_time ?? "",
        scheduled_end_time: data.so.scheduled_end_time ?? "",
        priority: data.so.priority,
        customer_instructions: data.so.customer_instructions ?? "",
        access_instructions: data.so.access_instructions ?? "",
        parking_instructions: data.so.parking_instructions ?? "",
        technical_notes: data.so.technical_notes ?? "",
      });
    }
  }, [data?.so?.id]);

  const updateMut = useMutation({
    mutationFn: (patch: any) => updateFn({ data: { id, ...patch } }),
    onSuccess: () => {
      toast.success("OS atualizada.");
      qc.invalidateQueries({ queryKey: ["service-order", id] });
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("OS cancelada.");
      qc.invalidateQueries({ queryKey: ["service-order", id] });
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      setCancelOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar."),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">OS não encontrada.</div>;

  const { so, customer, address, contact, project, quote, items } = data;
  const locked = so.status === "CANCELLED" || so.status === "COMPLETED";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/service-orders" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={`${so.service_order_number} — ${so.title}`}
          description={project ? `Projeto ${project.project_number}` : undefined}
          actions={
            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_VARIANT[so.status]}>{STATUS_LABEL[so.status]}</Badge>
              <Badge variant="outline">{PRIORITY_LABEL[so.priority]}</Badge>
              {!editing && !locked && (
                <Can module="service_orders" action="edit">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
                </Can>
              )}
              {!locked && (
                <Can module="service_orders" action="cancel">
                  <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                    <XCircle className="mr-1 h-4 w-4" />Cancelar
                  </Button>
                </Can>
              )}
            </div>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <User2 className="h-4 w-4" />Cliente
          </div>
          <div className="text-sm">
            <p className="font-medium">{so.customer_name}</p>
            {customer?.cpf_cnpj && <p className="text-muted-foreground">{customer.cpf_cnpj}</p>}
            {contact?.name && (
              <p className="mt-2 text-muted-foreground">
                Contato: {contact.name}{contact.phone ? ` · ${contact.phone}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />Endereço de instalação
          </div>
          <div className="text-sm text-muted-foreground">
            {address ? (
              <p>
                {address.street}{address.number ? `, ${address.number}` : ""}
                {address.neighborhood ? ` — ${address.neighborhood}` : ""}<br />
                {address.city}{address.state ? `/${address.state}` : ""}
                {address.zip_code ? ` · ${address.zip_code}` : ""}
              </p>
            ) : "Não informado."}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Briefcase className="h-4 w-4" />Origem
          </div>
          <div className="space-y-1 text-sm">
            {project && (
              <Button asChild variant="link" size="sm" className="h-auto px-0">
                <Link to="/projects/$id" params={{ id: project.id }}>
                  Projeto {project.project_number}
                </Link>
              </Button>
            )}
            {quote && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-3 w-3" />Orçamento {quote.quote_number}
              </div>
            )}
            <p className="text-muted-foreground">
              Técnico: {so.technician_name ?? "—"}
            </p>
            <p className="text-muted-foreground">
              Agendamento: {so.scheduled_date ? new Date(so.scheduled_date).toLocaleDateString("pt-BR") : "—"}
              {so.scheduled_start_time ? ` às ${so.scheduled_start_time.slice(0,5)}` : ""}
            </p>
          </div>
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Editar dados operacionais</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Técnico responsável</Label>
              <Select
                value={form.assigned_technician_id ?? "NONE"}
                onValueChange={(v) => setForm({ ...form, assigned_technician_id: v === "NONE" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— Sem técnico —</SelectItem>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data agendada</Label>
              <Input type="date" value={form.scheduled_date ?? ""}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início</Label>
                <Input type="time" value={form.scheduled_start_time ?? ""}
                  onChange={(e) => setForm({ ...form, scheduled_start_time: e.target.value || null })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="time" value={form.scheduled_end_time ?? ""}
                  onChange={(e) => setForm({ ...form, scheduled_end_time: e.target.value || null })} />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Instruções do cliente</Label>
              <Textarea value={form.customer_instructions ?? ""}
                onChange={(e) => setForm({ ...form, customer_instructions: e.target.value })} />
            </div>
            <div>
              <Label>Instruções de acesso</Label>
              <Textarea value={form.access_instructions ?? ""}
                onChange={(e) => setForm({ ...form, access_instructions: e.target.value })} />
            </div>
            <div>
              <Label>Instruções de estacionamento</Label>
              <Textarea value={form.parking_instructions ?? ""}
                onChange={(e) => setForm({ ...form, parking_instructions: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações técnicas</Label>
              <Textarea value={form.technical_notes ?? ""}
                onChange={(e) => setForm({ ...form, technical_notes: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}>
              <Save className="mr-1 h-4 w-4" />Salvar
            </Button>
          </div>
        </div>
      )}

      {(so.customer_instructions || so.access_instructions || so.parking_instructions || so.technical_notes) && !editing && (
        <div className="grid gap-4 md:grid-cols-2">
          {so.customer_instructions && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 text-sm font-medium">Instruções do cliente</div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{so.customer_instructions}</p>
            </div>
          )}
          {so.access_instructions && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 text-sm font-medium">Acesso</div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{so.access_instructions}</p>
            </div>
          )}
          {so.parking_instructions && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 text-sm font-medium">Estacionamento</div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{so.parking_instructions}</p>
            </div>
          )}
          {so.technical_notes && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 text-sm font-medium">Observações técnicas</div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{so.technical_notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          <Package className="h-4 w-4" />Itens previstos
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Unidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Sem itens.</TableCell></TableRow>
            ) : items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  {it.image_url ? (
                    <img src={it.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{it.name}</TableCell>
                <TableCell className="text-muted-foreground">{it.description ?? "—"}</TableCell>
                <TableCell>
                  {it.item_type === "SERVICE" || it.item_type === "LABOR" ? "Serviço" : "Produto"}
                </TableCell>
                <TableCell className="text-right">{Number(it.planned_quantity).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{it.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServiceOrderFinancialSummary serviceOrderId={so.id} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              A OS será marcada como cancelada e não poderá ser executada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMut.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
