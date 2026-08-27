import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronsUpDown,
  AlertTriangle,
  UserPlus,
  Package,
} from "lucide-react";
import { CustomerFormSheet } from "@/components/customers/CustomerFormSheet";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getActiveCustomersForQuote, type QuoteCustomerOption } from "@/lib/customers.functions";
import {
  getQuote,
  saveQuote,
  listQuoteCatalog,
  type QuoteItemKind,
  type QuoteCatalogItem,
} from "@/lib/quotes.functions";

import { getCompanyCostSettings, computeSuggestedPrice } from "@/lib/pricing.functions";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth-context";
import { roundMoney, roundPercent } from "@/lib/rounding";
import { computeQuoteTotals } from "@/lib/quote-totals";
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
import { buildDraftKey, clearDraft, hasDraft, loadDraft, saveDraft } from "@/lib/draft-storage";

type Line = {
  id?: string;
  tempId?: string;
  item_id: string | null;
  kind: QuoteItemKind;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  image_url?: string | null;
};

const KIND_LABEL: Record<QuoteItemKind, string> = {
  PRODUCT: "Produto",
  SERVICE: "Serviço",
  LABOR: "Mão de obra",
  OTHER: "Outro",
};

const DEFAULT_PAYMENT_TERMS = "50% de entrada e 50% na entrega do serviço.";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
// Formatação usa a regra única de arredondamento (src/lib/rounding.ts):
// R$ com 2 casas half-away-from-zero, % com 1 casa half-away-from-zero.
const fmtBRL = (n: number) => brlFormatter.format(roundMoney(n));
// Accepts a ratio in percent points (e.g. 12.5 for 12.5%).
const fmtPct = (n: number) => pctFormatter.format(roundPercent(n) / 100);

// Currency input: stores number, displays masked R$ value
function CurrencyInput({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
}) {
  const [text, setText] = useState(() => fmtBRL(value || 0));
  useEffect(() => {
    setText(fmtBRL(value || 0));
  }, [value]);
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        const n = digits ? Number(digits) / 100 : 0;
        setText(fmtBRL(n));
        onChange(n);
      }}
    />
  );
}

