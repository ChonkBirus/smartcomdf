import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  createImportJob,
  validateImport,
  listImportRows,
  confirmImport,
  TARGET_FIELDS,
  type TargetField,
} from "@/lib/product-import.functions";
import { listLocations } from "@/lib/stock.functions";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".xls,.xlsx,.csv";

type Step = "upload" | "mapping" | "preview" | "confirm" | "done";

const FIELD_LABEL: Record<TargetField, string> = {
  name: "Nome",
  description: "Descrição",
  sku: "SKU",
  barcode: "Código de barras",
  category_name: "Categoria",
  brand_name: "Marca",
  manufacturer_name: "Fabricante",
  unit: "Unidade",
  cost_price: "Preço de custo",
  sale_price: "Preço de venda",
  minimum_stock: "Estoque mínimo",
  ncm: "NCM",
  initial_qty: "Quantidade inicial",
  __ignore__: "— Ignorar —",
};

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) {
    return await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const headers = (res.meta.fields ?? []).filter((h) => h && h.trim());
          const rows = (res.data as any[]).filter((r) =>
            Object.values(r).some((v) => v !== "" && v != null),
          );
          resolve({ headers, rows });
        },
        error: reject,
      });
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellFormula: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true }) as Record<string, any>[];
  const headers = json.length ? Object.keys(json[0]) : [];
  const rows = json.filter((r) => Object.values(r).some((v) => v !== "" && v != null));
  return { headers, rows };
}

