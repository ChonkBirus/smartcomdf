import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { listBalances, listLocations } from "@/lib/stock.functions";
import { useCompanyId } from "@/hooks/use-company-id";

export function StockBalanceTable() {
  const listBal = useServerFn(listBalances);
  const listLocs = useServerFn(listLocations);
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: locations = [] } = useQuery({
    queryKey: ["stock_locations", companyId],
    queryFn: () => listLocs(),
    enabled: !!companyId,
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stock_balances", companyId, location, search],
    queryFn: () =>
      listBal({ data: { location_id: location !== "all" ? location : undefined, search } }),
    enabled: !!companyId,
  });

  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar item ou SKU…"
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="OK">Normal</SelectItem>
            <SelectItem value="LOW">Baixo estoque</SelectItem>
            <SelectItem value="OUT">Sem estoque</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum saldo encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={`${r.item_id}:${r.location_id}`}>
                  <TableCell className="font-medium">{r.item_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.item_sku || "—"}</TableCell>
                  <TableCell>{r.location_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.quantity} {r.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.minimum_stock ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.status === "OUT" && <Badge variant="destructive">Sem estoque</Badge>}
                    {r.status === "LOW" && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15">
                        Baixo
                      </Badge>
                    )}
                    {r.status === "OK" && <Badge variant="secondary">Normal</Badge>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