export function QuoteFormSheet({
  open,
  onOpenChange,
  quoteId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quoteId: string | null;
}) {
  const qc = useQueryClient();
  const { user, profile, loading: authLoading } = useAuth();
  const companyId = profile?.company_id;
  const { has } = usePermissions();
  const canSeeInternal = has("quotes.view_internal_values");
  const fetchOne = useServerFn(getQuote);
  const save = useServerFn(saveQuote);
  const fetchQuoteCustomers = useServerFn(getActiveCustomersForQuote);
  const fetchCatalog = useServerFn(listQuoteCatalog);
  const fetchCostSettings = useServerFn(getCompanyCostSettings);

  const [customerId, setCustomerId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const addDays = (iso: string, n: number) =>
    new Date(new Date(iso).getTime() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [validUntil, setValidUntil] = useState(() =>
    addDays(new Date().toISOString().slice(0, 10), 15),
  );
  const [validUntilTouched, setValidUntilTouched] = useState(false);
  const [payment, setPayment] = useState(DEFAULT_PAYMENT_TERMS);
  const [delivery, setDelivery] = useState("");
  const [warranty, setWarranty] = useState("");
  const [completion, setCompletion] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [diagProblem, setDiagProblem] = useState("");
  const [diagNeed, setDiagNeed] = useState("");
  const [diagEnvironment, setDiagEnvironment] = useState("");
  const [diagObjective, setDiagObjective] = useState("");
  const [diagCritical, setDiagCritical] = useState("");
  const [diagTechNotes, setDiagTechNotes] = useState("");
  const [laborCost, setLaborCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [addedLineId, setAddedLineId] = useState<string | null>(null);

  // Auto-fill valid_until = issue_date + 15 days for new quotes when user hasn't manually edited it.
  useEffect(() => {
    if (quoteId) return;
    if (validUntilTouched) return;
    if (!issueDate) return;
    setValidUntil(addDays(issueDate, 15));
  }, [issueDate, quoteId, validUntilTouched]);

  const {
    data: customersData,
    error: customersError,
    isFetching: customersFetching,
    isLoading: customersLoading,
  } = useQuery({
    queryKey: ["customers", "quote-form", companyId],
    queryFn: () => fetchQuoteCustomers({ data: { companyId: companyId! } }),
    enabled: open && !authLoading && !!user && !!companyId,
    staleTime: 30_000,
    refetchOnMount: true,
  });
  const customerOptions = useMemo(
    () => ((customersData as any)?.options ?? []) as QuoteCustomerOption[],
    [customersData],
  );
  const [customerTouched, setCustomerTouched] = useState(false);
  const selectedCustomer = customerOptions.find((option) => option.value === customerId) ?? null;
  const selectedCustomerContacts = selectedCustomer?.raw.customer_contacts ?? [];
  const selectedCustomerAddresses = selectedCustomer?.raw.customer_addresses ?? [];

  useEffect(() => {
    if (!open || !customersError) return;
    toast.error(
      "Não foi possível carregar os clientes. Verifique as permissões ou tente novamente.",
    );
  }, [open, customersError]);

  useEffect(() => {
    if (!open) return;
    if (!companyId) {
      console.log(
        "[QuoteCustomers] companyId ainda não carregado. Query de clientes não executada.",
        {
          authLoading,
          hasUser: !!user,
        },
      );
      return;
    }
    const d: any = customersData;
    console.log("[QuoteCustomers] companyId usado na query:", companyId);
    console.log(
      "[QuoteCustomers] profile.company_id:",
      profile?.company_id ?? d?.debug?.profile?.company_id ?? null,
    );
    console.log("[QuoteCustomers] customers.length:", (d?.customers ?? []).length);
    console.log(
      "[QuoteCustomers] supabase error:",
      customersError ? { message: customersError.message } : null,
    );
    console.log("[QuoteCustomers] options.length:", customerOptions.length);
    console.log(
      "[QuoteCustomers] query usada no customerService:",
      `supabase.from("customers").select("id, customer_type, name, corporate_name, trade_name, cpf_cnpj, email, phone, whatsapp, active, customer_status, customer_addresses!left(*), customer_contacts!left(*)").eq("company_id", "${companyId}").is("deleted_at", null).or("active.eq.true,customer_status.eq.ACTIVE").order("name", { ascending: true })`,
    );
  }, [
    open,
    companyId,
    authLoading,
    user,
    profile?.company_id,
    customersData,
    customersError,
    customerOptions.length,
  ]);

  const { data: catalog } = useQuery({
    queryKey: ["quote-catalog", companyId],
    queryFn: () => fetchCatalog(),
    enabled: open && !!companyId,
  });
  const catalogItems = (catalog ?? []) as QuoteCatalogItem[];
  const products = useMemo(
    () => catalogItems.filter((i) => i.item_type === "PRODUCT"),
    [catalogItems],
  );
  const services = useMemo(
    () => catalogItems.filter((i) => i.item_type === "SERVICE"),
    [catalogItems],
  );

  const { data: costSettingsData } = useQuery({
    queryKey: ["company-cost-settings-quote", companyId],
    queryFn: () => fetchCostSettings(),
    enabled: open && !!companyId && canSeeInternal,
    staleTime: 5 * 60 * 1000,
  });
  const costSettings = costSettingsData?.settings ?? null;

  const suggestPrice = useMemo(() => {
    return (cost: number): number | null => {
      if (!costSettings || !cost || cost <= 0) return null;
      const r = computeSuggestedPrice({
        cost_price: cost,
        tax_rate: costSettings.default_tax_rate,
        card_fee_rate: costSettings.default_card_fee_rate,
        commission_rate: costSettings.default_commission_rate,
        warranty_reserve_rate: costSettings.default_warranty_reserve_rate,
        operational_cost_rate: costSettings.default_operational_cost_rate,
        fixed_cost_allocation_rate: costSettings.default_fixed_cost_allocation_rate,
        pro_labore_rate: costSettings.pro_labore_percent,
        desired_margin_rate: costSettings.default_desired_margin_rate,
      });
      return r.ok ? r.suggested_price : null;
    };
  }, [costSettings]);

  const { data: existing } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => fetchOne({ data: { id: quoteId! } }),
    enabled: !!quoteId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (quoteId && existing) {
      const q: any = existing.quote;
      setCustomerId(q.customer_id);
      setTitle(q.title ?? "");
      setIssueDate(q.issue_date.slice(0, 10));
      setValidUntil(q.valid_until?.slice(0, 10) ?? "");
      setValidUntilTouched(true);
      setPayment(q.payment_terms ?? "");
      setDelivery(q.delivery_terms ?? "");
      setWarranty(q.warranty_terms ?? "");
      setCompletion(q.completion_estimate ?? "");
      setCustomerNotes(q.customer_notes ?? "");
      setInternalNotes(q.internal_notes ?? "");
      setDiagProblem(q.diagnosis_problem ?? "");
      setDiagNeed(q.diagnosis_need ?? "");
      setDiagEnvironment(q.diagnosis_environment ?? "");
      setDiagObjective(q.diagnosis_objective ?? "");
      setDiagCritical(q.diagnosis_critical_points ?? "");
      setDiagTechNotes(q.diagnosis_technical_notes ?? "");
      setLaborCost(Number(q.labor_cost || 0));
      setDiscount(Number(q.discount || 0));
      setLines(
        existing.items.map((it) => ({
          id: it.id,
          item_id: it.item_id,
          kind: it.kind,
          name: it.name,
          description: it.description ?? "",
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          cost_price: Number(it.cost_price || 0),
          // image_path removido do contrato e do banco
        })),
      );

      setAddedLineId(null);
    } else if (!quoteId) {
      const today = new Date().toISOString().slice(0, 10);
      setCustomerId("");
      setTitle("");
      setIssueDate(today);
      setValidUntil(addDays(today, 15));
      setValidUntilTouched(false);
      setPayment(DEFAULT_PAYMENT_TERMS);
      setDelivery("");
      setWarranty("");
      setCompletion("");
      setCustomerNotes("");
      setInternalNotes("");
      setDiagProblem("");
      setDiagNeed("");
      setDiagEnvironment("");
      setDiagObjective("");
      setDiagCritical("");
      setDiagTechNotes("");
      setLaborCost(0);
      setDiscount(0);
      setLines([]);
    }
  }, [open, quoteId, existing]);

  const totals = useMemo(
    () => computeQuoteTotals(lines, laborCost, discount),
    [lines, laborCost, discount],
  );
  const subtotal = totals.items_subtotal;
  const total = totals.total_amount;
  const suggestedItemsSubtotal = useMemo(() => {
    if (!canSeeInternal || !costSettings) return 0;
    const suggestedLines = lines.map((l) => {
      const sug = suggestPrice(l.cost_price);
      const price = sug && sug > 0 ? sug : l.unit_price;
      return { ...l, unit_price: price };
    });
    return computeQuoteTotals(suggestedLines, 0, 0).items_subtotal;
  }, [lines, suggestPrice, canSeeInternal, costSettings]);
  const suggestedTotal = useMemo(
    () =>
      computeQuoteTotals([{ quantity: 1, unit_price: suggestedItemsSubtotal }], laborCost, discount)
        .total_amount,
    [suggestedItemsSubtotal, laborCost, discount],
  );
  const totalBelowSuggested =
    canSeeInternal && suggestedItemsSubtotal > 0 && total < suggestedTotal;
  const totalGap = totalBelowSuggested ? suggestedTotal - total : 0;
  const totalDiffPct =
    totalBelowSuggested && suggestedTotal > 0 ? (totalGap / suggestedTotal) * 100 : 0;
  const totalCost = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.cost_price, 0),
    [lines],
  );
  const currentMarginPct = total > 0 ? ((total - totalCost) / total) * 100 : 0;
  const suggestedMarginPct =
    suggestedTotal > 0 ? ((suggestedTotal - totalCost) / suggestedTotal) * 100 : 0;

  // ============= Rascunho local (UX2B) =============
  const draftKey = buildDraftKey("quote", companyId, user?.id, quoteId ?? undefined);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  type DraftShape = {
    customer_id: string;
    title: string;
    issue_date: string;
    valid_until: string;
    payment: string;
    delivery: string;
    warranty: string;
    completion: string;
    customer_notes: string;
    internal_notes: string;
    diag_problem: string;
    diag_need: string;
    diag_environment: string;
    diag_objective: string;
    diag_critical: string;
    diag_tech_notes: string;
    labor_cost: number;
    discount: number;
    lines: Line[];
  };

  const currentDraft = (): DraftShape => ({
    customer_id: customerId,
    title,
    issue_date: issueDate,
    valid_until: validUntil,
    payment,
    delivery,
    warranty,
    completion,
    customer_notes: customerNotes,
    internal_notes: internalNotes,
    diag_problem: diagProblem,
    diag_need: diagNeed,
    diag_environment: diagEnvironment,
    diag_objective: diagObjective,
    diag_critical: diagCritical,
    diag_tech_notes: diagTechNotes,
    labor_cost: laborCost,
    discount,
    lines,
  });

  const isDirty = () => {
    if (
      customerId ||
      title ||
      customerNotes ||
      internalNotes ||
      diagProblem ||
      diagNeed ||
      diagEnvironment ||
      diagObjective ||
      diagCritical ||
      diagTechNotes ||
      delivery ||
      warranty ||
      completion
    )
      return true;
    if (lines.length > 0) return true;
    if (laborCost > 0 || discount > 0) return true;
    if (payment && payment !== DEFAULT_PAYMENT_TERMS) return true;
    return false;
  };

  const applyDraft = (d: DraftShape) => {
    setCustomerId(d.customer_id ?? "");
    setTitle(d.title ?? "");
    if (d.issue_date) setIssueDate(d.issue_date);
    if (d.valid_until) {
      setValidUntil(d.valid_until);
      setValidUntilTouched(true);
    }
    setPayment(d.payment ?? DEFAULT_PAYMENT_TERMS);
    setDelivery(d.delivery ?? "");
    setWarranty(d.warranty ?? "");
    setCompletion(d.completion ?? "");
    setCustomerNotes(d.customer_notes ?? "");
    setInternalNotes(d.internal_notes ?? "");
    setDiagProblem(d.diag_problem ?? "");
    setDiagNeed(d.diag_need ?? "");
    setDiagEnvironment(d.diag_environment ?? "");
    setDiagObjective(d.diag_objective ?? "");
    setDiagCritical(d.diag_critical ?? "");
    setDiagTechNotes(d.diag_tech_notes ?? "");
    setLaborCost(Number(d.labor_cost) || 0);
    setDiscount(Number(d.discount) || 0);
    setLines(Array.isArray(d.lines) ? d.lines : []);
  };

  // Verifica rascunho quando o sheet abre.
  useEffect(() => {
    if (!open || !draftKey) {
      setInitialSyncDone(false);
      return;
    }
    // Espera dados do "existing" antes de decidir (para edição).
    if (quoteId && !existing) return;
    if (initialSyncDone) return;
    setInitialSyncDone(true);
    if (hasDraft(draftKey)) setShowDraftBanner(true);
  }, [open, draftKey, quoteId, existing, initialSyncDone]);

  // Autosave debounced.
  useEffect(() => {
    if (!open || !draftKey || !initialSyncDone) return;
    if (showDraftBanner) return; // não sobrescrever antes de decidir
    if (!isDirty()) return;
    const t = setTimeout(() => saveDraft(draftKey, currentDraft()), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    draftKey,
    initialSyncDone,
    showDraftBanner,
    customerId,
    title,
    issueDate,
    validUntil,
    payment,
    delivery,
    warranty,
    completion,
    customerNotes,
    internalNotes,
    diagProblem,
    diagNeed,
    diagEnvironment,
    diagObjective,
    diagCritical,
    diagTechNotes,
    laborCost,
    discount,
    lines,
  ]);

  // Reseta flag quando fecha
  useEffect(() => {
    if (!open) {
      setShowDraftBanner(false);
      setDraftRestored(false);
      setInitialSyncDone(false);
      setAddedLineId(null);
    }
  }, [open]);

  const handleSheetOpenChange = (o: boolean) => {
    if (o) {
      onOpenChange(true);
      return;
    }
    if (draftKey && isDirty() && !showDraftBanner) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(false);
  };

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: quoteId ?? undefined,
          customer_id: customerId,
          title: title || null,
          issue_date: issueDate,
          valid_until: validUntil || null,
          payment_terms: payment || null,
          delivery_terms: delivery || null,
          warranty_terms: warranty || null,
          completion_estimate: completion || null,
          customer_notes: customerNotes || null,
          internal_notes: internalNotes || null,
          labor_cost: Number(laborCost) || 0,
          discount: Number(discount) || 0,
          diagnosis_problem: diagProblem || null,
          diagnosis_need: diagNeed || null,
          diagnosis_environment: diagEnvironment || null,
          diagnosis_objective: diagObjective || null,
          diagnosis_critical_points: diagCritical || null,
          diagnosis_technical_notes: diagTechNotes || null,
          items: lines.map((l, idx) => ({
            id: l.id,
            item_id: l.item_id,
            kind: l.kind,
            name: l.name.trim(),
            description: l.description || null,
            quantity: Number(l.quantity) || 0,
            unit_price: Number(l.unit_price) || 0,
            cost_price: Number(l.cost_price) || 0,
            position: idx,
            image_url: l.image_url ?? null,
          })),
        } as any,
      }),
    onSuccess: () => {
      toast.success(quoteId ? "Orçamento atualizado." : "Orçamento criado.");
      clearDraft(draftKey);
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote-metrics"] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  function addLine(kind: QuoteItemKind = "PRODUCT") {
    const tempId = Math.random().toString(36).slice(2);
    setLines((s) => [
      {
        tempId,
        item_id: null,
        kind,
        name: "",
        description: "",
        quantity: 1,
        unit_price: 0,
        cost_price: 0,
      },
      ...s,
    ]);
    setAddedLineId(tempId);
  }
  function setLine(i: number, patch: Partial<Line>) {
    setLines((s) => s.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((s) => s.filter((_, idx) => idx !== i));
  }
  function moveLine(i: number, dir: -1 | 1) {
    setLines((s) => {
      const arr = [...s];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function pickCatalogItem(i: number, item: QuoteCatalogItem) {
    // Use the item object coming from the picker (server search result).
    // Never re-lookup in the unfiltered catalog list: it is capped at 50 rows
    // and would silently drop products that only appear through search.
    const it = item;
    if (!it?.id) return;

    const current = lines[i];
    setLine(i, {
      item_id: it.id,
      name: it.name,
      kind: it.item_type === "SERVICE" ? "SERVICE" : "PRODUCT",
      unit_price: it.sale_price,
      cost_price: it.cost_price,
      description: current?.description?.trim() ? current.description : (it.description ?? ""),
      image_url: it.image_url,
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setCustomerTouched(true);
      return toast.error("Selecione um cliente para criar o orçamento.");
    }
    if (!lines.length) return toast.error("Adicione pelo menos um item.");
    if (lines.some((l) => !l.name.trim() || l.quantity <= 0 || l.unit_price < 0)) {
      return toast.error("Verifique os itens (nome, quantidade e preço).");
    }
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{quoteId ? "Editar orçamento" : "Novo orçamento"}</SheetTitle>
          <SheetDescription>Cadastro do orçamento, itens e condições comerciais.</SheetDescription>
        </SheetHeader>

        {showDraftBanner && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Encontramos um orçamento não salvo.</p>
              <p className="text-xs text-muted-foreground">
                {draftRestored ? "Rascunho restaurado." : "Deseja restaurar este rascunho?"}
              </p>
            </div>
            {!draftRestored && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearDraft(draftKey);
                    setShowDraftBanner(false);
                  }}
                >
                  Descartar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const d = loadDraft<any>(draftKey);
                    if (d) {
                      applyDraft(d);
                      setDraftRestored(true);
                    }
                    setShowDraftBanner(false);
                  }}
                >
                  Restaurar
                </Button>
              </div>
            )}
          </div>
        )}

        <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Manter rascunho?</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja manter este rascunho para continuar depois?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  clearDraft(draftKey);
                  setConfirmClose(false);
                  onOpenChange(false);
                }}
              >
                Descartar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  saveDraft(draftKey, currentDraft());
                  setConfirmClose(false);
                  onOpenChange(false);
                }}
              >
                Manter rascunho
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Tabs defaultValue="main">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="main">Dados</TabsTrigger>
              <TabsTrigger value="items">Itens</TabsTrigger>
              <TabsTrigger value="diagnosis">Diagnóstico</TabsTrigger>
              <TabsTrigger value="terms">Condições</TabsTrigger>
            </TabsList>

            {/* DADOS */}
            <TabsContent value="main" className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Cliente *</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !customerId && "text-muted-foreground",
                        )}
                        aria-invalid={customerTouched && !customerId}
                      >
                        {selectedCustomer
                          ? selectedCustomer.label
                          : "Selecione ou pesquise um cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const v = value.toLowerCase();
                          const s = search.toLowerCase().trim();
                          return !s || v.includes(s) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Selecione ou pesquise um cliente..." />
                        <CommandList>
                          {authLoading ||
                          (!!companyId && (customersLoading || customersFetching)) ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              Carregando clientes...
                            </div>
                          ) : !companyId ? (
                            <div className="py-6 text-center text-sm text-destructive">
                              Empresa não identificada.
                            </div>
                          ) : customersError ? (
                            <div className="py-6 text-center text-sm text-destructive">
                              Não foi possível carregar os clientes. Verifique as permissões ou
                              tente novamente.
                            </div>
                          ) : customerOptions.length === 0 ? (
                            <div className="space-y-3 px-3 py-6 text-center text-sm text-muted-foreground">
                              <p>Nenhum cliente cadastrado encontrado.</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCustomerOpen(false);
                                  setNewCustomerOpen(true);
                                }}
                              >
                                <UserPlus className="mr-1 h-4 w-4" />
                                Cadastrar novo cliente
                              </Button>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {customerOptions.map((option) => {
                                  const c = option.raw;
                                  const searchValue = [
                                    option.label,
                                    option.description,
                                    c.corporate_name,
                                    c.trade_name,
                                    c.name,
                                    c.cpf_cnpj,
                                    c.email,
                                    c.whatsapp,
                                    c.phone,
                                    option.value,
                                  ]
                                    .filter(Boolean)
                                    .join(" ");
                                  return (
                                    <CommandItem
                                      key={option.value}
                                      value={searchValue}
                                      onSelect={() => {
                                        setCustomerId(option.value);
                                        setCustomerTouched(true);
                                        setCustomerOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          customerId === option.value ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{option.label}</span>
                                        {option.description && (
                                          <span className="text-xs text-muted-foreground">
                                            {option.description}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                              <div className="border-t p-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => {
                                    setCustomerOpen(false);
                                    setNewCustomerOpen(true);
                                  }}
                                >
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Novo cliente
                                </Button>
                              </div>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {customerTouched && !customerId && (
                    <p className="mt-1 text-xs text-destructive">
                      Selecione um cliente para criar o orçamento.
                    </p>
                  )}
                  {selectedCustomer &&
                    (selectedCustomerContacts.length > 0 ||
                      selectedCustomerAddresses.length > 0) && (
                      <div className="mt-2 grid gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>
                          <span className="font-medium text-foreground">Contatos carregados:</span>{" "}
                          {selectedCustomerContacts.length || 0}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Endereços carregados:</span>{" "}
                          {selectedCustomerAddresses.length || 0}
                        </div>
                      </div>
                    )}
                </div>
                <div className="sm:col-span-2">
                  <Label>Título / Assunto</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Instalação de CFTV — 8 câmeras"
                  />
                </div>
                <div>
                  <Label>Data de emissão *</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => {
                      setValidUntil(e.target.value);
                      setValidUntilTouched(true);
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preenchida automaticamente com 15 dias após a emissão. Você pode editar
                    manualmente.
                  </p>
                </div>
              </div>

              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Mão de obra</Label>
                  <CurrencyInput value={laborCost} onChange={setLaborCost} />
                </div>
                <div>
                  <Label>Desconto</Label>
                  <CurrencyInput value={discount} onChange={setDiscount} />
                </div>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal itens</span>
                  <span>{fmtBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Mão de obra</span>
                  <span>{fmtBRL(laborCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>− Desconto</span>
                  <span>{fmtBRL(discount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total da proposta</span>
                  <span>{fmtBRL(total)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Valor total com materiais, serviços e mão de obra inclusos.
                </p>
                {totalBelowSuggested && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="w-full space-y-1">
                      <div>
                        Total abaixo do sugerido pelo markup em{" "}
                        <strong>{fmtPct(totalDiffPct)}</strong>.
                      </div>
                      <div>
                        Sugerido: <strong>{fmtBRL(suggestedTotal)}</strong> · Atual:{" "}
                        <strong>{fmtBRL(total)}</strong> · Gap: <strong>{fmtBRL(totalGap)}</strong>
                      </div>
                      <div>
                        Margem atual: <strong>{fmtPct(currentMarginPct)}</strong> · Margem sugerida:{" "}
                        <strong>{fmtPct(suggestedMarginPct)}</strong>
                      </div>
                      <details className="group mt-1">
                        <summary className="cursor-pointer select-none text-[11px] font-medium underline-offset-2 hover:underline">
                          Como esses valores são calculados?
                        </summary>
                        <div className="mt-2 space-y-2 rounded-md bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                          <div>
                            <strong>Preço sugerido por item:</strong> aplica o markup sobre o custo
                            usando as configurações de precificação da empresa.
                            <div className="mt-1 font-mono">
                              preço = custo ÷ (1 − (impostos + taxas + comissão + garantia + custos
                              operacionais + rateio fixo + pró-labore + margem desejada))
                            </div>
                          </div>
                          <div>
                            <strong>Total sugerido:</strong> soma de{" "}
                            <em>quantidade × preço sugerido</em> de cada item + mão de obra −
                            desconto = <strong>{fmtBRL(suggestedTotal)}</strong>.
                          </div>
                          <div>
                            <strong>Gap:</strong> total sugerido − total atual ={" "}
                            {fmtBRL(suggestedTotal)} − {fmtBRL(total)} ={" "}
                            <strong>{fmtBRL(totalGap)}</strong> ({fmtPct(totalDiffPct)} do
                            sugerido).
                          </div>
                          <div>
                            <strong>Margem %:</strong> (total − custo dos itens) ÷ total. Custo dos
                            itens = <strong>{fmtBRL(totalCost)}</strong>. Atual = {fmtBRL(total)} →{" "}
                            {fmtPct(currentMarginPct)}. Sugerido = {fmtBRL(suggestedTotal)} →{" "}
                            {fmtPct(suggestedMarginPct)}.
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Observações internas (não aparecem ao cliente)</Label>
                <Textarea
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>
            </TabsContent>

            {/* ITENS */}
            <TabsContent value="items" className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addLine("PRODUCT")}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Produto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addLine("SERVICE")}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Serviço
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("LABOR")}>
                  <Plus className="mr-1 h-3 w-3" />
                  Mão de obra
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addLine("OTHER")}>
                  <Plus className="mr-1 h-3 w-3" />
                  Outro
                </Button>
              </div>

              {lines.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhum item adicionado.
                </p>
              )}

              {lines.map((l, i) => (
                <LineRow
                  key={l.id || l.tempId || `line-${i}`}
                  line={l}
                  index={i}
                  last={i === lines.length - 1}
                  products={products}
                  services={services}
                  canSeeInternal={canSeeInternal}
                  suggestedPrice={suggestPrice(l.cost_price)}
                  onChange={(patch) => setLine(i, patch)}
                  onPickCatalog={(item) => pickCatalogItem(i, item)}
                  onRemove={() => removeLine(i)}
                  onMove={(dir) => moveLine(i, dir)}
                  autoFocus={l.tempId === addedLineId}
                />
              ))}

              <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm font-semibold">
                <span>Total da proposta (interno)</span>
                <span>{fmtBRL(total)}</span>
              </div>
            </TabsContent>

            {/* DIAGNÓSTICO */}
            <TabsContent value="diagnosis" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Preencha o diagnóstico técnico (visita técnica ou levantamento comercial). Esses
                campos alimentam a seção "Diagnóstico da necessidade" do PDF da proposta. Se ficar
                em branco, o PDF usa um texto padrão.
              </p>
              <div>
                <Label>Problema identificado</Label>
                <Textarea
                  rows={2}
                  value={diagProblem}
                  onChange={(e) => setDiagProblem(e.target.value)}
                  placeholder="Ex.: Falhas de monitoramento na entrada e área de carga."
                />
              </div>
              <div>
                <Label>Necessidade do cliente</Label>
                <Textarea
                  rows={2}
                  value={diagNeed}
                  onChange={(e) => setDiagNeed(e.target.value)}
                  placeholder="Ex.: Sistema com gravação contínua e acesso remoto."
                />
              </div>
              <div>
                <Label>Ambiente atendido</Label>
                <Textarea
                  rows={2}
                  value={diagEnvironment}
                  onChange={(e) => setDiagEnvironment(e.target.value)}
                  placeholder="Ex.: Galpão de 600m², dois acessos, recepção."
                />
              </div>
              <div>
                <Label>Objetivo da solução</Label>
                <Textarea
                  rows={2}
                  value={diagObjective}
                  onChange={(e) => setDiagObjective(e.target.value)}
                  placeholder="Ex.: Reduzir ocorrências e aumentar controle operacional."
                />
              </div>
              <div>
                <Label>Pontos críticos observados</Label>
                <Textarea
                  rows={2}
                  value={diagCritical}
                  onChange={(e) => setDiagCritical(e.target.value)}
                  placeholder="Ex.: Ângulos cegos na lateral e iluminação baixa à noite."
                />
              </div>
              <div>
                <Label>Observações técnicas</Label>
                <Textarea
                  rows={2}
                  value={diagTechNotes}
                  onChange={(e) => setDiagTechNotes(e.target.value)}
                  placeholder="Ex.: Necessário reforço de infraestrutura elétrica e cabeamento estruturado."
                />
              </div>
            </TabsContent>

            {/* CONDIÇÕES */}
            <TabsContent value="terms" className="space-y-3 pt-4">
              <div>
                <Label>Condições de pagamento</Label>
                <Textarea
                  rows={2}
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  placeholder={DEFAULT_PAYMENT_TERMS}
                />
              </div>
              <div>
                <Label>Prazo de entrega</Label>
                <Textarea
                  rows={2}
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                  placeholder="Ex.: 10 dias úteis após confirmação"
                />
              </div>
              <div>
                <Label>Garantia</Label>
                <Textarea
                  rows={2}
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  placeholder="Ex.: 12 meses para equipamentos e 90 dias para serviços"
                />
              </div>
              <div>
                <Label>Estimativa de conclusão do serviço</Label>
                <Input
                  value={completion}
                  onChange={(e) => setCompletion(e.target.value)}
                  placeholder="Ex.: 5 dias úteis após início"
                />
              </div>
              <div>
                <Label>Observações ao cliente</Label>
                <Textarea
                  rows={3}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
      <CustomerFormSheet
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        customerId={null}
        onCreated={(id) => {
          setCustomerId(id);
          setCustomerTouched(true);
          qc.invalidateQueries({ queryKey: ["customers", "quote-form", companyId] });
        }}
      />
    </Sheet>
  );
}

function LineRow({
  line,
  index,
  last,
  products,
  services,
  canSeeInternal,
  suggestedPrice,
  onChange,
  onPickCatalog,
  onRemove,
  onMove,
  autoFocus,
}: {
  line: Line;
  index: number;
  last: boolean;
  products: QuoteCatalogItem[];
  services: QuoteCatalogItem[];
  canSeeInternal: boolean;
  suggestedPrice: number | null;
  onChange: (patch: Partial<Line>) => void;
  onPickCatalog: (item: QuoteCatalogItem) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  autoFocus?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const catalogButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (line.kind === "PRODUCT" || line.kind === "SERVICE") {
        setTimeout(() => catalogButtonRef.current?.focus(), 150);
      } else {
        setTimeout(() => nameInputRef.current?.focus(), 150);
      }
    }
  }, [autoFocus, line.kind]);
  const [pickOpen, setPickOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const source = line.kind === "SERVICE" ? services : products;

  const showCatalog = line.kind === "PRODUCT" || line.kind === "SERVICE";
  const selected = source.find((s) => s.id === line.item_id);
  const margin =
    line.cost_price > 0 ? ((line.unit_price - line.cost_price) / line.cost_price) * 100 : null;
  const belowSuggested =
    canSeeInternal &&
    suggestedPrice !== null &&
    line.unit_price > 0 &&
    line.unit_price < suggestedPrice;
  const suggestedDiffPct =
    belowSuggested && suggestedPrice
      ? ((suggestedPrice - line.unit_price) / suggestedPrice) * 100
      : 0;

  return (
    <div ref={containerRef} className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{KIND_LABEL[line.kind]}</Badge>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={last}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showCatalog && (
        <div>
          <Label className="text-xs">
            {line.kind === "SERVICE" ? "Serviço do catálogo" : "Produto do catálogo"}
          </Label>
          <Popover open={pickOpen} onOpenChange={setPickOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={catalogButtonRef}
                type="button"
                variant="outline"
                role="combobox"
                className={cn("w-full justify-between", !selected && "text-muted-foreground")}
              >
                {selected
                  ? `${selected.name}${selected.sku ? ` (${selected.sku})` : ""}`
                  : "Pesquisar no catálogo..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto"
              align="start"
            >
              <CatalogPicker
                kind={line.kind}
                debouncedSearchTerm={debouncedSearchTerm}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelect={(item) => {
                  onPickCatalog(item);
                  setPickOpen(false);
                }}
                selectedId={line.item_id}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 sm:col-span-6">
          <Label className="text-xs">Nome *</Label>
          <Input
            ref={nameInputRef}
            value={line.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <Label className="text-xs">Qtd *</Label>
          <Input
            type="number"
            min="0"
            step="0.001"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="col-span-8 sm:col-span-2">
          <Label className="text-xs">Preço unit. *</Label>
          <CurrencyInput value={line.unit_price} onChange={(n) => onChange({ unit_price: n })} />
        </div>
        {canSeeInternal && (
          <div className="col-span-12 sm:col-span-2">
            <Label className="text-xs">Custo (interno)</Label>
            <CurrencyInput value={line.cost_price} onChange={(n) => onChange({ cost_price: n })} />
          </div>
        )}
        <div className="col-span-12">
          <Label className="text-xs">Descrição (aparece ao cliente)</Label>
          <Textarea
            rows={2}
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
      </div>
      {belowSuggested && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">
              Preço abaixo do sugerido pelo markup ({fmtPct(suggestedDiffPct)} menor)
            </div>
            <div className="text-[11px] opacity-90">
              Sugerido: {fmtBRL(suggestedPrice!)} · Atual: {fmtBRL(line.unit_price)}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => onChange({ unit_price: suggestedPrice! })}
          >
            Aplicar sugerido
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {canSeeInternal ? (
          <span>
            Margem: {margin !== null ? `${margin.toFixed(1)}%` : "—"}
            {suggestedPrice !== null && (
              <span className="ml-2">· Sugerido: {fmtBRL(suggestedPrice)}</span>
            )}
          </span>
        ) : (
          <span />
        )}
        <span className="font-medium text-foreground">
          Subtotal: {fmtBRL(line.quantity * line.unit_price)}
        </span>
      </div>
    </div>
  );
}

function CatalogPicker({
  kind,
  searchTerm,
  debouncedSearchTerm,
  onSearchChange,
  onSelect,
  selectedId,
}: {
  kind: QuoteItemKind;
  searchTerm: string;
  debouncedSearchTerm: string;
  onSearchChange: (val: string) => void;
  onSelect: (item: QuoteCatalogItem) => void;
  selectedId: string | null;
}) {
  const fetchCatalog = useServerFn(listQuoteCatalog);
  const { data = [], isLoading } = useQuery({
    queryKey: ["quote-catalog", debouncedSearchTerm, kind],
    queryFn: async () => {
      const items = await fetchCatalog({ data: { search: debouncedSearchTerm } });
      const normalizedKind = kind.toUpperCase();
      return items.filter((it) => it.item_type.toUpperCase() === normalizedKind);
    },
  });

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Buscar por nome ou SKU..."
        value={searchTerm}
        onValueChange={onSearchChange}
      />
      <CommandList className="max-h-[300px] overflow-y-auto pointer-events-auto">
        {isLoading && (
          <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
        )}
        {!isLoading && data.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum item encontrado.
          </div>
        )}
        <CommandGroup>
          {data.map((it) => {
            const isProduct = it.item_type === "PRODUCT";
            const stock = it.stock_quantity;
            const imageUrl = it.image_url;

            return (
              <CommandItem
                key={it.id}
                value={it.id}
                onSelect={() => onSelect(it)}
                className="flex items-start gap-2"
              >
                <Check
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0",
                    selectedId === it.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={it.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        (
                          e.currentTarget.parentElement?.querySelector(
                            ".fallback-icon",
                          ) as HTMLElement
                        ).style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "fallback-icon h-full w-full items-center justify-center",
                      imageUrl ? "hidden" : "flex",
                    )}
                  >
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{it.name}</span>
                    {it.sku && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {it.sku}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {it.unit} · {fmtBRL(it.sale_price)}
                    </span>
                    {it.item_type === "PRODUCT" && it.controls_stock && (
                      <span
                        className={cn(
                          "font-medium",
                          (it.stock_quantity ?? 0) <= 0 ? "text-destructive" : "text-primary",
                        )}
                      >
                        {(it.stock_quantity ?? 0) <= 0
                          ? "Sem estoque"
                          : `Estoque: ${it.stock_quantity}`}
                      </span>
                    )}
                  </div>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
