import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { createCompanyForCurrentUser, getMyContext } from "@/lib/account.functions";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — SecureERP" }] }),
  component: Onboarding,
});

const schema = z.object({
  corporate_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(150),
  trade_name: z.string().trim().max(150).optional().or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

type Plan = { id: string; slug: "starter" | "pro" | "business"; name: string; monthly_price: number; max_users: number; max_storage_gb: number };

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const createCompany = useServerFn(createCompanyForCurrentUser);
  const { data: ctx } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });

  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSlug, setPlanSlug] = useState<Plan["slug"]>("starter");
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    supabase.from("plans").select("id,slug,name,monthly_price,max_users,max_storage_gb").eq("active", true).order("monthly_price")
      .then(({ data }) => data && setPlans(data as Plan[]));
  }, []);

  useEffect(() => { if (ctx?.company) navigate({ to: "/dashboard", replace: true }); }, [ctx, navigate]);

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { corporate_name: "", trade_name: "", cnpj: "", phone: "" } });

  const mut = useMutation({
    mutationFn: (d: FormData) => createCompany({ data: {
      corporate_name: d.corporate_name,
      trade_name: d.trade_name || undefined,
      cnpj: d.cnpj || undefined,
      phone: d.phone || undefined,
      plan_slug: planSlug,
      coupon_code: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
    }}),

    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      setStep(4);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-lg"><ShieldCheck className="h-6 w-6 text-primary-foreground" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo ao SecureERP</h1>
          <p className="text-sm text-muted-foreground">Vamos configurar sua empresa em poucos passos.</p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full", step >= s ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      {step === 1 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Dados da empresa</CardTitle>
            <CardDescription>Apenas o básico, dá pra ajustar depois.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(() => setStep(2))} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="cn">Razão Social *</Label>
                <Input id="cn" {...form.register("corporate_name")} className="mt-1.5" />
                {form.formState.errors.corporate_name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.corporate_name.message}</p>}
              </div>
              <div>
                <Label htmlFor="tn">Nome Fantasia</Label>
                <Input id="tn" {...form.register("trade_name")} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" {...form.register("cnpj")} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" {...form.register("phone")} className="mt-1.5" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit">Continuar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Escolha seu plano</CardTitle>
            <CardDescription>Você começa com 14 dias de teste grátis.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((p) => (
                <button key={p.id} type="button" onClick={() => setPlanSlug(p.slug)}
                  className={cn("rounded-lg border p-4 text-left transition", planSlug === p.slug ? "border-primary bg-accent" : "border-border hover:border-primary/50")}>
                  <div className="font-semibold">{p.name}</div>
                  <div className="my-2 text-2xl font-bold">{formatCurrency(p.monthly_price)}<span className="text-xs text-muted-foreground">/mês</span></div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>{p.max_users} usuários</li>
                    <li>{p.max_storage_gb} GB armazenamento</li>
                  </ul>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)}>Continuar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Confirme e finalize</CardTitle>
            <CardDescription>Seu usuário será criado como Proprietário.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span className="font-medium">{form.getValues("corporate_name")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{plans.find((p) => p.slug === planSlug)?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Administrador</span><span className="font-medium">{ctx?.profile?.email}</span></div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => mut.mutate(form.getValues())} disabled={mut.isPending}>
                {mut.isPending ? "Criando..." : "Criar minha empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl"><CheckCircle2 className="h-8 w-8 text-primary-foreground" /></div>
            <h2 className="text-xl font-bold">Tudo pronto!</h2>
            <p className="max-w-md text-sm text-muted-foreground">Sua empresa foi criada com sucesso. Você tem 14 dias para explorar todos os recursos.</p>
            <Button className="mt-2" onClick={() => navigate({ to: "/dashboard" })}>Ir para o Dashboard</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
