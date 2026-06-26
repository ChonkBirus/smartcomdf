import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  A4,
  MARGIN,
  PALETTE,
  applyFooters,
  drawCard,
  drawEyebrow,
  drawParagraph,
  drawSectionTitle,
  ensureSpace,
  fmtBRL,
  fmtDate,
  generateQrDataUrl,
  loadImageAsDataUrl,
  loadLogoForDarkBg,
  detectImageFormat,
  newPage,
  setFill,
  setStroke,
  setText,
} from "./quote-pdf-helpers";

// ---- Types compatible with getQuotePdfPayload return ----
type PdfQuote = {
  id: string;
  quote_number: string;
  title: string | null;
  issue_date: string;
  valid_until: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  warranty_terms: string | null;
  completion_estimate: string | null;
  customer_notes: string | null;
  total_amount: number;
  down_payment_percent: number;
  down_payment_amount: number;
  remaining_amount: number;
  public_token: string;
  accepted_at?: string | null;
  accepted_by_name?: string | null;
};

type PdfCustomer = {
  name?: string | null;
  trade_name?: string | null;
  corporate_name?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
} | null;

type PdfCompany = {
  corporate_name?: string | null;
  trade_name?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
} | null;

type PdfSettings = Record<string, any> | null;

type PdfItem = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  image_url: string | null;
  position: number;
};

export type PremiumPdfConfig = {
  showCftPage?: boolean;
  showCftvImportance?: boolean;
  showDiagnosis?: boolean;
  showSolutionSummary?: boolean;
  showScope?: boolean;
  showProductHighlights?: boolean;
  maxProductHighlights?: number;
  showMaterialsTable?: boolean;
  showExecutionProcess?: boolean;
  showWarrantySupport?: boolean;
  showCommercialConditions?: boolean;
  showImportantNotes?: boolean;
  showAcceptancePage?: boolean;
  showWhatsappQr?: boolean;
  showAcceptanceQr?: boolean;
  kpis?: { projects?: string; cities?: string; clients?: string };
  // Optional dynamic copy
  responsibleName?: string | null;
  responsiblePhone?: string | null;
};

const DEFAULTS: Required<Omit<PremiumPdfConfig, "kpis" | "responsibleName" | "responsiblePhone">> & {
  kpis: NonNullable<PremiumPdfConfig["kpis"]>;
  responsibleName: string | null;
  responsiblePhone: string | null;
} = {
  showCftPage: true,
  showCftvImportance: true,
  showDiagnosis: true,
  showSolutionSummary: true,
  showScope: true,
  showProductHighlights: true,
  maxProductHighlights: 4,
  showMaterialsTable: true,
  showExecutionProcess: true,
  showWarrantySupport: true,
  showCommercialConditions: true,
  showImportantNotes: true,
  showAcceptancePage: true,
  showWhatsappQr: true,
  showAcceptanceQr: true,
  kpis: { projects: "500+", cities: "30+", clients: "Alta satisfação" },
  responsibleName: null,
  responsiblePhone: null,
};

// ---- Helpers specific to this template ----

type SolutionKey =
  | "cftv" | "alarm" | "intercom" | "access" | "network"
  | "automation" | "solar" | "ev" | "audio" | "generic";

type SolutionContent = {
  subtitle: string;
  importanceTitle: string;
  importanceIntro: string;
  importanceCards: { t: string; b: string }[];
  solutionTitle: string;
  solutionIntro: string;
  solutionBenefits: { t: string; b: string }[];
};

