import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | SmartPro" },
      {
        name: "description",
        content: "Termos de Uso do SmartPro — ERP para empresas de segurança eletrônica.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {new Date().toLocaleDateString("pt-BR")}
      </p>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground">
        <p>Ao contratar o SmartPro, o cliente concorda com os termos abaixo.</p>
        <h2 className="text-lg font-semibold">1. Objeto</h2>
        <p>
          O SmartPro é um software como serviço (SaaS) para gestão operacional de empresas de
          segurança eletrônica, incluindo clientes, produtos, estoque, orçamentos, projetos, ordens
          de serviço, equipe técnica e relatórios.
        </p>
        <h2 className="text-lg font-semibold">2. Cadastro e responsabilidade</h2>
        <p>
          O cliente é responsável pela veracidade dos dados informados, pela guarda das credenciais
          e pelo uso da conta por sua equipe.
        </p>
        <h2 className="text-lg font-semibold">3. Planos e pagamento</h2>
        <p>
          Os planos vigentes estão disponíveis em /#pricing. O teste grátis dura 7 dias e não exige
          cartão. Após o período de teste, a assinatura é cobrada de forma recorrente conforme o
          plano escolhido. O cliente pode cancelar a qualquer momento, sem multa.
        </p>
        <h2 className="text-lg font-semibold">4. Disponibilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível 24/7, podendo haver janelas programadas de
          manutenção comunicadas previamente.
        </p>
        <h2 className="text-lg font-semibold">5. Limitação de responsabilidade</h2>
        <p>
          O SmartPro é uma ferramenta de apoio operacional. Decisões comerciais, técnicas, fiscais
          ou jurídicas são de responsabilidade do cliente.
        </p>
        <h2 className="text-lg font-semibold">6. Contato</h2>
        <p>Suporte e dúvidas pelo WhatsApp informado na página inicial.</p>
      </div>
    </main>
  );
}
