import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar senha — SecureERP" }] }),
  component: ForgotPassword,
});

const schema = z.object({ email: z.string().trim().email().max(255) });

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (d: z.infer<typeof schema>) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(d.email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Enviamos um link para redefinir sua senha.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-sm">
              <p>Se o e-mail existir, você receberá as instruções em instantes.</p>
              <Link to="/auth" className="text-primary hover:underline">Voltar ao login</Link>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <Label htmlFor="e">E-mail</Label>
                <Input id="e" type="email" {...form.register("email")} className="mt-1.5" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
              <Link to="/auth" className="block text-center text-xs text-primary hover:underline">Voltar ao login</Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
