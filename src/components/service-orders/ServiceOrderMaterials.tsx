import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listMaterialUsage,
  listPlannedStockItems,
  listStockableProducts,
  listStockLocations,
  checkStockAvailability,
  addMaterialUsage,
  updateMaterialUsage,
  type PlannedItem,
  type MaterialUsage,
  type StockableProduct,
} from "@/lib/service-order-materials.functions";

type Status = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

export function ServiceOrderMaterials({
  serviceOrderId,
  status,
  canManage,
}: {
  serviceOrderId: string;
  status: Status;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const usageFn = useServerFn(listMaterialUsage);
  const plannedFn = useServerFn(listPlannedStockItems);

  const { data: usage = [] } = useQuery({
    queryKey: ["so-mat-usage", serviceOrderId],
    queryFn: () => usageFn({ data: { id: serviceOrderId } }),
  });
  const { data: planned = [] } = useQuery({
    queryKey: ["so-planned-items", serviceOrderId],
    queryFn: () => plannedFn({ data: { id: serviceOrderId } }),
  });

  const editable = canManage && (status === "IN_PROGRESS" || status === "PAUSED");

  const usageByPlanned = useMemo(() => {
    const map = new Map<string, MaterialUsage[]>();
    usage.forEach((u) => {
      if (!u.service_order_item_id) return;
      const arr = map.get(u.service_order_item_id) ?? [];
      arr.push(u);
      map.set(u.service_order_item_id, arr);
    });
    return map;
  }, [usage]);

  const extras = useMemo(() => usage.filter((u) => !u.service_order_item_id), [usage]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["so-mat-usage", serviceOrderId] });
    qc.invalidateQueries({ queryKey: ["so-exec-logs", serviceOrderId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="space-y-4">
      {planned.length === 0 && extras.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum produto com controle de estoque previsto. Use o botão abaixo para adicionar
          material extra.
        </p>
      ) : (
        <ul className="space-y-2">
          {planned.map((p) => (
            <PlannedRow
              key={p.id}
              planned={p}
              usages={usageByPlanned.get(p.id) ?? []}
              serviceOrderId={serviceOrderId}
              editable={editable}
              onChange={invalidate}
            />
          ))}
          {extras.length > 0 && (
            <li className="pt-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Materiais extras
              </div>
              <ul className="space-y-2">
                {extras.map((u) => (
                  <ExtraRow key={u.id} usage={u} editable={editable} onChange={invalidate} />
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}

      {editable && <ExtraMaterialDialog serviceOrderId={serviceOrderId} onAdded={invalidate} />}
    </div>
  );
}

function PlannedRow({
  planned,
  usages,
  serviceOrderId,
  editable,
  onChange,
}: {
  planned: PlannedItem;
  usages: MaterialUsage[];
  serviceOrderId: string;
  editable: boolean;
  onChange: () => void;
}) {
  const totalUsed = usages.reduce((s, u) => s + Number(u.used_quantity), 0);
  const warn = usages.some((u) => u.stock_warning);

  return (
    <li className="rounded-md border p-3">
      <div className="flex gap-3">
        {planned.image_url ? (
          <img
            src={planned.image_url}
            alt={planned.name}
            className="h-12 w-12 rounded object-cover bg-muted shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded bg-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{planned.name}</span>
            {warn && <StockWarningBadge />}
          </div>
          <div className="text-xs text-muted-foreground">
            Previsto: {planned.planned_quantity} {planned.unit} · Utilizado: {totalUsed}{" "}
            {planned.unit}
          </div>
        </div>
      </div>

      {usages.length > 0 && (
        <ul className="mt-2 space-y-1">
          {usages.map((u) => (
            <UsageInlineRow key={u.id} usage={u} editable={editable} onChange={onChange} />
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-2">
          <UsageDialog
            mode="add"
            serviceOrderId={serviceOrderId}
            plannedItem={planned}
            onSaved={onChange}
          />
        </div>
      )}
    </li>
  );
}

function ExtraRow({
  usage,
  editable,
  onChange,
}: {
  usage: MaterialUsage;
  editable: boolean;
  onChange: () => void;
}) {
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium">{usage.item_name ?? "Produto"}</div>
          <div className="text-xs text-muted-foreground">
            {usage.used_quantity} {usage.unit ?? ""} · {usage.location_name ?? "—"}
          </div>
          {usage.notes && <div className="text-xs italic text-muted-foreground">{usage.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          {usage.stock_warning && <StockWarningBadge />}
          {editable && <UsageDialog mode="edit" usage={usage} onSaved={onChange} />}
        </div>
      </div>
    </li>
  );
}

function UsageInlineRow({
  usage,
  editable,
  onChange,
}: {
  usage: MaterialUsage;
  editable: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
      <span>
        {usage.used_quantity} {usage.unit ?? ""} · {usage.location_name ?? "—"}
        {usage.stock_warning && (
          <>
            {" "}
            · <span className="text-amber-700">acima do saldo</span>
          </>
        )}
      </span>
      {editable && <UsageDialog mode="edit" usage={usage} onSaved={onChange} small />}
    </div>
  );
}

export function StockWarningBadge() {
  return (
    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
      <AlertTriangle className="h-3 w-3 mr-1" /> Saldo insuficiente
    </Badge>
  );
}

function UsageDialog({
  mode,
  serviceOrderId,
  plannedItem,
  usage,
  onSaved,
  small,
}: {
  mode: "add" | "edit";
  serviceOrderId?: string;
  plannedItem?: PlannedItem;
  usage?: MaterialUsage;
  onSaved: () => void;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>(
    usage ? String(usage.used_quantity) : plannedItem ? String(plannedItem.planned_quantity) : "",
  );
  const [locationId, setLocationId] = useState<string>(usage?.stock_location_id ?? "");
  const [notes, setNotes] = useState(usage?.notes ?? "");

  const locFn = useServerFn(listStockLocations);
  const stockFn = useServerFn(checkStockAvailability);
  const addFn = useServerFn(addMaterialUsage);
  const updateFn = useServerFn(updateMaterialUsage);

  const { data: locations = [] } = useQuery({
    queryKey: ["stock-locations"],
    queryFn: () => locFn({}),
    enabled: open,
  });

  const itemId = usage?.item_id ?? plannedItem?.item_id ?? null;

  const { data: balance } = useQuery({
    queryKey: ["so-stock", itemId, locationId],
    queryFn: () => stockFn({ data: { itemId: itemId!, locationId } }),
    enabled: open && !!itemId && !!locationId,
  });

  const qty = Number(quantity || 0);
  const willWarn = balance !== undefined && qty > Number(balance);

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "add") {
        if (!plannedItem || !plannedItem.item_id || !serviceOrderId)
          throw new Error("Dados inválidos");
        return addFn({
          data: {
            serviceOrderId,
            itemId: plannedItem.item_id,
            serviceOrderItemId: plannedItem.id,
            usedQuantity: qty,
            locationId,
            notes: notes.trim() || undefined,
          },
        });
      }
      if (!usage) throw new Error("Dados inválidos");
      return updateFn({
        data: {
          id: usage.id,
          usedQuantity: qty,
          locationId: locationId || undefined,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      onSaved();
      setOpen(false);
      toast.success("Material registrado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const submit = () => {
    if (qty <= 0) {
      toast.error("Quantidade deve ser maior que zero.");
      return;
    }
    if (!locationId) {
      toast.error("Selecione o local de estoque.");
      return;
    }
    save.mutate();
  };

  return (
    <>
      <Button
        size={small ? "sm" : "sm"}
        variant={mode === "add" ? "default" : "outline"}
        className={small ? "h-7 px-2 text-xs" : ""}
        onClick={() => setOpen(true)}
      >
        {mode === "add" ? "Registrar utilização" : "Editar"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "add"
                ? `Registrar uso — ${plannedItem?.name}`
                : `Editar ${usage?.item_name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label>Local de estoque *</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {locationId && itemId && (
              <p
                className={`text-xs ${willWarn ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
              >
                Saldo disponível: {balance ?? "—"}
                {willWarn && " — quantidade utilizada maior que o saldo (será salvo com alerta)."}
              </p>
            )}
            <div>
              <Label>Observação</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExtraMaterialDialog({
  serviceOrderId,
  onAdded,
}: {
  serviceOrderId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StockableProduct | null>(null);
  const [quantity, setQuantity] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");

  const prodFn = useServerFn(listStockableProducts);
  const locFn = useServerFn(listStockLocations);
  const stockFn = useServerFn(checkStockAvailability);
  const addFn = useServerFn(addMaterialUsage);

  const { data: products = [] } = useQuery({
    queryKey: ["stockable-products", search],
    queryFn: () => prodFn({ data: { search: search || undefined } }),
    enabled: open,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["stock-locations"],
    queryFn: () => locFn({}),
    enabled: open,
  });
  const { data: balance } = useQuery({
    queryKey: ["so-stock", selected?.id, locationId],
    queryFn: () => stockFn({ data: { itemId: selected!.id, locationId } }),
    enabled: open && !!selected && !!locationId,
  });

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setQuantity("");
      setLocationId("");
      setNotes("");
      setSearch("");
    }
  }, [open]);

  const qty = Number(quantity || 0);

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          serviceOrderId,
          itemId: selected!.id,
          usedQuantity: qty,
          locationId,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      onAdded();
      setOpen(false);
      toast.success("Material extra registrado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar"),
  });

  const submit = () => {
    if (!selected) {
      toast.error("Selecione o produto.");
      return;
    }
    if (qty <= 0) {
      toast.error("Quantidade deve ser maior que zero.");
      return;
    }
    if (!locationId) {
      toast.error("Selecione o local de estoque.");
      return;
    }
    add.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar material extra
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar material extra</DialogTitle>
          <DialogDescription>
            Registre um produto utilizado que não estava previsto na OS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Produto *</Label>
            <Input
              placeholder="Buscar produto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-auto mt-1 rounded border">
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Nenhum produto encontrado.</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`block w-full text-left text-sm px-2 py-1.5 hover:bg-muted ${selected?.id === p.id ? "bg-muted" : ""}`}
                    onClick={() => setSelected(p)}
                  >
                    {p.name}{" "}
                    {p.sku && <span className="text-xs text-muted-foreground">· {p.sku}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label>Local de estoque *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selected && locationId && (
            <p
              className={`text-xs ${balance !== undefined && qty > Number(balance) ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
            >
              Saldo disponível: {balance ?? "—"}
              {balance !== undefined &&
                qty > Number(balance) &&
                " — acima do saldo (será salvo com alerta)."}
            </p>
          )}
          <div>
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={add.isPending}>
            {add.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
