import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, FileText, RefreshCw, Trash2, Eye, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NotaUploader } from "@/components/smart-receiving/NotaUploader";
import { NotaReviewSheet } from "@/components/smart-receiving/NotaReviewSheet";
import {
  listNotaDocuments, parseNotaDocument, deleteNotaDocument,
  type NotaDocument, type NotaStatus,
} from "@/lib/smart-receiving.functions";
import { useCompanyId } from "@/hooks/use-company-id";

export const Route = createFileRoute("/_authenticated/smart-receiving")({
  head: () => ({ meta: [{ title: "Recebimento Inteligente — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="smart_receiving">
      <FeatureGate feature="smart_receiving">
        <SmartReceivingPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

const STATUS_META: Record<NotaStatus, { label: string; variant: any; icon?: any }> = {
  UPLOADED: { label: "Enviado", variant: "outline" },
  PROCESSING: { label: "Processando IA", variant: "secondary", icon: Loader2 },
  PARSED: { label: "Aguardando revisão", variant: "default" },
  REVIEWED: { label: "Revisado", variant: "default" },
  CONFIRMED: { label: "Confirmado", variant: "default", icon: CheckCircle2 },
  FAILED: { label: "Falhou", variant: "destructive", icon: AlertCircle },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

const brl = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function SmartReceivingPage() {
  const qc = useQueryClient();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<NotaDocument | null>(null);

  const fetchList = useServerFn(listNotaDocuments);
  const parse = useServerFn(parseNotaDocument);
  const remove = useServerFn(deleteNotaDocument);

  const companyId = useCompanyId();
  const { data: docs, isLoading } = useQuery({
    queryKey: ["nota_documents", companyId],
    queryFn: () => fetchList(),
    enabled: !!companyId,
    refetchInterval: (q) => {
      const list = (q.state.data as NotaDocument[] | undefined) ?? [];
      return list.some((d) => d.status === "PROCESSING") ? 3000 : false;
    },
  });

  const reparse = useMutation({
    mutationFn: (id: string) => parse({ data: { id } }),
    onSuccess: () => { toast.success("Reprocessamento concluído."); qc.invalidateQueries({ queryKey: ["nota_documents"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Documento excluído."); qc.invalidateQueries({ queryKey: ["nota_documents"] }); setConfirmDel(null); },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Recebimento Inteligente"
        description="Envie notas fiscais e a IA cadastra os itens e dá entrada no estoque."
      />

      <Can module="smart_receiving" action="upload">
        <NotaUploader onCreated={(id) => { qc.invalidateQueries({ queryKey: ["nota_documents"] }); setReviewId(id); }} />
      </Can>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !docs || docs.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Nenhuma nota enviada ainda"
            description="Tire uma foto ou envie um PDF da nota fiscal para começar."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Documento</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-left">Nº NF</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const meta = STATUS_META[d.status];
                  const Icon = meta?.icon;
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.original_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">{d.ai_supplier_name ?? "—"}</td>
                      <td className="px-3 py-2">{d.ai_invoice_number ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{d.ai_total_amount !== null ? brl(d.ai_total_amount) : "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={meta?.variant}>
                          {Icon && <Icon className={`mr-1 h-3 w-3 ${d.status === "PROCESSING" ? "animate-spin" : ""}`} />}
                          {meta?.label ?? d.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setReviewId(d.id)} title="Revisar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(d.status === "FAILED" || d.status === "PARSED") && (
                            <Can module="smart_receiving" action="process">
                              <Button
                                size="icon" variant="ghost"
                                onClick={() => reparse.mutate(d.id)}
                                disabled={reparse.isPending}
                                title="Reprocessar com IA"
                              >
                                <RefreshCw className={`h-4 w-4 ${reparse.isPending ? "animate-spin" : ""}`} />
                              </Button>
                            </Can>
                          )}
                          {d.status !== "CONFIRMED" && (
                            <Can module="smart_receiving" action="delete">
                              <Button size="icon" variant="ghost" onClick={() => setConfirmDel(d)} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Can>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NotaReviewSheet open={!!reviewId} onOpenChange={(o) => !o && setReviewId(null)} docId={reviewId} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento {confirmDel?.original_name} e seus dados extraídos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
