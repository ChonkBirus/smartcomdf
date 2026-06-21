import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  getProduct,
  listBrands,
  listCategories,
  listManufacturers,
  saveProduct,
  type ProductUnit,
} from "@/lib/products.functions";
import { ImageUploader, type ProductImage } from "./ImageUploader";

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
  minimum_stock: string;
  active: boolean;
};

const EMPTY: FormState = {
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
  minimum_stock: "0",
  active: true,
};

export function ProductFormSheet({
  open,
  onOpenChange,
  productId,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string | null;
  companyId: string | null;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getProduct);
  const saveFn = useServerFn(saveProduct);
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
  const { data: product, isFetching } = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => getFn({ data: { id: productId! } }),
    enabled: open && !!productId,
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [images, setImages] = useState<ProductImage[]>([]);

  useEffect(() => {
    if (!open) return;
    if (productId && product) {
      setForm({
        id: product.id,
        name: product.name ?? "",
        description: product.description ?? "",
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        category_id: product.category_id ?? "",
        brand_id: product.brand_id ?? "",
        manufacturer_id: product.manufacturer_id ?? "",
        unit: (product.unit ?? "UN") as ProductUnit,
        cost_price: String(product.cost_price ?? 0),
        sale_price: String(product.sale_price ?? 0),
        minimum_stock: String(product.minimum_stock ?? 0),
        active: !!product.active,
      });
      setImages((product.images ?? []) as ProductImage[]);
    } else if (!productId) {
      setForm(EMPTY);
      setImages([]);
    }
  }, [open, productId, product]);

  const save = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto salvo com sucesso.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar produto."),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Informe o nome do produto.");
    if (!form.sku.trim()) return toast.error("Informe o SKU.");
    if (!form.category_id) return toast.error("Selecione uma categoria.");
    save.mutate({
      id: form.id,
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
      minimum_stock: Number(form.minimum_stock) || 0,
      active: form.active,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{productId ? "Editar produto" : "Novo produto"}</SheetTitle>
          <SheetDescription>
            {productId ? "Atualize as informações do produto." : "Preencha os dados para cadastrar um novo produto."}
          </SheetDescription>
        </SheetHeader>

        {isFetching && productId ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando produto...</div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-6 pb-8">
            <Section title="Informações gerais">
              <Field label="Nome*" className="md:col-span-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
              </Field>
              <Field label="Descrição" className="md:col-span-2">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </Section>

            <Section title="Identificação">
              <Field label="SKU*">
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={80} />
              </Field>
              <Field label="Código de barras">
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  maxLength={80}
                />
              </Field>
            </Section>

            <Section title="Classificação">
              <Field label="Categoria*">
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c: any) => c.active || c.id === form.category_id)
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Marca">
                <Select
                  value={form.brand_id || "_none"}
                  onValueChange={(v) => setForm({ ...form, brand_id: v === "_none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nenhuma —</SelectItem>
                    {brands
                      .filter((b: any) => b.active || b.id === form.brand_id)
                      .map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fabricante" className="md:col-span-2">
                <Select
                  value={form.manufacturer_id || "_none"}
                  onValueChange={(v) => setForm({ ...form, manufacturer_id: v === "_none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nenhum —</SelectItem>
                    {manufacturers
                      .filter((m: any) => m.active || m.id === form.manufacturer_id)
                      .map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            <Section title="Comercial">
              <Field label="Preço de custo (R$)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                />
              </Field>
              <Field label="Preço de venda (R$)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                />
              </Field>
            </Section>

            <Section title="Estoque">
              <Field label="Estoque mínimo">
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={form.minimum_stock}
                  onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
                />
              </Field>
              <Field label="Unidade de medida">
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
            </Section>

            <Section title="Imagens">
              {productId && companyId ? (
                <div className="md:col-span-2">
                  <ImageUploader
                    productId={productId}
                    companyId={companyId}
                    images={images}
                    onChange={setImages}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground md:col-span-2">
                  Salve o produto para enviar imagens.
                </p>
              )}
            </Section>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label className="cursor-pointer" onClick={() => setForm({ ...form, active: !form.active })}>
                  Produto ativo
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : productId ? "Salvar alterações" : "Cadastrar produto"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
