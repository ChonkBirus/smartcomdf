import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, Sparkles, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { calculateSuggestedPrice, getCompanyCostSettings, type PricingResult } from "@/lib/pricing.functions";
import { usePermissions } from "@/lib/permissions";

type Rates = {
  tax_rate: string;
  card_fee_rate: string;
  commission_rate: string;
  warranty_reserve_rate: string;
  operational_cost_rate: string;
  fixed_cost_allocation_rate: string;
  desired_margin_rate: string;
  additional_costs: string;
};

const EMPTY_RATES: Rates = {
  tax_rate: "",
  card_fee_rate: "",
  commission_rate: "",
  warranty_reserve_rate: "",
  operational_cost_rate: "",
  fixed_cost_allocation_rate: "",
  desired_margin_rate: "",
  additional_costs: "0",
};

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const PCT = (r: number) =>
  `${(Math.round(r * 10000) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;

function pctToRate(s: string): number | undefined {
  if (s === "" || s == null) return undefined;
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  return n / 100;
}

function rateToPct(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return "";
  return String(Math.round(r * 10000) / 100);
}

export function ProductPricingSuggestion({
  costPrice,
  onApply,
}: {
  costPrice: string | number;
  onApply: (price: number) => void;
}) {
  const { has } = usePermissions();
  const canViewCosts = has("finance.view_costs");
  const canViewPricing = has("finance.pricing.view");
  const canView = canViewPricing && canViewCosts;
  const canApply = canView && has("finance.apply_suggested_price");

  const missingPermissions = [
    !canViewPricing && { slug: "finance.pricing.view", label: "Visualizar precificação" },
    !canViewCosts && { slug: "finance.view_costs", label: "Visualizar custos" },
    !canApply && canView && { slug: "finance.apply_suggested_price", label: "Aplicar preço sugerido" },
  ].filter(Boolean) as { slug: string; label: string }[];

  const missingMessage = (extra?: string) =>
    missingPermissions.length === 0
      ? ""
      : `${extra ?? "Permissões necessárias"}: ${missingPermissions
          .map((p) => `${p.label} (${p.slug})`)
          .join(", ")}. Solicite ao responsável financeiro.`;

  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<Rates>(EMPTY_RATES);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loadedDefaults, setLoadedDefaults] = useState(false);

  const fetchSettings = useServerFn(getCompanyCostSettings);
  const calc = useServerFn(calculateSuggestedPrice);

  const costNumber = useMemo(() => {
    const n = Number(String(costPrice).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [costPrice]);

  useEffect(() => {
    if (!open || loadedDefaults) return;
    fetchSettings()
      .then((r) => {
        const s = r?.settings;
        if (s) {
          setRates({
            tax_rate: rateToPct(s.default_tax_rate),
            card_fee_rate: rateToPct(s.default_card_fee_rate),
            commission_rate: rateToPct(s.default_commission_rate),
            warranty_reserve_rate: rateToPct(s.default_warranty_reserve_rate),
            operational_cost_rate: rateToPct(s.default_operational_cost_rate),
            fixed_cost_allocation_rate: rateToPct(s.default_fixed_cost_allocation_rate),
            desired_margin_rate: rateToPct(s.default_desired_margin_rate),
            additional_costs: "0",
          });
        }
        setLoadedDefaults(true);
      })
      .catch(() => setLoadedDefaults(true));
  }, [open, loadedDefaults, fetchSettings]);

  const mutation = useMutation({
    mutationFn: async () =>
      calc({
        data: {
          cost_price: costNumber,
          additional_costs: Number(rates.additional_costs.replace(",", ".")) || 0,
          tax_rate: pctToRate(rates.tax_rate),
          card_fee_rate: pctToRate(rates.card_fee_rate),
          commission_rate: pctToRate(rates.commission_rate),
          warranty_reserve_rate: pctToRate(rates.warranty_reserve_rate),
          operational_cost_rate: pctToRate(rates.operational_cost_rate),
          fixed_cost_allocation_rate: pctToRate(rates.fixed_cost_allocation_rate),
          desired_margin_rate: pctToRate(rates.desired_margin_rate),
          use_company_defaults: false,
        },
      }),
    onSuccess: (r) => setResult(r.result),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao calcular preço"),
  });

  function handleApply() {
    if (!result?.ok) return;
    if (!canApply) {
      toast.error("Sem permissão para aplicar preço sugerido.");
      return;
    }
    onApply(result.suggested_price);
    toast.success(`Preço sugerido aplicado: ${BRL(result.suggested_price)}`);
    setOpen(false);
  }

  if (!canView) {
    const missing = [
      !canViewPricing && "finance.pricing.view",
      !canViewCosts && "finance.view_costs",
    ].filter(Boolean).join(" e ");
    const reason = `Você não tem permissão para usar a sugestão de preço (faltando: ${missing}). Peça ao responsável financeiro.`;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        title={reason}
        aria-label={reason}
        onClick={() => toast.info(reason)}
        className="gap-2 pointer-events-auto opacity-60"
      >
        <Calculator className="h-4 w-4" />
        Sugerir preço
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={costNumber <= 0}
        className="gap-2"
      >
        <Calculator className="h-4 w-4" />
        Sugerir preço
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Precificação sugerida por markup
            </DialogTitle>
            <DialogDescription>
              Custo base: <strong>{BRL(costNumber)}</strong>. Ajuste percentuais e calcule o preço mínimo de venda para
              cobrir custos, impostos, taxas e a margem desejada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PctField label="Impostos (%)" v={rates.tax_rate} onChange={(v) => setRates({ ...rates, tax_rate: v })} />
            <PctField label="Taxa cartão (%)" v={rates.card_fee_rate} onChange={(v) => setRates({ ...rates, card_fee_rate: v })} />
            <PctField label="Comissão (%)" v={rates.commission_rate} onChange={(v) => setRates({ ...rates, commission_rate: v })} />
            <PctField label="Reserva garantia (%)" v={rates.warranty_reserve_rate} onChange={(v) => setRates({ ...rates, warranty_reserve_rate: v })} />
            <PctField label="Custo operacional (%)" v={rates.operational_cost_rate} onChange={(v) => setRates({ ...rates, operational_cost_rate: v })} />
            <PctField label="Rateio fixo (%)" v={rates.fixed_cost_allocation_rate} onChange={(v) => setRates({ ...rates, fixed_cost_allocation_rate: v })} />
            <PctField label="Margem desejada (%)" v={rates.desired_margin_rate} onChange={(v) => setRates({ ...rates, desired_margin_rate: v })} />
            <div>
              <Label className="text-xs">Custos adicionais (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={rates.additional_costs}
                onChange={(e) => setRates({ ...rates, additional_costs: e.target.value })}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || costNumber <= 0}
            className="w-full"
          >
            {mutation.isPending ? "Calculando..." : "Calcular preço sugerido"}
          </Button>

          {result && (
            <>
              <Separator />
              {result.ok ? (
                <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preço sugerido</span>
                    <span className="text-2xl font-bold text-primary">{BRL(result.suggested_price)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Row label="Custo base" value={BRL(result.cost_base)} />
                    <Row label="Markup" value={`${result.markup_percentage.toFixed(2)}%`} />
                    <Row label="Deduções (s/ margem)" value={PCT(result.deductions_without_margin_rate)} />
                    <Row label="Margem estimada" value={PCT(result.estimated_margin_rate)} />
                    <Row label="Lucro estimado" value={BRL(result.estimated_profit)} />
                    <Row label="Multiplicador" value={`${result.markup_multiplier.toFixed(4)}×`} />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Fórmula: preço = custo ÷ (1 − deduções totais)
                  </Badge>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <span>{result.reason}</span>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={!result?.ok || !canApply}
              title={!canApply ? "Sem permissão" : undefined}
            >
              Aplicar como preço de venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PctField({ label, v, onChange }: { label: string; v: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={v}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
