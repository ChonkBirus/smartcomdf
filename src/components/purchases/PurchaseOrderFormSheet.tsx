import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { listSuppliers } from "@/lib/suppliers.functions";
import { listStockItems } from "@/lib/stock.functions";
import { getPurchaseOrder, savePurchaseOrder } from "@/lib/purchases.functions";
import { useCompanyId } from "@/hooks/use-company-id";

type Line = { id?: string; item_id: string; quantity: number; unit_cost: number };

export function PurchaseOrderFormSheet({
  open, onOpenChange, orderId,
}: { open: boolean; onOpenChange: (o: boolean) => void; orderId: string | null }) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getPurchaseOrder);
  const save = useServerFn(savePurchaseOrder);
  const fetchSuppliers = useServerFn(listSuppliers);
  const fetchItems = useServerFn(listStockItems);

  const [supplierId, setSupplierId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "active"],
    queryFn: () => fetchSuppliers({ data: { active: true } }),
    enabled: open,
  });
  const { data: items } = useQuery({
    queryKey: ["stock_items"],
    queryFn: () => fetchItems(),
    enabled: open,
  });
  const { data: existing } = useQuery({
    queryKey: ["po", orderId],
    queryFn: () => fetchOne({ data: { id: orderId! } }),
    enabled: !!orderId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (orderId && existing) {
      setSupplierId(existing.order.supplier_id);
      setIssueDate(existing.order.issue_date.slice(0, 10));
      setExpectedDate(existing.order.expected_delivery_date?.slice(0, 10) ?? "");
      setNotes(existing.order.notes ?? "");
      setLines(existing.items.map((it) => ({
        id: it.id, item_id: it.item_id, quantity: it.quantity, unit_cost: it.unit_cost,
      })));
    } else if (!orderId) {
      setSupplierId(""); setIssueDate(new Date().toISOString().slice(0, 10));
      setExpectedDate(""); setNotes(""); setLines([]);
    }
  }, [open, orderId, existing]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0), [lines]);

  const mutation = useMutation({
    mutationFn: () => save({
      data: {
        id: orderId ?? undefined,
        supplier_id: supplierId,
        issue_date: issueDate,
        expected_delivery_date: expectedDate || undefined,
        notes,
        items: lines.map((l) => ({
          id: l.id, item_id: l.item_id, quantity: l.quantity, unit_cost: l.unit_cost,
        })),
      } as any,
    }),
    onSuccess: () => {
      toast.success(orderId ? "Pedido atualizado." : "Pedido criado.");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["po"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  function addLine() { setLines((s) => [...s, { item_id: "", quantity: 1, unit_cost: 0 }]); }
  function setLine(i: number, patch: Partial<Line>) {
    setLines((s) => s.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function removeLine(i: number) { setLines((s) => s.filter((_, idx) => idx !== i)); }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) return toast.error("Selecione um fornecedor.");
    if (!lines.length) return toast.error("Adicione pelo menos um item.");
    if (lines.some((l) => !l.item_id || l.quantity <= 0 || l.unit_cost < 0)) {
      return toast.error("Verifique os itens (item, quantidade e custo).");
    }
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{orderId ? "Editar pedido" : "Novo pedido de compra"}</SheetTitle>
          <SheetDescription>Selecione fornecedor e itens. O total é calculado automaticamente.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Fornecedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(suppliers ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.trade_name || s.corporate_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de emissão *</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </div>
            <div>
              <Label>Previsão de entrega</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens</h3>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" />Adicionar
              </Button>
            </div>

            {lines.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhum item adicionado.
              </p>
            )}

            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 rounded-md border p-2">
                <div className="col-span-12 sm:col-span-6">
                  <Label className="text-xs">Item</Label>
                  <Select value={l.item_id} onValueChange={(v) => setLine(i, { item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(items ?? []).map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name}{it.sku ? ` (${it.sku})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">Qtd</Label>
                  <Input type="number" min="0" step="0.001" value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-xs">Custo unit.</Label>
                  <Input type="number" min="0" step="0.01" value={l.unit_cost}
                    onChange={(e) => setLine(i, { unit_cost: Number(e.target.value) })} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="col-span-12 text-right text-xs text-muted-foreground">
                  Subtotal: {(l.quantity * l.unit_cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm font-semibold">
              <span>Total do pedido</span>
              <span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
          </div>

          <Separator />
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
