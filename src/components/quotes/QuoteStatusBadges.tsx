import { StatusBadge } from "@/components/ui/status-badge";
import type { QuoteStatus, QuoteFinancialStatus } from "@/lib/quotes.functions";

export type QuoteStatusInput = {
  status: QuoteStatus;
  financial_status?: QuoteFinancialStatus | null;
  project_id?: string | null;
  has_pending_receipt?: boolean | null;
};

type BadgeSpec = { key: string; status: string; label: string };

/**
 * Retorna até 3 badges relevantes descrevendo o estado do orçamento
 * combinando status, financial_status, comprovantes pendentes e projeto.
 */
export function computeQuoteBadges(q: QuoteStatusInput): BadgeSpec[] {
  const out: BadgeSpec[] = [];
  const fin = q.financial_status ?? null;
  const hasProject = !!q.project_id;
  const pendingReceipt = !!q.has_pending_receipt;

  switch (q.status) {
    case "DRAFT":
      out.push({ key: "s", status: "DRAFT", label: "Rascunho" });
      break;
    case "SENT":
      out.push({ key: "s", status: "SENT", label: "Enviado" });
      break;
    case "VIEWED":
      out.push({ key: "s", status: "VIEWED", label: "Visualizado" });
      break;
    case "REJECTED":
      out.push({ key: "s", status: "REJECTED", label: "Rejeitado" });
      break;
    case "EXPIRED":
      out.push({ key: "s", status: "EXPIRED", label: "Expirado" });
      break;
    case "CANCELLED":
      out.push({ key: "s", status: "CANCELLED", label: "Cancelado" });
      break;
    case "CONVERTED":
    case "APPROVED": {
      out.push({ key: "s", status: "APPROVED", label: "Aprovado" });
      if (pendingReceipt) {
        out.push({ key: "r", status: "REVIEW", label: "Comprovante em análise" });
      } else if (fin === "PAID") {
        out.push({ key: "f", status: "PAID", label: "Pago" });
      } else if (fin === "PARTIALLY_PAID") {
        out.push({ key: "f", status: "WAITING_PAYMENT", label: "Parcialmente pago" });
      } else {
        out.push({ key: "f", status: "WAITING_PAYMENT", label: "Aguardando pagamento" });
      }
      if ((fin === "PARTIALLY_PAID" || fin === "PAID") && !hasProject) {
        out.push({ key: "p", status: "PENDING", label: "Aguardando criação do projeto" });
      } else if (hasProject) {
        out.push({ key: "p", status: "COMPLETED", label: "Projeto criado" });
      }
      break;
    }
  }

  return out.slice(0, 3);
}

export function QuoteStatusBadges({
  quote,
  className,
}: {
  quote: QuoteStatusInput;
  className?: string;
}) {
  const badges = computeQuoteBadges(quote);
  return (
    <div className={"flex flex-wrap items-center gap-1 " + (className ?? "")}>
      {badges.map((b) => (
        <StatusBadge key={b.key} status={b.status} label={b.label} />
      ))}
    </div>
  );
}

export default QuoteStatusBadges;
