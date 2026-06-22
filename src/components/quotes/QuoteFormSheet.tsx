import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listCustomers } from "@/lib/customers.functions";
import { listStockItems } from "@/lib/stock.functions";
import { getQuote, saveQuote, type QuoteItemKind } from "@/lib/quotes.functions";

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

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function QuoteFormSheet({
  open, onOpenChange, quoteId,
}: { open: boolean; onOpenChange: (o: boolean) => void; quoteId: string | null }) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getQuote);
  const save = useServerFn(saveQuote);
  const fetchCustomers = useServerFn(listCustomers);
  const fetchItems = useServerFn(listStockItems);

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [payment, setPayment] = useState("");
  const [delivery, setDelivery] = useState("");
  const [warranty, setWarranty] = useState("");
  const [completion, setCompletion] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [laborCost, setLaborCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);

  const { data: customersData } = useQuery({
    queryKey: ["customers", "quote-form"],
    queryFn: () => fetchCustomers({ data: { status: "ACTIVE", page: 1, page_size: 200 } as any }),
    enabled: open,
  });
  const customers = (customersData as any)?.rows ?? [];

  const { data: items } = useQuery({
    queryKey: ["stock_items", "quote-form"],
    queryFn: () => fetchItems(),
    enabled: open,
  });

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
      setPayment(""); setDelivery(""); setWarranty(""); setCompletion("");
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
  function pickItem(i: number, itemId: string) {
    const it = (items ?? []).find((x: any) => x.id === itemId);
    if (!it) return;
    setLine(i, {
      item_id: it.id,
      name: it.name,
      kind: "PRODUCT",
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
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.trade_name || c.name}
                          {c.corporate_name && c.corporate_name !== c.name ? ` — ${c.corporate_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label>Mão de obra (R$)</Label>
                  <Input type="number" step="0.01" min="0"
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Desconto (R$)</Label>
                  <Input type="number" step="0.01" min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
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
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{KIND_LABEL[l.kind]}</Badge>
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveLine(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveLine(i, 1)} disabled={i === lines.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {l.kind === "PRODUCT" && (
                    <div>
                      <Label className="text-xs">Vincular ao catálogo (opcional)</Label>
                      <Select value={l.item_id ?? ""} onValueChange={(v) => pickItem(i, v)}>
                        <SelectTrigger><SelectValue placeholder="Pesquisar item do catálogo" /></SelectTrigger>
                        <SelectContent>
                          {(items ?? []).map((it: any) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.name}{it.sku ? ` (${it.sku})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-6">
                      <Label className="text-xs">Nome *</Label>
                      <Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs">Qtd *</Label>
                      <Input type="number" min="0" step="0.001" value={l.quantity}
                        onChange={(e) => setLine(i, { quantity: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs">Preço unit. *</Label>
                      <Input type="number" min="0" step="0.01" value={l.unit_price}
                        onChange={(e) => setLine(i, { unit_price: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs">Custo</Label>
                      <Input type="number" min="0" step="0.01" value={l.cost_price}
                        onChange={(e) => setLine(i, { cost_price: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-12">
                      <Label className="text-xs">Descrição (aparece ao cliente)</Label>
                      <Textarea rows={2} value={l.description}
                        onChange={(e) => setLine(i, { description: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Margem: {l.cost_price > 0
                      ? `${(((l.unit_price - l.cost_price) / l.cost_price) * 100).toFixed(1)}%`
                      : "—"}
                    </span>
                    <span className="font-medium text-foreground">
                      Subtotal: {fmtBRL(l.quantity * l.unit_price)}
                    </span>
                  </div>
                </div>
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
                  placeholder="Ex.: 50% na aprovação e 50% na entrega" />
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
