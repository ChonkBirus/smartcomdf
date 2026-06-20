import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — SecureERP" }] }),
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const loginForm = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm({ resolver: zodResolver(signupSchema), defaultValues: { full_name: "", email: "", password: "" } });

  const onLogin = async (d: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(d);
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  };

  const onSignup = async (d: z.infer<typeof signupSchema>) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        data: { full_name: d.full_name },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Confirme seu e-mail e faça login.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-xl">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SecureERP</h1>
          <p className="text-sm text-muted-foreground">Plataforma para empresas de segurança eletrônica</p>
        </div>

        <Card className="card-elevated">
          <Tabs defaultValue="login">
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
                    <Input id="lp" type="password" autoComplete="current-password" {...loginForm.register("password")} className="mt-1.5" />
                    {loginForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                  </div>
                  <div className="flex justify-end">
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
                    <Input id="sp" type="password" autoComplete="new-password" {...signupForm.register("password")} className="mt-1.5" />
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
