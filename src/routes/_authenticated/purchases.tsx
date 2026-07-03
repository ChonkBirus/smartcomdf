import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShoppingCart, Plus, Pencil, Copy, CheckCircle2, XCircle, PackageCheck,
  Trash2, Send, DollarSign, Clock, CheckCheck,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { KpiCard } from "@/components/app/KpiCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PurchaseOrderFormSheet } from "@/components/purchases/PurchaseOrderFormSheet";
import { ReceivingDialog } from "@/components/purchases/ReceivingDialog";
import {
  listPurchaseOrders, submitPurchaseOrder, approvePurchaseOrder,
  cancelPurchaseOrder, deletePurchaseOrder, duplicatePurchaseOrder,
  purchaseOverview, type PurchaseOrder, type PurchaseOrderStatus,
} from "@/lib/purchases.functions";
import { useCompanyId } from "@/hooks/use-company-id";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Compras — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="purchases">
      <FeatureGate feature="purchases">
        <PurchasesPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PARTIALLY_RECEIVED: "Parcial",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
};

const STATUS_VARIANT: Record<PurchaseOrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  PENDING: "secondary",
  APPROVED: "default",
  PARTIALLY_RECEIVED: "default",
  RECEIVED: "default",
  CANCELLED: "destructive",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PurchasesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<PurchaseOrder | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<PurchaseOrder | null>(null);

  const fetchList = useServerFn(listPurchaseOrders);
  const fetchOverview = useServerFn(purchaseOverview);
  const submit = useServerFn(submitPurchaseOrder);
  const approve = useServerFn(approvePurchaseOrder);
  const cancel = useServerFn(cancelPurchaseOrder);
  const remove = useServerFn(deletePurchaseOrder);
  const duplicate = useServerFn(duplicatePurchaseOrder);

  const companyId = useCompanyId();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase_orders", companyId, status, search],
    queryFn: () => fetchList({ data: { status: status || undefined, search } }),
    enabled: !!companyId,
  });
  const { data: overview } = useQuery({
    queryKey: ["purchase_overview", companyId],
    queryFn: () => fetchOverview(),
    enabled: !!companyId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    qc.invalidateQueries({ queryKey: ["purchase_overview"] });
  };

  const submitMut = useMutation({
    mutationFn: (id: string) => submit({ data: { id } }),
    onSuccess: () => { toast.success("Enviado para aprovação."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => { toast.success("Pedido aprovado."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { toast.success("Pedido cancelado."); invalidate(); setConfirmCancel(null); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Rascunho excluído."); invalidate(); setConfirmDel(null); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: (r) => { toast.success("Pedido duplicado."); invalidate(); setEditing(r.id); setOpen(true); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Pedidos de Compra"
        description="Crie, aprove e receba pedidos de compra."
        actions={
          <Can module="purchases" action="create">
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Novo pedido
            </Button>
          </Can>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Compras do mês" value={brl(overview?.monthTotal ?? 0)} icon={<DollarSign className="h-5 w-5" />} />
        <KpiCard title="Pedidos no mês" value={String(overview?.count ?? 0)} icon={<ShoppingCart className="h-5 w-5" />} />
        <KpiCard title="Pendentes" value={String(overview?.monthPending ?? 0)} icon={<Clock className="h-5 w-5" />} />
        <KpiCard title="Recebidos" value={String(overview?.monthReceived ?? 0)} icon={<CheckCheck className="h-5 w-5" />} />
      </div>

      <div className="my-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Buscar nº do pedido" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as PurchaseOrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !orders || orders.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhum pedido" description="Crie o primeiro pedido de compra." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Pedido</th>
                <th className="px-3 py-2 text-left">Fornecedor</th>
                <th className="px-3 py-2 text-left">Emissão</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{po.order_number}</td>
                  <td className="px-3 py-2">{po.supplier_name}</td>
                  <td className="px-3 py-2">{new Date(po.issue_date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right">{brl(po.total_amount)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[po.status]}>{STATUS_LABEL[po.status]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {po.status === "DRAFT" && (
                        <Can module="purchases" action="edit">
                          <Button size="sm" variant="ghost" onClick={() => submitMut.mutate(po.id)}>
                            <Send className="mr-1 h-3 w-3" />Enviar
                          </Button>
                        </Can>
                      )}
                      {(po.status === "DRAFT" || po.status === "PENDING") && (
                        <Can module="purchases" action="approve">
                          <Button size="sm" variant="ghost" onClick={() => approveMut.mutate(po.id)}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />Aprovar
                          </Button>
                        </Can>
                      )}
                      {(po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && (
                        <Can module="purchases" action="receive">
                          <Button size="sm" onClick={() => setReceiving(po.id)}>
                            <PackageCheck className="mr-1 h-3 w-3" />Receber
                          </Button>
                        </Can>
                      )}
                      {(po.status === "DRAFT" || po.status === "PENDING") && (
                        <Can module="purchases" action="edit">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(po.id); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Can>
                      )}
                      <Can module="purchases" action="create">
                        <Button size="icon" variant="ghost" onClick={() => dupMut.mutate(po.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </Can>
                      {po.status !== "CANCELLED" && po.status !== "RECEIVED" && (
                        <Can module="purchases" action="cancel">
                          <Button size="icon" variant="ghost" onClick={() => setConfirmCancel(po)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </Can>
                      )}
                      {po.status === "DRAFT" && (
                        <Can module="purchases" action="delete">
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDel(po)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Can>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PurchaseOrderFormSheet open={open} onOpenChange={setOpen} orderId={editing} />
      <ReceivingDialog open={!!receiving} onOpenChange={(o) => !o && setReceiving(null)} orderId={receiving} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rascunho?</AlertDialogTitle>
            <AlertDialogDescription>O pedido {confirmDel?.order_number} será removido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCancel?.order_number} será cancelado. Itens já recebidos permanecem no estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmCancel && cancelMut.mutate(confirmCancel.id)}>
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
