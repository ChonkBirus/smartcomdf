import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseStatementFile, type ParsedTx } from "@/lib/bank-statement-parsers";
import {
  createBankStatementImport, confirmBankStatementImport, cancelBankStatementImport,
  listBankAccountsForImport,
} from "@/lib/bank-statement-import.functions";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".ofx,.qfx,.csv,.txt,.xls,.xlsx";

type Step = "upload" | "preview" | "done";
type DraftResult = { import_id: string; total: number; inserted: number; duplicates: number };

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BankStatementImportDialog({
  open, onOpenChange, onImported,
}: { open: boolean; onOpenChange: (o: boolean) => void; onImported?: () => void }) {
  const createFn = useServerFn(createBankStatementImport);
  const confirmFn = useServerFn(confirmBankStatementImport);
  const cancelFn = useServerFn(cancelBankStatementImport);
  const listAccountsFn = useServerFn(listBankAccountsForImport);

  const accountsQuery = useQuery({
    queryKey: ["bank-accounts-for-import"],
    queryFn: () => listAccountsFn(),
    enabled: open,
  });

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedTx[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileType, setFileType] = useState<"OFX" | "CSV" | "XLSX" | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string>("__none__");
  const [draft, setDraft] = useState<DraftResult | null>(null);

  const reset = () => {
    setStep("upload"); setFile(null); setRows([]); setWarnings([]);
    setFileType(null); setBankAccountId("__none__"); setDraft(null);
  };

  const handleFile = async (f: File) => {
    if (f.size > MAX_BYTES) { toast.error("Arquivo excede 10 MB."); return; }
    setFile(f); setParsing(true);
    try {
      const res = await parseStatementFile(f);
      if (!res.rows.length) {
        toast.error("Nenhuma transação reconhecida no arquivo.");
        setWarnings(res.warnings);
        setParsing(false);
        return;
      }
      setRows(res.rows);
      setWarnings(res.warnings);
      setFileType(res.fileType);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar arquivo.");
    } finally {
      setParsing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !fileType) throw new Error("Arquivo ausente.");
      return createFn({
        data: {
          file_name: file.name,
          file_type: fileType,
          file_size: file.size,
          bank_account_id: bankAccountId === "__none__" ? null : bankAccountId,
          rows,
        },
      });
    },
    onSuccess: (data) => { setDraft(data); setStep("done"); onImported?.(); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmFn({ data: { import_id: draft!.import_id } }),
    onSuccess: () => { toast.success("Importação concluída."); onImported?.(); onOpenChange(false); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const discardMutation = useMutation({
    mutationFn: () => cancelFn({ data: { import_id: draft!.import_id } }),
    onSuccess: () => { toast.success("Importação descartada."); onImported?.(); onOpenChange(false); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    let credit = 0, debit = 0;
    for (const r of rows) {
      if (r.amount >= 0) credit += r.amount; else debit += r.amount;
    }
    return { credit, debit, net: credit + debit };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar extrato bancário</DialogTitle>
          <DialogDescription>
            Aceitamos OFX, CSV, XLSX ou XLS — até 10 MB. As transações duplicadas são detectadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs">
          {(["upload", "preview", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <Badge variant={step === s ? "default" : "secondary"} className="capitalize">
                {i + 1}. {s === "upload" ? "Upload" : s === "preview" ? "Prévia" : "Concluído"}
              </Badge>
              {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 p-10 cursor-pointer hover:bg-muted/60">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <div className="font-medium">Selecione o arquivo do extrato</div>
                <div className="text-xs text-muted-foreground">OFX, CSV, XLSX ou XLS — até 10 MB</div>
              </div>
              <Input type="file" accept={ACCEPT} className="hidden" disabled={parsing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {parsing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processando arquivo...
                </div>
              )}
              {file && !parsing && (
                <div className="flex items-center gap-2 text-xs">
                  <FileSpreadsheet className="h-4 w-4" />{file.name}
                </div>
              )}
            </label>
            {!!warnings.length && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Não foi possível ler o arquivo</AlertTitle>
                <AlertDescription className="text-xs">{warnings.join(" · ")}</AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertTitle>Colunas reconhecidas (CSV/XLSX)</AlertTitle>
              <AlertDescription className="text-xs">
                Data, Descrição/Histórico, Valor (ou Crédito/Débito separados), Documento, Tipo, ID/FITID.
                Para OFX usamos as tags <code>DTPOSTED</code>, <code>TRNAMT</code>, <code>MEMO</code>, <code>FITID</code>.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Linhas" value={rows.length.toString()} />
              <Stat label="Entradas" value={BRL(totals.credit)} tone="ok" />
              <Stat label="Saídas" value={BRL(totals.debit)} tone="err" />
              <Stat label="Saldo do período" value={BRL(totals.net)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Conta bancária (opcional)</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Não vincular —</SelectItem>
                    {(accountsQuery.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground self-end">
                Arquivo: <span className="font-mono">{file?.name}</span> · Formato: {fileType}
              </div>
            </div>

            {!!warnings.length && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{warnings.join(" · ")}</AlertDescription>
              </Alert>
            )}

            <ScrollArea className="h-[320px] rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-left">
                  <tr>
                    <th className="px-2 py-1.5">Data</th>
                    <th className="px-2 py-1.5">Descrição</th>
                    <th className="px-2 py-1.5">Documento</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="px-2 py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5 tabular-nums">{r.transaction_date}</td>
                      <td className="px-2 py-1.5">{r.description || "—"}</td>
                      <td className="px-2 py-1.5">{r.document_number || "—"}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant={r.type === "CREDIT" ? "default" : "secondary"}>
                          {r.type === "CREDIT" ? "Entrada" : "Saída"}
                        </Badge>
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${r.amount >= 0 ? "text-success" : "text-destructive"}`}>
                        {BRL(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 500 && (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  Exibindo as 500 primeiras de {rows.length} linhas. Todas serão importadas.
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {step === "done" && draft && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Prévia salva</AlertTitle>
            <AlertDescription className="text-xs">
              {draft.inserted} novas transações · {draft.duplicates} duplicadas ignoradas · {draft.total} processadas.
              Confirme para concluir a importação ou descarte para apagar.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !rows.length}>
                {importMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Importar para prévia
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={() => discardMutation.mutate()} disabled={discardMutation.isPending}>
                {discardMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Descartar
              </Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                {confirmMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Confirmar importação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "err" }) {
  const color = tone === "ok" ? "text-success" : tone === "err" ? "text-destructive" : "";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-micro uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
