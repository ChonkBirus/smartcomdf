import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  createCustomerImportJob,
  validateCustomerImport,
  listCustomerImportRows,
  confirmCustomerImport,
  TARGET_FIELDS,
  type TargetField,
} from "@/lib/customer-import.functions";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".xls,.xlsx,.csv";

const TEMPLATE_HEADERS = [
  "tipo_cliente",
  "nome_razao_social",
  "nome_fantasia",
  "cpf_cnpj",
  "telefone",
  "email",
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "contato_nome",
  "contato_telefone",
  "contato_email",
  "observacoes",
];

const TEMPLATE_ROWS = [
  [
    "PF",
    "João da Silva",
    "",
    "12345678900",
    "61999999999",
    "joao@email.com",
    "70000000",
    "Quadra Teste",
    "10",
    "",
    "Asa Sul",
    "Brasília",
    "DF",
    "João",
    "61999999999",
    "",
    "Cliente exemplo PF",
  ],
  [
    "PJ",
    "Empresa Teste LTDA",
    "Empresa Teste",
    "11222333000181",
    "6133333333",
    "contato@empresa.com",
    "70000000",
    "Quadra Comercial",
    "20",
    "Sala 1",
    "Asa Norte",
    "Brasília",
    "DF",
    "Maria",
    "61988888888",
    "",
    "Cliente exemplo PJ",
  ],
];

function csvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadTemplateCsv() {
  const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-clientes.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Step = "upload" | "mapping" | "preview" | "confirm" | "done";

const FIELD_LABEL: Record<TargetField, string> = {
  customer_type: "Tipo de cliente",
  name: "Nome",
  corporate_name: "Razão Social",
  trade_name: "Nome Fantasia",
  cpf_cnpj: "CPF/CNPJ",
  state_registration: "Inscrição Estadual",
  municipal_registration: "Inscrição Municipal",
  email: "E-mail",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  customer_origin: "Origem",
  customer_status: "Status",
  notes: "Observações",
  addr_zipcode: "Endereço: CEP",
  addr_street: "Endereço: Rua",
  addr_number: "Endereço: Número",
  addr_complement: "Endereço: Complemento",
  addr_district: "Endereço: Bairro",
  addr_city: "Endereço: Cidade",
  addr_state: "Endereço: UF",
  addr_country: "Endereço: País",
  addr_reference: "Endereço: Referência",
  contact_name: "Contato: Nome",
  contact_role: "Contato: Cargo",
  contact_phone: "Contato: Telefone",
  contact_whatsapp: "Contato: WhatsApp",
  contact_email: "Contato: E-mail",
  tags: "Tags / Segmento",
  __ignore__: "— Ignorar —",
};

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) {
    return await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        delimiter: "",
        delimitersToGuess: [",", ";", "\t", "|"],
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

export function CustomerImportDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId?: string | null;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCustomerImportJob);
  const validateFn = useServerFn(validateCustomerImport);
  const listRowsFn = useServerFn(listCustomerImportRows);
  const confirmFn = useServerFn(confirmCustomerImport);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetField>>({});
  const [validation, setValidation] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "CREATE" | "UPDATE" | "ERROR" | "SKIP">("all");
  const [createTags, setCreateTags] = useState(true);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    if (open) {
      console.log("[CUSTOMER IMPORT] open modal true");
      console.log("[CUSTOMER IMPORT] modal mounted");
    }
  }, [open]);

  const rowsQuery = useQuery({
    queryKey: ["customer-import-rows", jobId, filter],
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
    setProcessingLabel(null);
  };

  const handleFile = async (f: File) => {
    console.log("[CUSTOMER IMPORT] file selected", f.name, f.type, f.size);
    if (!companyId) {
      console.error("[CUSTOMER IMPORT] companyId", companyId);
      toast.error(
        "Não foi possível identificar a empresa ativa. Recarregue a página e tente novamente.",
      );
      return;
    }
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
    setProcessingLabel("Processando arquivo...");
    try {
      const { headers: h, rows } = await parseFile(f);
      console.log("[CUSTOMER IMPORT] parsed rows", rows);
      if (!h.length || !rows.length) {
        toast.error("Arquivo vazio ou sem cabeçalho.");
        setParsing(false);
        return;
      }
      const res = await createFn({ data: { file_name: f.name, headers: h, rows } });
      setJobId(res.job_id);
      setHeaders(res.headers);
      const initialMapping = res.mapping as Record<string, TargetField>;
      setMapping(initialMapping);
      const initialTargets = Object.values(initialMapping);
      if (initialTargets.includes("name") || initialTargets.includes("corporate_name")) {
        setStep("mapping");
        setProcessingLabel("Validando linhas no servidor...");
        const validationData = await validateFn({
          data: { job_id: res.job_id, mapping: initialMapping },
        });
        console.log("[CUSTOMER IMPORT] validation result", validationData);
        setValidation(validationData);
        setFilter("all");
        setStep("preview");
        toast.success(
          `Prévia pronta: ${validationData.valid} válidas, ${validationData.invalid} com erro.`,
        );
      } else {
        setStep("mapping");
      }
    } catch (e: any) {
      console.error("[CUSTOMER IMPORT] file/import preparation error", e);
      toast.error(e.message ?? "Falha ao processar arquivo.");
    } finally {
      setParsing(false);
      setProcessingLabel(null);
    }
  };

  const validateMutation = useMutation({
    mutationFn: () => validateFn({ data: { job_id: jobId!, mapping } }),
    onSuccess: (data) => {
      console.log("[CUSTOMER IMPORT] validation result", data);
      setValidation(data);
      setFilter("all");
      setStep("preview");
      toast.success(`Validação concluída: ${data.valid} válidas, ${data.invalid} com erro.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao validar importação."),
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!companyId) {
        throw new Error(
          "Não foi possível identificar a empresa ativa. Recarregue a página e tente novamente.",
        );
      }
      return confirmFn({ data: { job_id: jobId!, create_tags: createTags } });
    },
    onMutate: () => {
      if (!companyId) {
        console.error("[CUSTOMER IMPORT] companyId", companyId);
        throw new Error(
          "Não foi possível identificar a empresa ativa. Recarregue a página e tente novamente.",
        );
      }
      const validRows = (rowsQuery.data ?? []).filter(
        (r: any) => r.action === "CREATE" && r.status === "VALID",
      );
      const payload = validRows.map((r: any) => ({
        company_id: companyId,
        customer_type: r.mapped_data?.customer_type,
        name: r.mapped_data?.name,
        corporate_name: r.mapped_data?.corporate_name ?? null,
        trade_name: r.mapped_data?.trade_name ?? null,
        cpf_cnpj: r.mapped_data?.cpf_cnpj ?? "",
        email: r.mapped_data?.email ?? null,
        phone: r.mapped_data?.phone ?? null,
        whatsapp: r.mapped_data?.whatsapp ?? null,
      }));
      console.log("[CUSTOMER IMPORT] importing valid rows", validRows);
      console.log("[CUSTOMER IMPORT] companyId", companyId);
      console.log("[CUSTOMER IMPORT] insert payload", payload);
    },
    onSuccess: (data) => {
      console.log("[CUSTOMER IMPORT] insert result", data);
      setResult(data);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      qc.invalidateQueries({ queryKey: ["customers", "quote-form", companyId] });
      qc.invalidateQueries({ queryKey: ["customer-metrics", companyId] });
      toast.success(`Importação concluída: ${data.created} criados, ${data.updated} atualizados.`);
    },
    onError: (e: any) => {
      console.error("[CUSTOMER IMPORT] insert error", e);
      toast.error(e?.message ?? "Falha ao confirmar importação.");
    },
  });

  const mappingReady = useMemo(() => {
    const targets = Object.values(mapping);
    // Apenas Nome ou Razão Social é obrigatório. CPF/CNPJ e e-mail são opcionais.
    return targets.includes("name") || targets.includes("corporate_name");
  }, [mapping]);

  const busy = parsing || validateMutation.isPending || confirmMutation.isPending;
  const previewRows = rowsQuery.data ?? [];
  const previewLoading = step === "preview" && rowsQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) return; // bloqueia fechar durante operação
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-5xl overflow-y-auto"
        onPointerDownOutside={(e) => busy && e.preventDefault()}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>Envie uma planilha CSV ou XLSX com seus clientes.</DialogDescription>
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

        {busy && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {parsing
                ? (processingLabel ?? "Processando arquivo...")
                : validateMutation.isPending
                  ? "Validando linhas no servidor..."
                  : "Importando clientes — não feche esta janela..."}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-primary"
                style={{ animation: "progress-indeterminate 1.2s ease-in-out infinite" }}
              />
            </div>
            <style>{`@keyframes progress-indeterminate{0%{margin-left:-33%}100%{margin-left:100%}}`}</style>
          </div>
        )}

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3">
              <div className="text-sm">
                <div className="font-medium">Modelo de importação</div>
                <div className="text-xs text-muted-foreground">
                  Baixe um CSV real com as colunas aceitas.
                </div>
              </div>
              <Button type="button" variant="outline" onClick={downloadTemplateCsv} disabled={busy}>
                Baixar modelo CSV
              </Button>
            </div>
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 p-10 cursor-pointer hover:bg-muted/60">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <div className="font-medium">Selecione um arquivo</div>
                <div className="text-xs text-muted-foreground">CSV ou XLSX — até 10 MB</div>
              </div>
              <Input
                type="file"
                accept={ACCEPT}
                className="max-w-sm cursor-pointer bg-background"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {parsing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />{" "}
                  {processingLabel ?? "Processando arquivo..."}
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
                Tipo, Nome, Razão Social, Nome Fantasia, CPF/CNPJ, IE, IM, E-mail, Telefone,
                WhatsApp, Origem, Status, Observações, CEP, Rua, Número, Complemento, Bairro,
                Cidade, UF, País, Contato, Cargo, Tags. Variações de nome são reconhecidas
                automaticamente.
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
                  Mapeie ao menos "Nome" ou "Razão Social" para continuar. CPF/CNPJ e e-mail são
                  opcionais.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === "preview" && validation && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <Stat label="Total" value={validation.total} />
              <Stat label="Válidas" value={validation.valid} tone="ok" />
              <Stat label="Duplicados" value={validation.duplicates ?? 0} />
              <Stat
                label="Com erro"
                value={validation.invalid}
                tone={validation.invalid ? "err" : undefined}
              />
              <Stat label="Endereços" value={validation.addresses_to_create} />
              <Stat label="Contatos" value={validation.contacts_to_create} />
            </div>
            {validation.new_tags?.length > 0 && (
              <Alert>
                <AlertTitle className="text-sm">Tags serão criadas após confirmação</AlertTitle>
                <AlertDescription className="text-xs">
                  {validation.new_tags.join(", ")}
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

            {previewLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando prévia...
              </div>
            )}

            <ScrollArea className="h-[320px] rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="px-2 py-1.5">Nome / Razão Social</th>
                    <th className="px-2 py-1.5">CPF/CNPJ</th>
                    <th className="px-2 py-1.5">Telefone</th>
                    <th className="px-2 py-1.5">E-mail</th>
                    <th className="px-2 py-1.5">Cidade</th>
                    <th className="px-2 py-1.5">UF</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-1.5">{r.row_number}</td>
                      <td className="px-2 py-1.5">{r.mapped_data?.customer_type ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.mapped_data?.corporate_name ?? r.mapped_data?.name ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{r.mapped_data?.cpf_cnpj ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.mapped_data?.phone ?? r.mapped_data?.whatsapp ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">{r.mapped_data?.email ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.mapped_data?.addr_city ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.mapped_data?.addr_state ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <ImportStatusBadge action={r.action} />
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
                  Clientes novos: {previewRows.filter((r: any) => r.action === "CREATE").length}
                </div>
                <div>
                  Clientes atualizados:{" "}
                  {previewRows.filter((r: any) => r.action === "UPDATE").length}
                </div>
                <div>Linhas com erro: {validation.invalid}</div>
                <div>Endereços a criar: {validation.addresses_to_create}</div>
                <div>Contatos a criar: {validation.contacts_to_create}</div>
                <div>Tags a criar: {validation.new_tags?.length ?? 0}</div>
              </AlertDescription>
            </Alert>

            {validation.new_tags?.length > 0 && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={createTags}
                  onChange={(e) => setCreateTags(e.target.checked)}
                />
                Criar tags inexistentes ({validation.new_tags.length})
              </label>
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
              {result.addresses} endereços · {result.contacts} contatos
            </AlertDescription>
          </Alert>
        )}

        {(validateMutation.error || confirmMutation.error) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro na importação</AlertTitle>
            <AlertDescription className="text-xs">
              {(validateMutation.error as any)?.message ?? (confirmMutation.error as any)?.message}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={busy}>
                Voltar
              </Button>
              <Button onClick={() => validateMutation.mutate()} disabled={!mappingReady || busy}>
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
                onClick={() => confirmMutation.mutate()}
                disabled={
                  !validation ||
                  validation.valid === 0 ||
                  previewLoading ||
                  confirmMutation.isPending
                }
              >
                {confirmMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Importar clientes válidos
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")} disabled={busy}>
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
  const color = tone === "ok" ? "text-emerald-600" : tone === "err" ? "text-destructive" : "";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-micro uppercase text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ImportStatusBadge({ action }: { action: string }) {
  const variant: any =
    action === "CREATE" ? "default" : action === "SKIP" ? "secondary" : "destructive";
  const label = action === "CREATE" ? "Válido" : action === "SKIP" ? "Duplicado" : "Erro";
  return <Badge variant={variant}>{label}</Badge>;
}
