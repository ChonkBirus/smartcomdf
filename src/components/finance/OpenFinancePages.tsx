/**
 * Open Finance & Bank Reconciliation — UI.
 *
 * Two top-level pages exported:
 *   - <OpenFinancePage />          → connections, accounts, imported bank txs
 *   - <BankReconciliationPage />   → suggestion table + confirm/ignore/create
 *
 * All data comes from server functions in
 *   src/lib/open-finance.functions.ts
 *   src/lib/reconciliation.functions.ts
 *
 * Empty/error states are first-class: no fake data, no fake balances.
 * When the provider is not configured we render an explicit empty state and
 * disable the "Connect account" action.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  Plug,
  RefreshCcw,
  ShieldX,
  Banknote,
  CheckCircle2,
  XCircle,
  Plus,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";

import {
  getOpenFinanceStatus,
  listOpenFinanceConnections,
  listBankAccounts,
  listOpenFinanceTransactions,
  createOpenFinanceConnection,
  syncOpenFinanceAccounts,
  syncOpenFinanceTransactions,
  revokeOpenFinanceConnection,
  type OpenFinanceConnection,
  type BankAccount,
  type BankTransaction,
  type ConnectionStatus,
} from "@/lib/open-finance.functions";
import {
  listReconciliationSuggestions,
  confirmReconciliation,
  ignoreBankTransaction,
  createFinancialTransactionFromBankTransaction,
  type ReconciliationSuggestion,
} from "@/lib/reconciliation.functions";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function OpenFinanceStatusBadge({ status }: { status: ConnectionStatus }) {
  const map: Record<
    ConnectionStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    PENDING: { label: "Pendente", variant: "secondary" },
    CONNECTED: { label: "Conectada", variant: "default" },
    SYNCING: { label: "Sincronizando", variant: "secondary" },
    ERROR: { label: "Erro", variant: "destructive" },
    EXPIRED: { label: "Expirada", variant: "outline" },
    REVOKED: { label: "Revogada", variant: "outline" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Open Finance page
// ─────────────────────────────────────────────────────────────────────────────

export function OpenFinancePage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getOpenFinanceStatus);
  const listConns = useServerFn(listOpenFinanceConnections);
  const listAccs = useServerFn(listBankAccounts);
  const listTx = useServerFn(listOpenFinanceTransactions);
  const createConn = useServerFn(createOpenFinanceConnection);
  const syncAccs = useServerFn(syncOpenFinanceAccounts);
  const syncTx = useServerFn(syncOpenFinanceTransactions);
  const revoke = useServerFn(revokeOpenFinanceConnection);

  const status = useQuery({
    queryKey: ["of-status"],
    queryFn: () => getStatus(),
  });
  const connections = useQuery({
    queryKey: ["of-connections"],
    queryFn: () => listConns(),
    enabled: status.data?.configured !== false,
  });
  const accounts = useQuery({
    queryKey: ["of-accounts"],
    queryFn: () => listAccs(),
    enabled: status.data?.configured !== false,
  });
  const transactions = useQuery({
    queryKey: ["of-transactions"],
    queryFn: () => listTx({ data: {} }),
    enabled: status.data?.configured !== false,
  });

  const [revokeTarget, setRevokeTarget] = useState<OpenFinanceConnection | null>(null);

  const connectMut = useMutation({
    mutationFn: () => createConn({ data: {} }),
    onSuccess: (res) => {
      if (res?.connectToken) {
        toast.message("Token gerado. Abra o widget do provedor para autorizar.");
        // The frontend integration with provider widgets is wired here once
        // we ship the production SDK call (Pluggy Connect / Belvo Widget).
      } else {
        toast.success("Conexão iniciada.");
      }
      qc.invalidateQueries({ queryKey: ["of-connections"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar conexão."),
  });

  const syncAccsMut = useMutation({
    mutationFn: (connectionId: string) => syncAccs({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Contas sincronizadas.");
      qc.invalidateQueries({ queryKey: ["of-accounts"] });
      qc.invalidateQueries({ queryKey: ["of-connections"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao sincronizar contas."),
  });
  const syncTxMut = useMutation({
    mutationFn: (connectionId: string) => syncTx({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Transações sincronizadas.");
      qc.invalidateQueries({ queryKey: ["of-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao sincronizar transações."),
  });
  const revokeMut = useMutation({
    mutationFn: (connectionId: string) => revoke({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Acesso revogado.");
      setRevokeTarget(null);
      qc.invalidateQueries({ queryKey: ["of-connections"] });
      qc.invalidateQueries({ queryKey: ["of-accounts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao revogar."),
  });

  if (status.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando integração…
      </div>
    );
  }

  // ── Provider NOT configured ────────────────────────────────────────────────
  if (status.data && !status.data.configured) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            icon={<Plug className="h-6 w-6" />}
            title="Open Finance ainda não configurado"
            description={
              status.data.reason ??
              "As credenciais do provedor Open Finance ainda não foram configuradas. Após configurar Pluggy, Belvo ou outro provider, será possível conectar contas empresariais."
            }
          />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Defina <code>OPEN_FINANCE_PROVIDER</code> e as credenciais do provedor nas variáveis de
            ambiente do servidor. Nenhum dado bancário fictício é exibido.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Provider configured ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Intro + connect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" /> Open Finance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conecte sua conta empresarial para importar saldos e movimentações bancárias com
            segurança. O SmartPro nunca pede sua senha bancária — a autorização é feita no ambiente
            do provedor Open Finance.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
              {connectMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Conectar conta empresarial
            </Button>
            <Badge variant="outline">
              Provedor: <span className="ml-1 font-mono">{status.data?.provider ?? "—"}</span>
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexões</CardTitle>
        </CardHeader>
        <CardContent>
          {!connections.data?.length ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="Nenhuma conexão Open Finance"
              description="Conecte sua primeira conta empresarial para começar."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Consentimento expira</TableHead>
                  <TableHead>Última sincronização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.provider}</TableCell>
                    <TableCell>
                      <OpenFinanceStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>{fmtDate(c.consent_expires_at)}</TableCell>
                    <TableCell>{fmtDateTime(c.last_sync_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={syncAccsMut.isPending}
                          onClick={() => syncAccsMut.mutate(c.id)}
                        >
                          <RefreshCcw className="mr-1 h-4 w-4" /> Contas
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={syncTxMut.isPending}
                          onClick={() => syncTxMut.mutate(c.id)}
                        >
                          <RefreshCcw className="mr-1 h-4 w-4" /> Transações
                        </Button>
                        {c.status !== "REVOKED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRevokeTarget(c)}
                          >
                            <ShieldX className="mr-1 h-4 w-4" /> Revogar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {connections.data?.some((c) => c.status === "ERROR" && c.error_message) && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              {connections.data.find((c) => c.status === "ERROR")?.error_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas bancárias</CardTitle>
        </CardHeader>
        <CardContent>
          {!accounts.data?.length ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="Nenhuma conta empresarial conectada"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Agência</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Atualizado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.data.map((a: BankAccount) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.bank_name}</TableCell>
                    <TableCell>{a.account_type ?? "—"}</TableCell>
                    <TableCell>{a.agency ?? "—"}</TableCell>
                    <TableCell className="font-mono">{a.account_number_masked ?? "—"}</TableCell>
                    <TableCell className="text-right">{BRL(Number(a.balance ?? 0))}</TableCell>
                    <TableCell>{fmtDateTime(a.last_sync_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Imported transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações bancárias importadas</CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions.data?.length ? (
            <EmptyState
              icon={<Banknote className="h-6 w-6" />}
              title="Nenhuma movimentação bancária importada"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Conciliação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.data.map((t: BankTransaction) => (
                  <TableRow key={t.id}>
                    <TableCell>{fmtDate(t.transaction_date)}</TableCell>
                    <TableCell className="max-w-[360px] truncate" title={t.description}>
                      {t.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.type === "CREDIT" ? "default" : "secondary"}>
                        {t.type === "CREDIT" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right ${t.type === "CREDIT" ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {BRL(Number(t.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.reconciliation_status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Revoke modal */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar acesso Open Finance</DialogTitle>
            <DialogDescription>
              O consentimento será revogado junto ao provedor. As contas vinculadas ficarão
              inativas. Os dados já importados permanecem no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={revokeMut.isPending}
              onClick={() => revokeTarget && revokeMut.mutate(revokeTarget.id)}
            >
              {revokeMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation page
// ─────────────────────────────────────────────────────────────────────────────

export function BankReconciliationPage() {
  const qc = useQueryClient();
  const listSug = useServerFn(listReconciliationSuggestions);
  const confirmFn = useServerFn(confirmReconciliation);
  const ignoreFn = useServerFn(ignoreBankTransaction);
  const createFn = useServerFn(createFinancialTransactionFromBankTransaction);

  const suggestions = useQuery({
    queryKey: ["of-suggestions"],
    queryFn: () => listSug({ data: {} }),
  });

  const [ignoreTarget, setIgnoreTarget] = useState<{ id: string } | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["of-suggestions"] });
    qc.invalidateQueries({ queryKey: ["of-transactions"] });
    qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    qc.invalidateQueries({ queryKey: ["finance-overview"] });
  };

  const confirmMut = useMutation({
    mutationFn: (v: {
      bankTransactionId: string;
      financialTransactionId: string;
      confidenceScore: number;
    }) =>
      confirmFn({
        data: {
          bankTransactionId: v.bankTransactionId,
          financialTransactionId: v.financialTransactionId,
          confidenceScore: v.confidenceScore,
          matchedBy: "MANUAL",
        },
      }),
    onSuccess: () => {
      toast.success("Transação conciliada.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao conciliar."),
  });

  const ignoreMut = useMutation({
    mutationFn: (v: { bankTransactionId: string; reason?: string }) => ignoreFn({ data: v }),
    onSuccess: () => {
      toast.success("Transação ignorada.");
      setIgnoreTarget(null);
      setIgnoreReason("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao ignorar."),
  });

  const createMut = useMutation({
    mutationFn: (bankTransactionId: string) => createFn({ data: { bankTransactionId } }),
    onSuccess: () => {
      toast.success("Lançamento criado a partir do extrato.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar lançamento."),
  });

  if (suggestions.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando sugestões…
      </div>
    );
  }

  const rows = suggestions.data ?? [];
  if (!rows.length) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Nenhuma transação pendente de conciliação"
            description="Quando houver movimentações bancárias importadas, elas aparecerão aqui para conferência."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conciliação bancária</CardTitle>
        <p className="text-sm text-muted-foreground">
          Confira se os lançamentos do ERP batem com o extrato bancário.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Sugestão</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s: ReconciliationSuggestion) => {
              const best = s.candidates[0];
              const tierColor =
                best?.tier === "HIGH"
                  ? "default"
                  : best?.tier === "MEDIUM"
                    ? "secondary"
                    : "outline";
              return (
                <TableRow key={s.bankTransaction.id}>
                  <TableCell>{fmtDate(s.bankTransaction.transaction_date)}</TableCell>
                  <TableCell
                    className="max-w-[300px] truncate"
                    title={s.bankTransaction.description}
                  >
                    {s.bankTransaction.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.bankTransaction.type === "CREDIT" ? "default" : "secondary"}>
                      {s.bankTransaction.type === "CREDIT" ? "Entrada" : "Saída"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right ${s.bankTransaction.type === "CREDIT" ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {BRL(Number(s.bankTransaction.amount))}
                  </TableCell>
                  <TableCell>
                    {best ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={tierColor as any}>
                            {best.tier === "HIGH"
                              ? "Alta confiança"
                              : best.tier === "MEDIUM"
                                ? "Média"
                                : "Baixa"}{" "}
                            ({best.score})
                          </Badge>
                        </div>
                        <span
                          className="text-xs text-muted-foreground truncate max-w-[260px]"
                          title={best.description}
                        >
                          {best.description} · {BRL(best.amount)} · {fmtDate(best.date)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem correspondência</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      {best && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={confirmMut.isPending}
                          onClick={() =>
                            confirmMut.mutate({
                              bankTransactionId: s.bankTransaction.id,
                              financialTransactionId: best.financialTransactionId,
                              confidenceScore: best.score,
                            })
                          }
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" /> Conciliar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={createMut.isPending}
                        onClick={() => createMut.mutate(s.bankTransaction.id)}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Criar lançamento
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setIgnoreTarget({ id: s.bankTransaction.id })}
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Ignorar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!ignoreTarget} onOpenChange={(o) => !o && setIgnoreTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ignorar transação bancária</DialogTitle>
            <DialogDescription>
              Use para transferências entre contas, duplicidades ou movimentações que não devem
              entrar no financeiro do ERP.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo (opcional)"
            value={ignoreReason}
            onChange={(e) => setIgnoreReason(e.target.value)}
            maxLength={280}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIgnoreTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={ignoreMut.isPending}
              onClick={() =>
                ignoreTarget &&
                ignoreMut.mutate({
                  bankTransactionId: ignoreTarget.id,
                  reason: ignoreReason.trim() || undefined,
                })
              }
            >
              {ignoreMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ignorar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
