import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha — SmartPro" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ResetPassword,
});

const schema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async (d: z.infer<typeof schema>) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: d.password });
    setLoading(false);
    if (error) return toast.error(translateAuthError(error.message));
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader>
          <CardTitle>Definir nova senha</CardTitle>
          <CardDescription>Escolha uma senha forte para acessar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label htmlFor="p">Nova senha</Label>
              <Input id="p" type="password" {...form.register("password")} className="mt-1.5" />
              {form.formState.errors.password && <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="c">Confirmar senha</Label>
              <Input id="c" type="password" {...form.register("confirm")} className="mt-1.5" />
              {form.formState.errors.confirm && <p className="mt-1 text-xs text-destructive">{form.formState.errors.confirm.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
