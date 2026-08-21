import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Search,
  Loader2,
  FilePlus2,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { createCompanyForCurrentUser, getMyContext } from "@/lib/account.functions";
import { validateCoupon, type ValidatedCoupon } from "@/lib/billing-coupons.functions";
import { lookupCnpj, type CnpjLookupFailureDTO } from "@/lib/cnpj-lookup.functions";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — SmartPro" }] }),
  component: Onboarding,
});

function maskCnpj(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 14);
  return d.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d2, e) => {
    let s = a;
    if (b) s += "." + b;
    if (c) s += "." + c;
    if (d2) s += "/" + d2;
    if (e) s += "-" + e;
    return s;
  });
}
function maskPhone(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a})`, b, c && `-${c}`].filter(Boolean).join(" ").trim(),
    );
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}
function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}
function isLookupFailure(v: unknown): v is CnpjLookupFailureDTO {
  return !!v && typeof v === "object" && (v as CnpjLookupFailureDTO).ok === false;
}

const schema = z.object({
  corporate_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(150),
  trade_name: z.string().trim().max(150).optional().or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

type Plan = {
  id: string;
  slug: "starter" | "pro" | "business";
  name: string;
  monthly_price: number;
  max_users: number;
  max_storage_gb: number;
};

const PLAN_BENEFITS: Record<Plan["slug"], string> = {
  starter: "Ideal para começar a vender",
  pro: "Recursos completos para operar",
  business: "Escala com equipe e limites maiores",
};

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const createCompany = useServerFn(createCompanyForCurrentUser);
  const validateCouponFn = useServerFn(validateCoupon);
  const cnpjLookup = useServerFn(lookupCnpj);
  const { data: ctx } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });

  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSlug, setPlanSlug] = useState<Plan["slug"]>("starter");
  const [couponCode, setCouponCode] = useState("");
  const [couponInfo, setCouponInfo] = useState<ValidatedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("plans")
      .select("id,slug,name,monthly_price,max_users,max_storage_gb")
      .eq("active", true)
      .order("monthly_price")
      .then(({ data }) => data && setPlans(data as Plan[]));
  }, []);

  useEffect(() => {
    if (ctx?.company) navigate({ to: "/dashboard", replace: true });
  }, [ctx, navigate]);

  useEffect(() => {
    setCouponInfo(null);
    setCouponError(null);
  }, [planSlug, couponCode]);

  const selectedPlan = plans.find((p) => p.slug === planSlug);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { corporate_name: "", trade_name: "", cnpj: "", phone: "" },
  });

  async function handleCnpjLookup() {
    const cnpj = onlyDigits(form.getValues("cnpj") ?? "");
    if (cnpj.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setLookupLoading(true);
    try {
      const res = await cnpjLookup({ data: { cnpj } });
      if (isLookupFailure(res)) {
        toast.error(
          res.userMessage ||
            "Não conseguimos consultar o CNPJ agora. Você pode preencher manualmente.",
        );
        return;
      }
      if (res.corporate_name)
        form.setValue("corporate_name", res.corporate_name, { shouldValidate: true });
      if (res.trade_name) form.setValue("trade_name", res.trade_name);
      if (res.phone) form.setValue("phone", maskPhone(res.phone));
      toast.success("Dados preenchidos a partir do CNPJ.");
    } catch (e) {
      toast.error(
        (e as Error)?.message ||
          "Não conseguimos consultar o CNPJ agora. Você pode preencher manualmente.",
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleValidateCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code || !selectedPlan) return;
    setCouponChecking(true);
    setCouponError(null);
    setCouponInfo(null);
    try {
      const res = await validateCouponFn({
        data: { code, plan_id: selectedPlan.id, amount: Number(selectedPlan.monthly_price) || 1 },
      });
      setCouponInfo(res);
    } catch (e) {
      setCouponError((e as Error).message);
    } finally {
      setCouponChecking(false);
    }
  }

  const couponBlocked = couponCode.trim().length > 0 && !couponInfo;

  const mut = useMutation({
    mutationFn: (d: FormData) =>
      createCompany({
        data: {
          corporate_name: d.corporate_name,
          trade_name: d.trade_name || undefined,
          cnpj: d.cnpj ? onlyDigits(d.cnpj) : undefined,
          phone: d.phone ? onlyDigits(d.phone) : undefined,
          plan_slug: planSlug,
          coupon_code: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      setStep(4);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cnpjValue = form.watch("cnpj") ?? "";
  const phoneValue = form.watch("phone") ?? "";
  const cnpjDigits = onlyDigits(cnpjValue);

  return (
    <div className="mx-auto max-w-3xl px-2 sm:px-0">
      <div className="mb-8 flex items-center gap-3">
        <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-lg">
          <ShieldCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo ao Smart Pro</h1>
          <p className="text-sm text-muted-foreground">
            Configure sua empresa em 3 passos rápidos.
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn("h-1.5 flex-1 rounded-full", step >= s ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>

      {step === 1 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Dados da empresa
            </CardTitle>
            <CardDescription>
              Só o essencial — você pode ajustar depois em Configurações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(() => setStep(2))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <Label htmlFor="cnpj">
                  CNPJ{" "}
                  <span className="text-xs text-muted-foreground">
                    (opcional — se ainda não tiver, pule)
                  </span>
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="cnpj"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={maskCnpj(cnpjValue)}
                    onChange={(e) => form.setValue("cnpj", maskCnpj(e.target.value))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCnpjLookup}
                    disabled={lookupLoading || cnpjDigits.length !== 14}
                    title="Buscar dados pelo CNPJ"
                  >
                    {lookupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">Buscar</span>
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Consulta pública — preenche razão social, nome fantasia e telefone quando
                  disponíveis.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cn">
                  Razão social <span className="text-destructive">*</span>
                </Label>
                <Input id="cn" {...form.register("corporate_name")} className="mt-1.5" />
                {form.formState.errors.corporate_name && (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.corporate_name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="tn">Nome fantasia</Label>
                <Input id="tn" {...form.register("trade_name")} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={maskPhone(phoneValue)}
                  onChange={(e) => form.setValue("phone", maskPhone(e.target.value))}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" size="lg">
                  Continuar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Escolha seu plano
            </CardTitle>
            <CardDescription>
              Você começa com 14 dias de teste grátis em qualquer plano.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((p) => {
                const selected = planSlug === p.slug;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanSlug(p.slug)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition min-h-[140px]",
                      selected
                        ? "border-primary bg-accent ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="font-semibold">{p.name}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{PLAN_BENEFITS[p.slug]}</p>
                    <div className="my-2 text-2xl font-bold">
                      {formatCurrency(p.monthly_price)}
                      <span className="text-xs font-normal text-muted-foreground">/mês</span>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>{p.max_users} usuários</li>
                      <li>{p.max_storage_gb} GB de armazenamento</li>
                    </ul>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button size="lg" onClick={() => setStep(3)}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Confirme e finalize</CardTitle>
            <CardDescription>
              Você entra como Proprietário — pode convidar sua equipe depois.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium">{form.getValues("corporate_name") || "—"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{selectedPlan?.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Administrador</span>
                <span className="font-medium">{ctx?.profile?.email}</span>
              </div>
            </div>
            <div>
              <Label htmlFor="coupon">
                Cupom de desconto <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Ex.: LANCAMENTO"
                  maxLength={64}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidateCoupon}
                  disabled={!couponCode.trim() || couponChecking}
                >
                  {couponChecking ? "Validando..." : "Aplicar"}
                </Button>
              </div>
              {couponInfo && (
                <p className="mt-1 text-xs text-emerald-600">
                  Cupom válido — desconto de {formatCurrency(couponInfo.discount_amount)}. Total:{" "}
                  {formatCurrency(couponInfo.final_amount)}.
                </p>
              )}
              {couponError && <p className="mt-1 text-xs text-destructive">{couponError}</p>}
              {!couponInfo && !couponError && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sem cupom? Pode continuar normalmente — o campo é opcional.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={mut.isPending}>
                Voltar
              </Button>
              <Button
                size="lg"
                onClick={() => !mut.isPending && mut.mutate(form.getValues())}
                disabled={mut.isPending || couponBlocked}
              >
                {mut.isPending ? "Criando empresa..." : "Criar minha empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl">
              <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Tudo pronto!</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Sua empresa está criada. Que tal já montar seu primeiro orçamento?
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => navigate({ to: "/quotes", search: { new: 1 } as never })}
              >
                <FilePlus2 className="h-4 w-4" /> Criar primeiro orçamento
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => navigate({ to: "/dashboard" })}
              >
                <LayoutDashboard className="h-4 w-4" /> Ir para o painel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
