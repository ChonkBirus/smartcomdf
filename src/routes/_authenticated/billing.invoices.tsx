import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { BillingChargesTable } from "@/components/billing/BillingChargesTable";

export const Route = createFileRoute("/_authenticated/billing/invoices")({
  head: () => ({ meta: [{ title: "Faturas e Pagamentos — SecureERP" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Faturas e Pagamentos"
        description="Histórico de cobranças da sua empresa. Pague via Pix, boleto ou cartão e atualize o status quando necessário."
      />
      <BillingChargesTable />
    </div>
  );
}
