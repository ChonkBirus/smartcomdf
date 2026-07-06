import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getBankAccountBalances } from "@/lib/bank-accounts.functions";
import { useCompanyId } from "@/hooks/use-company-id";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AccountBalancesCard() {
  const companyId = useCompanyId();
  const fn = useServerFn(getBankAccountBalances);
  const { data, isLoading } = useQuery({
    queryKey: ["fin-bank-balances", companyId],
    queryFn: () => fn(),
    enabled: !!companyId,
  });

  const rows = (data ?? []).filter((r) => r.active || r.income > 0 || r.expense > 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <Wallet className="h-4 w-4" /> Saldos por conta
          </h3>
          <span className="text-xs text-muted-foreground">Baseado em lançamentos pagos</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta cadastrada. Vá em <strong>Configurações → Contas financeiras</strong> para criar Carteira, Banco X, etc.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => (
              <div key={a.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      + {BRL(a.income)} · − {BRL(a.expense)}
                    </div>
                  </div>
                  <div className={`text-right font-mono text-sm ${a.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                    {BRL(a.balance)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
