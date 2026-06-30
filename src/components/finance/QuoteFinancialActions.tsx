import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Plus, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createReceivableFromQuote, getReceivableByQuote,
} from "@/lib/finance-integrations.functions";
import { usePermissions } from "@/lib/permissions";
import { FinancialLinkedBadge } from "./FinancialLinkedBadge";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = { quoteId: string; status: string };

export function QuoteFinancialActions({ quoteId, status }: Props) {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const fetchOne = useServerFn(getReceivableByQuote);
  const create = useServerFn(createReceivableFromQuote);

  const canManage = has("finance.receivables.manage") || has("finance.manage");
  const isReady = status === "APPROVED" || status === "CONVERTED";

  const { data: receivable, isLoading } = useQuery({
    queryKey: ["finance", "receivable", "quote", quoteId],
    queryFn: () => fetchOne({ data: { quote_id: quoteId } }),
    enabled: isReady,
  });

  const mut = useMutation({
    mutationFn: () => create({ data: { quote_id: quoteId } }),
    onSuccess: (res: any) => {
      if (res?.duplicate) toast.info("Conta a receber já existe para este orçamento.");
      else toast.success("Conta a receber criada.");
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar conta a receber."),
  });

  if (!isReady) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" />Financeiro
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : receivable ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <p className="font-medium">{fmtBRL(Number((receivable as any).amount))}</p>
              {(receivable as any).due_date && (
                <p className="text-xs text-muted-foreground">
                  Vence em {new Date((receivable as any).due_date).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <FinancialLinkedBadge status={(receivable as any).status} />
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/finance">
              <ExternalLink className="mr-1 h-4 w-4" />
              Ver no financeiro
            </Link>
          </Button>
        </div>
      ) : canManage ? (
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
          <Plus className="mr-1 h-4 w-4" />
          {mut.isPending ? "Gerando…" : "Gerar conta a receber"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma conta a receber vinculada. Solicite ao financeiro para gerar.
        </p>
      )}
    </div>
  );
}
