import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { SubscriptionStatus } from "@/lib/billing.functions";

const MAP: Record<SubscriptionStatus, { label: string; tone: StatusTone }> = {
  TRIALING: { label: "Em teste", tone: "warning" },
  ACTIVE: { label: "Ativa", tone: "success" },
  PAST_DUE: { label: "Pagamento pendente", tone: "warning" },
  SUSPENDED: { label: "Suspensa", tone: "destructive" },
  CANCELED: { label: "Cancelada", tone: "neutral" },
  EXPIRED: { label: "Expirada", tone: "destructive" },
  MANUAL_REVIEW: { label: "Análise manual", tone: "warning" },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const cfg = MAP[status] ?? { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge status={status} label={cfg.label} tone={cfg.tone} />;
}
