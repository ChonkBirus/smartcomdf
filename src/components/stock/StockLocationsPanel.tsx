import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  listLocations,
  saveLocation,
  toggleLocation,
  type StockLocation,
} from "@/lib/stock.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import { Card } from "@/components/ui/card";
import { Plus, MapPin } from "lucide-react";
import { Can } from "@/components/app/PermissionRoute";

export function StockLocationsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listLocations);
  const save = useServerFn(saveLocation);
  const toggle = useServerFn(toggleLocation);
  const companyId = useCompanyId();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["stock_locations", companyId],
    queryFn: () => list(),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocation | null>(null);
  const [form, setForm] = useState({ name: "", description: "", active: true });

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", active: true });
    setOpen(true);
  }
  function openEdit(loc: StockLocation) {
    setEditing(loc);
    setForm({ name: loc.name, description: loc.description || "", active: loc.active });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: editing?.id,
          name: form.name,
          description: form.description,
          active: form.active,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Local atualizado." : "Local criado.");
      qc.invalidateQueries({ queryKey: ["stock_locations"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock_locations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Locais de Estoque</h3>
        <Can module="stock" action="create">
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Novo local
          </Button>
        </Can>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : locations.length === 0 ? (
        <Card className="card-elevated p-6 text-center text-sm text-muted-foreground">
          Nenhum local cadastrado. Crie o primeiro para começar a movimentar estoque.
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <Card key={l.id} className="card-elevated p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">{l.name}</p>
                    {l.description && (
                      <p className="text-xs text-muted-foreground">{l.description}</p>
                    )}
                  </div>
                </div>
                <Can module="stock" action="edit">
                  <Switch
                    checked={l.active}
                    onCheckedChange={(v) => toggleMut.mutate({ id: l.id, active: v })}
                  />
                </Can>
              </div>
              <div className="mt-2 flex justify-end">
                <Can module="stock" action="edit">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(l)}>
                    Editar
                  </Button>
                </Can>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar local" : "Novo local"}</SheetTitle>
            <SheetDescription>
              Defina locais como Estoque Principal, Veículos Técnicos, Filiais etc.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Nome*</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Estoque Principal"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Ativo</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMut.mutate()}
                disabled={!form.name.trim() || saveMut.isPending}
              >
                {saveMut.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
