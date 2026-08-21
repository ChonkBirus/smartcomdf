import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusDomain =
  | "service_order"
  | "project"
  | "subscription"
  | "billing_charge"
  | "webhook"
  | "dunning"
  | "pilot"
  | "generic";

export type StatusTone = "success" | "warning" | "destructive" | "primary" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/20",
  warning: "bg-warning/15 text-warning border-warning/20",
  destructive: "bg-destructive/15 text-destructive border-destructive/20",
  primary: "bg-primary/15 text-primary border-primary/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const SUCCESS = new Set([
  "ACTIVE",
  "APPROVED",
  "COMPLETED",
  "PAID",
  "CONFIRMED",
  "PROCESSED",
  "CONVERTED",
  "READY",
  "DELIVERED",
  "REACTIVATED",
  "RECEIVED_OK",
  "SUCCESS",
  "ACCEPTED",
]);
const WARNING = new Set([
  "PENDING",
  "WAITING_PAYMENT",
  "PAST_DUE",
  "IN_PROGRESS",
  "SCHEDULED",
  "PAUSED",
  "TRIALING",
  "MANUAL_REVIEW",
  "PROCESSING",
  "AWAITING",
  "REVIEW",
  "RETRY",
]);
const DESTRUCTIVE = new Set([
  "CANCELED",
  "CANCELLED",
  "EXPIRED",
  "SUSPENDED",
  "FAILED",
  "OVERDUE",
  "REJECTED",
  "BLOCKED",
  "DELETED",
  "ERROR",
  "REFUSED",
  "REFUNDED",
  "CHARGEBACK",
]);
const PRIMARY = new Set([
  "DRAFT",
  "OPEN",
  "NEW",
  "RECEIVED",
  "SENT",
  "VIEWED",
  "CREATED",
  "STARTED",
]);
const NEUTRAL = new Set(["IGNORED", "ARCHIVED", "INACTIVE", "UNKNOWN", "CLOSED", "NONE"]);

function toneFor(status: string): StatusTone {
  const key = (status ?? "").toString().toUpperCase().trim();
  if (SUCCESS.has(key)) return "success";
  if (WARNING.has(key)) return "warning";
  if (DESTRUCTIVE.has(key)) return "destructive";
  if (PRIMARY.has(key)) return "primary";
  if (NEUTRAL.has(key)) return "neutral";
  return "neutral";
}

const SIZE_CLASS = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
  lg: "text-sm px-2.5 py-1",
} as const;

export interface StatusBadgeProps {
  status: string;
  label?: ReactNode;
  domain?: StatusDomain;
  tone?: StatusTone;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

export function StatusBadge({ status, label, tone, size = "md", className }: StatusBadgeProps) {
  const resolvedTone = tone ?? toneFor(status);
  return (
    <Badge
      variant="outline"
      className={cn("font-medium border", TONE_CLASS[resolvedTone], SIZE_CLASS[size], className)}
    >
      {label ?? status}
    </Badge>
  );
}

export default StatusBadge;
