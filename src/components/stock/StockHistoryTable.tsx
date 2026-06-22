import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLocations, listMovements, type MovementType } from "@/lib/stock.functions";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, MoveRight, MoveLeft } from "lucide-react";

const TYPE_META: Record<MovementType, { label: string; icon: any; cls: string }> = {
  ENTRY: { label: "Entrada", icon: ArrowDownLeft, cls: "text-emerald-600" },
  EXIT: { label: "Saída", icon: ArrowUpRight, cls: "text-rose-600" },
  ADJUSTMENT: { label: "Ajuste", icon: RefreshCw, cls: "text-amber-600" },
  TRANSFER_IN: { label: "Transf. ↓", icon: MoveLeft, cls: "text-blue-600" },
  TRANSFER_OUT: { label: "Transf. ↑", icon: MoveRight, cls: "text-blue-600" },
};

export function StockHistoryTable() {
  const listMov = useServerFn(listMovements);
  const listLocs = useServerFn(listLocations);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [location, setLocation] = useState<string>("all");

  const { data: locations = [] } = useQuery({ queryKey: ["stock_locations"], queryFn: () => listLocs() });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stock_movements", type, location, search],
    queryFn: () => listMov({
      data: {
        movement_type: type !== "all" ? (type as MovementType) : undefined,
        location_id: location !== "all" ? location : undefined,
        search,
        limit: 200,
      },
    }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar item ou SKU…" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="ENTRY">Entrada</SelectItem>
            <SelectItem value="EXIT">Saída</SelectItem>
            <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
            <SelectItem value="TRANSFER_IN">Transferência (entrada)</SelectItem>
            <SelectItem value="TRANSFER_OUT">Transferência (saída)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Anterior</TableHead>
              <TableHead className="text-right">Atual</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhuma movimentação encontrada.</TableCell></TableRow>
            ) : rows.map((r) => {
              const m = TYPE_META[r.movement_type];
              const Icon = m.icon;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><div className="font-medium">{r.item_name}</div>{r.item_sku && <div className="text-xs text-muted-foreground">{r.item_sku}</div>}</TableCell>
                  <TableCell><Badge variant="secondary" className="gap-1"><Icon className={`h-3 w-3 ${m.cls}`} />{m.label}</Badge></TableCell>
                  <TableCell>{r.location_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.previous_balance}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{r.new_balance}</TableCell>
                  <TableCell className="text-xs">{r.user_name || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
