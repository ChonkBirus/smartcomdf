import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, EyeOff, Loader2, Plus, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listStatementSuggestions,
  confirmStatementReconciliation,
  ignoreStatementTransaction,
  undoStatementReconciliation,
  createFinancialFromStatementTransaction,
  type StatementSuggestion,
} from "@/lib/bank-statement-reconciliation.functions";
import { suggestCategoryForDescription } from "@/lib/bank-statement-categorize.functions";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIER_CLS: Record<string, string> = {
  HIGH: "bg-success/15 text-success",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  LOW: "bg-muted text-muted-foreground",
};

type StatusFilter = "PENDING" | "SUGGESTED" | "RECONCILED" | "IGNORED";

export function BankStatementReconciliationPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listStatementSuggestions);
  const confirmFn = useServerFn(confirmStatementReconciliation);
  const ignoreFn = useServerFn(ignoreStatementTransaction);
  const undoFn = useServerFn(undoStatementReconciliation);
  const createFinFn = useServerFn(createFinancialFromStatementTransaction);
  const suggestCatFn = useServerFn(suggestCategoryForDescription);

  const [status, setStatus] = useState<StatusFilter>("PENDING");

  const q = useQuery({
    queryKey: ["bank-statement-suggestions", status],
    queryFn: () => listFn({ data: { status, minScore: 50, limit: 100 } }),
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["bank-statement-suggestions"] });

  const confirmMut = useMutation({
    mutationFn: (vars: { bankId: string; finId: string; score?: number }) =>
      confirmFn({
        data: {
          bankStatementTransactionId: vars.bankId,
          financialTransactionId: vars.finId,
          confidenceScore: vars.score,
        },
      }),
    onSuccess: () => {
      toast.success("Conciliação confirmada.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar."),
  });

  const ignoreMut = useMutation({
    mutationFn: (bankId: string) =>
      ignoreFn({ data: { bankStatementTransactionId: bankId } }),
    onSuccess: () => {
      toast.success("Lançamento ignorado.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao ignorar."),
  });

  const undoMut = useMutation({
    mutationFn: (bankId: string) =>
      undoFn({ data: { bankStatementTransactionId: bankId } }),
    onSuccess: () => {
      toast.success("Conciliação desfeita.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao desfazer."),
  });

  const createMut = useMutation({
    mutationFn: async (row: StatementSuggestion["bankTransaction"]) => {
      const type = row.type === "CREDIT" ? "INCOME" : "EXPENSE";
      const cat = await suggestCatFn({ data: { description: row.description, type } }).catch(() => null);
      return createFinFn({
        data: {
          bankStatementTransactionId: row.id,
          categoryId: cat?.categoryId ?? null,
        },
      });
    },
    onSuccess: (res: any) => {
      if (res?.already_existed) {
        const finId = res?.financial_transaction_id;
        toast.warning("Já existe um lançamento para esta linha do extrato.", {
          description: "Nenhum duplicado foi criado.",
          action: finId
            ? {
                label: "Ver lançamento",
                onClick: () => {
                  window.location.href = `/finance?transaction=${finId}`;
                },
              }
            : undefined,
        });
      } else {
        toast.success("Lançamento financeiro criado e conciliado.");
      }
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar lançamento."),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-base font-semibold">Sugestões de conciliação</div>
          <div className="text-xs text-muted-foreground">
            Casamos cada lançamento do extrato com o financeiro mais provável. Confirme apenas o que estiver correto.
          </div>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="SUGGESTED">Sugeridos</SelectItem>
            <SelectItem value="RECONCILED">Conciliados</SelectItem>
            <SelectItem value="IGNORED">Ignorados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando sugestões...
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Nada para conciliar"
          description="Importe um extrato ou troque o filtro para visualizar lançamentos."
        />
      ) : (
        <div className="space-y-3">
          {q.data.map((row: StatementSuggestion) => (
            <Card key={row.bankTransaction.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {row.bankTransaction.description || "(sem descrição)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(row.bankTransaction.transaction_date).toLocaleDateString("pt-BR")}
                      {" · "}
                      <span
                        className={
                          row.bankTransaction.type === "CREDIT"
                            ? "text-success"
                            : "text-destructive"
                        }
                      >
                        {row.bankTransaction.type === "CREDIT" ? "Entrada" : "Saída"} {BRL(Math.abs(row.bankTransaction.amount))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.bankTransaction.reconciliation_status === "RECONCILED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={undoMut.isPending}
                        onClick={() => undoMut.mutate(row.bankTransaction.id)}
                      >
                        <Undo2 className="mr-1.5 h-4 w-4" /> Desfazer
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ignoreMut.isPending}
                        onClick={() => ignoreMut.mutate(row.bankTransaction.id)}
                      >
                        <EyeOff className="mr-1.5 h-4 w-4" /> Ignorar
                      </Button>
                    )}
                  </div>
                </div>

                {row.candidates.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3">
                    <div className="text-xs text-muted-foreground">
                      Nenhum lançamento financeiro próximo encontrado.
                    </div>
                    {row.bankTransaction.reconciliation_status !== "RECONCILED" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={createMut.isPending}
                        onClick={() => createMut.mutate(row.bankTransaction)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" /> Criar lançamento
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y rounded-md border">
                    {row.candidates.map((c) => (
                      <div
                        key={c.financialTransactionId}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.date ? new Date(c.date).toLocaleDateString("pt-BR") : "—"}
                            {" · "}
                            {c.type === "INCOME" ? "Receber" : "Pagar"} {BRL(c.amount)}
                            {" · "}
                            {c.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={TIER_CLS[c.tier]}>
                            {c.score}% · {c.tier}
                          </Badge>
                          <Button
                            size="sm"
                            disabled={
                              confirmMut.isPending ||
                              row.bankTransaction.reconciliation_status === "RECONCILED"
                            }
                            onClick={() =>
                              confirmMut.mutate({
                                bankId: row.bankTransaction.id,
                                finId: c.financialTransactionId,
                                score: c.score,
                              })
                            }
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Conciliar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
