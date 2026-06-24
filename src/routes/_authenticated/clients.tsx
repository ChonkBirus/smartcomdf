import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, Plus, Pencil, Trash2, Search, MessageCircle, Eye, History,
  Building2, User as UserIcon, ArrowLeft, ArrowRight, Upload,
} from "lucide-react";
import { CustomerImportDialog } from "@/components/customers/CustomerImportDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { KpiCard } from "@/components/app/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CustomerFormSheet } from "@/components/customers/CustomerFormSheet";
import { CustomerHistorySheet } from "@/components/customers/CustomerHistorySheet";
import {
  listCustomers, deleteCustomer, toggleCustomer, listCustomerTags, customerMetrics,
  type CustomerStatus, type CustomerType,
} from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clientes — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="clients">
      <FeatureGate feature="customers">
        <ClientsPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

function formatDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

const STATUS_LABEL: Record<CustomerStatus, string> = {
  LEAD: "Lead", ACTIVE: "Ativo", INACTIVE: "Inativo", BLOCKED: "Bloqueado",
};
const STATUS_VARIANT: Record<CustomerStatus, "default" | "secondary" | "destructive" | "outline"> = {
  LEAD: "outline", ACTIVE: "default", INACTIVE: "secondary", BLOCKED: "destructive",
};

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<CustomerType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<CustomerStatus | "ALL">("ALL");
  const [filterTag, setFilterTag] = useState<string>("ALL");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const fetchList = useServerFn(listCustomers);
  const fetchTags = useServerFn(listCustomerTags);
  const fetchMetrics = useServerFn(customerMetrics);
  const remove = useServerFn(deleteCustomer);
  const toggle = useServerFn(toggleCustomer);

  const { data: metrics } = useQuery({
    queryKey: ["customer-metrics"],
    queryFn: () => fetchMetrics(),
  });

  const { data: tags } = useQuery({
    queryKey: ["customer-tags"],
    queryFn: () => fetchTags(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, filterType, filterStatus, filterTag, city, page],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          customer_type: filterType === "ALL" ? undefined : filterType,
          customer_status: filterStatus === "ALL" ? undefined : filterStatus,
          tag_id: filterTag === "ALL" ? undefined : filterTag,
          city: city || undefined,
          page,
          page_size: 20,
        },
      }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Cliente removido.");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-metrics"] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  const togMut = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => toggle({ data: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-metrics"] });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Clientes"
        description="Gestão completa de pessoas físicas e jurídicas."
        actions={
          <Can module="clients" action="create">
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Novo cliente
            </Button>
          </Can>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard title="Total" value={metrics?.total ?? 0} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Ativos" value={metrics?.active ?? 0} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Pessoa Física" value={metrics?.individual ?? 0} icon={<UserIcon className="h-5 w-5" />} />
        <KpiCard title="Pessoa Jurídica" value={metrics?.company ?? 0} icon={<Building2 className="h-5 w-5" />} />
        <KpiCard title="Novos no mês" value={metrics?.new_this_month ?? 0} icon={<Plus className="h-5 w-5" />} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar nome, CPF/CNPJ, e-mail, WhatsApp" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Input className="w-40" placeholder="Cidade" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} />
        <Select value={filterType} onValueChange={(v) => { setFilterType(v as any); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
            <SelectItem value="COMPANY">Pessoa Jurídica</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="INACTIVE">Inativo</SelectItem>
            <SelectItem value="BLOCKED">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={(v) => { setFilterTag(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as tags</SelectItem>
            {(tags ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum cliente"
          description="Cadastre o primeiro cliente para começar."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">CPF/CNPJ</th>
                  <th className="px-3 py-2 text-left">WhatsApp</th>
                  <th className="px-3 py-2 text-left">Cidade</th>
                  <th className="px-3 py-2 text-left">Tags</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Cadastro</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link to="/clients/$id" params={{ id: c.id }} className="font-medium hover:underline">
                        {c.trade_name || c.name}
                      </Link>
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {c.customer_type === "COMPANY" ? "PJ" : "PF"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{formatDoc(c.cpf_cnpj)}</td>
                    <td className="px-3 py-2">{c.whatsapp || "—"}</td>
                    <td className="px-3 py-2">{c.primary_address?.city || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).slice(0, 3).map((t: any) => (
                          <Badge key={t.id} variant="outline" className="text-[10px]"
                            style={{ borderColor: t.color, color: t.color }}>
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[c.customer_status as CustomerStatus]}>
                        {STATUS_LABEL[c.customer_status as CustomerStatus]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {c.whatsapp && (
                          <Button asChild size="icon" variant="ghost" title="WhatsApp">
                            <a target="_blank" rel="noreferrer"
                              href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`}>
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Histórico"
                          onClick={() => setHistoryFor({ id: c.id, name: c.trade_name || c.name })}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button asChild size="icon" variant="ghost" title="Visualizar">
                          <Link to="/clients/$id" params={{ id: c.id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Can module="clients" action="edit">
                          <Button size="icon" variant="ghost" title="Editar"
                            onClick={() => { setEditing(c.id); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => togMut.mutate({ id: c.id, active: !c.active })}>
                            {c.active ? "Desativar" : "Ativar"}
                          </Button>
                        </Can>
                        <Can module="clients" action="delete">
                          <Button size="icon" variant="ghost" title="Excluir"
                            onClick={() => setConfirmDel({ id: c.id, name: c.trade_name || c.name })}>
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

          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} clientes — página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <CustomerFormSheet open={open} onOpenChange={setOpen} customerId={editing} />

      {historyFor && (
        <CustomerHistorySheet
          open={!!historyFor}
          onOpenChange={(o) => !o && setHistoryFor(null)}
          customerId={historyFor.id}
          customerName={historyFor.name}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.name} será removido (soft delete). Histórico e contatos serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
