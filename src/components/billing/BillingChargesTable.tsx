import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw, Copy, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCompanyCharges, type CompanyCharge } from "@/lib/billing.functions";
import { syncBillingStatus } from "@/lib/billing-sync.functions";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  WAITING_PAYMENT: "Aguardando",
  PAID: "Paga",
  CONFIRMED: "Confirmada",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  CHARGEBACK: "Chargeback",
  CANCELED: "Cancelada",
  FAILED: "Falhou",
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "—",
};

const isPayable = (c: CompanyCharge) =>
  ["PENDING", "WAITING_PAYMENT", "OVERDUE"].includes(c.status);

export function BillingChargesTable() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCompanyCharges);
  const syncFn = useServerFn(syncBillingStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "company-charges"],
    queryFn: () => listFn(),
  });

  const syncM = useMutation({
    mutationFn: (charge_id: string) => syncFn({ data: { charge_id } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["billing", "company-charges"] });
      qc.invalidateQueries({ queryKey: ["billing", "current-subscription"] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Falha ao atualizar status"),
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Carregando faturas...</div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-5 w-5" />}
        title="Nenhuma cobrança encontrada"
        description="As cobranças da sua assinatura aparecerão aqui assim que forem geradas."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pago em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((c) => {
            const payUrl = c.invoice_url || c.checkout_url || c.bank_slip_url;
            return (
              <TableRow key={c.id}>
                <TableCell>{fmtDate(c.due_date)}</TableCell>
                <TableCell className="font-medium">
                  {fmtBRL(c.amount)}
                </TableCell>
                <TableCell>
                  {METHOD_LABEL[c.payment_method ?? "UNDEFINED"] ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.status} label={STATUS_LABEL[c.status] ?? c.status} />
                </TableCell>
                <TableCell>{fmtDate(c.paid_at)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {isPayable(c) && c.pix_copy_paste ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(c.pix_copy_paste!);
                          toast.success("Pix copia e cola copiado");
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Pix
                      </Button>
                    ) : null}
                    {isPayable(c) && payUrl ? (
                      <Button asChild size="sm">
                        <a href={payUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Pagar
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={syncM.isPending && syncM.variables === c.id}
                      onClick={() => syncM.mutate(c.id)}
                    >
                      {syncM.isPending && syncM.variables === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
