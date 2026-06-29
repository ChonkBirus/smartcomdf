import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCompanyId } from "@/hooks/use-company-id";
import { Boxes, ArrowDownLeft, ArrowUpRight, RefreshCw, MoveRight, AlertTriangle, PackageX } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/app/KpiCard";
import { StockBalanceTable } from "@/components/stock/StockBalanceTable";
import { StockHistoryTable } from "@/components/stock/StockHistoryTable";
import { StockLocationsPanel } from "@/components/stock/StockLocationsPanel";
import { StockMovementDialog } from "@/components/stock/StockMovementDialog";
import { stockOverview } from "@/lib/stock.functions";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Estoque — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="stock">
      <FeatureGate feature="inventory">
        <StockPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

type Mode = "ENTRY" | "EXIT" | "ADJUSTMENT" | "TRANSFER";

function StockPage() {
  const [dialog, setDialog] = useState<Mode | null>(null);
  const companyId = useCompanyId();
  const overview = useServerFn(stockOverview);
  const { data } = useQuery({ queryKey: ["stock_overview", companyId], queryFn: () => overview(), enabled: !!companyId });


  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Estoque"
        description="Controle completo de movimentações, saldos e locais."
        actions={
          <>
            <Can module="stock" action="create">
              <Button size="sm" onClick={() => setDialog("ENTRY")}><ArrowDownLeft className="mr-1 h-4 w-4" />Entrada</Button>
            </Can>
            <Can module="stock" action="edit">
              <Button size="sm" variant="outline" onClick={() => setDialog("EXIT")}><ArrowUpRight className="mr-1 h-4 w-4" />Saída</Button>
            </Can>
            <Can module="stock" action="edit">
              <Button size="sm" variant="outline" onClick={() => setDialog("TRANSFER")}><MoveRight className="mr-1 h-4 w-4" />Transferir</Button>
            </Can>
            <Can module="stock" action="edit">
              <Button size="sm" variant="outline" onClick={() => setDialog("ADJUSTMENT")}><RefreshCw className="mr-1 h-4 w-4" />Ajuste</Button>
            </Can>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Sem estoque" value={String(data?.outOfStock ?? 0)} icon={<PackageX className="h-5 w-5" />} />
        <KpiCard title="Abaixo do mínimo" value={String(data?.lowStock ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiCard title="Últimas movimentações" value={String(data?.recent.length ?? 0)} icon={<Boxes className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="balances" className="mt-6">
        <TabsList>
          <TabsTrigger value="balances">Saldos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="locations">Locais</TabsTrigger>
        </TabsList>
        <TabsContent value="balances" className="mt-4"><StockBalanceTable /></TabsContent>
        <TabsContent value="history" className="mt-4"><StockHistoryTable /></TabsContent>
        <TabsContent value="locations" className="mt-4"><StockLocationsPanel /></TabsContent>
      </Tabs>

      {dialog && (
        <StockMovementDialog
          open={dialog !== null}
          onOpenChange={(v) => { if (!v) setDialog(null); }}
          mode={dialog}
        />
      )}
    </div>
  );
}
