import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the full payload needed to render the Premium PDF on the client:
 * quote + items (with catalog image_url/unit) + customer + company + company_settings.
 * Logo URL is converted to a signed URL when stored under company-logos bucket.
 */
export const getQuotePdfPayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quote_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;

    const { data: q, error: e1 } = await sb
      .from("quotes")
      .select(
        "*, customers:customer_id(id, name, trade_name, corporate_name, cpf_cnpj, email, phone, whatsapp)",
      )
      .eq("id", data.quote_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!q) throw new Error("Orçamento não encontrado.");

    const { data: items } = await sb
      .from("quote_items")
      .select("*, items:item_id(id, name, image_url, unit, description)")
      .eq("quote_id", data.quote_id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    const { data: company } = await sb
      .from("companies")
      .select("id, corporate_name, trade_name, cnpj, email, phone, whatsapp, logo_url")
      .eq("id", q.company_id)
      .maybeSingle();

    const { data: settings } = await sb
      .from("company_settings")
      .select("*")
      .eq("company_id", q.company_id)
      .maybeSingle();

    // Sign logo if stored as path in company-logos bucket
    let logoSignedUrl: string | null = null;
    if (company?.logo_url) {
      const raw = company.logo_url as string;
      if (/^https?:\/\//i.test(raw)) {
        logoSignedUrl = raw;
      } else {
        const { data: signed } = await sb.storage
          .from("company-logos")
          .createSignedUrl(raw, 60 * 60);
        logoSignedUrl = signed?.signedUrl ?? null;
      }
    }

    const enrichedItems = (items ?? []).map((it: any) => ({
      id: it.id as string,
      kind: it.kind as string,
      name: it.name as string,
      description: (it.description ?? it.items?.description ?? null) as string | null,
      quantity: Number(it.quantity),
      position: it.position as number,
      unit: (it.items?.unit ?? "UN") as string,
      image_url: (it.items?.image_url ?? null) as string | null,
    }));

    return {
      quote: {
        ...q,
        labor_cost: Number(q.labor_cost || 0),
        discount: Number(q.discount || 0),
        items_subtotal: Number(q.items_subtotal || 0),
        total_amount: Number(q.total_amount || 0),
        down_payment_percent: Number(q.down_payment_percent || 0),
        down_payment_amount: Number(q.down_payment_amount || 0),
        remaining_amount: Number(q.remaining_amount || 0),
      },
      customer: q.customers ?? null,
      company: company
        ? { ...company, logo_url: logoSignedUrl ?? company.logo_url }
        : null,
      settings: settings ?? null,
      items: enrichedItems,
    };
  });
