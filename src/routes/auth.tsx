import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/auth-errors";
import { appUrl } from "@/lib/app-url";
import { logAuthDev, maskEmail } from "@/lib/auth-dev-log";


const REMEMBER_KEY = "secureerp.remember_email";

function safeRedirectTarget(raw: unknown): string {
  if (typeof raw !== "string") return "/dashboard";
  const v = raw.trim();
  if (!v.startsWith("/")) return "/dashboard";
  if (v.startsWith("//")) return "/dashboard";
  if (v.startsWith("/\\")) return "/dashboard";
  if (/^https?:/i.test(v)) return "/dashboard";
  return v;
}

function isEmailNotConfirmedError(msg: string | undefined | null): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("email not confirmed") || m.includes("not confirmed") || m.includes("confirm your email");
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — SmartPro" }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});
const signupSchema = loginSchema.extend({
  full_name: z.string().trim().min(2, "Nome obrigatório").max(120),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const redirectTarget = safeRedirectTarget(search.redirectTo);
  const [loading, setLoading] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const resendGuard = useRef(false);

  const loginForm = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm({ resolver: zodResolver(signupSchema), defaultValues: { full_name: "", email: "", password: "" } });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirectTarget, replace: true });
    });
  }, [navigate, redirectTarget]);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBER_KEY) ?? "";
    if (rememberedEmail) {
      loginForm.setValue("email", rememberedEmail, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    }
  }, [loginForm]);

  const onLogin = async (d: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(d);
    setLoading(false);
    if (error) {
      if (isEmailNotConfirmedError(error.message)) {
        setPendingEmail(d.email);
        toast.error("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou solicite um novo envio.");
        return;
      }
      return toast.error(translateAuthError(error.message));
    }
    if (remember) localStorage.setItem(REMEMBER_KEY, d.email);
    else localStorage.removeItem(REMEMBER_KEY);
    navigate({ to: redirectTarget, replace: true });
  };

  const onSignup = async (d: z.infer<typeof signupSchema>) => {
    setLoading(true);
    const redirectUrl = appUrl("/dashboard");
    const masked = maskEmail(d.email);
    if (import.meta.env.DEV) {
      console.info("[AUTH SIGNUP] email", d.email);
      console.info("[AUTH SIGNUP] redirectUrl", redirectUrl);
    }
    logAuthDev({ flow: "signup", status: "attempt", emailMasked: masked, redirectUrl });
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        data: { full_name: d.full_name },
        emailRedirectTo: redirectUrl,
      },
    });
    setLoading(false);
    if (error) {
      if (import.meta.env.DEV) console.warn("[AUTH SIGNUP] error", error.message);
      logAuthDev({ flow: "signup", status: "error", emailMasked: masked, message: error.message });
      return toast.error(translateAuthError(error.message));
    }
    logAuthDev({ flow: "signup", status: "success", emailMasked: masked, redirectUrl });
    // If session came back, confirmation is disabled → go to app.
    if (data.session) {
      navigate({ to: redirectTarget, replace: true });
      return;
    }
    setPendingEmail(d.email);
  };

  const handleResend = async () => {
    if (!pendingEmail || resendGuard.current) return;
    resendGuard.current = true;
    setResending(true);
    const redirectUrl = appUrl("/dashboard");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: redirectUrl },
    });
    setResending(false);
    setTimeout(() => { resendGuard.current = false; }, 3000);
    if (error) {
      const m = error.message?.toLowerCase() ?? "";
      if (m.includes("rate") || m.includes("too many")) {
        return toast.error("Aguarde alguns instantes antes de solicitar novamente.");
      }
      return toast.error("Não conseguimos reenviar agora. Tente novamente em alguns minutos.");
    }
    toast.success("E-mail de confirmação reenviado.");
  };

  const handleChangeEmail = () => {
    const email = pendingEmail ?? "";
    setPendingEmail(null);
    setTab("signup");
    signupForm.setValue("email", "");
    signupForm.setValue("password", "");
    // Keep full_name if user filled it.
    loginForm.setValue("email", email);
  };

  if (pendingEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-3">
            <img src="/brand/smart-pro-logo-horizontal.png" alt="Logo SmartPro" className="h-20 w-auto object-contain" />
          </div>
          <Card className="card-elevated">
            <CardHeader className="items-center text-center">
              <div className="brand-gradient mb-2 flex h-12 w-12 items-center justify-center rounded-2xl">
                <MailCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">Confirme seu e-mail</CardTitle>
              <CardDescription>
                Enviamos um link de confirmação para <span className="font-medium text-foreground break-all">{pendingEmail}</span>. Acesse sua caixa de entrada e clique no link para ativar sua conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Não encontrou? Verifique a caixa de spam ou solicite um novo envio.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleResend} disabled={resending} className="w-full">
                  {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                </Button>
                <Button variant="outline" onClick={handleChangeEmail} className="w-full">
                  Trocar e-mail
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setPendingEmail(null); setTab("login"); }}
                  className="w-full"
                >
                  Voltar para login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/brand/smart-pro-logo-horizontal.png" alt="Logo SmartPro" className="h-20 w-auto object-contain" />
          <p className="text-sm text-muted-foreground">Plataforma para empresas de segurança eletrônica</p>
        </div>

        <Card className="card-elevated">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <CardHeader>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login" className="mt-0">
                <CardTitle className="text-lg">Bem-vindo de volta</CardTitle>
                <CardDescription className="mb-4">Acesse sua empresa.</CardDescription>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-3">
                  <div>
                    <Label htmlFor="le">E-mail</Label>
                    <Input id="le" type="email" autoComplete="email" {...loginForm.register("email")} className="mt-1.5" />
                    {loginForm.formState.errors.email && <p className="mt-1 text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lp">Senha</Label>
                    <div className="relative mt-1.5">
                      <Input id="lp" type={showLoginPwd ? "text" : "password"} autoComplete="current-password" {...loginForm.register("password")} className="pr-10" />
                      <button type="button" onClick={() => setShowLoginPwd((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground" aria-label={showLoginPwd ? "Ocultar senha" : "Mostrar senha"}>
                        {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
                      Lembrar sessão
                    </label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <CardTitle className="text-lg">Crie sua conta</CardTitle>
                <CardDescription className="mb-4">Em seguida você configura sua empresa.</CardDescription>
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-3">
                  <div>
                    <Label htmlFor="sn">Nome completo</Label>
                    <Input id="sn" {...signupForm.register("full_name")} className="mt-1.5" />
                    {signupForm.formState.errors.full_name && <p className="mt-1 text-xs text-destructive">{signupForm.formState.errors.full_name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="se">E-mail</Label>
                    <Input id="se" type="email" autoComplete="email" {...signupForm.register("email")} className="mt-1.5" />
                    {signupForm.formState.errors.email && <p className="mt-1 text-xs text-destructive">{signupForm.formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="sp">Senha</Label>
                    <div className="relative mt-1.5">
                      <Input id="sp" type={showSignupPwd ? "text" : "password"} autoComplete="new-password" {...signupForm.register("password")} className="pr-10" />
                      <button type="button" onClick={() => setShowSignupPwd((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground" aria-label={showSignupPwd ? "Ocultar senha" : "Mostrar senha"}>
                        {showSignupPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{signupForm.formState.errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Voltar à página inicial</Link>
        </p>
      </div>
    </div>
  );
}
