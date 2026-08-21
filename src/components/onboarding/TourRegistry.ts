import type { FeatureCode } from "@/lib/features";
import type { ModuleSlug } from "@/lib/permissions";

export type TourStep = {
  title: string;
  body: string;
  module?: ModuleSlug;
  feature?: FeatureCode;
  route?: string;
};

export type TourDefinition = {
  key: string;
  name: string;
  description: string;
  steps: TourStep[];
};

export const TOURS: Record<string, TourDefinition> = {
  initial: {
    key: "initial",
    name: "Primeiros passos no SmartPro",
    description: "Conheça o fluxo principal do sistema em poucos minutos.",
    steps: [
      {
        title: "Dashboard",
        body: "Aqui você acompanha os principais números da sua operação: clientes, orçamentos, projetos, ordens de serviço e alertas importantes.",
        route: "/dashboard",
        module: "dashboard",
      },
      {
        title: "Clientes",
        body: "Cadastre seus clientes Pessoa Física ou Pessoa Jurídica. Para empresas, você pode usar o CNPJ para preencher dados automaticamente.",
        route: "/clients",
        module: "clients",
        feature: "customers",
      },
      {
        title: "Produtos e serviços",
        body: "Cadastre os produtos, materiais e serviços que você usa nos orçamentos e atendimentos técnicos.",
        route: "/products",
        module: "products",
        feature: "products",
      },
      {
        title: "Estoque",
        body: "Controle entradas, saídas, locais de estoque e materiais usados nos serviços.",
        route: "/stock",
        module: "stock",
        feature: "inventory",
      },
      {
        title: "Orçamentos",
        body: "Crie propostas profissionais com materiais, serviços, condições comerciais, PDF, link público e aceite do cliente.",
        route: "/quotes",
        module: "quotes",
        feature: "quotes",
      },
      {
        title: "PDF premium",
        body: "Gere uma proposta visualmente profissional para aumentar a percepção de valor e facilitar o fechamento do serviço.",
        module: "quotes",
        feature: "quotes",
      },
      {
        title: "Projetos",
        body: "Quando o orçamento for aprovado e pago, ele pode virar um projeto para organizar a execução.",
        route: "/projects",
        module: "projects",
      },
      {
        title: "Ordens de serviço",
        body: "Crie ordens de serviço para sua equipe técnica executar o atendimento com checklist, fotos, materiais e relatório final.",
        route: "/service-orders",
        module: "service_orders",
        feature: "service_orders",
      },
      {
        title: "Relatório final",
        body: "Ao concluir a OS, gere um relatório técnico com fotos, assinatura do cliente e histórico do atendimento.",
        module: "service_orders",
        feature: "service_orders",
      },
      {
        title: "SmartCom IA",
        body: "Use o SmartCom IA para criar textos, checklists, mensagens para clientes, descrições de serviços e apoio operacional.",
        route: "/assistant",
        feature: "ai_assistant",
      },
      {
        title: "Assinatura e faturas",
        body: "Acompanhe seu plano, faturas, pagamentos, regularização e dados da assinatura.",
        route: "/billing/invoices",
      },
      {
        title: "Tudo pronto!",
        body: "Agora você já conhece o fluxo principal: cliente → orçamento → aprovação → projeto → ordem de serviço → relatório final.",
      },
    ],
  },
  clients: {
    key: "clients",
    name: "Tour de Clientes",
    description: "Aprenda a cadastrar e organizar seus clientes.",
    steps: [
      {
        title: "Novo cliente",
        body: "Clique em 'Novo cliente' para começar um cadastro.",
        module: "clients",
      },
      {
        title: "PF ou PJ",
        body: "Escolha entre Pessoa Física e Pessoa Jurídica. Para PJ, informe o CNPJ.",
        module: "clients",
      },
      {
        title: "Buscar por CNPJ",
        body: "Use o autopreenchimento por CNPJ para puxar razão social, endereço e telefone automaticamente.",
        module: "clients",
      },
      {
        title: "Endereço",
        body: "Cadastre o endereço de atendimento — ele será usado em orçamentos e ordens de serviço.",
        module: "clients",
      },
      {
        title: "Salvar",
        body: "Salve o cliente. Ele já estará disponível em orçamentos, projetos e OS.",
        module: "clients",
      },
    ],
  },
  products: {
    key: "products",
    name: "Tour de Produtos e Serviços",
    description: "Como cadastrar produtos, materiais e serviços.",
    steps: [
      {
        title: "Novo item",
        body: "Cadastre produtos físicos (materiais) e serviços que você presta.",
        module: "products",
      },
      {
        title: "Tipo",
        body: "Defina se é Produto ou Serviço. Serviços não controlam estoque.",
        module: "products",
      },
      {
        title: "Foto",
        body: "Adicione uma imagem para identificar o item nos orçamentos.",
        module: "products",
      },
      {
        title: "Controle de estoque",
        body: "Para produtos, ative o controle de estoque e defina estoque mínimo.",
        module: "products",
      },
      {
        title: "Use no orçamento",
        body: "Esses itens ficam disponíveis no orçamento e na ordem de serviço.",
        module: "products",
      },
    ],
  },
  stock: {
    key: "stock",
    name: "Tour de Estoque",
    description: "Movimentações, locais e saldos.",
    steps: [
      {
        title: "Locais de estoque",
        body: "Cadastre depósitos, veículos ou bases técnicas.",
        module: "stock",
      },
      {
        title: "Entrada",
        body: "Registre entradas de compras ou ajustes positivos.",
        module: "stock",
      },
      {
        title: "Saída",
        body: "Registre saídas de uso em obras ou ajustes negativos.",
        module: "stock",
      },
      {
        title: "Saldo atual",
        body: "Veja o saldo por item e por local em tempo real.",
        module: "stock",
      },
      {
        title: "Alerta de estoque baixo",
        body: "Itens abaixo do mínimo aparecem no painel do Dashboard.",
        module: "stock",
      },
    ],
  },
  quotes: {
    key: "quotes",
    name: "Tour de Orçamentos",
    description: "Da criação ao envio e conversão em projeto.",
    steps: [
      { title: "Cliente", body: "Selecione o cliente da proposta.", module: "quotes" },
      {
        title: "Itens",
        body: "Adicione produtos e serviços. Valores e descontos podem ser ajustados.",
        module: "quotes",
      },
      {
        title: "Diagnóstico",
        body: "Preencha o diagnóstico técnico — ele aparece no PDF premium.",
        module: "quotes",
      },
      {
        title: "Condições comerciais",
        body: "Defina validade, formas de pagamento e Pix de entrada.",
        module: "quotes",
      },
      { title: "Gerar PDF", body: "Escolha entre PDF Premium e Simples.", module: "quotes" },
      {
        title: "Enviar",
        body: "Envie por WhatsApp, e-mail ou link público com aceite eletrônico.",
        module: "quotes",
      },
      {
        title: "Acompanhar",
        body: "Veja status: enviado, visualizado, aceito ou recusado.",
        module: "quotes",
      },
      {
        title: "Converter em projeto",
        body: "Orçamentos aprovados podem virar projeto com um clique.",
        module: "quotes",
      },
    ],
  },
  service_orders: {
    key: "service_orders",
    name: "Tour de Ordem de Serviço",
    description: "Execução técnica do início ao fim.",
    steps: [
      {
        title: "Abrir OS",
        body: "Crie a OS a partir de um projeto aprovado.",
        module: "service_orders",
      },
      {
        title: "Iniciar atendimento",
        body: "O técnico inicia a execução pelo celular.",
        module: "service_orders",
      },
      {
        title: "Checklist",
        body: "Siga o checklist configurado para o tipo de serviço.",
        module: "service_orders",
      },
      { title: "Fotos", body: "Tire fotos do antes, durante e depois.", module: "service_orders" },
      {
        title: "Materiais usados",
        body: "Registre os materiais — o estoque é baixado automaticamente.",
        module: "service_orders",
      },
      {
        title: "Assinatura do cliente",
        body: "Colete a assinatura digital no encerramento.",
        module: "service_orders",
      },
      {
        title: "Relatório final",
        body: "Gere e envie o relatório com fotos e assinatura.",
        module: "service_orders",
      },
    ],
  },
  billing: {
    key: "billing",
    name: "Tour de Assinatura e Faturas",
    description: "Acompanhe plano, faturas e pagamentos.",
    steps: [
      { title: "Plano atual", body: "Veja seu plano, ciclo e próxima cobrança." },
      { title: "Faturas", body: "Histórico de faturas, status e comprovantes." },
      { title: "Regularizar", body: "Faturas em aberto têm botão de regularização rápida." },
      { title: "Cupom", body: "Aplique cupons promocionais quando disponíveis." },
      { title: "Alterar plano", body: "Upgrade ou downgrade respeitando seu ciclo." },
    ],
  },
  crm: {
    key: "crm",
    name: "Como usar o CRM",
    description: "Do primeiro lead ao pós-venda: acompanhe o fluxo comercial completo.",
    steps: [
      {
        title: "O que é o CRM",
        body: "O CRM ajuda sua empresa a acompanhar leads, propostas, visitas, follow-ups e clientes para não perder oportunidades de venda.",
        route: "/crm",
        module: "crm",
      },
      {
        title: "Pipeline",
        body: "O pipeline mostra em qual etapa cada oportunidade está — do primeiro contato ao fechamento.",
        module: "crm",
      },
      {
        title: "Criar um lead",
        body: "Clique em 'Novo lead' e preencha nome, telefone, serviço de interesse e próxima ação. CPF/CNPJ não é obrigatório.",
        module: "crm",
      },
      {
        title: "Mover a oportunidade",
        body: "Arraste o card conforme a negociação avança: contato → visita → proposta → negociação → ganho ou perdido.",
        module: "crm",
      },
      {
        title: "Follow-up",
        body: "Registre a próxima ação e a data de retorno. O sistema destaca atividades atrasadas.",
        module: "crm",
      },
      {
        title: "Converter em cliente",
        body: "Na oportunidade, use 'Converter em cliente' para criar o cadastro sem digitar de novo. Duplicados são detectados automaticamente.",
        module: "crm",
      },
      {
        title: "Criar orçamento pelo CRM",
        body: "Com cliente vinculado, clique em 'Gerar orçamento'. O orçamento fica ligado ao CRM e à oportunidade.",
        module: "crm",
      },
      {
        title: "Ganho ou perdido",
        body: "Marque a oportunidade como ganha ao fechar a venda ou como perdida, informando o motivo.",
        module: "crm",
      },
      {
        title: "Projeto e OS",
        body: "Oportunidades ganhas geram projeto e ordem de serviço para a execução técnica.",
        module: "crm",
      },
      {
        title: "Pós-venda",
        body: "Após concluir a OS, retorne ao cliente para confirmar satisfação e identificar novas oportunidades.",
        module: "crm",
      },
      {
        title: "Relatórios",
        body: "Use a aba Relatórios para ver origem dos leads, conversão, ganhos e motivos de perda.",
        module: "crm",
      },
    ],
  },
};
