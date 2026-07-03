import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBankStatementImports, type BankStatementImport } from "@/lib/bank-statement-import.functions";
import { BankStatementImportDialog } from "./BankStatementImportDialog";

const STATUS_LABEL: Record<BankStatementImport["status"], { label: string; cls: string }> = {
  UPLOADED: { label: "Recebido", cls: "bg-muted text-muted-foreground" },
  PARSING: { label: "Processando", cls: "bg-muted text-muted-foreground" },
  PREVIEW: { label: "Em prévia", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  IMPORTED: { label: "Importado", cls: "bg-success/15 text-success" },
  FAILED: { label: "Falhou", cls: "bg-destructive/15 text-destructive" },
  CANCELED: { label: "Cancelado", cls: "bg-muted text-muted-foreground line-through" },
};

export function BankReconciliationPanel() {
  const listFn = useServerFn(listBankStatementImports);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["bank-statement-imports"],
    queryFn: () => listFn(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["bank-statement-imports"] });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-base font-semibold">Conciliação bancária</div>
          <div className="text-xs text-muted-foreground">
            Importe o extrato do banco (OFX, CSV ou XLSX) e o SmartPro casa cada lançamento com seus pagamentos.
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Upload className="mr-1.5 h-4 w-4" /> Importar extrato
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando importações...
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Nenhuma importação ainda"
          description="Envie um arquivo OFX, CSV ou XLSX exportado do seu internet banking para começar."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Importadas</TableHead>
                  <TableHead className="text-right">Duplicadas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((imp) => {
                  const st = STATUS_LABEL[imp.status];
                  const account = imp.bank_account
                    ? imp.bank_account.account_name
                      ? `${imp.bank_account.bank_name} — ${imp.bank_account.account_name}`
                      : imp.bank_account.bank_name
                    : "—";
                  return (
                    <TableRow key={imp.id}>
                      <TableCell>
                        <div className="font-medium">{imp.file_name}</div>
                        <div className="text-xs text-muted-foreground">{imp.file_type}</div>
                      </TableCell>
                      <TableCell className="text-sm">{account}</TableCell>
                      <TableCell className="text-right tabular-nums">{imp.total_rows}</TableCell>
                      <TableCell className="text-right tabular-nums">{imp.imported_rows}</TableCell>
                      <TableCell className="text-right tabular-nums">{imp.duplicate_rows}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(imp.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <BankStatementImportDialog open={open} onOpenChange={setOpen} onImported={refresh} />
    </div>
  );
}
