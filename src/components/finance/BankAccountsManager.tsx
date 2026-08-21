import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Wallet, PowerOff, Power, Pencil, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LabelWithHelp } from "@/components/ui/FieldHelp";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  setBankAccountActive,
  type BankAccount,
} from "@/lib/bank-accounts.functions";
import { useCompanyId } from "@/hooks/use-company-id";

const ACCOUNT_TYPES = [
  { value: "WALLET", label: "Carteira" },
  { value: "CASH", label: "Caixa físico" },
  { value: "CHECKING", label: "Conta corrente" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "PIX", label: "Pix" },
  { value: "CARD", label: "Cartão" },
  { value: "OTHER", label: "Outra" },
];

function typeLabel(v: string | null) {
  return ACCOUNT_TYPES.find((t) => t.value === v)?.label ?? "—";
}

export function BankAccountsManager() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const listFn = useServerFn(listBankAccounts);
  const createFn = useServerFn(createBankAccount);
  const updateFn = useServerFn(updateBankAccount);
  const activeFn = useServerFn(setBankAccountActive);

  const q = useQuery({
    queryKey: ["fin-bank-accounts-all", companyId],
    queryFn: () => listFn({ data: { activeOnly: false } }),
  });

  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<string>("WALLET");
  const [balance, setBalance] = useState("");
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fin-bank-accounts-all", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-bank-accounts", companyId, true] });
    qc.invalidateQueries({ queryKey: ["fin-bank-balances", companyId] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!bankName.trim()) throw new Error("Informe o nome do banco/conta.");
      return createFn({
        data: {
          bank_name: bankName.trim(),
          account_name: accountName.trim() || null,
          account_type: accountType,
          balance: Number((balance || "0").replace(",", ".")) || 0,
        },
      });
    },
    onSuccess: () => {
      toast.success("Conta criada.");
      setBankName("");
      setAccountName("");
      setBalance("");
      setAccountType("WALLET");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const toggle = useMutation({
    mutationFn: async (a: BankAccount) => activeFn({ data: { id: a.id, active: !a.active } }),
    onSuccess: () => {
      toast.success("Atualizado.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      return updateFn({
        data: {
          id: editing.id,
          bank_name: editing.bank_name,
          account_name: editing.account_name,
          account_type: editing.account_type,
          balance: Number(editing.balance) || 0,
        },
      });
    },
    onSuccess: () => {
      toast.success("Conta atualizada.");
      setEditing(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="md:col-span-2 space-y-1.5">
            <LabelWithHelp
              label="Nome (banco ou apelido)"
              help="Ex.: Carteira, Nubank, Banco do Brasil, Caixa."
              required
            />
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Ex.: Nubank"
            />
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              label="Detalhe (opcional)"
              help="Identificação da conta, como 'PJ' ou o número."
            />
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="PJ, pessoal…"
            />
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp label="Tipo" help="Categoria da conta financeira." />
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp
              label="Saldo inicial"
              help="Quanto existe hoje nesta conta (opcional). Serve como ponto de partida para o cálculo de saldos."
            />
            <Input
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="md:col-span-5 flex justify-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending || !bankName.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar conta
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Wallet className="h-4 w-4" /> Contas cadastradas
          </h3>
          {(q.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="Nenhuma conta cadastrada"
              description="Cadastre Carteira, seu banco principal e outras contas para vincular aos lançamentos."
            />
          ) : (
            <ul className="divide-y">
              {(q.data ?? []).map((a) => {
                const isEdit = editing?.id === a.id;
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    {isEdit ? (
                      <>
                        <Input
                          className="w-40"
                          value={editing!.bank_name}
                          onChange={(e) => setEditing({ ...editing!, bank_name: e.target.value })}
                        />
                        <Input
                          className="w-36"
                          placeholder="Detalhe"
                          value={editing!.account_name ?? ""}
                          onChange={(e) =>
                            setEditing({ ...editing!, account_name: e.target.value })
                          }
                        />
                        <Select
                          value={editing!.account_type ?? "OTHER"}
                          onValueChange={(v) => setEditing({ ...editing!, account_type: v })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="w-28"
                          inputMode="decimal"
                          value={String(editing!.balance ?? "")}
                          onChange={(e) =>
                            setEditing({
                              ...editing!,
                              balance: Number(e.target.value.replace(",", ".")) || 0,
                            })
                          }
                        />
                        <div className="ml-auto flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => saveEdit.mutate()}
                            disabled={saveEdit.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                a.active
                                  ? "font-medium"
                                  : "font-medium text-muted-foreground line-through"
                              }
                            >
                              {a.bank_name}
                              {a.account_name ? ` — ${a.account_name}` : ""}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {typeLabel(a.account_type)}
                            </Badge>
                            {!a.active && (
                              <Badge variant="secondary" className="text-[10px]">
                                Inativa
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Saldo inicial: R$ {a.balance.toFixed(2)}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggle.mutate(a)}
                          title={a.active ? "Inativar" : "Ativar"}
                        >
                          {a.active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
