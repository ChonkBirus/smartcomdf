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
  SCHEDULED: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-transparent",
  IN_PROGRESS: "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-transparent",
  PAUSED: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-transparent",
  COMPLETED: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-transparent",
  CANCELLED: "bg-destructive/15 text-destructive border-transparent",
};

const PRIORITY_CLASS: Record<ServiceOrderPriority, string> = {
  LOW: "bg-muted text-muted-foreground border-transparent",
  NORMAL: "bg-secondary text-secondary-foreground border-transparent",
  HIGH: "bg-orange-500/20 text-orange-800 dark:text-orange-200 border-transparent",
  URGENT: "bg-destructive/20 text-destructive border-transparent",
};

export function ServiceOrderStatusBadge({ status }: { status: ServiceOrderStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{SO_STATUS_LABEL[status]}</Badge>;
}

export function ServiceOrderPriorityBadge({ priority }: { priority: ServiceOrderPriority }) {
  return <Badge className={PRIORITY_CLASS[priority]}>{SO_PRIORITY_LABEL[priority]}</Badge>;
}
