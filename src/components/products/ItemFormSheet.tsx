import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerItemImage } from "@/lib/products.functions";

import { Package, Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LabelWithHelp } from "@/components/ui/FieldHelp";
import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getItem,
  listBrands,
  listCategories,
  listManufacturers,
  saveItem,
  type ItemType,
  type ProductUnit,
} from "@/lib/products.functions";
import { ImageUploader, type ItemImage } from "./ImageUploader";
import { ProductPricingSuggestion } from "./ProductPricingSuggestion";
import { getItemFieldCopy } from "./itemFieldHelp";

const UNITS: { value: ProductUnit; label: string }[] = [
  { value: "UN", label: "UN — Unidade" },
  { value: "CX", label: "CX — Caixa" },
  { value: "MT", label: "MT — Metro" },
  { value: "M2", label: "M² — Metro Quadrado" },
  { value: "M3", label: "M³ — Metro Cúbico" },
  { value: "RL", label: "RL — Rolo" },
  { value: "KIT", label: "KIT — Kit" },
];

type FormState = {
  id?: string;
  item_type: ItemType;
  name: string;
  description: string;
  sku: string;
  barcode: string;
  category_id: string;
  brand_id: string;
  manufacturer_id: string;
  unit: ProductUnit;
  cost_price: string;
  sale_price: string;
  controls_stock: boolean;
  minimum_stock: string;
  active: boolean;
};

const EMPTY: FormState = {
  item_type: "PRODUCT",
  name: "",
  description: "",
  sku: "",
  barcode: "",
  category_id: "",
  brand_id: "",
  manufacturer_id: "",
  unit: "UN",
  cost_price: "0",
  sale_price: "0",
  controls_stock: true,
  minimum_stock: "0",
  active: true,
};

