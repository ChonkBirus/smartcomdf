import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  createMovement,
  listLocations,
  listStockItems,
  transferStock,
} from "@/lib/stock.functions";
import { useCompanyId } from "@/hooks/use-company-id";

type Mode = "ENTRY" | "EXIT" | "ADJUSTMENT" | "TRANSFER";

export function StockMovementDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
}) {
  const qc = useQueryClient();
  const listLocs = useServerFn(listLocations);
  const listItems = useServerFn(listStockItems);
  const create = useServerFn(createMovement);
  const transfer = useServerFn(transferStock);
  const companyId = useCompanyId();

  const { data: locations = [] } = useQuery({
    queryKey: ["stock_locations", companyId],
    queryFn: () => listLocs(),
    enabled: open && !!companyId,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["stock_items", companyId],
    queryFn: () => listItems(),
    enabled: open && !!companyId,
  });

  const [form, setForm] = useState({
    item_id: "",
    location_id: "",
    to_location: "",
    quantity: "",
    final_quantity: "",
    reason: "",
    notes: "",
  });

  function reset() {
    setForm({
      item_id: "",
      location_id: "",
      to_location: "",
      quantity: "",
      final_quantity: "",
      reason: "",
      notes: "",
    });
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.item_id || !form.location_id) throw new Error("Selecione item e local.");
      if (mode === "TRANSFER") {
        if (!form.to_location) throw new Error("Selecione o destino.");
        if (form.location_id === form.to_location)
          throw new Error("Origem e destino devem ser diferentes.");
        const qty = Number(form.quantity);
        if (!(qty > 0)) throw new Error("Quantidade inválida.");
        return transfer({
          data: {
            item_id: form.item_id,
            from_location: form.location_id,
            to_location: form.to_location,
            quantity: qty,
            notes: form.notes,
          },
        });
      }
      if (mode === "ADJUSTMENT") {
        const fq = Number(form.final_quantity);
        if (!(fq >= 0)) throw new Error("Quantidade final inválida.");
        return create({
          data: {
            item_id: form.item_id,
            location_id: form.location_id,
            movement_type: "ADJUSTMENT",
            final_quantity: fq,
            reason: form.reason,
            notes: form.notes,
          },
        });
      }
      const qty = Number(form.quantity);
      if (!(qty > 0)) throw new Error("Quantidade inválida.");
      return create({
        data: {
          item_id: form.item_id,
          location_id: form.location_id,
          movement_type: mode,
          quantity: qty,
          reason: form.reason,
          notes: form.notes,
        },
      });
    },
    onSuccess: () => {
      toast.success("Movimentação registrada.");
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["stock_balances"] });
      qc.invalidateQueries({ queryKey: ["stock_overview"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const titles: Record<Mode, string> = {
    ENTRY: "Entrada de estoque",
    EXIT: "Saída de estoque",
    ADJUSTMENT: "Ajuste de estoque",
    TRANSFER: "Transferência entre locais",
  };

  const activeLocs = locations.filter((l) => l.active);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>Apenas itens que controlam estoque são listados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Item*</Label>
            <Select
              value={form.item_id}
              onValueChange={(v) => setForm((f) => ({ ...f, item_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                    {i.sku ? ` — ${i.sku}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{mode === "TRANSFER" ? "Origem*" : "Local*"}</Label>
              <Select
                value={form.location_id}
                onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeLocs.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "TRANSFER" && (
              <div>
                <Label>Destino*</Label>
                <Select
                  value={form.to_location}
                  onValueChange={(v) => setForm((f) => ({ ...f, to_location: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLocs
                      .filter((l) => l.id !== form.location_id)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {mode === "ADJUSTMENT" ? (
              <div>
                <Label>Quantidade final*</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.final_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, final_quantity: e.target.value }))}
                />
              </div>
            ) : (
              <div>
                <Label>Quantidade*</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
            )}
          </div>

          {mode !== "TRANSFER" && (
            <div>
              <Label>Motivo</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Ex: Compra NFe 1234"
              />
            </div>
          )}
          <div>
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
