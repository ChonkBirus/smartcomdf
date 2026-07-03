import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | SmartPro" },
      { name: "description", content: "Como o SmartPro trata seus dados — conformidade com a LGPD." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground">
        <p>Esta política descreve como o SmartPro coleta, usa e protege os dados dos seus clientes, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).</p>
        <h2 className="text-lg font-semibold">1. Dados coletados</h2>
        <p>Dados de cadastro da empresa e usuários (nome, e-mail, telefone, CNPJ), dados operacionais inseridos pelo cliente (clientes finais, produtos, orçamentos, OS, fotos) e dados técnicos de uso (logs, navegador, IP).</p>
        <h2 className="text-lg font-semibold">2. Finalidade</h2>
        <p>Operar o serviço contratado, dar suporte, faturar a assinatura, melhorar o produto e cumprir obrigações legais.</p>
        <h2 className="text-lg font-semibold">3. Armazenamento</h2>
        <p>Os dados ficam em infraestrutura segura, com criptografia em trânsito (HTTPS/TLS) e em repouso, e acesso restrito por perfil/permissão dentro da empresa do cliente.</p>
        <h2 className="text-lg font-semibold">4. Compartilhamento</h2>
        <p>Não vendemos dados. Compartilhamos apenas com provedores estritamente necessários para operar o serviço (hospedagem, pagamento, e-mail transacional) e quando exigido por lei.</p>
        <h2 className="text-lg font-semibold">5. Direitos do titular</h2>
        <p>O titular pode solicitar acesso, correção, portabilidade, anonimização e exclusão de dados pessoais, pelos canais de contato.</p>
        <h2 className="text-lg font-semibold">6. Encarregado (DPO) e contato</h2>
        <p>Para exercer seus direitos ou tirar dúvidas, use o WhatsApp de suporte informado na página inicial.</p>
      </div>
    </main>
  );
}