export function ItemFormSheet({
  open,
  onOpenChange,
  itemId,
  companyId,
  defaultType = "PRODUCT",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemId: string | null;
  companyId: string | null;
  defaultType?: ItemType;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getItem);
  const saveFn = useServerFn(saveItem);
  const catFn = useServerFn(listCategories);
  const brandFn = useServerFn(listBrands);
  const manFn = useServerFn(listManufacturers);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => catFn(), enabled: open });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => brandFn(), enabled: open });
  const { data: manufacturers = [] } = useQuery({
    queryKey: ["manufacturers"],
    queryFn: () => manFn(),
    enabled: open,
  });
  const { data: item, isFetching } = useQuery({
    queryKey: ["items", "detail", itemId],
    queryFn: () => getFn({ data: { id: itemId! } }),
    enabled: open && !!itemId,
  });

  const [form, setForm] = useState<FormState>({ ...EMPTY, item_type: defaultType });
  const [images, setImages] = useState<ItemImage[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const pendingInputRef = useRef<HTMLInputElement>(null);
  const registerImgFn = useServerFn(registerItemImage);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  useEffect(() => {
    if (!open) return;
    if (itemId && item) {
      const i = item as any;
      setForm({
        id: i.id,
        item_type: (i.item_type ?? "PRODUCT") as ItemType,
        name: i.name ?? "",
        description: i.description ?? "",
        sku: i.sku ?? "",
        barcode: i.barcode ?? "",
        category_id: i.category_id ?? "",
        brand_id: i.brand_id ?? "",
        manufacturer_id: i.manufacturer_id ?? "",
        unit: (i.unit ?? "UN") as ProductUnit,
        cost_price: String(i.cost_price ?? 0),
        sale_price: String(i.sale_price ?? 0),
        controls_stock: i.controls_stock ?? true,
        minimum_stock: String(i.minimum_stock ?? 0),
        active: !!i.active,
      });
      setImages((i.images ?? []) as ItemImage[]);
    } else if (!itemId) {
      setForm({ ...EMPTY, item_type: defaultType });
      setImages([]);
      setPendingFile(null);
      setPendingPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open, itemId, item, defaultType]);


  const isService = form.item_type === "SERVICE";

  const save = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: async (savedRaw: any) => {
      // Se havia arquivo pendente (fluxo de novo produto), faz upload agora
      if (pendingFile && !isService) {
        const saved = savedRaw as { id?: string; company_id?: string } | null;
        const newId = saved?.id ?? form.id;
        const companyId = saved?.company_id;
        if (newId && companyId) {
          try {
            const ext = (pendingFile.name.split(".").pop() || "jpg").toLowerCase();
            const path = `${companyId}/${newId}/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("product-images")
              .upload(path, pendingFile, {
                contentType: pendingFile.type,
                upsert: false,
              });
            if (upErr) throw upErr;
            await registerImgFn({
              data: { item_id: newId, file_path: path, is_primary: true },
            });
          } catch (err: any) {
            toast.error("Item salvo, mas a imagem não pôde ser enviada: " + (err?.message ?? ""));
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(isService ? "Serviço salvo com sucesso." : "Produto salvo com sucesso.");
      setPendingFile(null);
      setPendingPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar."),
  });

  function handlePendingFile(f: File | null) {
    if (!f) {
      setPendingFile(null);
      setPendingPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(f.type)) {
      toast.error("Tipo de arquivo não suportado (use JPG, PNG ou WEBP).");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Imagem excede 5 MB.");
      return;
    }
    setPendingFile(f);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }


  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Informe o nome.");
    if (!form.category_id) return toast.error("Selecione uma categoria.");
    save.mutate({
      id: form.id,
      item_type: form.item_type,
      name: form.name.trim(),
      description: form.description.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category_id: form.category_id,
      brand_id: form.brand_id || undefined,
      manufacturer_id: form.manufacturer_id || undefined,
      unit: form.unit,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      controls_stock: isService ? false : form.controls_stock,
      minimum_stock: Number(form.minimum_stock) || 0,
      active: form.active,
    });
  };

  const filteredCategories = (categories as any[]).filter(
    (c) =>
      c.active || c.id === form.category_id
        ? isService
          ? c.category_type === "SERVICE" || c.category_type === "BOTH"
          : c.category_type === "PRODUCT" || c.category_type === "BOTH"
        : false,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {itemId ? (isService ? "Editar serviço" : "Editar produto") : isService ? "Novo serviço" : "Novo produto"}
          </SheetTitle>
          <SheetDescription>
            {isService
              ? "Cadastre serviços oferecidos pela sua empresa (instalação, manutenção, consultoria...)."
              : "Cadastre produtos do seu catálogo (câmeras, alarmes, cabos...)."}
          </SheetDescription>
        </SheetHeader>

        {isFetching && itemId ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando item...</div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-6 pb-8">
            {/* Type selector */}
            <Section title="Tipo">
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                <TypeCard
                  active={form.item_type === "PRODUCT"}
                  onClick={() =>
                    setForm({ ...form, item_type: "PRODUCT", controls_stock: true, category_id: "" })
                  }
                  icon={<Package className="h-5 w-5" />}
                  title="Produto"
                  description="Item físico, controla estoque"
                  disabled={!!itemId}
                />
                <TypeCard
                  active={form.item_type === "SERVICE"}
                  onClick={() =>
                    setForm({
                      ...form,
                      item_type: "SERVICE",
                      controls_stock: false,
                      barcode: "",
                      manufacturer_id: "",
                      minimum_stock: "0",
                      category_id: "",
                    })
                  }
                  icon={<Wrench className="h-5 w-5" />}
                  title="Serviço"
                  description="Serviço prestado, não controla estoque"
                  disabled={!!itemId}
                />
              </div>
              {itemId && (
                <p className="md:col-span-2 -mt-2 text-micro text-muted-foreground">
                  O tipo não pode ser alterado após a criação.
                </p>
              )}
            </Section>

            <Section title="Informações gerais">
              {(() => {
                const c = getItemFieldCopy(form.item_type, "name");
                return (
                  <Field label={c.label} className="md:col-span-2" help={c.help}>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
                  </Field>
                );
              })()}
              {(() => {
                const c = getItemFieldCopy(form.item_type, "description");
                return (
                  <Field label={c.label} className="md:col-span-2" help={c.help}>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </Field>
                );
              })()}
            </Section>

            <Section title="Identificação">
              {(() => {
                const c = getItemFieldCopy(form.item_type, "sku");
                return (
                  <Field label={c.label} help={c.help}>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={80} />
                  </Field>
                );
              })()}
              {!isService && (() => {
                const c = getItemFieldCopy(form.item_type, "barcode");
                return (
                  <Field label={c.label} help={c.help}>
                    <Input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      maxLength={80}
                    />
                  </Field>
                );
              })()}
            </Section>

            <Section title="Classificação">
              {(() => {
                const c = getItemFieldCopy(form.item_type, "category");
                return (
                  <Field label={c.label} help={c.help}>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.length === 0 && (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            Nenhuma categoria de {isService ? "serviço" : "produto"} cadastrada.
                          </div>
                        )}
                        {filteredCategories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              })()}
              {(() => {
                const c = getItemFieldCopy(form.item_type, "brand");
                return (
                  <Field label={c.label} help={c.help}>
                    <Select
                      value={form.brand_id || "_none"}
                      onValueChange={(v) => setForm({ ...form, brand_id: v === "_none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Nenhuma —</SelectItem>
                        {(brands as any[])
                          .filter((b: any) => b.active || b.id === form.brand_id)
                          .map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              })()}
              {!isService && (() => {
                const c = getItemFieldCopy(form.item_type, "manufacturer");
                return (
                  <Field label={c.label} className="md:col-span-2" help={c.help}>
                    <Select
                      value={form.manufacturer_id || "_none"}
                      onValueChange={(v) => setForm({ ...form, manufacturer_id: v === "_none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Nenhum —</SelectItem>
                        {(manufacturers as any[])
                          .filter((m: any) => m.active || m.id === form.manufacturer_id)
                          .map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              })()}
            </Section>

            <Section title="Comercial">
              {(() => {
                const c = getItemFieldCopy(form.item_type, "cost_price");
                return (
                  <Field label={c.label} help={c.help}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.cost_price}
                      onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    />
                  </Field>
                );
              })()}
              {(() => {
                const c = getItemFieldCopy(form.item_type, "sale_price");
                return (
                  <Field label={c.label} help={c.help}>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.sale_price}
                        onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                      />
                      <ProductPricingSuggestion
                        costPrice={form.cost_price}
                        onApply={(price) => setForm({ ...form, sale_price: String(price) })}
                      />
                    </div>
                  </Field>
                );
              })()}
              {(() => {
                const c = getItemFieldCopy(form.item_type, "unit");
                return (
                  <Field label={c.label} help={c.help}>
                    <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v as ProductUnit })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              })()}
            </Section>

            {!isService && (
              <Section title="Controle de estoque">
                <div className="flex items-center gap-3 md:col-span-2">
                  <Switch
                    checked={form.controls_stock}
                    onCheckedChange={(v) => setForm({ ...form, controls_stock: v })}
                  />
                  <Label className="cursor-pointer" onClick={() => setForm({ ...form, controls_stock: !form.controls_stock })}>
                    Controlar estoque deste produto
                  </Label>
                </div>
                {form.controls_stock && (() => {
                  const c = getItemFieldCopy(form.item_type, "minimum_stock");
                  return (
                    <Field label={c.label} help={c.help}>
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        value={form.minimum_stock}
                        onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
                      />
                    </Field>
                  );
                })()}
              </Section>
            )}

            <Section title="Imagens">
              {itemId && companyId ? (
                <div className="md:col-span-2">
                  <ImageUploader itemId={itemId} companyId={companyId} images={images} onChange={setImages} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground md:col-span-2">Salve o item para enviar imagens.</p>
              )}
            </Section>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label className="cursor-pointer" onClick={() => setForm({ ...form, active: !form.active })}>
                  {isService ? "Serviço ativo" : "Produto ativo"}
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : itemId ? "Salvar alterações" : "Cadastrar"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TypeCard({
  active,
  onClick,
  icon,
  title,
  description,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-foreground/30",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  help,
  children,
  className,
}: {
  label: string;
  help?: ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      {help ? <LabelWithHelp label={label} help={help} /> : <Label>{label}</Label>}
      {children}
    </div>
  );
}
