import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/account.functions";
import { updateMyProfile, getSignedImageUrl } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Meu perfil — SmartPro" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const save = useServerFn(updateMyProfile);
  const sign = useServerFn(getSignedImageUrl);

  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });
  const p = data?.profile;

  const [form, setForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [signed, setSigned] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (p) setForm({ full_name: p.full_name ?? "", phone: p.phone ?? "", avatar_url: p.avatar_url ?? "" });
  }, [p]);

  useEffect(() => {
    if (form.avatar_url) {
      sign({ data: { bucket: "avatars", path: form.avatar_url } })
        .then((r) => setSigned(r.url))
        .catch(() => setSigned(null));
    } else setSigned(null);
  }, [form.avatar_url]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => { toast.success("Perfil atualizado."); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !p?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${p.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      setForm((f) => ({ ...f, avatar_url: path }));
      toast.success("Avatar enviado. Clique em Salvar para confirmar.");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const initials = (form.full_name || p?.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Meu perfil" description="Atualize seus dados pessoais." />
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Informações pessoais</CardTitle></CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
          >
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {signed && <AvatarImage src={signed} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <span className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium hover:bg-secondary/80">
                    {uploading ? "Enviando..." : "Trocar avatar"}
                  </span>
                </Label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden"
                  onChange={onUpload} disabled={uploading} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={p?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input required value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMut.isPending}>Salvar alterações</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
