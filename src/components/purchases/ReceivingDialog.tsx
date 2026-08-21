import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getPurchaseOrder, receivePurchaseOrder } from "@/lib/purchases.functions";
import { listLocations } from "@/lib/stock.functions";
import { useCompanyId } from "@/hooks/use-company-id";

export function ReceivingDialog({
  open,
  onOpenChange,
  orderId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
}) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getPurchaseOrder);
  const fetchLocs = useServerFn(listLocations);
  const receive = useServerFn(receivePurchaseOrder);
  const companyId = useCompanyId();

  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const { data } = useQuery({
    queryKey: ["po", companyId, orderId],
    queryFn: () => fetchOne({ data: { id: orderId! } }),
    enabled: !!orderId && open && !!companyId,
  });
  const { data: locations } = useQuery({
    queryKey: ["stock_locations", companyId],
    queryFn: () => fetchLocs(),
    enabled: open && !!companyId,
  });

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, number> = {};
    for (const it of data.items) initial[it.id] = Math.max(0, it.quantity - it.received_quantity);
    setQtys(initial);
  }, [data]);

  const totalLines = useMemo(
    () => data?.items.filter((it) => (qtys[it.id] ?? 0) > 0).length ?? 0,
    [data, qtys],
  );

  const mutation = useMutation({
    mutationFn: () =>
      receive({
        data: {
          id: orderId!,
          location_id: locationId,
          notes,
          items: (data?.items ?? []).map((it) => ({ poi_id: it.id, quantity: qtys[it.id] ?? 0 })),
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.status === "RECEIVED"
          ? "Pedido totalmente recebido. Estoque atualizado."
          : "Recebimento parcial registrado.",
      );
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["po"] });
      qc.invalidateQueries({ queryKey: ["stock_overview"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao receber."),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) return toast.error("Selecione um local de estoque.");
    if (!totalLines) return toast.error("Informe a quantidade recebida de ao menos um item.");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receber pedido {data?.order.order_number ?? ""}</DialogTitle>
          <DialogDescription>
            Confirme as quantidades recebidas. A entrada no estoque é criada automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Local de estoque *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(locations ?? [])
                    .filter((l) => l.active)
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex: NF 12345"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Pedido</th>
                  <th className="px-3 py-2 text-right">Já recebido</th>
                  <th className="px-3 py-2 text-right">Pendente</th>
                  <th className="px-3 py-2 text-right">Receber agora</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((it) => {
                  const remaining = it.quantity - it.received_quantity;
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.item_name}</div>
                        {it.item_sku && (
                          <div className="text-xs text-muted-foreground">SKU: {it.item_sku}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right">{it.received_quantity}</td>
                      <td className="px-3 py-2 text-right font-medium">{remaining}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.001"
                          className="ml-auto w-24 text-right"
                          value={qtys[it.id] ?? 0}
                          onChange={(e) =>
                            setQtys((s) => ({
                              ...s,
                              [it.id]: Math.min(remaining, Math.max(0, Number(e.target.value))),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <Label>Notas do recebimento</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Processando..." : "Confirmar recebimento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