export function ProductImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const createFn = useServerFn(createImportJob);
  const validateFn = useServerFn(validateImport);
  const listRowsFn = useServerFn(listImportRows);
  const confirmFn = useServerFn(confirmImport);
  const locFn = useServerFn(listLocations);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetField>>({});
  const [validation, setValidation] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "CREATE" | "UPDATE" | "ERROR" | "SKIP">("all");
  const [stockLocationId, setStockLocationId] = useState<string>("__none__");
  const [createCats, setCreateCats] = useState(true);
  const [createBrands, setCreateBrands] = useState(true);
  const [createMfs, setCreateMfs] = useState(true);
  const [result, setResult] = useState<any | null>(null);

  const { data: locations = [] } = useQuery({
    queryKey: ["stock-locations-import"],
    queryFn: () => locFn(),
    enabled: step === "confirm",
  });

  const rowsQuery = useQuery({
    queryKey: ["import-rows", jobId, filter],
    queryFn: () => listRowsFn({ data: { job_id: jobId!, filter } }),
    enabled: !!jobId && (step === "preview" || step === "confirm"),
  });

  const reset = () => {
    setStep("upload");
    setFile(null);
    setJobId(null);
    setHeaders([]);
    setMapping({});
    setValidation(null);
    setResult(null);
    setStockLocationId("__none__");
  };

  const handleFile = async (f: File) => {
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo excede 10 MB.");
      return;
    }
    if (!/\.(xls|xlsx|csv)$/i.test(f.name)) {
      toast.error("Formato não suportado. Use XLS, XLSX ou CSV.");
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      const { headers: h, rows } = await parseFile(f);
      if (!h.length || !rows.length) {
        toast.error("Arquivo vazio ou sem cabeçalho.");
        setParsing(false);
        return;
      }
      const res = await createFn({ data: { file_name: f.name, headers: h, rows } });
      setJobId(res.job_id);
      setHeaders(res.headers);
      setMapping(res.mapping as any);
      setStep("mapping");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao processar arquivo.");
    } finally {
      setParsing(false);
    }
  };

  const validateMutation = useMutation({
    mutationFn: () => validateFn({ data: { job_id: jobId!, mapping } }),
    onSuccess: (data) => {
      setValidation(data);
      setStep("preview");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmFn({
        data: {
          job_id: jobId!,
          create_categories: createCats,
          create_brands: createBrands,
          create_manufacturers: createMfs,
          stock_location_id: stockLocationId !== "__none__" ? stockLocationId : null,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mappingReady = useMemo(() => {
    const targets = Object.values(mapping);
    return targets.includes("name") && (targets.includes("sku") || targets.includes("barcode"));
  }, [mapping]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar produtos</DialogTitle>
          <DialogDescription>
            Importe seu catálogo de produtos por arquivos XLS, XLSX ou CSV (até 10 MB).
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          {(["upload", "mapping", "preview", "confirm", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <Badge variant={step === s ? "default" : "secondary"} className="capitalize">
                {i + 1}.{" "}
                {s === "upload"
                  ? "Upload"
                  : s === "mapping"
                    ? "Mapeamento"
                    : s === "preview"
                      ? "Prévia"
                      : s === "confirm"
                        ? "Confirmar"
                        : "Concluído"}
              </Badge>
              {i < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 p-10 cursor-pointer hover:bg-muted/60">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <div className="font-medium">Selecione um arquivo</div>
                <div className="text-xs text-muted-foreground">XLS, XLSX ou CSV — até 10 MB</div>
              </div>
              <Input
                type="file"
                accept={ACCEPT}
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {parsing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processando arquivo...
                </div>
              )}
              {file && !parsing && (
                <div className="flex items-center gap-2 text-xs">
                  <FileSpreadsheet className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </label>
            <Alert>
              <AlertTitle>Colunas reconhecidas</AlertTitle>
              <AlertDescription className="text-xs">
                Nome, SKU, Código de barras, Categoria, Marca, Fabricante, Unidade, Preço de custo,
                Preço de venda, Estoque mínimo, NCM, Quantidade inicial. Variações de nome são
                reconhecidas automaticamente.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* STEP: MAPPING */}
        {step === "mapping" && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Confirme ou corrija o mapeamento das colunas do seu arquivo:
            </div>
            <ScrollArea className="h-[360px] rounded-md border">
              <div className="divide-y">
                {headers.map((h) => (
                  <div key={h} className="grid grid-cols-2 items-center gap-3 p-3">
                    <div className="truncate font-mono text-xs">{h}</div>
                    <Select
                      value={mapping[h] ?? "__ignore__"}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v as TargetField }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_FIELDS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FIELD_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {!mappingReady && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Mapeie ao menos "Nome" e "SKU" ou "Código de barras" para continuar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === "preview" && validation && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Total" value={validation.total} />
              <Stat label="Válidas" value={validation.valid} tone="ok" />
              <Stat
                label="Com erro"
                value={validation.invalid}
                tone={validation.invalid ? "err" : undefined}
              />
              <Stat label="Estoque inicial" value={validation.initial_stock_entries} />
            </div>
            {(validation.new_categories.length ||
              validation.new_brands.length ||
              validation.new_manufacturers.length) > 0 && (
              <Alert>
                <AlertTitle className="text-sm">Serão criados após confirmação</AlertTitle>
                <AlertDescription className="text-xs space-y-1">
                  {validation.new_categories.length > 0 && (
                    <div>Categorias: {validation.new_categories.join(", ")}</div>
                  )}
                  {validation.new_brands.length > 0 && (
                    <div>Marcas: {validation.new_brands.join(", ")}</div>
                  )}
                  {validation.new_manufacturers.length > 0 && (
                    <div>Fabricantes: {validation.new_manufacturers.join(", ")}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2">
              <Label className="text-xs">Filtrar:</Label>
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CREATE">Criar</SelectItem>
                  <SelectItem value="UPDATE">Atualizar</SelectItem>
                  <SelectItem value="ERROR">Com erro</SelectItem>
                  <SelectItem value="SKIP">Ignorados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[320px] rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Nome</th>
                    <th className="px-2 py-1.5">SKU</th>
                    <th className="px-2 py-1.5">Cód. barras</th>
                    <th className="px-2 py-1.5">Categoria</th>
                    <th className="px-2 py-1.5">Un.</th>
                    <th className="px-2 py-1.5 text-right">Venda</th>
                    <th className="px-2 py-1.5">Ação</th>
                    <th className="px-2 py-1.5">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {(rowsQuery.data ?? []).map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-1.5">{r.row_number}</td>
                      <td className="px-2 py-1.5">{r.mapped_data?.name ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{r.mapped_data?.sku ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{r.mapped_data?.barcode ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.mapped_data?.category_name ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.mapped_data?.unit ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.mapped_data?.sale_price != null
                          ? `R$ ${Number(r.mapped_data.sale_price).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <ActionBadge action={r.action} />
                      </td>
                      <td className="px-2 py-1.5 text-destructive">
                        {(r.validation_errors ?? []).join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* STEP: CONFIRM */}
        {step === "confirm" && validation && (
          <div className="space-y-3 text-sm">
            <Alert>
              <AlertTitle>Resumo da importação</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <div>Total de linhas: {validation.total}</div>
                <div>
                  Produtos novos:{" "}
                  {(rowsQuery.data ?? []).filter((r: any) => r.action === "CREATE").length}
                </div>
                <div>
                  Produtos atualizados:{" "}
                  {(rowsQuery.data ?? []).filter((r: any) => r.action === "UPDATE").length}
                </div>
                <div>Linhas com erro: {validation.invalid}</div>
                <div>Categorias a criar: {validation.new_categories.length}</div>
                <div>Marcas a criar: {validation.new_brands.length}</div>
                <div>Fabricantes a criar: {validation.new_manufacturers.length}</div>
                <div>Entradas de estoque inicial: {validation.initial_stock_entries}</div>
              </AlertDescription>
            </Alert>

            {validation.initial_stock_entries > 0 && (
              <div>
                <Label className="text-xs">Local de estoque para entradas iniciais</Label>
                <Select value={stockLocationId} onValueChange={setStockLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não movimentar estoque</SelectItem>
                    {(locations as any[]).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stockLocationId === "__none__" && (
                  <div className="mt-1 text-micro text-muted-foreground">
                    Sem local selecionado, os produtos serão criados sem entrada de estoque.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP: DONE */}
        {step === "done" && result && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Importação concluída</AlertTitle>
            <AlertDescription className="text-xs">
              {result.created} criados · {result.updated} atualizados · {result.skipped} ignorados ·{" "}
              {result.stock_entries} entradas de estoque
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                onClick={() => validateMutation.mutate()}
                disabled={!mappingReady || validateMutation.isPending}
              >
                {validateMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Validar
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Voltar
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={!validation || validation.valid === 0}
              >
                Continuar
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>
                Voltar
              </Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                {confirmMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Confirmar importação
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={() => onOpenChange(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "err" }) {
  const color = tone === "ok" ? "text-success" : tone === "err" ? "text-destructive" : "";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-micro uppercase text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const variant: any =
    action === "CREATE"
      ? "default"
      : action === "UPDATE"
        ? "secondary"
        : action === "SKIP"
          ? "outline"
          : "destructive";
  return <Badge variant={variant}>{action}</Badge>;
}
