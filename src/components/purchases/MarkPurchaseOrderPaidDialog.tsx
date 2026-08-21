import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listBankAccounts } from "@/lib/bank-accounts.functions";
import { markPurchaseOrderPaid } from "@/lib/finance-integrations.functions";

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "PIX", label: "PIX" },
  { value: "TRANSFER", label: "Transferência" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "DEBIT_CARD", label: "Cartão de débito" },
  { value: "CASH", label: "Dinheiro" },
  { value: "OTHER", label: "Outro" },
];

export function MarkPurchaseOrderPaidDialog({
  open,
  onOpenChange,
  purchaseId,
  orderNumber,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  purchaseId: string | null;
  orderNumber?: string;
  onPaid?: () => void;
}) {
  const qc = useQueryClient();
  const listAccs = useServerFn(listBankAccounts);
  const mark = useServerFn(markPurchaseOrderPaid);

  const [accountId, setAccountId] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("PIX");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open]);

  const accs = useQuery({
    queryKey: ["fin-bank-accounts", "active"],
    queryFn: () => listAccs({ data: { activeOnly: true } }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!purchaseId) throw new Error("Pedido inválido.");
      if (!accountId) throw new Error("Selecione a conta financeira.");
      return mark({
        data: {
          purchase_id: purchaseId,
          bank_account_id: accountId,
          paid_at: new Date(paidAt).toISOString(),
          payment_method: method || undefined,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Pedido de compra marcado como pago.");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["purchase_overview"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["fin-overview"] });
      qc.invalidateQueries({ queryKey: ["fin-cashflow"] });
      qc.invalidateQueries({ queryKey: ["fin-expenses"] });
      qc.invalidateQueries({ queryKey: ["fin-bank-accounts"] });
      onPaid?.();
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (/permiss|permission|not_authoriz/i.test(msg)) {
        toast.error("Você não tem permissão para pagar pedido de compra.");
      } else if (/bank|conta/i.test(msg) && /inv|not/i.test(msg)) {
        toast.error("Conta financeira inválida para esta empresa.");
      } else {
        toast.error(msg || "Falha ao marcar como pago.");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar pedido de compra como pago</DialogTitle>
          {orderNumber && <DialogDescription>Pedido {orderNumber}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Conta financeira</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {(accs.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.bank_name}
                    {a.account_name ? ` — ${a.account_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>

          <div>
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !accountId}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
