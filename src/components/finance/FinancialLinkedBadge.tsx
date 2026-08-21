import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";

const MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }
> = {
  PAID: { label: "Pago", variant: "default", icon: CheckCircle2 },
  PLANNED: { label: "Pendente", variant: "secondary", icon: Clock },
  OVERDUE: { label: "Vencido", variant: "destructive", icon: AlertCircle },
  CANCELED: { label: "Cancelado", variant: "outline", icon: XCircle },
  RECONCILED: { label: "Conciliado", variant: "default", icon: CheckCircle2 },
};

export function FinancialLinkedBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, variant: "outline" as const, icon: Clock };
  const I = m.icon;
  return (
    <Badge variant={m.variant} className="gap-1">
      <I className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}
