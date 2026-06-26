/**
 * Dispatcher for quote PDF templates.
 * - "premium" (default): rich, persuasive multi-page proposal (SmartCom DF).
 * - "simple": legacy single-style PDF kept as fallback.
 */
import { generateQuotePDF as generateSimplePDF } from "./quote-pdf";
import { generatePremiumQuotePDF, type PremiumPdfConfig } from "./quote-pdf-premium";
import type { Quote, QuoteItem } from "./quotes.functions";

export type QuotePdfTemplate = "premium" | "simple";

type Customer = {
  name?: string | null;
  trade_name?: string | null;
  corporate_name?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
} | null;

type Company = {
  corporate_name?: string | null;
  trade_name?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
} | null;

export type GenerateQuotePdfOpts = {
  template?: QuotePdfTemplate;
  quote: Quote;
  items: Array<QuoteItem & { unit?: string | null; image_url?: string | null }>;
  customer: Customer;
  company: Company;
  settings?: Record<string, any> | null;
  publicLink?: string;
  config?: PremiumPdfConfig;
};

export async function generateQuotePDF(opts: GenerateQuotePdfOpts) {
  const template: QuotePdfTemplate = opts.template ?? "premium";
  if (template === "simple") {
    generateSimplePDF({
      quote: opts.quote,
      items: opts.items,
      customer: opts.customer,
      company: opts.company,
      publicLink: opts.publicLink,
    });
    return;
  }
  await generatePremiumQuotePDF({
    quote: opts.quote as any,
    items: opts.items.map((it) => ({
      id: it.id,
      kind: it.kind,
      name: it.name,
      description: it.description,
      quantity: Number(it.quantity),
      unit: (it.unit as string) || "UN",
      image_url: (it.image_url as string) || null,
      position: it.position,
    })),
    customer: opts.customer,
    company: opts.company,
    settings: opts.settings ?? null,
    publicLink: opts.publicLink ?? "",
    config: opts.config,
  });
}