const SOLUTION_CONTENT: Record<SolutionKey, SolutionContent> = {
  cftv: {
    subtitle: "Solução em CFTV e Segurança Eletrônica",
    importanceTitle: "Por que investir em CFTV e segurança eletrônica?",
    importanceIntro:
      "Um sistema de CFTV bem instalado não serve apenas para gravar imagens. Ele ajuda a prevenir ocorrências, acompanhar movimentações, registrar evidências, aumentar a sensação de segurança e melhorar a gestão do ambiente.",
    importanceCards: [
      { t: "Prevenção", b: "Câmeras visíveis inibem ações suspeitas e reduzem vulnerabilidades do ambiente." },
      { t: "Registro de evidências", b: "Imagens auxiliam na análise de ocorrências e tomada de decisão." },
      { t: "Controle do ambiente", b: "Acompanhe entradas, saídas, áreas comuns e pontos críticos." },
      { t: "Mais tranquilidade", b: "Síndicos, gestores e moradores ganham segurança e controle." },
      { t: "Valorização do imóvel", b: "Ambientes com estrutura de segurança transmitem organização." },
      { t: "Integração", b: "CFTV trabalha junto com alarmes, controle de acesso, redes e automação." },
    ],
    solutionTitle: "Solução de monitoramento e vigilância",
    solutionIntro:
      "A solução proposta contempla o fornecimento e instalação de um sistema completo de CFTV, com câmeras, gravador, infraestrutura de cabeamento e configuração de acesso remoto. O projeto foi dimensionado para cobrir os pontos críticos do ambiente com qualidade de imagem e estabilidade.",
    solutionBenefits: [
      { t: "Cobertura adequada", b: "Pontos críticos monitorados com câmeras corretas." },
      { t: "Imagem de qualidade", b: "Resolução adequada para identificação visual." },
      { t: "Acesso remoto", b: "Visualização pelo celular a qualquer momento." },
      { t: "Gravação contínua", b: "Histórico das imagens conforme dimensionamento." },
      { t: "Instalação profissional", b: "Cabeamento organizado e bem documentado." },
      { t: "Suporte e garantia", b: "Pós-instalação estruturado e assistido." },
    ],
  },
  alarm: {
    subtitle: "Solução em Alarme e Detecção de Intrusão",
    importanceTitle: "Por que investir em sistema de alarme?",
    importanceIntro:
      "O sistema de alarme atua na detecção imediata de tentativas de invasão e situações de risco, permitindo resposta rápida e reduzindo prejuízos. É uma camada essencial de proteção do patrimônio.",
    importanceCards: [
      { t: "Detecção imediata", b: "Sensores identificam abertura, movimento e impacto." },
      { t: "Resposta rápida", b: "Notificação instantânea para o responsável." },
      { t: "Efeito dissuasivo", b: "Sirenes e sinalização inibem ação criminosa." },
      { t: "Cobertura perimetral", b: "Proteção do limite externo da propriedade." },
      { t: "Integração com CFTV", b: "Alarme + câmeras formam um sistema completo." },
      { t: "Tranquilidade", b: "Ambiente protegido mesmo quando desocupado." },
    ],
    solutionTitle: "Solução de proteção perimetral e intrusão",
    solutionIntro:
      "A solução contempla central de alarme, sensores adequados ao ambiente, sirene e sinalização, com configuração de partições e usuários. O projeto foi pensado para reduzir riscos e oferecer reação rápida em caso de evento.",
    solutionBenefits: [
      { t: "Sensores corretos", b: "Selecionados para cada tipo de ambiente." },
      { t: "Notificação no app", b: "Aviso imediato em caso de disparo." },
      { t: "Partições", b: "Áreas armadas separadamente conforme rotina." },
      { t: "Sirene e sinalização", b: "Inibição visível e audível." },
      { t: "Instalação criteriosa", b: "Posicionamento técnico de cada sensor." },
      { t: "Garantia e suporte", b: "Acompanhamento pós-instalação." },
    ],
  },
  intercom: {
    subtitle: "Solução em Interfonia e Comunicação Interna",
    importanceTitle: "Por que investir em um sistema de interfonia?",
    importanceIntro:
      "O interfone organiza a comunicação interna, o controle de visitantes e o acesso ao imóvel. Ele aumenta a segurança no momento mais sensível: a entrada de pessoas no ambiente.",
    importanceCards: [
      { t: "Controle de acesso", b: "Identifique quem chega antes de liberar a entrada." },
      { t: "Comunicação clara", b: "Áudio e/ou vídeo de qualidade entre pontos." },
      { t: "Segurança na portaria", b: "Reduz exposição direta de moradores e equipe." },
      { t: "Praticidade no dia a dia", b: "Atendimento rápido de visitantes e entregas." },
      { t: "Integração", b: "Pode operar com fechaduras, portões e CFTV." },
      { t: "Valorização do imóvel", b: "Ambientes com interfonia transmitem organização." },
    ],
    solutionTitle: "Solução de comunicação interna e controle de acesso",
    solutionIntro:
      "A solução contempla módulos externos e internos de interfonia, infraestrutura de cabeamento e configuração de acionamentos. O projeto foi pensado para garantir comunicação estável, identificação visual quando aplicável e controle confiável da entrada.",
    solutionBenefits: [
      { t: "Áudio estável", b: "Comunicação clara entre os pontos." },
      { t: "Vídeo quando aplicável", b: "Identificação visual do visitante." },
      { t: "Acionamento de portão", b: "Abertura remota com segurança." },
      { t: "Infra organizada", b: "Cabeamento bem documentado." },
      { t: "Durabilidade", b: "Equipamentos adequados ao uso contínuo." },
      { t: "Suporte técnico", b: "Garantia e acompanhamento da solução." },
    ],
  },
  access: {
    subtitle: "Solução em Controle de Acesso",
    importanceTitle: "Por que investir em controle de acesso?",
    importanceIntro:
      "O controle de acesso permite saber quem entra, quando entra e onde pode circular. Reduz riscos, registra movimentações e organiza a rotina do ambiente.",
    importanceCards: [
      { t: "Rastreabilidade", b: "Histórico de entradas e saídas." },
      { t: "Permissões por usuário", b: "Cada pessoa acessa só o que precisa." },
      { t: "Mais segurança", b: "Reduz acessos indevidos ao ambiente." },
      { t: "Operação organizada", b: "Fluxo previsível e controlável." },
      { t: "Integração", b: "Trabalha junto com CFTV e alarme." },
      { t: "Escalável", b: "Cresce conforme a necessidade do ambiente." },
    ],
    solutionTitle: "Solução de gestão de entradas e saídas",
    solutionIntro:
      "A solução contempla leitores, controladoras, fechaduras/atuadores e software de gestão, com cadastro de usuários e regras de acesso. O projeto foi pensado para organizar o fluxo de pessoas com segurança e auditoria.",
    solutionBenefits: [
      { t: "Cadastro de usuários", b: "Gestão simples de permissões." },
      { t: "Múltiplas tecnologias", b: "Cartão, senha, biometria conforme escopo." },
      { t: "Logs de acesso", b: "Registro automatizado de cada evento." },
      { t: "Atuação em portas/portões", b: "Liberação controlada de cada ponto." },
      { t: "Instalação técnica", b: "Posicionamento e fixação corretos." },
      { t: "Garantia e suporte", b: "Acompanhamento contínuo." },
    ],
  },
  network: {
    subtitle: "Solução em Redes e Infraestrutura",
    importanceTitle: "Por que investir em infraestrutura de rede?",
    importanceIntro:
      "Uma rede estável é a base de quase todos os serviços modernos: internet, câmeras, controle de acesso, automação e gestão. Estrutura mal feita gera lentidão, instabilidade e custo recorrente de manutenção.",
    importanceCards: [
      { t: "Estabilidade", b: "Conexão consistente para todos os dispositivos." },
      { t: "Desempenho", b: "Velocidade adequada ao uso do ambiente." },
      { t: "Cobertura WiFi", b: "Sinal nas áreas certas, sem zonas mortas." },
      { t: "Cabeamento organizado", b: "Rack limpo e bem documentado." },
      { t: "Segurança lógica", b: "Segmentação e proteção da rede." },
      { t: "Escalabilidade", b: "Pronta para crescer com o ambiente." },
    ],
    solutionTitle: "Solução de conectividade e infraestrutura",
    solutionIntro:
      "A solução contempla cabeamento estruturado, ativos de rede, pontos de acesso WiFi e organização do rack, com configuração das redes. O projeto foi dimensionado para entregar estabilidade, desempenho e facilidade de manutenção.",
    solutionBenefits: [
      { t: "Cabeamento estruturado", b: "Padrão técnico em todos os pontos." },
      { t: "WiFi bem distribuído", b: "Cobertura onde realmente precisa." },
      { t: "Rack organizado", b: "Identificação e documentação clara." },
      { t: "Segmentação de rede", b: "Mais segurança e controle." },
      { t: "Equipamentos adequados", b: "Selecionados para o porte do projeto." },
      { t: "Suporte e garantia", b: "Acompanhamento pós-instalação." },
    ],
  },
  automation: {
    subtitle: "Solução em Automação",
    importanceTitle: "Por que investir em automação?",
    importanceIntro:
      "A automação transforma o uso do ambiente em algo mais prático, controlável e integrado. Iluminação, acionamentos, cenas e dispositivos passam a operar de forma centralizada e inteligente.",
    importanceCards: [
      { t: "Praticidade", b: "Controle pelo celular, voz ou cena programada." },
      { t: "Integração", b: "Vários sistemas operando em conjunto." },
      { t: "Conforto", b: "Ambiente reage à rotina do usuário." },
      { t: "Economia", b: "Uso mais consciente de energia." },
      { t: "Segurança", b: "Simulação de presença e acionamentos remotos." },
      { t: "Valorização", b: "Imóvel com tecnologia agregada." },
    ],
    solutionTitle: "Solução de automação e integração",
    solutionIntro:
      "A solução contempla módulos de automação, infraestrutura de comando e configuração de cenas/rotinas. O projeto foi pensado para entregar uso simples no dia a dia e integração com os demais sistemas do ambiente.",
    solutionBenefits: [
      { t: "Cenas programadas", b: "Acionamentos com um toque." },
      { t: "Controle remoto", b: "Pelo aplicativo, de qualquer lugar." },
      { t: "Integração", b: "Funciona com outros sistemas." },
      { t: "Instalação limpa", b: "Sem alterações estéticas agressivas." },
      { t: "Suporte técnico", b: "Equipe disponível para ajustes." },
      { t: "Escalável", b: "Pode crescer por etapas." },
    ],
  },
  solar: {
    subtitle: "Solução em Energia Solar",
    importanceTitle: "Por que investir em energia solar?",
    importanceIntro:
      "A energia solar reduz o custo de energia elétrica de forma previsível, agrega valor ao imóvel e contribui para uma operação mais eficiente e sustentável.",
    importanceCards: [
      { t: "Economia mensal", b: "Redução real da conta de energia." },
      { t: "Previsibilidade", b: "Custo de energia mais estável no tempo." },
      { t: "Valorização do imóvel", b: "Sistema próprio de geração agregado." },
      { t: "Sustentabilidade", b: "Energia limpa e renovável." },
      { t: "Vida útil longa", b: "Equipamentos com durabilidade comprovada." },
      { t: "Monitoramento", b: "Acompanhamento da geração pelo app." },
    ],
    solutionTitle: "Solução de geração e economia de energia",
    solutionIntro:
      "A solução contempla módulos fotovoltaicos, inversor, estrutura de fixação, proteção e configuração do monitoramento. O projeto foi dimensionado conforme o consumo informado e a capacidade do telhado/área disponível.",
    solutionBenefits: [
      { t: "Dimensionamento técnico", b: "Adequado ao consumo do imóvel." },
      { t: "Estrutura segura", b: "Fixação correta dos módulos." },
      { t: "Inversor de qualidade", b: "Eficiência e confiabilidade." },
      { t: "Proteções elétricas", b: "String box e aterramento corretos." },
      { t: "Monitoramento", b: "Acompanhamento contínuo." },
      { t: "Garantia", b: "Conforme política dos fabricantes." },
    ],
  },
  ev: {
    subtitle: "Solução em Recarga Veicular Elétrica",
    importanceTitle: "Por que investir em carregador veicular?",
    importanceIntro:
      "O carregador para veículos elétricos é uma infraestrutura cada vez mais essencial. Ele garante recarga segura, rápida e dimensionada conforme a instalação elétrica do imóvel.",
    importanceCards: [
      { t: "Recarga segura", b: "Proteções específicas para VE." },
      { t: "Praticidade", b: "Carregar em casa, no próprio horário." },
      { t: "Eficiência", b: "Tempo de carga adequado ao veículo." },
      { t: "Valorização do imóvel", b: "Infraestrutura moderna agregada." },
      { t: "Sustentabilidade", b: "Combina com energia solar." },
      { t: "Pronto para o futuro", b: "Imóvel preparado para a mobilidade elétrica." },
    ],
    solutionTitle: "Solução de recarga veicular",
    solutionIntro:
      "A solução contempla o carregador, infraestrutura elétrica adequada, proteções e configuração. O projeto foi dimensionado conforme o veículo informado e a capacidade da instalação elétrica do imóvel.",
    solutionBenefits: [
      { t: "Dimensionamento correto", b: "Compatível com a instalação elétrica." },
      { t: "Proteções dedicadas", b: "DR, disjuntor e aterramento." },
      { t: "Equipamento certificado", b: "Modelo adequado ao veículo." },
      { t: "Instalação organizada", b: "Acabamento profissional." },
      { t: "Documentação técnica", b: "Memorial e diagrama da instalação." },
      { t: "Suporte e garantia", b: "Acompanhamento pós-instalação." },
    ],
  },
  audio: {
    subtitle: "Solução em Som Ambiente e Comunicação Visual",
    importanceTitle: "Por que investir em som ambiente e mídia?",
    importanceIntro:
      "Som ambiente, painéis de LED e mídia visual transformam a experiência do ambiente — comunicam, ambientam, informam e fortalecem a percepção do espaço.",
    importanceCards: [
      { t: "Experiência", b: "Ambientes mais agradáveis e envolventes." },
      { t: "Comunicação", b: "Mensagens, avisos e conteúdo dirigido." },
      { t: "Profissionalismo", b: "Transmite cuidado e organização." },
      { t: "Versatilidade", b: "Atende lazer, vendas e operação." },
      { t: "Cobertura sonora", b: "Volume equilibrado em todo o ambiente." },
      { t: "Integração", b: "Som + mídia controlados juntos." },
    ],
    solutionTitle: "Solução de áudio e ambientação",
    solutionIntro:
      "A solução contempla amplificação, caixas acústicas, fontes de áudio e/ou painéis de mídia, com configuração para uso contínuo. O projeto foi pensado para entregar cobertura equilibrada, qualidade sonora e operação simples.",
    solutionBenefits: [
      { t: "Cobertura equilibrada", b: "Som distribuído com qualidade." },
      { t: "Equipamentos adequados", b: "Selecionados para o ambiente." },
      { t: "Operação simples", b: "Controle prático no dia a dia." },
      { t: "Instalação limpa", b: "Sem comprometer a estética." },
      { t: "Integração", b: "Funciona com mídia/cenas." },
      { t: "Suporte técnico", b: "Garantia e acompanhamento." },
    ],
  },
  generic: {
    subtitle: "Solução Técnica Personalizada",
    importanceTitle: "Por que investir nessa solução?",
    importanceIntro:
      "Uma solução bem projetada gera mais segurança, controle e eficiência para o ambiente. Estrutura correta reduz retrabalho, custos futuros e dores de cabeça operacionais.",
    importanceCards: [
      { t: "Solução adequada", b: "Pensada para o cenário real do cliente." },
      { t: "Execução técnica", b: "Profissionais capacitados e responsáveis." },
      { t: "Documentação", b: "Projeto organizado e rastreável." },
      { t: "Menor retrabalho", b: "Instalação correta desde o início." },
      { t: "Suporte estruturado", b: "Atendimento pós-instalação." },
      { t: "Garantia", b: "Cobertura conforme proposta." },
    ],
    solutionTitle: "Solução proposta para o seu projeto",
    solutionIntro:
      "A solução contempla o fornecimento e instalação dos equipamentos necessários, com configuração, testes e entrega assistida. O projeto foi pensado para atender à necessidade do cliente com qualidade e organização.",
    solutionBenefits: [
      { t: "Equipamentos adequados", b: "Selecionados para o ambiente." },
      { t: "Instalação profissional", b: "Acabamento e organização." },
      { t: "Documentação técnica", b: "Projeto bem registrado." },
      { t: "Testes e entrega", b: "Validação antes da conclusão." },
      { t: "Suporte técnico", b: "Equipe disponível para dúvidas." },
      { t: "Garantia", b: "Conforme condições da proposta." },
    ],
  },
};

