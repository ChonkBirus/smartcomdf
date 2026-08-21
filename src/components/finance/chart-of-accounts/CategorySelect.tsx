import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  listFinancialCategories,
  type FinancialCategory,
  type FinTxType,
} from "@/lib/finance.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const EXPENSE_GROUPS = new Set([
  "VARIABLE_COST",
  "FIXED_EXPENSE",
  "INVESTMENT",
  "NON_OPERATIONAL",
  "CASH_ADJUSTMENT",
]);

function labelFor(c: FinancialCategory): string {
  return c.code ? `${c.code} — ${c.name}` : c.name;
}

function shortLabelFor(c: FinancialCategory): string {
  return c.code ? `${c.code} — ${c.name}` : c.name;
}

/**
 * Category picker driven by the Chart of Accounts. Filters by flow type:
 *  - INCOME  → only REVENUE categories
 *  - EXPENSE → VARIABLE_COST + FIXED_EXPENSE + INVESTMENT + NON_OPERATIONAL + CASH_ADJUSTMENT
 * On mobile, opens a full-height sheet with search.
 */
export function CategorySelect({
  value,
  onChange,
  flowType,
  placeholder = "Selecione a categoria",
  className,
  allowEmpty = true,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  flowType: FinTxType;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  const companyId = useCompanyId();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const catsFn = useServerFn(listFinancialCategories);
  const cats = useQuery({
    queryKey: ["fin-cats-coa", companyId, flowType],
    queryFn: () => catsFn({ data: { type: flowType, activeOnly: true } }),
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    const all = (cats.data ?? []) as FinancialCategory[];
    // Keep leaf-like entries: those without children in the returned list.
    const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean) as string[]);
    const compatible = all.filter((c) => {
      if (flowType === "INCOME")
        return c.category_group === "REVENUE" || (!c.category_group && c.type === "INCOME");
      return (
        EXPENSE_GROUPS.has(c.category_group ?? "") || (!c.category_group && c.type === "EXPENSE")
      );
    });
    const q = query.trim().toLowerCase();
    const rows = compatible.filter((c) => {
      // Prefer selectable leaves, but allow parents too — the user may want a bucket.
      if (!q) return true;
      const hay = `${c.code ?? ""} ${c.name}`.toLowerCase();
      return hay.includes(q);
    });
    // Sort by sort_order, then code, then name.
    rows.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      const ac = a.code ?? "";
      const bc = b.code ?? "";
      if (ac !== bc) return ac.localeCompare(bc);
      return a.name.localeCompare(b.name);
    });
    return { rows, parentIds };
  }, [cats.data, flowType, query]);

  const current = (cats.data ?? []).find((c) => c.id === value) ?? null;

  const handlePick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const list = (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-0.5 py-1">
        {allowEmpty && (
          <button
            type="button"
            onClick={() => handlePick(null)}
            className={cn(
              "flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted",
              !value && "bg-muted/70",
            )}
          >
            <span className="text-muted-foreground">Sem categoria</span>
            {!value && <Check className="h-4 w-4 text-primary" />}
          </button>
        )}
        {filtered.rows.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma categoria encontrada.
          </div>
        )}
        {filtered.rows.map((c) => {
          const isParent = filtered.parentIds.has(c.id);
          const indent = Math.max(0, (c.level ?? 1) - 1) * 12;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePick(c.id)}
              className={cn(
                "flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted",
                value === c.id && "bg-muted/70",
              )}
              style={{ paddingLeft: 12 + indent }}
            >
              <span className={cn("truncate", isParent && "font-medium")}>{labelFor(c)}</span>
              {value === c.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );

  const searchInput = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por código ou nome..."
        className="pl-9"
      />
    </div>
  );

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      disabled={disabled}
      className={cn("w-full justify-between font-normal", className)}
      onClick={() => setOpen(true)}
    >
      <span className={cn("truncate", !current && "text-muted-foreground")}>
        {current ? shortLabelFor(current) : placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-3 pb-4 pt-3">
            <SheetHeader className="mb-3 text-left">
              <SheetTitle>Selecionar categoria</SheetTitle>
            </SheetHeader>
            <div className="space-y-3">
              {searchInput}
              {list}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-2">
        <div className="space-y-2">
          {searchInput}
          {list}
        </div>
      </PopoverContent>
    </Popover>
  );
}
