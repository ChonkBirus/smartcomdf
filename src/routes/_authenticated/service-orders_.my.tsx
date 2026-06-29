import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Wrench } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listMyServiceOrders } from "@/lib/technician-service-orders.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import {
  TechnicianServiceOrderCard,
  type TechnicianOrderRow,
} from "@/components/service-orders/TechnicianServiceOrderCard";

export const Route = createFileRoute("/_authenticated/service-orders_/my")({
  head: () => ({ meta: [{ title: "Minhas Ordens de Serviço — SecureERP" }] }),
  component: () => (
    <FeatureGate feature="service_orders">
      <PermissionRoute module="service_orders">
        <MyServiceOrdersPage />
      </PermissionRoute>
    </FeatureGate>
  ),
});

type FilterKey = "ALL" | "TODAY" | "WEEK" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "Todas" },
  { key: "TODAY", label: "Hoje" },
  { key: "WEEK", label: "Esta semana" },
  { key: "SCHEDULED", label: "Agendadas" },
  { key: "IN_PROGRESS", label: "Em andamento" },
  { key: "PAUSED", label: "Pausadas" },
  { key: "COMPLETED", label: "Concluídas" },
  { key: "CANCELLED", label: "Canceladas" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function weekRangeISO() {
  const now = new Date();
  const day = now.getDay(); // 0 sun
  const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

function MyServiceOrdersPage() {
  const fetchFn = useServerFn(listMyServiceOrders);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");

  const params = useMemo(() => {
    const base: any = {};
    if (filter === "TODAY") { base.from = todayISO(); base.to = todayISO(); }
    else if (filter === "WEEK") { Object.assign(base, weekRangeISO()); }
    else if (filter === "SCHEDULED" || filter === "IN_PROGRESS" || filter === "PAUSED"
      || filter === "COMPLETED" || filter === "CANCELLED") {
      base.status = filter;
    }
    if (search.trim()) base.search = search.trim();
    return base;
  }, [filter, search]);

  const companyId = useCompanyId();
  const { data, isLoading } = useQuery({
    queryKey: ["my-service-orders", companyId, params],
    queryFn: () => fetchFn({ data: params }) as Promise<TechnicianOrderRow[]>,
    enabled: !!companyId,
  });

  const list = (data ?? []).filter((so) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      so.service_order_number.toLowerCase().includes(s) ||
      so.customer_name.toLowerCase().includes(s) ||
      (so.address_short ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      <PageHeader title="Minhas OS" description="Ordens de Serviço atribuídas a você." />

      <Card className="p-3 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente ou endereço"
            className="pl-8 h-11"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center">
          <Wrench className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma Ordem de Serviço encontrada.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((so) => <TechnicianServiceOrderCard key={so.id} so={so} />)}
        </div>
      )}
    </div>
  );
}
