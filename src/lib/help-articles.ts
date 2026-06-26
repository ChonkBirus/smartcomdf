export type HelpArticle = {
  slug: string;
  title: string;
  description: string;
  category: "Primeiros passos" | "Cadastros" | "Operação" | "Inteligência" | "Assinatura" | "FAQ";
  tourKey?: string;
  video_url?: string;
  content: string[]; // paragraphs
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "primeiros-passos",
    title: "Primeiros passos no SmartCom Pro",
    description: "Conheça o fluxo principal: cliente → orçamento → projeto → OS → relatório final.",
    category: "Primeiros passos",
    tourKey: "initial",
    content: [
      "O SmartCom Pro organiza toda a operação de uma empresa de segurança eletrônica em um único lugar.",
      "Fluxo recomendado: cadastre clientes e produtos → crie um orçamento → envie e acompanhe o aceite → converta em projeto → abra a ordem de serviço → execute e gere o relatório final.",
      "Clique em 'Iniciar tour' para receber a orientação dentro do sistema.",
    ],
  },
  {
    slug: "como-cadastrar-clientes",
    title: "Como cadastrar clientes",
    description: "PF, PJ, busca por CNPJ, endereços e contatos.",
    category: "Cadastros",
    tourKey: "clients",
    content: [
      "Em Clientes → Novo cliente, escolha PF ou PJ.",
      "Para PJ, informe o CNPJ e use o botão de autopreenchimento para puxar razão social, endereço e telefone.",
      "Cadastre endereços e contatos adicionais — eles aparecem nos orçamentos e ordens de serviço.",
    ],
  },
  {
    slug: "como-cadastrar-produtos",
    title: "Como cadastrar produtos e serviços",
    description: "Materiais, serviços, fotos e controle de estoque.",
    category: "Cadastros",
    tourKey: "products",
    content: [
      "Em Produtos → Novo item, escolha Produto ou Serviço.",
      "Para produtos, ative o controle de estoque e defina estoque mínimo.",
      "Anexe foto para facilitar a identificação visual nos orçamentos.",
    ],
  },
  {
    slug: "como-criar-orcamento",
    title: "Como criar um orçamento",
    description: "Cliente, itens, diagnóstico, condições e envio.",
    category: "Operação",
    tourKey: "quotes",
    content: [
      "Em Orçamentos → Novo, selecione o cliente e adicione produtos e serviços.",
      "Preencha o diagnóstico técnico, condições comerciais, validade e Pix de entrada.",
      "Envie o orçamento por WhatsApp, e-mail ou link público — o cliente pode aceitar eletronicamente.",
    ],
  },
  {
    slug: "como-gerar-pdf",
    title: "Como gerar o PDF da proposta",
    description: "PDF Premium e Simples.",
    category: "Operação",
    content: [
      "Na tela do orçamento, clique em 'Visualizar PDF' e escolha entre o modelo Premium e o Simples.",
      "O PDF Premium é otimizado para fechar negócio: capa visual, diagnóstico e materiais bem organizados.",
      "O PDF Simples é direto e leve, ideal para envio rápido.",
    ],
  },
  {
    slug: "como-enviar-proposta",
    title: "Como enviar a proposta para o cliente",
    description: "WhatsApp, e-mail e link público com aceite.",
    category: "Operação",
    content: [
      "Use os botões WhatsApp e E-mail no card de envio — o link público é incluído automaticamente.",
      "O cliente pode visualizar, aceitar ou recusar pelo link, sem precisar de cadastro.",
      "O sistema registra visualizações, aceites e histórico completo.",
    ],
  },
  {
    slug: "como-criar-projeto",
    title: "Como criar um projeto",
    description: "Converta um orçamento aprovado em projeto.",
    category: "Operação",
    content: [
      "Orçamentos aprovados ganham o botão 'Converter em projeto'.",
      "No projeto, defina datas, equipe, materiais previstos e instruções operacionais.",
      "Depois, gere a ordem de serviço a partir do projeto.",
    ],
  },
  {
    slug: "como-criar-os",
    title: "Como criar uma ordem de serviço",
    description: "Checklist, fotos, materiais e relatório final.",
    category: "Operação",
    tourKey: "service_orders",
    content: [
      "A OS é gerada a partir do projeto e enviada ao técnico responsável.",
      "Pelo celular, o técnico segue o checklist, registra fotos, materiais usados e coleta a assinatura do cliente.",
      "O relatório final é gerado automaticamente e pode ser enviado ao cliente.",
    ],
  },
  {
    slug: "smartcom-ia",
    title: "Como usar o SmartCom IA",
    description: "Apoio para textos, checklists e mensagens.",
    category: "Inteligência",
    content: [
      "O SmartCom IA ajuda a redigir descrições, mensagens para clientes e checklists.",
      "Disponível nos planos Pro e Business.",
    ],
  },
  {
    slug: "assinatura-e-pagamentos",
    title: "Assinatura e pagamentos",
    description: "Plano, faturas, regularização e cupons.",
    category: "Assinatura",
    tourKey: "billing",
    content: [
      "Em Faturas, acompanhe o histórico e regularize pendências em poucos cliques.",
      "Você pode aplicar cupons promocionais e alterar de plano respeitando o ciclo vigente.",
    ],
  },
  {
    slug: "faq",
    title: "Perguntas frequentes",
    description: "Dúvidas comuns sobre o SmartCom Pro.",
    category: "FAQ",
    content: [
      "Posso testar antes de pagar? Sim, todo novo usuário começa com 14 dias de teste.",
      "Posso usar no celular? Sim, todo o sistema é responsivo e a execução de OS é otimizada para mobile.",
      "Como reiniciar o tour? Pelo menu do usuário ou pela Central de Ajuda.",
    ],
  },
];

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