function detectSolutionKey(quote: PdfQuote, items: PdfItem[]): SolutionKey {
  const haystack = [
    quote.title ?? "",
    ...items.map((i) => `${i.name} ${i.description ?? ""}`),
  ].join(" ").toLowerCase();
  const test = (re: RegExp) => re.test(haystack);
  if (test(/(interfon|porteiro\s*eletr|video[- ]?porteir)/)) return "intercom";
  if (test(/(controle\s*de\s*acesso|catraca|biometr|leitor\s*(rfid|nfc|tag)|fechadura\s*(eletr|digital))/)) return "access";
  if (test(/(alarme|sensor\s*(de\s*)?(presen|movim|abert)|central\s*de\s*alarme|sirene)/)) return "alarm";
  if (test(/(carregador|wallbox|veic|ev\b|recarga)/)) return "ev";
  if (test(/(solar|fotovolt|inversor|placa\s*solar)/)) return "solar";
  if (test(/(automa(c|ç)ão|domot|cena|smart\s*home)/)) return "automation";
  if (test(/(rede|switch|roteador|wifi|wi[- ]fi|cabea(mento)?\s*estrutur|patch\s*panel|rack|fibra)/)) return "network";
  if (test(/(som\s*ambient|caixa\s*acust|amplificad|painel\s*de\s*led|mídia|midia)/)) return "audio";
  if (test(/(cftv|c(â|a)mer|dvr|nvr|vigil|monitor)/)) return "cftv";
  return "generic";
}

function getSolutionContent(quote: PdfQuote, items: PdfItem[]): SolutionContent {
  return SOLUTION_CONTENT[detectSolutionKey(quote, items)];
}

