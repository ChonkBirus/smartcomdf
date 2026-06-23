import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, ArrowUp, ArrowDown, Check, ChevronsUpDown } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listCustomers } from "@/lib/customers.functions";
import { getQuote, saveQuote, listQuoteCatalog, type QuoteItemKind, type QuoteCatalogItem } from "@/lib/quotes.functions";
import { usePermissions } from "@/lib/permissions";

type Line = {
  id?: string;
  item_id: string | null;
  kind: QuoteItemKind;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
};

const KIND_LABEL: Record<QuoteItemKind, string> = {
  PRODUCT: "Produto", SERVICE: "Serviço", LABOR: "Mão de obra", OTHER: "Outro",
};

const DEFAULT_PAYMENT_TERMS = "50% de entrada e 50% na entrega do serviço.";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Currency input: stores number, displays masked R$ value
function CurrencyInput({
  value, onChange, id,
}: { value: number; onChange: (n: number) => void; id?: string }) {
  const [text, setText] = useState(() => fmtBRL(value || 0));
  useEffect(() => { setText(fmtBRL(value || 0)); }, [value]);
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        const n = digits ? Number(digits) / 100 : 0;
        setText(fmtBRL(n));
        onChange(n);
      }}
    />
  );
}

export function QuoteFormSheet({
  open, onOpenChange, quoteId,
}: { open: boolean; onOpenChange: (o: boolean) => void; quoteId: string | null }) {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canSeeInternal = has("quotes.view_internal_values");
  const fetchOne = useServerFn(getQuote);
  const save = useServerFn(saveQuote);
  const fetchCustomers = useServerFn(listCustomers);
  const fetchCatalog = useServerFn(listQuoteCatalog);

  const [customerId, setCustomerId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [payment, setPayment] = useState(DEFAULT_PAYMENT_TERMS);
  const [delivery, setDelivery] = useState("");
  const [warranty, setWarranty] = useState("");
  const [completion, setCompletion] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [laborCost, setLaborCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);

  const { data: customersData, error: customersError } = useQuery({
    queryKey: ["customers", "quote-form"],
    queryFn: () => fetchCustomers({ data: { active: true, sort: "name", page: 1, page_size: 100 } as any }),
    enabled: open,
  });
  useEffect(() => {
    if (customersError) toast.error("Falha ao carregar clientes.");
  }, [customersError]);
  const customers: any[] = (customersData as any)?.rows ?? [];

  const { data: catalog } = useQuery({
    queryKey: ["quote-catalog"],
    queryFn: () => fetchCatalog(),
    enabled: open,
  });
  const catalogItems = (catalog ?? []) as QuoteCatalogItem[];
  const products = useMemo(() => catalogItems.filter((i) => i.item_type === "PRODUCT"), [catalogItems]);
  const services = useMemo(() => catalogItems.filter((i) => i.item_type === "SERVICE"), [catalogItems]);

  const { data: existing } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => fetchOne({ data: { id: quoteId! } }),
    enabled: !!quoteId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (quoteId && existing) {
      const q = existing.quote;
      setCustomerId(q.customer_id);
      setTitle(q.title ?? "");
      setIssueDate(q.issue_date.slice(0, 10));
      setValidUntil(q.valid_until?.slice(0, 10) ?? "");
      setPayment(q.payment_terms ?? "");
      setDelivery(q.delivery_terms ?? "");
      setWarranty(q.warranty_terms ?? "");
      setCompletion(q.completion_estimate ?? "");
      setCustomerNotes(q.customer_notes ?? "");
      setInternalNotes(q.internal_notes ?? "");
      setLaborCost(Number(q.labor_cost || 0));
      setDiscount(Number(q.discount || 0));
      setLines(
        existing.items.map((it) => ({
          id: it.id,
          item_id: it.item_id,
          kind: it.kind,
          name: it.name,
          description: it.description ?? "",
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          cost_price: Number(it.cost_price || 0),
        })),
      );
    } else if (!quoteId) {
      setCustomerId(""); setTitle("");
      setIssueDate(new Date().toISOString().slice(0, 10)); setValidUntil("");
      setPayment(DEFAULT_PAYMENT_TERMS); setDelivery(""); setWarranty(""); setCompletion("");
      setCustomerNotes(""); setInternalNotes("");
      setLaborCost(0); setDiscount(0); setLines([]);
    }
  }, [open, quoteId, existing]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0),
    [lines],
  );
  const total = useMemo(
    () => Math.max(0, subtotal + laborCost - discount),
    [subtotal, laborCost, discount],
  );

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: quoteId ?? undefined,
          customer_id: customerId,
          title: title || null,
          issue_date: issueDate,
          valid_until: validUntil || null,
          payment_terms: payment || null,
          delivery_terms: delivery || null,
          warranty_terms: warranty || null,
          completion_estimate: completion || null,
          customer_notes: customerNotes || null,
          internal_notes: internalNotes || null,
          labor_cost: Number(laborCost) || 0,
          discount: Number(discount) || 0,
          items: lines.map((l, idx) => ({
            id: l.id,
            item_id: l.item_id,
            kind: l.kind,
            name: l.name.trim(),
            description: l.description || null,
            quantity: Number(l.quantity) || 0,
            unit_price: Number(l.unit_price) || 0,
            cost_price: Number(l.cost_price) || 0,
            position: idx,
          })),
        } as any,
      }),
    onSuccess: () => {
      toast.success(quoteId ? "Orçamento atualizado." : "Orçamento criado.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote-metrics"] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  function addLine(kind: QuoteItemKind = "PRODUCT") {
    setLines((s) => [
      ...s,
      { item_id: null, kind, name: "", description: "", quantity: 1, unit_price: 0, cost_price: 0 },
    ]);
  }
  function setLine(i: number, patch: Partial<Line>) {
    setLines((s) => s.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((s) => s.filter((_, idx) => idx !== i));
  }
  function moveLine(i: number, dir: -1 | 1) {
    setLines((s) => {
      const arr = [...s];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function pickCatalogItem(i: number, itemId: string) {
    const it = catalogItems.find((x) => x.id === itemId);
    if (!it) return;
    setLine(i, {
      item_id: it.id,
      name: it.name,
      kind: it.item_type === "SERVICE" ? "SERVICE" : "PRODUCT",
      unit_price: it.sale_price,
      cost_price: it.cost_price,
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return toast.error("Selecione um cliente.");
    if (!lines.length) return toast.error("Adicione pelo menos um item.");
    if (lines.some((l) => !l.name.trim() || l.quantity <= 0 || l.unit_price < 0)) {
      return toast.error("Verifique os itens (nome, quantidade e preço).");
    }
    mutation.mutate();
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{quoteId ? "Editar orçamento" : "Novo orçamento"}</SheetTitle>
          <SheetDescription>
            Cadastro do orçamento, itens e condições comerciais.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Tabs defaultValue="main">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="main">Dados</TabsTrigger>
              <TabsTrigger value="items">Itens</TabsTrigger>
              <TabsTrigger value="terms">Condições</TabsTrigger>
            </TabsList>

            {/* DADOS */}
            <TabsContent value="main" className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Cliente *</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className={cn("w-full justify-between", !customerId && "text-muted-foreground")}
                      >
                        {selectedCustomer
                          ? (selectedCustomer.trade_name || selectedCustomer.name)
                          : "Pesquisar cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou razão social..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((c: any) => {
                              const label = c.trade_name || c.name;
                              const sub = c.corporate_name && c.corporate_name !== c.name ? c.corporate_name : "";
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={`${label} ${sub} ${c.cpf_cnpj ?? ""}`}
                                  onSelect={() => { setCustomerId(c.id); setCustomerOpen(false); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col">
                                    <span>{label}</span>
                                    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="sm:col-span-2">
                  <Label>Título / Assunto</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Instalação de CFTV — 8 câmeras" />
                </div>
                <div>
                  <Label>Data de emissão *</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>

              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Mão de obra</Label>
                  <CurrencyInput value={laborCost} onChange={setLaborCost} />
                </div>
                <div>
                  <Label>Desconto</Label>
                  <CurrencyInput value={discount} onChange={setDiscount} />
                </div>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between"><span>Subtotal itens</span><span>{fmtBRL(subtotal)}</span></div>
                <div className="flex justify-between"><span>+ Mão de obra</span><span>{fmtBRL(laborCost)}</span></div>
                <div className="flex justify-between"><span>− Desconto</span><span>{fmtBRL(discount)}</span></div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total da proposta</span><span>{fmtBRL(total)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Valor total com materiais, serviços e mão de obra inclusos.
                </p>
              </div>

              <div>
                <Label>Observações internas (não aparecem ao cliente)</Label>
                <Textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </div>
            </TabsContent>

            {/* ITENS */}
            <TabsContent value="items" className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("PRODUCT")}>
                  <Plus className="mr-1 h-3 w-3" />Produto
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("SERVICE")}>
                  <Plus className="mr-1 h-3 w-3" />Serviço
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("LABOR")}>
                  <Plus className="mr-1 h-3 w-3" />Mão de obra
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("OTHER")}>
                  <Plus className="mr-1 h-3 w-3" />Outro
                </Button>
              </div>

              {lines.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhum item adicionado.
                </p>
              )}

              {lines.map((l, i) => (
                <LineRow
                  key={i}
                  line={l}
                  index={i}
                  last={i === lines.length - 1}
                  products={products}
                  services={services}
                  canSeeInternal={canSeeInternal}
                  onChange={(patch) => setLine(i, patch)}
                  onPickCatalog={(id) => pickCatalogItem(i, id)}
                  onRemove={() => removeLine(i)}
                  onMove={(dir) => moveLine(i, dir)}
                />
              ))}

              <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm font-semibold">
                <span>Total da proposta (interno)</span>
                <span>{fmtBRL(total)}</span>
              </div>
            </TabsContent>

            {/* CONDIÇÕES */}
            <TabsContent value="terms" className="space-y-3 pt-4">
              <div>
                <Label>Condições de pagamento</Label>
                <Textarea rows={2} value={payment} onChange={(e) => setPayment(e.target.value)}
                  placeholder={DEFAULT_PAYMENT_TERMS} />
              </div>
              <div>
                <Label>Prazo de entrega</Label>
                <Textarea rows={2} value={delivery} onChange={(e) => setDelivery(e.target.value)}
                  placeholder="Ex.: 10 dias úteis após confirmação" />
              </div>
              <div>
                <Label>Garantia</Label>
                <Textarea rows={2} value={warranty} onChange={(e) => setWarranty(e.target.value)}
                  placeholder="Ex.: 12 meses para equipamentos e 90 dias para serviços" />
              </div>
              <div>
                <Label>Estimativa de conclusão do serviço</Label>
                <Input value={completion} onChange={(e) => setCompletion(e.target.value)}
                  placeholder="Ex.: 5 dias úteis após início" />
              </div>
              <div>
                <Label>Observações ao cliente</Label>
                <Textarea rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>

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

function LineRow({
  line, index, last, products, services, canSeeInternal,
  onChange, onPickCatalog, onRemove, onMove,
}: {
  line: Line;
  index: number;
  last: boolean;
  products: QuoteCatalogItem[];
  services: QuoteCatalogItem[];
  canSeeInternal: boolean;
  onChange: (patch: Partial<Line>) => void;
  onPickCatalog: (id: string) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const source = line.kind === "SERVICE" ? services : products;
  const showCatalog = line.kind === "PRODUCT" || line.kind === "SERVICE";
  const selected = source.find((s) => s.id === line.item_id);
  const margin = line.cost_price > 0
    ? (((line.unit_price - line.cost_price) / line.cost_price) * 100)
    : null;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{KIND_LABEL[line.kind]}</Badge>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => onMove(1)} disabled={last}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showCatalog && (
        <div>
          <Label className="text-xs">
            {line.kind === "SERVICE" ? "Serviço do catálogo" : "Produto do catálogo"}
          </Label>
          <Popover open={pickOpen} onOpenChange={setPickOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className={cn("w-full justify-between", !selected && "text-muted-foreground")}
              >
                {selected ? `${selected.name}${selected.sku ? ` (${selected.sku})` : ""}` : "Pesquisar no catálogo..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar por nome ou SKU..." />
                <CommandList>
                  <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                  <CommandGroup>
                    {source.map((it) => (
                      <CommandItem
                        key={it.id}
                        value={`${it.name} ${it.sku ?? ""}`}
                        onSelect={() => { onPickCatalog(it.id); setPickOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", line.item_id === it.id ? "opacity-100" : "opacity-0")} />
                        <span>{it.name}{it.sku ? ` (${it.sku})` : ""}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 sm:col-span-6">
          <Label className="text-xs">Nome *</Label>
          <Input value={line.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <Label className="text-xs">Qtd *</Label>
          <Input type="number" min="0" step="0.001" value={line.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })} />
        </div>
        <div className="col-span-8 sm:col-span-2">
          <Label className="text-xs">Preço unit. *</Label>
          <CurrencyInput value={line.unit_price} onChange={(n) => onChange({ unit_price: n })} />
        </div>
        {canSeeInternal && (
          <div className="col-span-12 sm:col-span-2">
            <Label className="text-xs">Custo (interno)</Label>
            <CurrencyInput value={line.cost_price} onChange={(n) => onChange({ cost_price: n })} />
          </div>
        )}
        <div className="col-span-12">
          <Label className="text-xs">Descrição (aparece ao cliente)</Label>
          <Textarea rows={2} value={line.description}
            onChange={(e) => onChange({ description: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {canSeeInternal ? (
          <span>Margem: {margin !== null ? `${margin.toFixed(1)}%` : "—"}</span>
        ) : <span />}
        <span className="font-medium text-foreground">
          Subtotal: {fmtBRL(line.quantity * line.unit_price)}
        </span>
      </div>
    </div>
  );
}
