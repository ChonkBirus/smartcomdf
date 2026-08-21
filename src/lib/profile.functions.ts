import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  avatar_url: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        avatar_url: data.avatar_url || null,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const optStr = (max: number) =>
  z
    .preprocess((v) => (v == null || v === "" ? "" : String(v)), z.string().trim().max(max))
    .optional()
    .or(z.literal(""));

const companySchema = z.object({
  corporate_name: z.string().trim().min(2).max(150),
  trade_name: optStr(150),
  cnpj: optStr(20),
  phone: optStr(20),
  whatsapp: optStr(20),
  email: z
    .preprocess(
      (v) => (v == null ? "" : String(v).trim()),
      z.union([z.literal(""), z.string().email().max(255)]),
    )
    .optional(),
  logo_url: optStr(500),
  zipcode: optStr(20),
  street: optStr(200),
  number: optStr(20),
  complement: optStr(200),
  district: optStr(120),
  city: optStr(120),
  state: optStr(2),
  country: optStr(2),
});

export const updateMyCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.company_id) throw new Error("Sem empresa vinculada.");

    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", me.company_id);
    if (!(rows ?? []).some((r: any) => r.role === "owner")) {
      throw new Error("Apenas o proprietário pode editar a empresa.");
    }

    const nz = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);
    const { error } = await supabase
      .from("companies")
      .update({
        corporate_name: data.corporate_name,
        trade_name: nz(data.trade_name),
        cnpj: nz(data.cnpj),
        phone: nz(data.phone),
        whatsapp: nz(data.whatsapp),
        email: nz(data.email),
        logo_url: nz(data.logo_url),
        zipcode: nz(data.zipcode),
        street: nz(data.street),
        number: nz(data.number),
        complement: nz(data.complement),
        district: nz(data.district),
        city: nz(data.city),
        state: nz(data.state),
        country: nz(data.country) ?? "BR",
      } as any)
      .eq("id", me.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSignedImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bucket: z.enum(["avatars", "company-logos"]),
        path: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