function inferSubtitle(quote: PdfQuote, items: PdfItem[]): string {
  return getSolutionContent(quote, items).subtitle;
}

function companyName(company: PdfCompany): string {
  return company?.trade_name || company?.corporate_name || "SmartCom DF";
}

function customerName(c: PdfCustomer): string {
  return c?.trade_name || c?.name || c?.corporate_name || "Cliente";
}

// ============================================================
// PAGES
// ============================================================

async function renderCoverPage(
  doc: jsPDF,
  ctx: {
    quote: PdfQuote;
    items: PdfItem[];
    company: PdfCompany;
    customer: PdfCustomer;
    cfg: typeof DEFAULTS;
    logoDataUrl: string | null;
  },
) {
  // Black background full page
  setFill(doc, PALETTE.black);
  doc.rect(0, 0, A4.w, A4.h, "F");

  // Gold accent bars
  setFill(doc, PALETTE.gold);
  doc.rect(0, 0, A4.w, 6, "F");
  doc.rect(0, A4.h - 6, A4.w, 6, "F");

  // Logo — white background already removed in loadLogoForDarkBg.
  // Rendered directly on the black background, no white box.
  if (ctx.logoDataUrl) {
    try {
      const lw = 160;
      const lh = 80;
      doc.addImage(
        ctx.logoDataUrl,
        "PNG",
        A4.w / 2 - lw / 2,
        90,
        lw,
        lh,
        undefined,
        "FAST",
      );
    } catch {
      /* ignore */
    }
  } else {
    setText(doc, PALETTE.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(companyName(ctx.company).toUpperCase(), A4.w / 2, 130, { align: "center" });
  }

  // Eyebrow
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PROPOSTA TÉCNICA E COMERCIAL", A4.w / 2, 220, { align: "center" });

  // Subtitle dynamic
  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const subtitle = inferSubtitle(ctx.quote, ctx.items);
  const subLines = doc.splitTextToSize(subtitle, A4.w - 120) as string[];
  let sy = 260;
  subLines.forEach((ln) => {
    doc.text(ln, A4.w / 2, sy, { align: "center" });
    sy += 32;
  });

  // Decorative gold line
  setFill(doc, PALETTE.gold);
  doc.rect(A4.w / 2 - 30, sy + 10, 60, 2, "F");

  // White info card
  const cardX = MARGIN + 20;
  const cardY = 420;
  const cardW = A4.w - (MARGIN + 20) * 2;
  const cardH = 220;
  setFill(doc, PALETTE.white);
  doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(cardX, cardY, cardW, 4, "F");

  setText(doc, PALETTE.grayDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PREPARADA PARA", cardX + 20, cardY + 26);

  setText(doc, PALETTE.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(customerName(ctx.customer), cardX + 20, cardY + 46);

  if (ctx.quote.title) {
    setText(doc, PALETTE.grayDark);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    const tt = doc.splitTextToSize(ctx.quote.title, cardW - 40) as string[];
    doc.text(tt.slice(0, 2), cardX + 20, cardY + 64);
  }

  // 2-col meta grid
  const metaY = cardY + 100;
  const colW = (cardW - 60) / 2;
  const drawMeta = (x: number, y: number, label: string, value: string) => {
    setText(doc, PALETTE.gray);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    setText(doc, PALETTE.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value, x, y + 12);
  };

  drawMeta(cardX + 20, metaY, "Nº da proposta", ctx.quote.quote_number);
  drawMeta(cardX + 20 + colW + 20, metaY, "Data", fmtDate(ctx.quote.issue_date));
  drawMeta(cardX + 20, metaY + 36, "Validade", fmtDate(ctx.quote.valid_until));
  drawMeta(
    cardX + 20 + colW + 20,
    metaY + 36,
    "Responsável",
    ctx.cfg.responsibleName || ctx.company?.email || "Equipe Comercial",
  );
  const contact = ctx.cfg.responsiblePhone || ctx.company?.whatsapp || ctx.company?.phone || "—";
  drawMeta(cardX + 20, metaY + 72, "Contato / WhatsApp", contact);
  drawMeta(
    cardX + 20 + colW + 20,
    metaY + 72,
    "E-mail",
    ctx.company?.email || "—",
  );

  // Tagline at bottom
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text(
    "Segurança, tecnologia e execução técnica para proteger o que realmente importa.",
    A4.w / 2,
    A4.h - 80,
    { align: "center", maxWidth: A4.w - 120 },
  );
}

function renderCompanyIntroPage(doc: jsPDF, ctx: { company: PdfCompany }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Apresentação", y);
  y = drawSectionTitle(doc, "Prezado cliente,", y);

  y = drawParagraph(
    doc,
    `A ${companyName(ctx.company)} apresenta esta proposta técnica e comercial com o objetivo de entregar uma solução segura, eficiente e adequada à necessidade do seu ambiente.`,
    y,
  );
  y += 4;
  y = drawParagraph(
    doc,
    "Nosso trabalho não se limita à instalação de equipamentos. Atuamos desde a análise técnica, escolha correta dos materiais, execução organizada, testes, entrega assistida e suporte pós-instalação.",
    y,
  );
  y += 4;
  y = drawParagraph(
    doc,
    "Cada projeto é pensado para reduzir riscos, evitar retrabalho, melhorar o controle do ambiente e garantir maior confiabilidade na operação.",
    y,
  );

  y += 16;
  // Pull-quote box
  setFill(doc, PALETTE.black);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 70, 6, 6, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(MARGIN, y, 4, 70, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("NOSSO COMPROMISSO", MARGIN + 18, y + 22);
  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "Mais do que vender equipamentos, entregamos uma solução técnica\ncom responsabilidade, acabamento e suporte.",
    MARGIN + 18,
    y + 42,
  );
}

function renderAboutPage(doc: jsPDF, ctx: { company: PdfCompany; cfg: typeof DEFAULTS }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Quem somos", y);
  y = drawSectionTitle(doc, `Sobre a ${companyName(ctx.company)}`, y);

  y = drawParagraph(
    doc,
    `A ${companyName(ctx.company)} é uma empresa especializada em soluções integradas de segurança eletrônica, tecnologia e infraestrutura para residências, condomínios, comércios e empresas.`,
    y,
  );
  y += 4;
  y = drawParagraph(
    doc,
    "Atuamos com projetos, instalação, manutenção e suporte técnico em sistemas de CFTV, alarmes, controle de acesso, interfonia, redes, automação, energia solar, carregadores veiculares e soluções sob medida.",
    y,
  );

  y += 8;
  // 3 pillars
  const pillars = [
    { t: "Levantamento técnico", b: "Análise correta do ambiente, dimensionamento e escolha dos equipamentos adequados." },
    { t: "Instalação profissional", b: "Execução organizada, com acabamento, testes e documentação técnica." },
    { t: "Suporte e garantia", b: "Acompanhamento pós-instalação, suporte técnico e garantia sobre os serviços." },
  ];
  const cardW = (A4.w - MARGIN * 2 - 16) / 3;
  pillars.forEach((p, i) =>
    drawCard(doc, { x: MARGIN + i * (cardW + 8), y, w: cardW, h: 90, title: p.t, body: p.b, gold: true }),
  );
  y += 110;

  y = drawParagraph(
    doc,
    "Acreditamos que segurança eletrônica não deve ser tratada como improviso. Um sistema bem projetado protege pessoas, patrimônio, informações e reduz riscos operacionais.",
    y,
    { color: PALETTE.black },
  );

  y += 12;
  // KPI strip
  setFill(doc, PALETTE.black);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 80, 6, 6, "F");
  const kpiW = (A4.w - MARGIN * 2) / 3;
  const kpis = [
    { v: ctx.cfg.kpis.projects ?? "500+", l: "Projetos executados" },
    { v: ctx.cfg.kpis.cities ?? "30+", l: "Cidades atendidas" },
    { v: ctx.cfg.kpis.clients ?? "Alta satisfação", l: "Clientes atendidos" },
  ];
  kpis.forEach((k, i) => {
    const cx = MARGIN + i * kpiW + kpiW / 2;
    setText(doc, PALETTE.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(k.v, cx, y + 36, { align: "center" });
    setText(doc, PALETTE.white);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(k.l, cx, y + 58, { align: "center" });
  });
}

function renderTechnicalAuthorityPage(doc: jsPDF, ctx: { settings: PdfSettings; company: PdfCompany }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Responsabilidade Técnica", y);
  y = drawSectionTitle(doc, "Por que contratar uma empresa com responsabilidade técnica?", y);

  y = drawParagraph(
    doc,
    "Projetos de segurança eletrônica envolvem instalação elétrica, passagem de cabos, fixação de equipamentos, configuração de rede, gravação de imagens, controle de acesso e integração de sistemas. Contratar uma empresa com responsabilidade técnica reduz riscos e aumenta a segurança da execução.",
    y,
  );
  y += 6;

  const items = [
    "Melhor escolha dos equipamentos para cada cenário",
    "Instalação seguindo critérios técnicos",
    "Documentação organizada do projeto",
    "Menor risco de falhas e retrabalho",
    "Suporte técnico estruturado",
    "Garantia sobre equipamentos e serviços",
    "Manutenção futura com histórico do projeto",
  ];
  setText(doc, PALETTE.black);
  doc.setFontSize(10);
  items.forEach((t) => {
    setFill(doc, PALETTE.gold);
    doc.circle(MARGIN + 4, y - 3, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.text(t, MARGIN + 14, y);
    y += 16;
  });

  y += 6;
  // Credentials box (only real data)
  const s = ctx.settings ?? {};
  const creds: { label: string; value: string }[] = [];
  if (s.cft_registry) creds.push({ label: "Registro CFT", value: String(s.cft_registry) });
  if (s.nr10) creds.push({ label: "NR-10", value: "Certificação ativa" });
  if (s.nr35) creds.push({ label: "NR-35", value: "Certificação ativa" });
  if (s.technical_responsible) creds.push({ label: "Responsável técnico", value: String(s.technical_responsible) });

  setFill(doc, PALETTE.graphite);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, creds.length ? 110 : 70, 6, 6, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(MARGIN, y, 4, creds.length ? 110 : 70, "F");

  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CREDENCIAIS DA EMPRESA", MARGIN + 18, y + 22);

  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    `A ${companyName(ctx.company)} mantém compromisso com normas técnicas e qualificação profissional.`,
    MARGIN + 18,
    y + 40,
    { maxWidth: A4.w - MARGIN * 2 - 36 },
  );

  if (creds.length) {
    let cy = y + 64;
    creds.forEach((c) => {
      setText(doc, PALETTE.goldSoft);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(c.label.toUpperCase(), MARGIN + 18, cy);
      setText(doc, PALETTE.white);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(c.value, MARGIN + 130, cy);
      cy += 14;
    });
  }
}

function renderCftvImportancePage(doc: jsPDF) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Importância da Solução", y);
  y = drawSectionTitle(doc, "Por que investir em CFTV e segurança eletrônica?", y);

  y = drawParagraph(
    doc,
    "Um sistema de CFTV bem instalado não serve apenas para gravar imagens. Ele ajuda a prevenir ocorrências, acompanhar movimentações, registrar evidências, aumentar a sensação de segurança e melhorar a gestão do ambiente.",
    y,
  );
  y += 10;

  const cards = [
    { t: "Prevenção", b: "Câmeras visíveis inibem ações suspeitas e reduzem vulnerabilidades do ambiente." },
    { t: "Registro de evidências", b: "Imagens auxiliam na análise de ocorrências e tomada de decisão." },
    { t: "Controle do ambiente", b: "Acompanhe entradas, saídas, áreas comuns e pontos críticos." },
    { t: "Mais tranquilidade", b: "Síndicos, gestores e moradores ganham segurança e controle." },
    { t: "Valorização do imóvel", b: "Ambientes com estrutura de segurança transmitem organização." },
    { t: "Integração", b: "CFTV trabalha junto com alarmes, controle de acesso, redes e automação." },
  ];
  const cw = (A4.w - MARGIN * 2 - 16) / 3;
  const ch = 80;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawCard(doc, {
      x: MARGIN + col * (cw + 8),
      y: y + row * (ch + 10),
      w: cw,
      h: ch,
      title: c.t,
      body: c.b,
    });
  });
  y += (ch + 10) * 2;

  y += 4;
  drawParagraph(
    doc,
    "O investimento em segurança eletrônica é uma decisão preventiva. Esperar o problema acontecer costuma sair mais caro do que estruturar uma solução correta desde o início.",
    y,
    { color: PALETTE.black, size: 10.5 },
  );
}

