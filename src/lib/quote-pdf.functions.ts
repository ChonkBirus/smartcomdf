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

    // Load quote_items first (don't fail if catalog join is blocked by RLS)
    const { data: itemsRaw, error: itemsErr } = await sb
      .from("quote_items")
      .select("*")
      .eq("quote_id", data.quote_id)
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    if (itemsErr) {
      console.error("[PDF PAYLOAD] quote_items query failed:", itemsErr);
      throw new Error("Falha ao carregar itens do orçamento: " + itemsErr.message);
    }

    // Enrich with catalog data (unit, description) when available
    const itemIds = Array.from(
      new Set((itemsRaw ?? []).map((r: any) => r.item_id).filter(Boolean)),
    );
    let catalogById = new Map<string, any>();
    let primaryImageByItem = new Map<string, string>();
    if (itemIds.length > 0) {
      const { data: catalog, error: catErr } = await sb
        .from("items")
        .select("id, name, unit, description, sku")
        .in("id", itemIds as string[]);
      if (catErr) console.warn("[PDF PAYLOAD] items join warning:", catErr.message);
      (catalog ?? []).forEach((c: any) => catalogById.set(c.id, c));

      // Fallback: fetch primary image per item for legacy quotes without image_path snapshot
      const { data: imgs } = await sb
        .from("item_images")
        .select("item_id, file_path, is_primary, created_at")
        .in("item_id", itemIds as string[])
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      (imgs ?? []).forEach((im: any) => {
        if (!primaryImageByItem.has(im.item_id)) {
          primaryImageByItem.set(im.item_id, im.file_path);
        }
      });
    }
    const items = (itemsRaw ?? []).map((r: any) => ({
      ...r,
      items: r.item_id ? catalogById.get(r.item_id) ?? null : null,
    }));

    console.log(
      "[PDF PAYLOAD] quote_id:", data.quote_id,
      "items_count:", items.length,
      "kinds:", items.map((i: any) => i.kind),
    );

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

    // Resolve each item's image: prefer quote_items.image_path snapshot, fallback to current primary
    const enrichedItems = await Promise.all((items ?? []).map(async (it: any) => {
      const path: string | null =
        it.image_path ?? (it.item_id ? primaryImageByItem.get(it.item_id) ?? null : null);
      let image_url: string | null = null;
      if (path) {
        const { data: signed } = await sb.storage
          .from("product-images")
          .createSignedUrl(path, 60 * 60);
        image_url = signed?.signedUrl ?? null;
      }
      return {
        id: it.id as string,
        kind: (it.kind ?? "PRODUCT") as string,
        name: (it.name ?? it.items?.name ?? "Item") as string,
        description: (it.description ?? it.items?.description ?? null) as string | null,
        quantity: Number(it.quantity ?? 0),
        position: (it.position ?? 0) as number,
        unit: (it.items?.unit ?? "UN") as string,
        image_url,
      };
    }));
    console.log("[PDF PAYLOAD] enriched items:", enrichedItems.length);


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
