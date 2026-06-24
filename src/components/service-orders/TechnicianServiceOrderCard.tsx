import { Link } from "@tanstack/react-router";
import { Calendar, Clock, MapPin, User, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ServiceOrderStatusBadge, ServiceOrderPriorityBadge } from "./StatusBadges";
import type { ServiceOrderStatus, ServiceOrderPriority } from "@/lib/service-orders.functions";

export type TechnicianOrderRow = {
  id: string;
  service_order_number: string;
  title: string;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  customer_name: string;
  address_short: string | null;
  technician_name: string | null;
};

export function TechnicianServiceOrderCard({ so }: { so: TechnicianOrderRow }) {
  const date = so.scheduled_date
    ? new Date(so.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")
    : null;
  const time = so.scheduled_start_time
    ? so.scheduled_start_time.slice(0, 5) +
      (so.scheduled_end_time ? ` — ${so.scheduled_end_time.slice(0, 5)}` : "")
    : null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">OS</div>
          <div className="font-bold truncate">#{so.service_order_number}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ServiceOrderStatusBadge status={so.status} />
          <ServiceOrderPriorityBadge priority={so.priority} />
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="font-semibold truncate">{so.customer_name}</div>
        {so.address_short && (
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{so.address_short}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />{date}
            </span>
          )}
          {time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />{time}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <User className="h-4 w-4" />{so.technician_name ?? "Técnico não definido"}
          </span>
        </div>
      </div>

      <Button asChild className="w-full h-11">
        <Link to="/service-orders/$id/mobile" params={{ id: so.id }}>
          Ver detalhes <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </Card>
  );
}
