import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublicServiceOrderReport } from "@/lib/service-order-reports.functions";

export const Route = createFileRoute("/r/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Relatório de Serviço" }] }),
  component: PublicReportPage,
  notFoundComponent: () => <ErrorView message="Relatório não encontrado." />,
  errorComponent: ({ error }) => <ErrorView message={error?.message ?? "Erro."} />,
});

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="p-6 max-w-md text-center space-y-2">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="font-semibold">{message}</p>
      </Card>
    </div>
  );
}

function fmt(s?: string | null) {
  return s ? new Date(s).toLocaleString("pt-BR") : "—";
}

function PublicReportPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getPublicServiceOrderReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-so-report", token],
    queryFn: () => fetchFn({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (error || !data) return <ErrorView message={(error as any)?.message ?? "Relatório indisponível."} />;

  const { report, service_order: so, customer, company, address, items, materials, checklist, signatures, photos } = data as any;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl p-4 sm:p-8 space-y-4">
        <Card className="p-6 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Relatório de Serviço</div>
              <h1 className="text-xl font-bold">{report.report_number}</h1>
              <div className="text-sm text-muted-foreground">OS #{so.service_order_number}</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{company?.trade_name || company?.corporate_name}</div>
              {company?.cnpj && <div className="text-muted-foreground">CNPJ {company.cnpj}</div>}
            </div>
          </div>
          {report.signed_pdf_url && (
            <div className="pt-2">
              <Button asChild size="sm">
                <a href={report.signed_pdf_url} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-1" /> Baixar PDF
                </a>
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-2">
          <h2 className="font-semibold">Cliente</h2>
          <div className="text-sm">{customer?.name}</div>
          {customer?.cpf_cnpj && <div className="text-xs text-muted-foreground">{customer.cpf_cnpj}</div>}
          {address && (
            <div className="text-sm text-muted-foreground">
              {[address.street, address.number].filter(Boolean).join(", ")}
              {address.complement ? ` — ${address.complement}` : ""}
              {address.neighborhood ? ` · ${address.neighborhood}` : ""}
              {address.city ? ` · ${address.city}/${address.state ?? ""}` : ""}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-2">
          <h2 className="font-semibold">{so.title}</h2>
          {so.description && <p className="text-sm whitespace-pre-wrap">{so.description}</p>}
          <div className="text-xs text-muted-foreground">
            Início: {fmt(so.started_at)} · Conclusão: {fmt(so.completed_at)}
          </div>
          {so.issue_found && (
            <div className="pt-2"><div className="text-xs font-semibold">Problema</div>
              <p className="text-sm whitespace-pre-wrap">{so.issue_found}</p></div>
          )}
          {so.solution_applied && (
            <div className="pt-2"><div className="text-xs font-semibold">Solução</div>
              <p className="text-sm whitespace-pre-wrap">{so.solution_applied}</p></div>
          )}
          {so.technician_report && (
            <div className="pt-2"><div className="text-xs font-semibold">Relatório técnico</div>
              <p className="text-sm whitespace-pre-wrap">{so.technician_report}</p></div>
          )}
        </Card>

        {items.length > 0 && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Itens executados</h2>
            <ul className="text-sm divide-y">
              {items.map((it: any) => (
                <li key={it.id} className="py-2 flex justify-between gap-3">
                  <span>{it.name}</span>
                  <span className="text-muted-foreground">
                    {Number(it.used_quantity ?? it.planned_quantity)} {it.unit}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {materials.length > 0 && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Materiais utilizados</h2>
            <ul className="text-sm divide-y">
              {materials.map((m: any) => (
                <li key={m.id} className="py-2 flex justify-between gap-3">
                  <span>{m.name ?? "Material"}</span>
                  <span className="text-muted-foreground">{Number(m.quantity)} {m.unit ?? ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {checklist.length > 0 && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Checklist</h2>
            <ul className="text-sm space-y-1">
              {checklist.map((c: any) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className={c.is_completed ? "text-green-600" : "text-muted-foreground"}>
                    {c.is_completed ? "✓" : "○"}
                  </span>
                  <span>{c.title}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {photos.length > 0 && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold">Fotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((p: any) => (
                p.signed_url ? (
                  <a key={p.id} href={p.signed_url} target="_blank" rel="noreferrer">
                    <img src={p.signed_url} alt={p.caption ?? ""} className="rounded object-cover aspect-square w-full" />
                  </a>
                ) : null
              ))}
            </div>
          </Card>
        )}

        {signatures.length > 0 && (
          <Card className="p-6 space-y-2">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Assinaturas
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {signatures.map((s: any) => (
                <div key={s.id} className="border rounded p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {s.signature_type === "CUSTOMER" ? "Cliente" : "Técnico"}
                  </div>
                  <div className="text-sm font-medium">{s.signer_name}</div>
                  {s.signed_url && (
                    <img src={s.signed_url} alt="Assinatura" className="bg-white rounded border max-h-32 object-contain" />
                  )}
                  <div className="text-xs text-muted-foreground">{fmt(s.signed_at)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground py-6">
          Documento gerado em {fmt(report.generated_at)}.
        </p>
      </div>
    </div>
  );
}
