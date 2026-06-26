import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Loader2, PackageMinus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listStockDeductionLogs,
  deductServiceOrderStock,
  type DeductStockResult,
} from "@/lib/service-order-stock.functions";

type Props = {
  serviceOrderId: string;
  status: string;
  stockDeductionStatus: "PENDING" | "DEDUCTED" | "BLOCKED" | "NOT_APPLICABLE";
  canDeduct: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  DEDUCTED: "Baixado",
  BLOCKED: "Bloqueado",
  NOT_APPLICABLE: "Não aplicável",
};

export function ServiceOrderStockDeduction({
  serviceOrderId,
  status,
  stockDeductionStatus,
  canDeduct,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listStockDeductionLogs);
  const deductFn = useServerFn(deductServiceOrderStock);
  const [busy, setBusy] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["so-stock-logs", serviceOrderId],
    queryFn: () => listFn({ data: { id: serviceOrderId } }),
  });

  const isCompleted = status === "COMPLETED";
  const alreadyDone =
    stockDeductionStatus === "DEDUCTED" || stockDeductionStatus === "NOT_APPLICABLE";
  const canRun = canDeduct && isCompleted && !alreadyDone;

  async function handleDeduct() {
    if (!canRun) return;
    if (!confirm("Confirmar baixa de estoque dos materiais utilizados?")) return;
    setBusy(true);
    try {
      const r: DeductStockResult = await deductFn({ data: { id: serviceOrderId } });
      if (r.status === "DEDUCTED") {
        toast.success(`Baixa concluída: ${r.deducted} item(ns).`);
      } else if (r.status === "BLOCKED") {
        toast.warning(
          `Baixa parcial — ${r.deducted} ok, ${r.blocked} bloqueado(s), ${r.failed} falha(s).`,
        );
      } else {
        toast.info("Nenhum material elegível para baixa.");
      }
      qc.invalidateQueries({ queryKey: ["so-stock-logs", serviceOrderId] });
      qc.invalidateQueries({ queryKey: ["so-mobile", serviceOrderId] });
      qc.invalidateQueries({ queryKey: ["service-order", serviceOrderId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao realizar baixa de estoque.");
    } finally {
      setBusy(false);
    }
  }

  const statusVariant =
    stockDeductionStatus === "DEDUCTED"
      ? "default"
      : stockDeductionStatus === "BLOCKED"
      ? "destructive"
      : "secondary";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={statusVariant as any}>{STATUS_LABEL[stockDeductionStatus] ?? stockDeductionStatus}</Badge>
        {canDeduct && (
          <Button size="sm" onClick={handleDeduct} disabled={!canRun || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PackageMinus className="h-4 w-4 mr-1" />}
            {stockDeductionStatus === "BLOCKED" ? "Tentar novamente" : "Baixar estoque"}
          </Button>
        )}
      </div>

      {!isCompleted && (
        <p className="text-xs text-muted-foreground">
          A baixa fica disponível após concluir a OS.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma baixa registrada ainda.</p>
      ) : (
        <ul className="divide-y rounded border">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start gap-3 p-3 text-sm">
              {l.status === "DEDUCTED" ? (
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              ) : l.status === "BLOCKED" ? (
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {l.item_name ?? "Item"} · {l.quantity}
                </div>
                <div className="text-xs text-muted-foreground">
                  {l.location_name ?? "Sem local"} ·{" "}
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </div>
                {l.error_message && (
                  <div className="text-xs text-warning mt-1">
                    {l.error_message}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
