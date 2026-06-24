import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, Pencil, Trash2, Search, Upload } from "lucide-react";
import { SupplierImportDialog } from "@/components/purchases/SupplierImportDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SupplierFormSheet } from "@/components/purchases/SupplierFormSheet";
import { listSuppliers, deleteSupplier, toggleSupplier, type Supplier } from "@/lib/suppliers.functions";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Fornecedores — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="suppliers">
      <FeatureGate feature="suppliers">
        <SuppliersPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Supplier | null>(null);

  const fetchAll = useServerFn(listSuppliers);
  const remove = useServerFn(deleteSupplier);
  const toggle = useServerFn(toggleSupplier);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: () => fetchAll({ data: { search } }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Fornecedor removido.");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  const togMut = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => toggle({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores para pedidos de compra."
        actions={
          <Can module="suppliers" action="create">
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Novo fornecedor
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome ou CNPJ" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nenhum fornecedor"
          description="Cadastre o primeiro fornecedor para começar a registrar compras."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Razão social</th>
                <th className="px-3 py-2 text-left">CPF/CNPJ</th>
                <th className="px-3 py-2 text-left">Cidade/UF</th>
                <th className="px-3 py-2 text-left">Contato</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.trade_name || s.corporate_name}</div>
                    {s.trade_name && <div className="text-xs text-muted-foreground">{s.corporate_name}</div>}
                  </td>
                  <td className="px-3 py-2">{formatCnpj(s.cpf_cnpj)}</td>
                  <td className="px-3 py-2">{[s.city, s.state].filter(Boolean).join("/") || "—"}</td>
                  <td className="px-3 py-2">{s.phone || s.whatsapp || s.email || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.active ? "default" : "secondary"}>
                      {s.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Can module="suppliers" action="edit">
                        <Button size="sm" variant="ghost" onClick={() => togMut.mutate({ id: s.id, active: !s.active })}>
                          {s.active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(s.id); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Can>
                      <Can module="suppliers" action="delete">
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDel(s)}>
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

      <SupplierFormSheet open={open} onOpenChange={setOpen} supplierId={editing} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.corporate_name} será removido. Esta ação não pode ser desfeita.
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