function renderDiagnosisPage(doc: jsPDF, ctx: { quote: PdfQuote }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Análise", y);
  y = drawSectionTitle(doc, "Diagnóstico da necessidade", y);

  const text =
    ctx.quote.customer_notes?.trim() ||
    "Durante a análise da necessidade, foram considerados os pontos críticos do ambiente, a rotina de uso, a exposição a riscos, a necessidade de monitoramento, o controle de acesso e a viabilidade técnica da instalação. A solução proposta busca atender ao cenário atual e permitir futuras ampliações de forma organizada.";

  drawParagraph(doc, text, y);
}

function renderSolutionSummaryPage(doc: jsPDF, ctx: { quote: PdfQuote; items: PdfItem[] }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Solução Proposta", y);
  y = drawSectionTitle(doc, "Solução proposta para o seu projeto", y);

  const totalItems = ctx.items.filter((i) => i.kind !== "LABOR")
    .reduce((s, i) => s + i.quantity, 0);

  y = drawParagraph(
    doc,
    "A solução proposta contempla o fornecimento e instalação dos equipamentos necessários para compor um sistema funcional, organizado e preparado para atender às necessidades do cliente. O projeto foi estruturado considerando qualidade, estabilidade da rede, organização da infraestrutura, facilidade de manutenção e suporte pós-instalação.",
    y,
  );
  y += 6;

  // Quick facts
  setFill(doc, PALETTE.graphite);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 56, 6, 6, "F");
  const fW = (A4.w - MARGIN * 2) / 2;
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ESCOPO PRINCIPAL", MARGIN + 16, y + 18);
  doc.text("ITENS PREVISTOS", MARGIN + 16 + fW, y + 18);
  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(ctx.quote.title || "Solução técnica personalizada", MARGIN + 16, y + 38, { maxWidth: fW - 24 });
  doc.text(
    `${ctx.items.filter((i) => i.kind !== "LABOR").length} produtos · ${String(totalItems).replace(".", ",")} unidades`,
    MARGIN + 16 + fW,
    y + 38,
  );
  y += 70;

  // Benefits
  const benefits = [
    { t: "Monitoramento eficiente", b: "Cobertura adequada dos pontos críticos." },
    { t: "Acabamento profissional", b: "Instalação organizada e bem documentada." },
    { t: "Equipamentos adequados", b: "Selecionados para o ambiente do projeto." },
    { t: "Controle de acesso", b: "Gestão de quem entra, sai e circula." },
    { t: "Suporte especializado", b: "Equipe técnica para esclarecer dúvidas." },
    { t: "Garantia e acompanhamento", b: "Pós-instalação assistido e estruturado." },
  ];
  const cw = (A4.w - MARGIN * 2 - 16) / 3;
  const ch = 72;
  benefits.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawCard(doc, {
      x: MARGIN + col * (cw + 8),
      y: y + row * (ch + 10),
      w: cw,
      h: ch,
      title: c.t,
      body: c.b,
      gold: true,
    });
  });
}

