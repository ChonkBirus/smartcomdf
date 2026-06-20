import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/account.functions";
import { updateMyCompany, getSignedImageUrl } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/settings/company")({
  component: CompanyPage,
});

function CompanyPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getMyContext);
  const save = useServerFn(updateMyCompany);
  const sign = useServerFn(getSignedImageUrl);

  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });
  const c = data?.company;

  const [form, setForm] = useState({
    corporate_name: "", trade_name: "", cnpj: "", phone: "", whatsapp: "", email: "", logo_url: "",
  });
  const [signedLogo, setSignedLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (c) {
      setForm({
        corporate_name: c.corporate_name ?? "",
        trade_name: c.trade_name ?? "",
        cnpj: c.cnpj ?? "",
        phone: c.phone ?? "",
        whatsapp: (c as any).whatsapp ?? "",
        email: c.email ?? "",
        logo_url: c.logo_url ?? "",
      });
    }
  }, [c]);


  useEffect(() => {
    if (form.logo_url) {
      sign({ data: { bucket: "company-logos", path: form.logo_url } })
        .then((r) => setSignedLogo(r.url))
        .catch(() => setSignedLogo(null));
    } else setSignedLogo(null);
  }, [form.logo_url]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success("Empresa atualizada.");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !c?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${c.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      setForm((f) => ({ ...f, logo_url: path }));
      toast.success("Logo enviada. Clique em Salvar para confirmar.");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-base">Dados da empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
        >
          <div className="md:col-span-2 flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
              {signedLogo ? (
                <img src={signedLogo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem logo</span>
              )}
            </div>
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium hover:bg-secondary/80">
                  {uploading ? "Enviando..." : "Trocar logo"}
                </span>
              </Label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUpload}
                disabled={uploading}
              />
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou SVG até ~2MB.</p>
            </div>
          </div>

          <Field label="Razão Social *">
            <Input required value={form.corporate_name}
              onChange={(e) => setForm({ ...form, corporate_name: e.target.value })} />
          </Field>
          <Field label="Nome Fantasia">
            <Input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
          </Field>
          <Field label="CNPJ">
            <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </Field>


          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saveMut.isPending}>Salvar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
