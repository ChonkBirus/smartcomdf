import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelWithHelp } from "@/components/ui/FieldHelp";
import {
  createFinancialTransaction,
  type FinTxType, type FinTxStatus,
} from "@/lib/finance.functions";
import { listBankAccounts } from "@/lib/bank-accounts.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import { CategorySelect } from "@/components/finance/chart-of-accounts/CategorySelect";

/**
 * Mobile-first quick entry for a financial transaction.
 * Big touch targets, decimal keypad, sensible defaults.
 */
export function QuickTransactionSheet({
  open,
  onOpenChange,
  onSaved,
  defaultType = "EXPENSE",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  defaultType?: FinTxType;
}) {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const [type, setType] = useState<FinTxType>(defaultType);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<FinTxStatus>("PAID");
  const [notes, setNotes] = useState("");

  const catsFn = useServerFn(listFinancialCategories);
  const accsFn = useServerFn(listBankAccounts);
  const createFn = useServerFn(createFinancialTransaction);

  const cats = useQuery({
    queryKey: ["fin-cats", companyId, type],
    queryFn: () => catsFn({ data: { type, activeOnly: true } }),
    enabled: open,
  });
  const accs = useQuery({
    queryKey: ["fin-bank-accounts", companyId, true],
    queryFn: () => accsFn({ data: { activeOnly: true } }),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number((amount || "").replace(",", "."));
      if (!description.trim()) throw new Error("Descrição obrigatória.");
      if (!amt || amt <= 0) throw new Error("Valor deve ser maior que zero.");
      const isoDate = date;
      return createFn({
        data: {
          type,
          description: description.trim(),
          amount: amt,
          status,
          due_date: status === "PAID" ? null : isoDate,
          paid_at: status === "PAID" ? new Date(isoDate).toISOString() : null,
          category_id: categoryId || null,
          bank_account_id: accountId || null,
          notes: notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Lançamento salvo.");
      qc.invalidateQueries({ queryKey: ["fin-overview", companyId] });
      qc.invalidateQueries({ queryKey: ["fin-cashflow", companyId] });
      qc.invalidateQueries({ queryKey: ["fin-incomes", companyId] });
      qc.invalidateQueries({ queryKey: ["fin-expenses", companyId] });
      qc.invalidateQueries({ queryKey: ["fin-bank-balances", companyId] });
      // reset
      setDescription(""); setAmount(""); setNotes("");
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4">
        <SheetHeader className="mb-3 text-left">
          <SheetTitle className="text-lg">Novo lançamento</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="lg"
              variant={type === "EXPENSE" ? "default" : "outline"}
              className="h-12"
              onClick={() => setType("EXPENSE")}
            >
              <ArrowDownCircle className="mr-2 h-5 w-5" /> Saída
            </Button>
            <Button
              type="button"
              size="lg"
              variant={type === "INCOME" ? "default" : "outline"}
              className="h-12"
              onClick={() => setType("INCOME")}
            >
              <ArrowUpCircle className="mr-2 h-5 w-5" /> Entrada
            </Button>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp label="Descrição" help="O que foi este lançamento? Ex.: Aluguel, gasolina, venda para cliente João." />
            <Input
              className="h-12 text-base"
              placeholder="Ex.: Combustível"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus={false}
            />
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp label="Valor (R$)" help="Quanto entrou ou saiu. Use vírgula ou ponto para os centavos." />
            <Input
              inputMode="decimal"
              className="h-14 text-2xl font-semibold"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp label="Conta financeira" help="De qual conta o dinheiro saiu ou entrou: carteira, banco, caixa. Cadastre em Financeiro → Configurações → Contas." />
            <Select value={accountId || "__none__"} onValueChange={(v) => setAccountId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem conta definida</SelectItem>
                {(accs.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name ? `${a.bank_name} — ${a.account_name}` : a.bank_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <LabelWithHelp label="Categoria" help="Classifique para entender onde a empresa ganha e gasta." />
              <Select value={categoryId || "__none__"} onValueChange={(v) => setCategoryId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {(cats.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <LabelWithHelp label="Data" help="Data em que o dinheiro saiu ou entrou (se pago), ou data de vencimento (se pendente)." />
              <Input type="date" className="h-12" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={status === "PAID" ? "default" : "outline"}
              className="h-11"
              onClick={() => setStatus("PAID")}
            >
              {type === "INCOME" ? "Recebido" : "Pago"}
            </Button>
            <Button
              type="button"
              variant={status === "PLANNED" ? "default" : "outline"}
              className="h-11"
              onClick={() => setStatus("PLANNED")}
            >
              Pendente
            </Button>
          </div>

          <div className="space-y-1.5">
            <LabelWithHelp label="Observação (opcional)" help="Detalhes adicionais que ajudem a identificar depois." />
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
            <Button variant="outline" className="flex-1 h-12" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button className="flex-1 h-12" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
