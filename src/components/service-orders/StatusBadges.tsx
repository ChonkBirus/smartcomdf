import { Badge } from "@/components/ui/badge";
import type { ServiceOrderStatus, ServiceOrderPriority } from "@/lib/service-orders.functions";

export const SO_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const SO_PRIORITY_LABEL: Record<ServiceOrderPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const STATUS_CLASS: Record<ServiceOrderStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground border-transparent",
  SCHEDULED: "bg-primary/15 text-primary border-transparent",
  IN_PROGRESS: "bg-warning/20 text-warning border-transparent",
  PAUSED: "bg-warning/15 text-warning border-transparent",
  COMPLETED: "bg-success/20 text-success border-transparent",
  CANCELLED: "bg-destructive/15 text-destructive border-transparent",
};

const PRIORITY_CLASS: Record<ServiceOrderPriority, string> = {
  LOW: "bg-muted text-muted-foreground border-transparent",
  NORMAL: "bg-secondary text-secondary-foreground border-transparent",
  HIGH: "bg-warning/20 text-warning border-transparent",
  URGENT: "bg-destructive/20 text-destructive border-transparent",
};

export function ServiceOrderStatusBadge({ status }: { status: ServiceOrderStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{SO_STATUS_LABEL[status]}</Badge>;
}

export function ServiceOrderPriorityBadge({ priority }: { priority: ServiceOrderPriority }) {
  return <Badge className={PRIORITY_CLASS[priority]}>{SO_PRIORITY_LABEL[priority]}</Badge>;
}