function renderScopePage(doc: jsPDF) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Escopo", y);
  y = drawSectionTitle(doc, "Escopo técnico do serviço", y);

  const colW = (A4.w - MARGIN * 2 - 16) / 2;

  // Included
  setFill(doc, PALETTE.white);
  setStroke(doc, PALETTE.gold);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, y, colW, 240, 6, 6, "FD");
  setFill(doc, PALETTE.gold);
  doc.rect(MARGIN, y, colW, 4, "F");
  setText(doc, PALETTE.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Incluso na proposta", MARGIN + 14, y + 24);

  const inc = [
    "Fornecimento dos equipamentos listados",
    "Instalação dos equipamentos",
    "Configuração inicial",
    "Testes de funcionamento",
    "Orientação básica de uso",
    "Entrega técnica",
    "Garantia conforme proposta",
  ];
  setText(doc, PALETTE.grayDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  inc.forEach((t, i) => {
    setFill(doc, PALETTE.gold);
    doc.circle(MARGIN + 18, y + 44 + i * 22, 2, "F");
    doc.text(t, MARGIN + 28, y + 47 + i * 22);
  });

  // Not included
  const x2 = MARGIN + colW + 16;
  setFill(doc, PALETTE.white);
  setStroke(doc, PALETTE.grayLight);
  doc.roundedRect(x2, y, colW, 240, 6, 6, "FD");
  setFill(doc, PALETTE.graphite);
  doc.rect(x2, y, colW, 4, "F");
  setText(doc, PALETTE.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Não incluso (salvo acordo)", x2 + 14, y + 24);

  const exc = [
    "Serviços de alvenaria",
    "Pintura",
    "Serralheria",
    "Infraestrutura não prevista",
    "Pontos elétricos adicionais",
    "Internet / link dedicado",
    "Adequações estruturais",
  ];
  setText(doc, PALETTE.grayDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  exc.forEach((t, i) => {
    setText(doc, PALETTE.gray);
    doc.text("×", x2 + 16, y + 47 + i * 22);
    setText(doc, PALETTE.grayDark);
    doc.text(t, x2 + 28, y + 47 + i * 22);
  });
}

function renderMaterialsTablePage(doc: jsPDF, ctx: { items: PdfItem[] }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Materiais", y);
  y = drawSectionTitle(doc, "Materiais e itens do projeto", y);

  const visible = ctx.items.filter((it) => it.kind !== "LABOR");

  autoTable(doc, {
    startY: y,
    head: [["#", "Item / Descrição", "Qtd", "Un"]],
    body: visible.map((it, i) => [
      String(i + 1),
      it.description ? `${it.name}\n${it.description}` : it.name,
      String(Number(it.quantity)).replace(".", ","),
      it.unit || "UN",
    ]),
    styles: { fontSize: 10, cellPadding: 8, valign: "top", textColor: [30, 30, 30] },
    headStyles: {
      fillColor: [11, 11, 11],
      textColor: [201, 162, 75],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: {
      0: { cellWidth: 28, halign: "center", textColor: [120, 120, 120] },
      2: { cellWidth: 50, halign: "center" },
      3: { cellWidth: 40, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 60 },
  });

  // Disclosure
  const finalY = (doc as any).lastAutoTable.finalY + 14;
  setText(doc, PALETTE.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "A tabela apresenta os itens e quantidades do projeto. Valores unitários não são detalhados — o valor total da proposta já contempla materiais, serviços e mão de obra.",
    MARGIN,
    finalY,
    { maxWidth: A4.w - MARGIN * 2 },
  );
}

async function renderProductHighlight(
  doc: jsPDF,
  ctx: { item: PdfItem; imageDataUrl: string | null; index: number; total: number },
) {
  let y = newPage(doc);
  y = drawEyebrow(doc, `Produto em destaque · ${ctx.index + 1}/${ctx.total}`, y);
  y = drawSectionTitle(doc, ctx.item.name, y);

  // Image box on left, copy on right
  const imgW = 220;
  const imgH = 200;
  setFill(doc, PALETTE.grayLight);
  doc.roundedRect(MARGIN, y, imgW, imgH, 6, 6, "F");
  if (ctx.imageDataUrl) {
    try {
      const fmt = detectImageFormat(ctx.imageDataUrl);
      doc.addImage(ctx.imageDataUrl, fmt, MARGIN + 6, y + 6, imgW - 12, imgH - 12, undefined, "FAST");
    } catch {
      /* ignore */
    }
  } else {
    setText(doc, PALETTE.gray);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Imagem ilustrativa", MARGIN + imgW / 2, y + imgH / 2, { align: "center" });
  }

  const tx = MARGIN + imgW + 20;
  const tw = A4.w - tx - MARGIN;

  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("POR QUE FOI ESCOLHIDO", tx, y + 16);
  setText(doc, PALETTE.black);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const reason =
    "Este equipamento foi selecionado por oferecer bom desempenho, confiabilidade e compatibilidade com a necessidade técnica do projeto.";
  const rLines = doc.splitTextToSize(reason, tw) as string[];
  let cy = y + 32;
  rLines.forEach((ln) => { doc.text(ln, tx, cy); cy += 13; });

  if (ctx.item.description) {
    cy += 6;
    setText(doc, PALETTE.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DESCRIÇÃO", tx, cy);
    cy += 12;
    setText(doc, PALETTE.grayDark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const dLines = doc.splitTextToSize(ctx.item.description, tw) as string[];
    dLines.slice(0, 8).forEach((ln) => { doc.text(ln, tx, cy); cy += 12; });
  }

  cy += 6;
  setText(doc, PALETTE.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("BENEFÍCIOS", tx, cy);
  cy += 12;
  setText(doc, PALETTE.grayDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  ["Qualidade comprovada", "Boa durabilidade", "Compatibilidade", "Facilidade de manutenção"].forEach((b) => {
    setFill(doc, PALETTE.gold);
    doc.circle(tx + 2, cy - 3, 1.6, "F");
    doc.text(b, tx + 10, cy);
    cy += 12;
  });

  // Quantity badge
  let by = y + imgH + 16;
  setFill(doc, PALETTE.black);
  doc.roundedRect(MARGIN, by, imgW, 36, 6, 6, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("QUANTIDADE NO PROJETO", MARGIN + 14, by + 14);
  setText(doc, PALETTE.white);
  doc.setFontSize(13);
  doc.text(
    `${String(Number(ctx.item.quantity)).replace(".", ",")} ${ctx.item.unit}`,
    MARGIN + 14,
    by + 30,
  );
}

function renderExecutionProcessPage(doc: jsPDF) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Execução", y);
  y = drawSectionTitle(doc, "Como será a execução do projeto", y);

  const steps = [
    "Aprovação da proposta",
    "Pagamento de entrada, quando houver",
    "Agendamento da instalação",
    "Separação dos materiais",
    "Execução técnica",
    "Configuração e testes",
    "Entrega assistida",
    "Garantia e suporte",
  ];

  const startY = y + 6;
  setStroke(doc, PALETTE.gold);
  doc.setLineWidth(1.5);
  doc.line(MARGIN + 14, startY, MARGIN + 14, startY + steps.length * 36 - 18);

  steps.forEach((s, i) => {
    const cy = startY + i * 36;
    setFill(doc, PALETTE.gold);
    doc.circle(MARGIN + 14, cy, 9, "F");
    setText(doc, PALETTE.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(String(i + 1), MARGIN + 14, cy + 3, { align: "center" });
    setText(doc, PALETTE.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(s, MARGIN + 34, cy + 4);
  });

  y = startY + steps.length * 36 + 4;
  drawParagraph(
    doc,
    "Este processo garante mais previsibilidade, organização e transparência para o cliente durante toda a entrega do projeto.",
    y,
    { color: PALETTE.grayDark },
  );
}

function renderWarrantySupportPage(doc: jsPDF) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Pós-instalação", y);
  y = drawSectionTitle(doc, "Garantia, suporte e acompanhamento", y);

  y = drawParagraph(
    doc,
    "Após a instalação realizamos testes de funcionamento e orientamos o cliente sobre o uso básico da solução implantada. A garantia cobre os serviços executados conforme as condições descritas nesta proposta. Equipamentos seguem garantia conforme fabricante, quando aplicável.",
    y,
  );
  y += 10;

  const cards = [
    { t: "Suporte técnico", b: "Atendimento estruturado para dúvidas técnicas." },
    { t: "Garantia de instalação", b: "Cobertura conforme condições da proposta." },
    { t: "Garantia de equipamentos", b: "Conforme política do fabricante." },
    { t: "Orientação de uso", b: "Cliente recebe instruções claras de operação." },
    { t: "Manutenção preventiva", b: "Plano opcional para manter o sistema saudável." },
    { t: "Histórico do projeto", b: "Documentação para futuras intervenções." },
  ];
  const cw = (A4.w - MARGIN * 2 - 16) / 3;
  const ch = 78;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawCard(doc, {
      x: MARGIN + col * (cw + 8),
      y: y + row * (ch + 10),
      w: cw,
      h: ch,
      title: c.t,
      body: c.b,
    });
  });
}

function renderCommercialConditionsPage(doc: jsPDF, ctx: { quote: PdfQuote }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Investimento", y);
  y = drawSectionTitle(doc, "Condições comerciais", y);

  // Big total
  setFill(doc, PALETTE.black);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 110, 8, 8, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(MARGIN, y, 6, 110, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VALOR TOTAL DA PROPOSTA", MARGIN + 20, y + 30);
  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(fmtBRL(ctx.quote.total_amount), MARGIN + 20, y + 70);
  setText(doc, PALETTE.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "Valor total com materiais, serviços e mão de obra inclusos.",
    MARGIN + 20,
    y + 92,
  );
  y += 130;

  // Terms grid
  const blocks: { label: string; value: string | null | undefined }[] = [
    { label: "Forma de pagamento", value: ctx.quote.payment_terms },
    { label: "Prazo / entrega", value: ctx.quote.delivery_terms },
    { label: "Estimativa de conclusão", value: ctx.quote.completion_estimate },
    { label: "Validade da proposta", value: fmtDate(ctx.quote.valid_until) },
    { label: "Garantia", value: ctx.quote.warranty_terms },
  ];
  if (ctx.quote.down_payment_percent > 0) {
    blocks.unshift({
      label: `Entrada (${ctx.quote.down_payment_percent}%)`,
      value: `${fmtBRL(ctx.quote.down_payment_amount)} · Saldo restante ${fmtBRL(ctx.quote.remaining_amount)}`,
    });
  }

  blocks.forEach((b) => {
    if (!b.value) return;
    y = ensureSpace(doc, y, 50);
    setText(doc, PALETTE.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(b.label.toUpperCase(), MARGIN, y);
    setText(doc, PALETTE.black);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(String(b.value), A4.w - MARGIN * 2) as string[];
    lines.forEach((ln, i) => doc.text(ln, MARGIN, y + 14 + i * 13));
    y += 14 + lines.length * 13 + 12;
  });
}

function renderImportantNotesPage(doc: jsPDF, ctx: { quote: PdfQuote }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Observações", y);
  y = drawSectionTitle(doc, "Observações da proposta", y);

  const items: string[] = [];
  if (ctx.quote.customer_notes?.trim()) items.push(ctx.quote.customer_notes.trim());
  items.push(
    "A proposta foi elaborada com base nas informações disponíveis no momento da análise.",
    "Alterações de escopo poderão gerar revisão de valores.",
    "Serviços não listados nesta proposta não estão inclusos.",
    "A instalação depende de disponibilidade de acesso ao local.",
    "Infraestrutura adicional será validada antes da execução.",
    "Equipamentos possuem garantia conforme fabricante.",
    "Serviços possuem garantia conforme condição comercial informada.",
  );

  items.forEach((t) => {
    y = ensureSpace(doc, y, 40);
    setFill(doc, PALETTE.gold);
    doc.circle(MARGIN + 3, y - 3, 2, "F");
    setText(doc, PALETTE.grayDark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(t, A4.w - MARGIN * 2 - 14) as string[];
    lines.forEach((ln, i) => doc.text(ln, MARGIN + 14, y + i * 14));
    y += lines.length * 14 + 6;
  });
}

async function renderAcceptancePage(
  doc: jsPDF,
  ctx: {
    quote: PdfQuote;
    customer: PdfCustomer;
    company: PdfCompany;
    publicUrl: string;
    cfg: typeof DEFAULTS;
  },
) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Próximo Passo", y);
  y = drawSectionTitle(doc, "Aceite da proposta", y);

  y = drawParagraph(
    doc,
    "Ao aprovar esta proposta, o cliente declara estar ciente do escopo, condições comerciais, prazo, garantias e observações descritas neste documento.",
    y,
  );
  y += 6;

  // Signature block
  setFill(doc, PALETTE.white);
  setStroke(doc, PALETTE.grayLight);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 130, 6, 6, "FD");
  const colW = (A4.w - MARGIN * 2 - 30) / 2;
  setText(doc, PALETTE.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("NOME DO CLIENTE", MARGIN + 14, y + 22);
  doc.text("CPF / CNPJ", MARGIN + 14 + colW + 14, y + 22);
  setStroke(doc, PALETTE.grayDark);
  doc.line(MARGIN + 14, y + 50, MARGIN + 14 + colW, y + 50);
  doc.line(MARGIN + 14 + colW + 14, y + 50, MARGIN + 14 + colW + 14 + colW, y + 50);
  setText(doc, PALETTE.gold);
  doc.text("DATA", MARGIN + 14, y + 78);
  doc.text("ASSINATURA", MARGIN + 14 + colW + 14, y + 78);
  setStroke(doc, PALETTE.grayDark);
  doc.line(MARGIN + 14, y + 106, MARGIN + 14 + colW, y + 106);
  doc.line(MARGIN + 14 + colW + 14, y + 106, MARGIN + 14 + colW + 14 + colW, y + 106);
  y += 144;

  // CTA bar
  setFill(doc, PALETTE.black);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 60, 6, 6, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(MARGIN, y, 6, 60, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRONTO PARA APROVAR?", MARGIN + 20, y + 22);
  setText(doc, PALETTE.white);
  doc.setFontSize(14);
  doc.text("Aprovar proposta e iniciar projeto", MARGIN + 20, y + 44);
  y += 76;

  // QR codes
  const qrSize = 110;
  const acceptQr = ctx.cfg.showAcceptanceQr ? await generateQrDataUrl(ctx.publicUrl) : null;
  const wa = ctx.company?.whatsapp || ctx.company?.phone || "";
  const waDigits = String(wa).replace(/\D/g, "");
  const waUrl = waDigits
    ? `https://wa.me/${waDigits.startsWith("55") ? waDigits : `55${waDigits}`}?text=${encodeURIComponent(
        `Olá! Estou com a proposta ${ctx.quote.quote_number} e gostaria de aprovar.`,
      )}`
    : null;
  const waQr = ctx.cfg.showWhatsappQr && waUrl ? await generateQrDataUrl(waUrl) : null;

  const qrs = [
    acceptQr ? { dataUrl: acceptQr, label: "Aprovar online", caption: ctx.publicUrl } : null,
    waQr ? { dataUrl: waQr, label: "Falar no WhatsApp", caption: wa } : null,
  ].filter(Boolean) as { dataUrl: string; label: string; caption: string }[];

  if (qrs.length) {
    const totalW = qrs.length * (qrSize + 120);
    let qx = (A4.w - totalW) / 2;
    qrs.forEach((q) => {
      try {
        doc.addImage(q.dataUrl, "PNG", qx, y, qrSize, qrSize, undefined, "FAST");
      } catch {
        /* ignore */
      }
      setText(doc, PALETTE.black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(q.label, qx + qrSize + 16, y + 28);
      setText(doc, PALETTE.grayDark);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(q.caption, 110) as string[], qx + qrSize + 16, y + 44);
      qx += qrSize + 120;
    });
  }
}

function renderCompanyDataPage(doc: jsPDF, ctx: { company: PdfCompany; settings: PdfSettings }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Contato", y);
  y = drawSectionTitle(doc, `Dados da ${companyName(ctx.company)}`, y);

  const rows: { label: string; value?: string | null }[] = [
    { label: "Razão social", value: ctx.company?.corporate_name },
    { label: "Nome fantasia", value: ctx.company?.trade_name },
    { label: "CNPJ", value: ctx.company?.cnpj },
    { label: "Telefone", value: ctx.company?.phone },
    { label: "WhatsApp", value: ctx.company?.whatsapp },
    { label: "E-mail", value: ctx.company?.email },
    { label: "Responsável técnico", value: ctx.settings?.technical_responsible },
    { label: "Registro CFT", value: ctx.settings?.cft_registry },
  ];

  rows.filter((r) => r.value).forEach((r) => {
    setText(doc, PALETTE.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(r.label.toUpperCase(), MARGIN, y);
    setText(doc, PALETTE.black);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(String(r.value), MARGIN + 140, y);
    setStroke(doc, PALETTE.grayLight);
    doc.line(MARGIN, y + 8, A4.w - MARGIN, y + 8);
    y += 24;
  });

  y += 16;
  setFill(doc, PALETTE.black);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 90, 6, 6, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text(
    `Obrigado pela oportunidade de apresentar esta solução. A ${companyName(ctx.company)} está à disposição para esclarecer dúvidas e iniciar a execução com segurança, organização e responsabilidade técnica.`,
    MARGIN + 20,
    y + 36,
    { maxWidth: A4.w - MARGIN * 2 - 40 },
  );
}

// ============================================================
// MAIN
// ============================================================

export async function generatePremiumQuotePDF(opts: {
  quote: PdfQuote;
  items: PdfItem[];
  customer: PdfCustomer;
  company: PdfCompany;
  settings: PdfSettings;
  publicLink: string;
  config?: PremiumPdfConfig;
  output?: "save" | "blob";
}): Promise<Blob | void> {

  const cfg = { ...DEFAULTS, ...(opts.config ?? {}), kpis: { ...DEFAULTS.kpis, ...(opts.config?.kpis ?? {}) } };

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  // Preload images in parallel
  const logoPromise = loadImageAsDataUrl(opts.company?.logo_url ?? null);
  const highlightItems = cfg.showProductHighlights
    ? opts.items
        .filter((it) => it.kind !== "LABOR" && it.image_url)
        .slice(0, cfg.maxProductHighlights)
    : [];
  const productImagesPromise = Promise.all(
    highlightItems.map((it) => loadImageAsDataUrl(it.image_url)),
  );
  const [logoDataUrl, productImages] = await Promise.all([logoPromise, productImagesPromise]);

  // Render pages
  await renderCoverPage(doc, {
    quote: opts.quote,
    company: opts.company,
    customer: opts.customer,
    cfg,
    logoDataUrl,
  });
  renderCompanyIntroPage(doc, { company: opts.company });
  renderAboutPage(doc, { company: opts.company, cfg });
  if (cfg.showCftPage) renderTechnicalAuthorityPage(doc, { settings: opts.settings, company: opts.company });
  if (cfg.showCftvImportance) renderCftvImportancePage(doc);
  if (cfg.showDiagnosis) renderDiagnosisPage(doc, { quote: opts.quote });
  if (cfg.showSolutionSummary) renderSolutionSummaryPage(doc, { quote: opts.quote, items: opts.items });
  if (cfg.showScope) renderScopePage(doc);
  if (cfg.showMaterialsTable) renderMaterialsTablePage(doc, { items: opts.items });
  if (cfg.showProductHighlights) {
    for (let i = 0; i < highlightItems.length; i++) {
      await renderProductHighlight(doc, {
        item: highlightItems[i],
        imageDataUrl: productImages[i] ?? null,
        index: i,
        total: highlightItems.length,
      });
    }
  }
  if (cfg.showExecutionProcess) renderExecutionProcessPage(doc);
  if (cfg.showWarrantySupport) renderWarrantySupportPage(doc);
  if (cfg.showCommercialConditions) renderCommercialConditionsPage(doc, { quote: opts.quote });
  if (cfg.showImportantNotes) renderImportantNotesPage(doc, { quote: opts.quote });
  if (cfg.showAcceptancePage) {
    await renderAcceptancePage(doc, {
      quote: opts.quote,
      customer: opts.customer,
      company: opts.company,
      publicUrl: opts.publicLink,
      cfg,
    });
  }
  renderCompanyDataPage(doc, { company: opts.company, settings: opts.settings });

  // Footer on every page EXCEPT cover (page 1 has its own design)
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    // drawFooter pulled via helper applyFooters would overwrite cover; do manually
  }
  applyFooters(doc, companyName(opts.company));
  // Re-paint cover top/bottom gold bars (footer overwrote bottom)
  doc.setPage(1);
  setFill(doc, PALETTE.black);
  // bottom bar of cover
  doc.rect(0, A4.h - 32, A4.w, 32, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(0, A4.h - 6, A4.w, 6, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text(
    "Segurança, tecnologia e execução técnica para proteger o que realmente importa.",
    A4.w / 2,
    A4.h - 14,
    { align: "center", maxWidth: A4.w - 120 },
  );

  if (opts.output === "blob") return doc.output("blob");
  doc.save(`Proposta-${opts.quote.quote_number}.pdf`);
}

