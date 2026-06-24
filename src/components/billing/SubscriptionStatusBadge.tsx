import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus } from "@/lib/billing.functions";

const STATUS_MAP: Record<
  SubscriptionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  TRIALING: { label: "Em teste", variant: "secondary" },
  ACTIVE: { label: "Ativa", variant: "default" },
  PAST_DUE: { label: "Pagamento pendente", variant: "outline" },
  SUSPENDED: { label: "Suspensa", variant: "destructive" },
  CANCELED: { label: "Cancelada", variant: "outline" },
  EXPIRED: { label: "Expirada", variant: "destructive" },
  MANUAL_REVIEW: { label: "Análise manual", variant: "outline" },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
