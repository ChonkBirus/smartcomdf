import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Calculator, Save, CheckCircle2, AlertTriangle, Sparkles, Settings2 } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldHelp, LabelWithHelp } from "@/components/ui/FieldHelp";
import { usePermissions } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import {
  getCompanyCostSettings,
  calculateSuggestedPrice,
  saveSimulation,
  listRecentSimulations,
  applySimulationToItem,
  listItemsForPricing,
} from "@/lib/pricing.functions";

type Rates = {
  tax_rate: string;
  card_fee_rate: string;
  commission_rate: string;
  warranty_reserve_rate: string;
  operational_cost_rate: string;
  fixed_cost_allocation_rate: string;
  pro_labore_rate: string;
  desired_margin_rate: string;
};

const zero: Rates = {
  tax_rate: "0",
  card_fee_rate: "0",
  commission_rate: "0",
  warranty_reserve_rate: "0",
  operational_cost_rate: "0",
  fixed_cost_allocation_rate: "0",
  pro_labore_rate: "0",
  desired_margin_rate: "15",
};

function pct(n: number | null | undefined) {
  return String(Number(((Number(n) || 0) * 100).toFixed(4)));
}
function toRate(s: string) {
  const n = Number((s || "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : 0;
}

export function PricingSimulatorPage() {
  const { has } = usePermissions();
  const canView = has("finance.pricing.view") || has("finance.manage");
  const canSave = has("finance.pricing.manage") || has("finance.manage");
  const canApply =
    has("finance.apply_suggested_price") || has("finance.pricing.manage") || has("finance.manage");

  if (!canView) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Precificação e markup" />
        <EmptyState
          icon={<Calculator className="h-6 w-6" />}
          title="Sem acesso"
          description="Você não tem permissão para visualizar precificação."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Precificação simples"
        description="Calcule o preço ideal de venda com base nos custos da sua empresa."
      />
      <Simulator canSave={canSave} canApply={canApply} />
    </div>
  );
}

function Simulator({ canSave, canApply }: { canSave: boolean; canApply: boolean }) {
  const qc = useQueryClient();
  const getSettings = useServerFn(getCompanyCostSettings);
  const calc = useServerFn(calculateSuggestedPrice);
  const save = useServerFn(saveSimulation);
  const listRecent = useServerFn(listRecentSimulations);
  const apply = useServerFn(applySimulationToItem);
  const listItems = useServerFn(listItemsForPricing);

  const settingsQ = useQuery({ queryKey: ["cost-settings"], queryFn: () => getSettings() });
  const recentQ = useQuery({
    queryKey: ["pricing-recent"],
    queryFn: () => listRecent({ data: { limit: 10 } }),
  });
  const [itemSearch, setItemSearch] = useState("");
  const itemsQ = useQuery({
    queryKey: ["pricing-items", itemSearch],
    queryFn: () => listItems({ data: { search: itemSearch || undefined } }),
  });

  const cfg = settingsQ.data?.settings ?? null;

  const [itemId, setItemId] = useState<string>("");
  const [itemName, setItemName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [additionalCosts, setAdditionalCosts] = useState("");
  const [rates, setRates] = useState<Rates>(zero);
  const [result, setResult] = useState<{
    ok: boolean;
    reason?: string;
    suggested_price: number;
    markup_multiplier: number;
    markup_percentage: number;
    estimated_margin_rate: number;
    estimated_profit: number;
  } | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // preencher defaults ao carregar cfg
  useEffect(() => {
    if (!cfg) return;
    setRates({
      tax_rate: pct(cfg.default_tax_rate),
      card_fee_rate: pct(cfg.default_card_fee_rate),
      commission_rate: pct(cfg.default_commission_rate),
      warranty_reserve_rate: pct(cfg.default_warranty_reserve_rate),
      operational_cost_rate: pct(cfg.default_operational_cost_rate),
      fixed_cost_allocation_rate: pct(cfg.default_fixed_cost_allocation_rate),
      pro_labore_rate: pct(cfg.pro_labore_percent),
      desired_margin_rate: pct(cfg.default_desired_margin_rate),
    });
  }, [cfg?.id]);

  const selectedItem = itemsQ.data?.find((i) => i.id === itemId) ?? null;
  useEffect(() => {
    if (selectedItem) {
      setItemName(selectedItem.name);
      if (!costPrice) setCostPrice(String(selectedItem.cost_price ?? ""));
    }
  }, [itemId]);

  const totalPct = useMemo(() => Object.values(rates).reduce((s, v) => s + toRate(v), 0), [rates]);

  const doCalc = async () => {
    const cost = Number(costPrice || 0);
    if (cost <= 0) return toast.error("Informe o preço de custo.");
    if (totalPct >= 1) {
      setResult({
        ok: false,
        reason:
          "Os percentuais de custos e margem somam 100% ou mais. Reduza custos ou margem para calcular o preço.",
        suggested_price: 0,
        markup_multiplier: 0,
        markup_percentage: 0,
        estimated_margin_rate: 0,
        estimated_profit: 0,
      });
      return;
    }
    try {
      const r = await calc({
        data: {
          cost_price: cost,
          additional_costs: Number(additionalCosts || 0),
          tax_rate: toRate(rates.tax_rate),
          card_fee_rate: toRate(rates.card_fee_rate),
          commission_rate: toRate(rates.commission_rate),
          warranty_reserve_rate: toRate(rates.warranty_reserve_rate),
          operational_cost_rate: toRate(rates.operational_cost_rate),
          fixed_cost_allocation_rate: toRate(rates.fixed_cost_allocation_rate),
          pro_labore_rate: toRate(rates.pro_labore_rate),
          desired_margin_rate: toRate(rates.desired_margin_rate),
          use_company_defaults: false,
        },
      });
      setResult(r.result as any);
      setSavedId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro.");
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!result?.ok) throw new Error("Calcule primeiro.");
      return save({
        data: {
          item_id: itemId || null,
          item_name: itemName.trim() || (selectedItem?.name ?? "Item avulso"),
          cost_price: Number(costPrice || 0),
          additional_costs: Number(additionalCosts || 0),
          tax_rate: toRate(rates.tax_rate),
          card_fee_rate: toRate(rates.card_fee_rate),
          commission_rate: toRate(rates.commission_rate),
          warranty_reserve_rate: toRate(rates.warranty_reserve_rate),
          operational_cost_rate: toRate(rates.operational_cost_rate),
          fixed_cost_allocation_rate: toRate(rates.fixed_cost_allocation_rate),
          pro_labore_rate: toRate(rates.pro_labore_rate),
          desired_margin_rate: toRate(rates.desired_margin_rate),
          current_price: selectedItem?.sale_price ?? null,
        },
      });
    },
    onSuccess: (row: any) => {
      setSavedId(row.id);
      toast.success("Simulação salva.");
      qc.invalidateQueries({ queryKey: ["pricing-recent"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!savedId) throw new Error("Salve a simulação antes.");
      if (!itemId) throw new Error("Selecione um produto.");
      return apply({ data: { simulation_id: savedId, item_id: itemId } });
    },
    onSuccess: (r: any) => {
      toast.success(`Preço aplicado: ${formatCurrency(r.sale_price)}.`);
      setApplyOpen(false);
      qc.invalidateQueries({ queryKey: ["pricing-items"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["pricing-recent"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const applyDefaults = () => {
    if (!cfg) return;
    setRates({
      tax_rate: pct(cfg.default_tax_rate),
      card_fee_rate: pct(cfg.default_card_fee_rate),
      commission_rate: pct(cfg.default_commission_rate),
      warranty_reserve_rate: pct(cfg.default_warranty_reserve_rate),
      operational_cost_rate: pct(cfg.default_operational_cost_rate),
      fixed_cost_allocation_rate: pct(cfg.default_fixed_cost_allocation_rate),
      pro_labore_rate: pct(cfg.pro_labore_percent),
      desired_margin_rate: pct(cfg.default_desired_margin_rate),
    });
    toast.success("Padrões da empresa aplicados.");
  };

  return (
    <>
      <div className="space-y-4">
        {/* PASSO 1 — Item */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                1
              </span>
              O que você quer precificar?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <LabelWithHelp
                  label="Produto/serviço cadastrado (opcional)"
                  help="Selecione um item já cadastrado para puxar o custo automaticamente. Deixe como 'Item avulso' para simular sem cadastro."
                />
                <Select
                  value={itemId || "__none__"}
                  onValueChange={(v) => setItemId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Item avulso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Item avulso</SelectItem>
                    {(itemsQ.data ?? []).map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <LabelWithHelp
                  label="Nome do item"
                  help="Como este item será identificado na simulação salva."
                />
                <Input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ex.: Central de alarme"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <LabelWithHelp
                  label="Custo do produto (R$)"
                  help="Quanto sua empresa paga para comprar ou produzir este item."
                  required
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <LabelWithHelp
                  label="Custos adicionais (R$)"
                  help="Outros custos ligados ao item, como frete, embalagem, deslocamento ou instalação terceirizada."
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={additionalCosts}
                  onChange={(e) => setAdditionalCosts(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PASSO 2 — Custos e margem */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  2
                </span>
                Custos e margem
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={applyDefaults} disabled={!cfg}>
                  Usar padrões da empresa
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/finance/pricing/settings">
                    <Settings2 className="mr-1 h-4 w-4" /> Configurar custos
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <PctField
                label="Impostos"
                help="Impostos sobre a venda, como Simples Nacional ou ISS."
                value={rates.tax_rate}
                onChange={(v) => setRates((r) => ({ ...r, tax_rate: v }))}
              />
              <PctField
                label="Taxa de cartão"
                help="Percentual retido pela maquininha ou gateway em vendas com cartão."
                value={rates.card_fee_rate}
                onChange={(v) => setRates((r) => ({ ...r, card_fee_rate: v }))}
              />
              <PctField
                label="Comissão"
                help="Percentual pago ao vendedor por esta venda."
                value={rates.commission_rate}
                onChange={(v) => setRates((r) => ({ ...r, commission_rate: v }))}
              />
              <PctField
                label="Reserva de garantia"
                help="Percentual reservado para cobrir garantias e retrabalhos futuros."
                value={rates.warranty_reserve_rate}
                onChange={(v) => setRates((r) => ({ ...r, warranty_reserve_rate: v }))}
              />
              <PctField
                label="Custos variáveis"
                help="Custos operacionais que aumentam com as vendas, como combustível e frete."
                value={rates.operational_cost_rate}
                onChange={(v) => setRates((r) => ({ ...r, operational_cost_rate: v }))}
              />
              <PctField
                label="Custos fixos alocados"
                help="Fatia dos custos fixos (aluguel, salários, sistema) que cabe a cada venda."
                value={rates.fixed_cost_allocation_rate}
                onChange={(v) => setRates((r) => ({ ...r, fixed_cost_allocation_rate: v }))}
              />
              <PctField
                label="Pró-labore"
                help="Valor destinado ao dono ou sócio. Costuma ser entre 3% e 8%."
                value={rates.pro_labore_rate}
                onChange={(v) => setRates((r) => ({ ...r, pro_labore_rate: v }))}
              />
              <PctField
                label="Margem desejada"
                help="Percentual de lucro que você quer manter depois de pagar tudo."
                value={rates.desired_margin_rate}
                onChange={(v) => setRates((r) => ({ ...r, desired_margin_rate: v }))}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Soma total de percentuais</span>
              <Badge
                variant={totalPct >= 1 ? "destructive" : totalPct >= 0.95 ? "secondary" : "outline"}
              >
                {(totalPct * 100).toFixed(2)}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* PASSO 3 — Resultado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                3
              </span>
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={doCalc}>
                <Calculator className="mr-2 h-4 w-4" /> Calcular preço
              </Button>
              <Button
                variant="outline"
                disabled={!result?.ok || !canSave || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                <Save className="mr-2 h-4 w-4" /> Salvar simulação
              </Button>
              <Button
                variant="secondary"
                disabled={!savedId || !itemId || !canApply}
                onClick={() => setApplyOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Aplicar ao produto
              </Button>
            </div>

            {!result && (
              <EmptyState
                icon={<Calculator className="h-6 w-6" />}
                title="Preencha os passos 1 e 2 e clique em Calcular preço"
                description="O preço sugerido aparecerá aqui em destaque."
              />
            )}
            {result && !result.ok && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{result.reason}</span>
              </div>
            )}
            {result?.ok && (
              <>
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Preço sugerido
                    <FieldHelp>
                      Preço calculado com base nos custos, taxas, pró-labore e margem desejada.
                    </FieldHelp>
                  </div>
                  <div className="mt-2 text-5xl font-black text-primary">
                    {formatCurrency(result.suggested_price)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat
                    label="Custo total"
                    value={formatCurrency(Number(costPrice || 0) + Number(additionalCosts || 0))}
                  />
                  <Stat label="Markup" value={`${result.markup_multiplier.toFixed(2)}x`} />
                  <Stat label="Lucro estimado" value={formatCurrency(result.estimated_profit)} />
                  <Stat
                    label="Margem estimada"
                    value={`${(result.estimated_margin_rate * 100).toFixed(2)}%`}
                  />
                </div>
                {selectedItem?.sale_price != null && (
                  <div className="text-xs text-muted-foreground">
                    Preço atual do produto: <b>{formatCurrency(Number(selectedItem.sale_price))}</b>
                  </div>
                )}
                <Accordion type="single" collapsible>
                  <AccordionItem value="how" className="border rounded-md px-3">
                    <AccordionTrigger className="text-sm">
                      Como esse preço foi calculado?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2">
                      <p>
                        <strong>Fórmula:</strong> Markup = 100 ÷ (100 − soma dos percentuais). O
                        preço é <em>(custo + custos adicionais) × markup</em>.
                      </p>
                      <p>
                        O sistema soma seus custos, impostos, taxas, comissões, pró-labore, custos
                        fixos e a margem desejada. Depois calcula um multiplicador (markup) que
                        garante cobrir tudo isso e ainda deixar a margem que você quer no bolso.
                      </p>
                      <p className="text-xs">
                        Neste cálculo: percentuais somam{" "}
                        <strong>{(totalPct * 100).toFixed(2)}%</strong> · markup{" "}
                        <strong>{result.markup_multiplier.toFixed(2)}x</strong> · margem líquida{" "}
                        <strong>{(result.estimated_margin_rate * 100).toFixed(2)}%</strong>.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas simulações */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas simulações</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Calculator className="h-6 w-6" />}
              title="Nenhuma simulação salva ainda"
              description="Ao salvar, ela aparece aqui e pode ser aplicada ao produto."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço sugerido</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead>Aplicado</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentQ.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.item_name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(s.cost_price))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(s.suggested_price))}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(s.markup_multiplier).toFixed(2)}x
                    </TableCell>
                    <TableCell className="text-right">
                      {(Number(s.estimated_margin_rate) * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      {s.applied_to_item ? <CheckCircle2 className="h-4 w-4 text-primary" /> : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={applyOpen} onOpenChange={setApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar preço sugerido ao produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O preço de venda de <b>{selectedItem?.name ?? itemName}</b> será atualizado para{" "}
              <b>{result ? formatCurrency(result.suggested_price) : ""}</b>. O custo do produto não
              será alterado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyMut.mutate()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function PctField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      {help ? (
        <LabelWithHelp label={`${label} (%)`} help={help} />
      ) : (
        <Label className="text-xs text-muted-foreground">{label} (%)</Label>
      )}
      <Input
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
