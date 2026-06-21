import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Power, PowerOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  listCategories,
  saveCategory,
  toggleCategoryActive,
  listBrands,
  saveBrand,
  toggleBrandActive,
  listManufacturers,
  saveManufacturer,
  toggleManufacturerActive,
} from "@/lib/products.functions";
import { usePermissions } from "@/lib/permissions";

type Tab = "categories" | "brands" | "manufacturers";

export function TaxonomyDialog({
  open,
  onOpenChange,
  initialTab = "categories",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cadastros auxiliares</DialogTitle>
          <DialogDescription>Gerencie categorias, marcas e fabricantes utilizados pelos produtos.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="brands">Marcas</TabsTrigger>
            <TabsTrigger value="manufacturers">Fabricantes</TabsTrigger>
          </TabsList>
          <TabsContent value="categories" className="mt-4">
            <CategoriesPanel />
          </TabsContent>
          <TabsContent value="brands" className="mt-4">
            <BrandsPanel />
          </TabsContent>
          <TabsContent value="manufacturers" className="mt-4">
            <ManufacturersPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============== CATEGORIES ==============
function CategoriesPanel() {
  const { canCreate, canEdit } = usePermissions();
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const saveFn = useServerFn(saveCategory);
  const toggleFn = useServerFn(toggleCategoryActive);
  const { data: items = [] } = useQuery({ queryKey: ["categories"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    description?: string;
    category_type: "PRODUCT" | "SERVICE" | "BOTH";
    active: boolean;
  } | null>(null);

  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditing(null);
      toast.success("Categoria salva.");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate("products") && (
          <Button
            size="sm"
            onClick={() => setEditing({ name: "", description: "", category_type: "BOTH", active: true })}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova categoria
          </Button>
        )}
      </div>

      {editing && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome*</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Aplica-se a</Label>
              <Select
                value={editing.category_type}
                onValueChange={(v) => setEditing({ ...editing, category_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">Apenas produtos</SelectItem>
                  <SelectItem value="SERVICE">Apenas serviços</SelectItem>
                  <SelectItem value="BOTH">Produtos e serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!editing.name.trim() || save.isPending} onClick={() => save.mutate(editing)}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[40vh] overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            )}
            {items.map((c: any) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.description ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex justify-center gap-1">
                    {canEdit("products") && (
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...c })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit("products") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                      >
                        {c.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== BRANDS ==============
function BrandsPanel() {
  const { canCreate, canEdit } = usePermissions();
  const qc = useQueryClient();
  const listFn = useServerFn(listBrands);
  const saveFn = useServerFn(saveBrand);
  const toggleFn = useServerFn(toggleBrandActive);
  const { data: items = [] } = useQuery({ queryKey: ["brands"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<{ id?: string; name: string; description?: string; active: boolean } | null>(
    null,
  );

  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditing(null);
      toast.success("Marca salva.");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate("products") && (
          <Button size="sm" onClick={() => setEditing({ name: "", description: "", active: true })}>
            <Plus className="mr-1 h-4 w-4" /> Nova marca
          </Button>
        )}
      </div>
      {editing && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome*</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              <Label>Ativa</Label>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!editing.name.trim() || save.isPending} onClick={() => save.mutate(editing)}>
              Salvar
            </Button>
          </div>
        </div>
      )}
      <div className="max-h-[40vh] overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nenhuma marca cadastrada.
                </td>
              </tr>
            )}
            {items.map((b: any) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{b.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{b.description ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Ativa" : "Inativa"}</Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex justify-center gap-1">
                    {canEdit("products") && (
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...b })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit("products") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggle.mutate({ id: b.id, active: !b.active })}
                      >
                        {b.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== MANUFACTURERS ==============
function ManufacturersPanel() {
  const { canCreate, canEdit } = usePermissions();
  const qc = useQueryClient();
  const listFn = useServerFn(listManufacturers);
  const saveFn = useServerFn(saveManufacturer);
  const toggleFn = useServerFn(toggleManufacturerActive);
  const { data: items = [] } = useQuery({ queryKey: ["manufacturers"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manufacturers"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditing(null);
      toast.success("Fabricante salvo.");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manufacturers"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate("products") && (
          <Button
            size="sm"
            onClick={() => setEditing({ name: "", website: "", phone: "", email: "", active: true })}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo fabricante
          </Button>
        )}
      </div>
      {editing && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome*</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                value={editing.website ?? ""}
                onChange={(e) => setEditing({ ...editing, website: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editing.email ?? ""}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!editing.name?.trim() || save.isPending} onClick={() => save.mutate(editing)}>
              Salvar
            </Button>
          </div>
        </div>
      )}
      <div className="max-h-[40vh] overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Contato</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nenhum fabricante cadastrado.
                </td>
              </tr>
            )}
            {items.map((m: any) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[m.email, m.phone, m.website].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex justify-center gap-1">
                    {canEdit("products") && (
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...m })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit("products") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggle.mutate({ id: m.id, active: !m.active })}
                      >
                        {m.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
