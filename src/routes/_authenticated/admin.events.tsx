import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminListSubscriptionEventsGlobal } from "@/lib/billing-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/events")({
  component: AdminEventsPage,
});

const EVENT_TYPES = [
  "TRIAL_STARTED",
  "TRIAL_EXTENDED",
  "ACTIVATED",
  "PLAN_CHANGED",
  "CYCLE_CHANGED",
  "STATUS_OVERRIDE",
  "SUSPENDED",
  "REACTIVATED",
  "CANCELED",
  "EXPIRED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
];

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function AdminEventsPage() {
  const fn = useServerFn(adminListSubscriptionEventsGlobal);
  const [eventType, setEventType] = useState("ALL");

  const filters = useMemo(
    () => ({ event_type: eventType === "ALL" ? null : eventType }),
    [eventType],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscription-events-global", filters],
    queryFn: () => fn({ data: filters }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum evento encontrado.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDate(e.created_at)}
                </TableCell>
                <TableCell className="font-medium">{e.company_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{e.event_type}</Badge>
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {e.previous_status ?? "—"} → {e.new_status ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[420px]">
                  {e.description ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
