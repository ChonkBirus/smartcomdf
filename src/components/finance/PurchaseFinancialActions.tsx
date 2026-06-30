import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Wallet, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createPayableFromPurchase, getPayableByPurchase,
} from "@/lib/finance-integrations.functions";
import { usePermissions } from "@/lib/permissions";
import { FinancialLinkedBadge } from "./FinancialLinkedBadge";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PurchaseFinancialActions({ purchaseId }: { purchaseId: string }) {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const fetchOne = useServerFn(getPayableByPurchase);
  const create = useServerFn(createPayableFromPurchase);
  const canManage = has("finance.payables.manage") || has("finance.manage");

  const { data: payable, isLoading } = useQuery({
    queryKey: ["finance", "payable", "purchase", purchaseId],
    queryFn: () => fetchOne({ data: { purchase_id: purchaseId } }),
  });

  const mut = useMutation({
    mutationFn: () => create({ data: { purchase_id: purchaseId } }),
    onSuccess: (res: any) => {
      if (res?.duplicate) toast.info("Conta a pagar já existe para esta compra.");
      else toast.success("Conta a pagar criada.");
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar conta a pagar."),
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" />Conta a pagar
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : payable ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{fmtBRL(Number((payable as any).amount))}</span>
            <FinancialLinkedBadge status={(payable as any).status} />
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/finance"><ExternalLink className="mr-1 h-4 w-4" />Ver no financeiro</Link>
          </Button>
        </div>
      ) : canManage ? (
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
          <Plus className="mr-1 h-4 w-4" />
          {mut.isPending ? "Gerando…" : "Gerar conta a pagar"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Sem conta a pagar vinculada.</p>
      )}
    </div>
  );
}
