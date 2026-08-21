import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Loader2,
  X,
  FileText,
} from "lucide-react";
import {
  getNotaDocument,
  parseNotaDocument,
  updateNotaItem,
  updateNotaDocumentReview,
  confirmNotaReceiving,
  searchItemsForMatch,
  type NotaItem,
} from "@/lib/smart-receiving.functions";
import { listSuppliers } from "@/lib/suppliers.functions";
import { listLocations } from "@/lib/stock.functions";
import { useCompanyId } from "@/hooks/use-company-id";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docId: string | null;
};

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  UPLOADED: { label: "Enviado", variant: "outline" },
  PROCESSING: { label: "Processando", variant: "secondary" },
  PARSED: { label: "Lido pela IA", variant: "default" },
  REVIEWED: { label: "Revisado", variant: "default" },
  CONFIRMED: { label: "Confirmado", variant: "default" },
  FAILED: { label: "Falhou", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

const brl = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function NotaReviewSheet({ open, onOpenChange, docId }: Props) {
  const qc = useQueryClient();
  const fetchDoc = useServerFn(getNotaDocument);
  const parse = useServerFn(parseNotaDocument);
  const updateItem = useServerFn(updateNotaItem);
  const updateReview = useServerFn(updateNotaDocumentReview);
  const confirm = useServerFn(confirmNotaReceiving);
  const fetchSuppliers = useServerFn(listSuppliers);
  const fetchLocations = useServerFn(listLocations);
  const companyId = useCompanyId();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["nota_document", companyId, docId],
    queryFn: () => (docId ? fetchDoc({ data: { id: docId } }) : Promise.resolve(null)),
    enabled: !!docId && open && !!companyId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list_min", companyId],
    queryFn: () => fetchSuppliers({ data: { search: "" } }),
    enabled: open && !!companyId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["stock_locations_list", companyId],
    queryFn: () => fetchLocations(),
    enabled: open && !!companyId,
  });

  const [supplierId, setSupplierId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data?.doc) {
      setSupplierId(data.doc.supplier_id ?? "");
      setLocationId(data.doc.location_id ?? "");
      setNotes("");
    }
  }, [data?.doc?.id]);

  const parseMut = useMutation({
    mutationFn: () => parse({ data: { id: docId! } }),
    onSuccess: () => {
      toast.success("Releitura concluída.");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("Selecione um local de estoque.");
      await updateReview({
        data: {
          id: docId!,
          supplier_id: supplierId || null,
          location_id: locationId,
          notes: notes || undefined,
        },
      });
      return confirm({
        data: {
          id: docId!,
          location_id: locationId,
          supplier_id: supplierId || undefined,
          notes: notes || undefined,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(
        `Confirmado — ${r.movements.length} entrada(s), ${r.created_items.length} item(s) novo(s).`,
      );
      qc.invalidateQueries({ queryKey: ["nota_documents"] });
      qc.invalidateQueries({ queryKey: ["stock_balances"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar."),
  });

  const items: NotaItem[] = data?.items ?? [];
  const totals = useMemo(() => {
    const active = items.filter((i: NotaItem) => i.status !== "IGNORED");
    return {
      total: active.reduce(
        (s: number, i: NotaItem) =>
          s + Number(i.raw_total ?? Number(i.raw_quantity ?? 0) * Number(i.raw_unit_cost ?? 0)),
        0,
      ),
      newCount: items.filter((i: NotaItem) => i.status === "NEW").length,
      matchedCount: items.filter((i: NotaItem) => i.status === "MATCHED").length,
      pending: items.filter((i: NotaItem) => i.status === "PENDING").length,
    };
  }, [items]);

  const doc = data?.doc;
  const canConfirm = doc && ["PARSED", "REVIEWED"].includes(doc.status) && totals.pending === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-3xl">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Revisar Nota Fiscal
            </SheetTitle>
            {doc && (
              <Badge variant={STATUS_BADGE[doc.status]?.variant}>
                {STATUS_BADGE[doc.status]?.label ?? doc.status}
              </Badge>
            )}
          </div>
          <SheetDescription>
            Confira os dados extraídos pela IA antes de dar entrada no estoque.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading || !doc ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              <p className="mt-2">Carregando...</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {doc.error_message && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Erro no processamento</p>
                    <p className="text-xs text-muted-foreground">{doc.error_message}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => parseMut.mutate()}
                    disabled={parseMut.isPending}
                  >
                    {parseMut.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Reprocessar
                  </Button>
                </div>
              )}

              {/* Cabeçalho */}
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Fornecedor extraído</Label>
                  <p className="text-sm font-medium">{doc.ai_supplier_name ?? "—"}</p>
                  {doc.ai_supplier_cnpj && (
                    <p className="text-xs text-muted-foreground">CNPJ: {doc.ai_supplier_cnpj}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Nº da Nota</Label>
                  <p className="text-sm font-medium">{doc.ai_invoice_number ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{doc.ai_issue_date ?? ""}</p>
                </div>
                <div>
                  <Label className="text-xs">Total na nota</Label>
                  <p className="text-sm font-medium">{brl(doc.ai_total_amount)}</p>
                </div>
                <div>
                  <Label className="text-xs">Confiança da IA</Label>
                  <p className="text-sm font-medium">
                    {doc.ai_confidence !== null ? `${Math.round(doc.ai_confidence * 100)}%` : "—"}
                  </p>
                </div>
                {data?.signedUrl && (
                  <a
                    href={data.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-full inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    Ver arquivo original
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Selecionar fornecedor/local */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Fornecedor</Label>
                  <Select
                    value={supplierId || "NONE"}
                    onValueChange={(v) => setSupplierId(v === "NONE" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vincular fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">— Sem vínculo —</SelectItem>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.trade_name || s.corporate_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Local de estoque *</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar local" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations as any[]).map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Itens */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Itens ({items.length})</p>
                  <div className="flex gap-1 text-xs">
                    <Badge variant="default" className="bg-success">
                      {totals.matchedCount} OK
                    </Badge>
                    <Badge variant="secondary">{totals.newCount} novos</Badge>
                    {totals.pending > 0 && (
                      <Badge variant="destructive">{totals.pending} pendentes</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((it: NotaItem) => (
                    <ItemReviewRow
                      key={it.id}
                      item={it}
                      onChange={(patch) =>
                        updateItem({ data: { id: it.id, ...patch } }).then(() => refetch())
                      }
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nenhum item lido. Reprocesse o documento.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Total da nota (itens ativos)</span>
                  <span className="font-semibold">{brl(totals.total)}</span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <SheetFooter className="border-t pt-3">
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
            {doc && doc.status === "FAILED" && (
              <Button
                onClick={() => parseMut.mutate()}
                disabled={parseMut.isPending}
                className="flex-1"
              >
                {parseMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                Reprocessar
              </Button>
            )}
            {doc && doc.status !== "CONFIRMED" && doc.status !== "FAILED" && (
              <Button
                onClick={() => confirmMut.mutate()}
                disabled={!canConfirm || confirmMut.isPending}
                className="flex-1"
              >
                {confirmMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                Confirmar entrada
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Item row ----------
function ItemReviewRow({
  item,
  onChange,
}: {
  item: NotaItem;
  onChange: (
    patch: Partial<{
      status: "PENDING" | "MATCHED" | "NEW" | "IGNORED";
      matched_item_id: string | null;
      confirmed_quantity: number | null;
      confirmed_unit_cost: number | null;
      new_item_payload: any;
    }>,
  ) => void;
}) {
  const searchFn = useServerFn(searchItemsForMatch);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const companyId = useCompanyId();
  const { data: results = [] } = useQuery({
    queryKey: ["item_search", companyId, search],
    queryFn: () => searchFn({ data: { query: search } }),
    enabled: showSearch && !!companyId,
  });

  const total = Number(
    item.raw_total ?? Number(item.raw_quantity ?? 0) * Number(item.raw_unit_cost ?? 0),
  );

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{item.raw_name}</p>
          <p className="text-xs text-muted-foreground">
            {item.raw_code && <>Cód: {item.raw_code} · </>}
            {Number(item.raw_quantity ?? 0)} {item.raw_unit ?? "UN"} × {brl(item.raw_unit_cost)} ={" "}
            <b>{brl(total)}</b>
          </p>
          {item.matched_item_id && item.status === "MATCHED" && (
            <p className="mt-1 text-xs text-success">
              ✓ Vinculado: {item.matched_item_name}{" "}
              {item.matched_item_sku && `(${item.matched_item_sku})`}
              {item.match_reason && (
                <span className="text-muted-foreground"> · {item.match_reason}</span>
              )}
            </p>
          )}
          {item.status === "NEW" && (
            <p className="mt-1 text-xs text-primary">+ Será criado como novo item</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Select
            value={item.status}
            onValueChange={(v) => {
              if (v === "NEW") {
                onChange({
                  status: "NEW",
                  matched_item_id: null,
                  new_item_payload: {
                    name: item.raw_name,
                    unit: item.raw_unit ?? "UN",
                    cost_price: Number(item.raw_unit_cost ?? 0),
                    sale_price: 0,
                    minimum_stock: 0,
                  },
                });
              } else if (v === "IGNORED") {
                onChange({ status: "IGNORED" });
              } else if (v === "PENDING") {
                onChange({ status: "PENDING", matched_item_id: null });
              } else if (v === "MATCHED" && item.matched_item_id) {
                onChange({ status: "MATCHED" });
              } else {
                setShowSearch(true);
              }
            }}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="MATCHED" disabled={!item.matched_item_id}>
                Vinculado
              </SelectItem>
              <SelectItem value="NEW">Criar novo</SelectItem>
              <SelectItem value="IGNORED">Ignorar</SelectItem>
            </SelectContent>
          </Select>
          {item.status !== "IGNORED" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowSearch((s) => !s)}
            >
              {item.matched_item_id ? "Trocar" : "Vincular"}
            </Button>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="mt-2 rounded-md border bg-muted/30 p-2">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item no catálogo..."
            className="h-8"
          />
          <div className="mt-2 max-h-40 overflow-y-auto">
            {results.map((r: any) => (
              <button
                key={r.id}
                type="button"
                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => {
                  onChange({ matched_item_id: r.id, status: "MATCHED" });
                  setShowSearch(false);
                }}
              >
                <span className="font-medium">{r.name}</span>
                {r.sku && <span className="text-muted-foreground"> · {r.sku}</span>}
              </button>
            ))}
            {results.length === 0 && search && (
              <p className="px-2 py-1 text-xs text-muted-foreground">Nada encontrado.</p>
            )}
          </div>
          <div className="mt-1 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setShowSearch(false)}
            >
              <X className="mr-1 h-3 w-3" />
              Fechar
            </Button>
          </div>
        </div>
      )}

      {item.status === "NEW" && (
        <div className="mt-2 grid gap-2 rounded-md border bg-muted/30 p-2 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              className="h-7 text-xs"
              defaultValue={item.new_item_payload?.name ?? item.raw_name}
              onBlur={(e) =>
                onChange({
                  new_item_payload: { ...(item.new_item_payload ?? {}), name: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">SKU</Label>
            <Input
              className="h-7 text-xs"
              defaultValue={item.new_item_payload?.sku ?? item.raw_code ?? ""}
              onBlur={(e) =>
                onChange({
                  new_item_payload: { ...(item.new_item_payload ?? {}), sku: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Preço de venda</Label>
            <Input
              className="h-7 text-xs"
              type="number"
              step="0.01"
              defaultValue={item.new_item_payload?.sale_price ?? 0}
              onBlur={(e) =>
                onChange({
                  new_item_payload: {
                    ...(item.new_item_payload ?? {}),
                    sale_price: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
