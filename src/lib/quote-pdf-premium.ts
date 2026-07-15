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
  diagnosis_problem?: string | null;
  diagnosis_need?: string | null;
  diagnosis_environment?: string | null;
  diagnosis_objective?: string | null;
  diagnosis_critical_points?: string | null;
  diagnosis_technical_notes?: string | null;
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
  sku?: string | null;
  image_url: string | null;
  position: number;
};

export type PremiumPdfConfig = {
  compactPremiumPdf?: boolean;
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
  compactPremiumPdf: true,
  showCftPage: true,
  showCftvImportance: true,
  showDiagnosis: true,
  showSolutionSummary: true,
  showScope: true,
  showProductHighlights: true,
  maxProductHighlights: 3,
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

// ============================================================
// STRATEGIC ITEM SELECTION
// ============================================================

type ScoredItem = { item: PdfItem; score: number; category: HighlightCategory };

type HighlightCategory =
  | "camera" | "dvr" | "switch" | "alarm_central" | "sensor" | "siren"
  | "intercom" | "lock" | "access_reader" | "controller" | "router" | "ap"
  | "motor" | "inverter" | "solar_panel" | "ev_charger" | "amp" | "speaker"
  | "led_panel" | "radio" | "other";

const NEGATIVE_RE = /(cabo|canaleta|conector|parafuso|caixa\s*de\s*passag|disjuntor|protetor|suporte|abraçad|abracad|braçad|bracad|eletrod|terminal|presilha|fita|bucha|chumb|silicone|fonte\s*simples|adaptador\s*simples)/i;

function categorizeItem(it: PdfItem): HighlightCategory {
  const s = `${it.name} ${it.description ?? ""}`.toLowerCase();
  if (/(dvr|nvr|gravador)/.test(s)) return "dvr";
  if (/(c[âa]mer|bullet|dome|speed\s*dome|ipc\b)/.test(s)) return "camera";
  if (/(switch|poe)/.test(s)) return "switch";
  if (/(central\s*de\s*alarme|painel\s*de\s*alarme)/.test(s)) return "alarm_central";
  if (/(sensor|infraverm|ivp\b|magn[ée]tic)/.test(s)) return "sensor";
  if (/(sirene)/.test(s)) return "siren";
  if (/(interfon|porteiro\s*eletr|video[- ]?porteir)/.test(s)) return "intercom";
  if (/(fechadura|trinco|eletro[ií]m)/.test(s)) return "lock";
  if (/(leitor|biometr|facial|catraca|rfid)/.test(s)) return "access_reader";
  if (/(controladora|controlador|central(?!\s*de\s*alarme))/.test(s)) return "controller";
  if (/(roteador|router)/.test(s)) return "router";
  if (/(access\s*point|\bap\b\s|repet|mesh)/.test(s)) return "ap";
  if (/(motor|automatizador\s*de\s*port|m[áa]quina\s*de\s*port)/.test(s)) return "motor";
  if (/(inversor)/.test(s)) return "inverter";
  if (/(m[óo]dulo\s*solar|placa\s*solar|painel\s*solar|fotovolt)/.test(s)) return "solar_panel";
  if (/(carregador|wallbox|veicular)/.test(s)) return "ev_charger";
  if (/(amplificad|matriz\s*de\s*som)/.test(s)) return "amp";
  if (/(caixa\s*ac[úu]st|alto[- ]?falante|speaker)/.test(s)) return "speaker";
  if (/(painel\s*de\s*led|tela\s*led)/.test(s)) return "led_panel";
  if (/(r[áa]dio|enlace|antena)/.test(s)) return "radio";
  return "other";
}

const PRIMARY_BY_SOLUTION: Record<SolutionKey, HighlightCategory[]> = {
  cftv: ["camera", "dvr", "switch", "radio"],
  alarm: ["alarm_central", "sensor", "siren", "controller"],
  intercom: ["intercom", "lock", "controller"],
  access: ["access_reader", "controller", "lock"],
  network: ["switch", "router", "ap", "radio"],
  automation: ["controller", "motor", "sensor"],
  solar: ["inverter", "solar_panel", "controller"],
  ev: ["ev_charger", "controller"],
  audio: ["amp", "speaker", "controller", "led_panel"],
  generic: ["controller", "camera", "dvr", "intercom", "access_reader", "alarm_central"],
};

function scoreItem(it: PdfItem, solution: SolutionKey): ScoredItem {
  const cat = categorizeItem(it);
  const name = `${it.name} ${it.description ?? ""}`;
  let score = 0;
  const primary = PRIMARY_BY_SOLUTION[solution] ?? [];
  if (cat !== "other" && primary[0] === cat) score += 5;
  else if (primary.includes(cat)) score += 4;
  else if (cat !== "other") score += 2;
  if (it.image_url) score += 2;
  if (it.description && it.description.trim().length > 20) score += 2;
  if (Number(it.quantity) >= 1) score += 1;
  if (NEGATIVE_RE.test(name)) score -= 3;
  if (cat === "other" && !it.image_url) score -= 2;
  if (it.kind === "LABOR") score -= 10;
  return { item: it, score, category: cat };
}

export function selectStrategicQuoteItems(
  items: PdfItem[],
  solution: SolutionKey,
  max = 3,
): PdfItem[] {
  const scored = items
    .filter((it) => it.kind !== "LABOR")
    .map((it) => scoreItem(it, solution))
    .filter((s) => s.score >= 4)
    .sort((a, b) => b.score - a.score);
  // dedupe by category so we don't repeat 3 cameras
  const seen = new Set<HighlightCategory>();
  const result: PdfItem[] = [];
  for (const s of scored) {
    if (s.category !== "other" && seen.has(s.category)) continue;
    seen.add(s.category);
    result.push(s.item);
    if (result.length >= max) break;
  }
  return result;
}

const RESOLVES_COPY: Record<HighlightCategory, string> = {
  camera: "Permite monitorar pontos estratégicos, registrar imagens com mais clareza e aumentar a capacidade de identificação de movimentações no ambiente.",
  dvr: "Centraliza a gravação das imagens, organiza o monitoramento e permite consulta posterior de eventos importantes.",
  switch: "Reduz a necessidade de fontes individuais, melhora a organização da infraestrutura e facilita a alimentação dos dispositivos pela rede.",
  alarm_central: "Monitora sensores e eventos de intrusão, permitindo resposta mais rápida em caso de tentativa de acesso indevido.",
  sensor: "Detecta movimentação, abertura ou impacto em pontos críticos do ambiente, ativando o sistema de proteção quando necessário.",
  siren: "Inibe ações suspeitas e sinaliza eventos de forma audível, reforçando o efeito dissuasivo do sistema.",
  intercom: "Melhora a comunicação com visitantes, aumenta o controle de acesso e torna a entrada no ambiente mais segura e organizada.",
  lock: "Controla a liberação de acesso, reduz uso de chaves físicas e aumenta a segurança da entrada.",
  access_reader: "Identifica usuários autorizados e libera o acesso com rastreabilidade, reduzindo riscos de entradas indevidas.",
  controller: "Centraliza a operação da solução, garantindo integração e funcionamento confiável entre os dispositivos.",
  router: "Garante a conectividade do ambiente, organiza o tráfego de rede e dá base estável para os demais sistemas.",
  ap: "Distribui o sinal Wi-Fi nos pontos certos, reduzindo zonas mortas e melhorando a experiência de uso.",
  motor: "Automatiza o acesso, melhora a praticidade e contribui para a segurança e o controle na entrada.",
  inverter: "Converte a energia gerada pelos módulos para uso no imóvel, sendo o coração do sistema fotovoltaico.",
  solar_panel: "Capta a luz solar e gera energia limpa, reduzindo o custo mensal de eletricidade do imóvel.",
  ev_charger: "Permite recarregar o veículo elétrico em casa, com mais praticidade, segurança e economia.",
  amp: "Distribui o áudio com qualidade para todo o ambiente, sustentando a experiência sonora da solução.",
  speaker: "Entrega cobertura sonora equilibrada, melhorando a experiência e a ambientação do espaço.",
  led_panel: "Comunica informações e conteúdos visuais com alto impacto, fortalecendo a apresentação do ambiente.",
  radio: "Estabelece o enlace de comunicação entre pontos distantes, mantendo dados e imagens disponíveis com estabilidade.",
  other: "Contribui para o funcionamento da solução, oferecendo desempenho e confiabilidade adequados ao projeto.",
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

// Discreet green accent used only on the cover (Smart Pro / SmartCom vibe).
const COVER_GREEN = "#22C55E";
const COVER_GREEN_SOFT = "#4ADE80";
const COVER_GRAPHITE = "#0F1216";
const COVER_GRAPHITE_2 = "#161B22";

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
  const NA = "Não informado";

  // Full-page graphite background
  setFill(doc, COVER_GRAPHITE);
  doc.rect(0, 0, A4.w, A4.h, "F");

  // Subtle inner panel for visual depth (very slight lighter graphite)
  setFill(doc, COVER_GRAPHITE_2);
  doc.rect(0, 0, A4.w, 300, "F");

  // Discreet green accent bars — thin, top and bottom
  setFill(doc, COVER_GREEN);
  doc.rect(0, 0, A4.w, 3, "F");
  doc.rect(0, A4.h - 3, A4.w, 3, "F");

  // Small vertical green mark on the left, right below the top bar
  setFill(doc, COVER_GREEN);
  doc.rect(MARGIN, 40, 3, 34, "F");
  setText(doc, COVER_GREEN_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(companyName(ctx.company).toUpperCase(), MARGIN + 12, 58);
  setText(doc, "#9CA3AF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Proposta comercial", MARGIN + 12, 70);

  // ------- Logo (aspect-preserved, bounded, centered) — enlarged to ~half the cover width -------
  const LOGO_MAX_W = 340;
  const LOGO_MAX_H = 170;
  const logoAreaTop = 95;
  const logoAreaCenterY = logoAreaTop + LOGO_MAX_H / 2;

  let logoDrawn = false;
  if (ctx.logoDataUrl) {
    try {
      const props = (doc as any).getImageProperties(ctx.logoDataUrl);
      const natW = Number(props?.width) || LOGO_MAX_W;
      const natH = Number(props?.height) || LOGO_MAX_H;
      const scale = Math.min(LOGO_MAX_W / natW, LOGO_MAX_H / natH);
      const w = Math.max(1, natW * scale);
      const h = Math.max(1, natH * scale);
      const x = A4.w / 2 - w / 2;
      const y = logoAreaCenterY - h / 2;
      const fmt = detectImageFormat(ctx.logoDataUrl);
      doc.addImage(ctx.logoDataUrl, fmt, x, y, w, h, undefined, "FAST");
      logoDrawn = true;
    } catch {
      /* fall through to text */
    }
  }
  if (!logoDrawn) {
    setText(doc, "#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text(companyName(ctx.company).toUpperCase(), A4.w / 2, logoAreaCenterY + 8, {
      align: "center",
    });
  }

  // Thin green underline just under the logo area
  setFill(doc, COVER_GREEN);
  doc.rect(A4.w / 2 - 24, logoAreaTop + LOGO_MAX_H + 8, 48, 2, "F");


  // ------- Big title -------
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("PROPOSTA COMERCIAL", A4.w / 2, 300, { align: "center" });

  // ------- Subtitle: quote title or solution subtitle -------
  const subtitle = (ctx.quote.title && ctx.quote.title.trim()) || inferSubtitle(ctx.quote, ctx.items);
  setText(doc, COVER_GREEN_SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const subLines = doc.splitTextToSize(subtitle, A4.w - 140) as string[];
  let sy = 330;
  subLines.slice(0, 2).forEach((ln) => {
    doc.text(ln, A4.w / 2, sy, { align: "center" });
    sy += 18;
  });

  // ------- Elegant data card (bottom half) -------
  const cardX = MARGIN + 10;
  const cardY = 470;
  const cardW = A4.w - (MARGIN + 10) * 2;
  const cardH = 230;
  setFill(doc, "#FFFFFF");
  doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "F");
  // green side accent
  setFill(doc, COVER_GREEN);
  doc.rect(cardX, cardY, 4, cardH, "F");

  setText(doc, "#6B7280");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PROPOSTA PREPARADA PARA", cardX + 24, cardY + 30);

  const clientLabel =
    ctx.customer?.name ||
    ctx.customer?.trade_name ||
    ctx.customer?.corporate_name ||
    NA;
  setText(doc, "#0B0B0B");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const clientLines = doc.splitTextToSize(clientLabel, cardW - 48) as string[];
  doc.text(clientLines[0], cardX + 24, cardY + 52);

  // Divider inside card
  setFill(doc, "#E5E7EB");
  doc.rect(cardX + 24, cardY + 70, cardW - 48, 0.6, "F");

  // 2-col meta grid
  const metaY = cardY + 96;
  const colW = (cardW - 72) / 2;
  const drawMeta = (x: number, y: number, label: string, value: string) => {
    setText(doc, "#9CA3AF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    setText(doc, "#0B0B0B");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value, colW) as string[];
    doc.text(lines[0], x, y + 12);
  };

  const responsible =
    ctx.cfg.responsibleName ||
    (ctx.company?.trade_name || ctx.company?.corporate_name) ||
    companyName(ctx.company) ||
    NA;

  drawMeta(cardX + 24, metaY, "Nº do orçamento", ctx.quote.quote_number || NA);
  drawMeta(cardX + 24 + colW + 24, metaY, "Responsável", responsible);
  drawMeta(cardX + 24, metaY + 42, "Data de emissão", ctx.quote.issue_date ? fmtDate(ctx.quote.issue_date) : NA);
  drawMeta(cardX + 24 + colW + 24, metaY + 42, "Validade", ctx.quote.valid_until ? fmtDate(ctx.quote.valid_until) : NA);

  // ------- Footer contact strip -------
  const footerY = A4.h - 60;
  setText(doc, COVER_GREEN_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CONTATO", A4.w / 2, footerY, { align: "center" });

  const contactBits: string[] = [];
  const site = (ctx.company as any)?.website || (ctx.company as any)?.site;
  if (site) contactBits.push(String(site));
  const tel = ctx.company?.whatsapp || ctx.company?.phone;
  if (tel) contactBits.push(String(tel));
  if (ctx.company?.email) contactBits.push(String(ctx.company.email));
  const contactLine = contactBits.length ? contactBits.join("  •  ") : "";

  if (contactLine) {
    setText(doc, "#E5E7EB");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(contactLine, A4.w / 2, footerY + 14, { align: "center", maxWidth: A4.w - 100 });
  }
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

function renderCftvImportancePage(doc: jsPDF, ctx: { quote: PdfQuote; items: PdfItem[] }) {
  const content = getSolutionContent(ctx.quote, ctx.items);
  let y = newPage(doc);
  y = drawEyebrow(doc, "Importância da Solução", y);
  y = drawSectionTitle(doc, content.importanceTitle, y);

  y = drawParagraph(doc, content.importanceIntro, y);
  y += 14;

  const cards = content.importanceCards;
  const cw = (A4.w - MARGIN * 2 - 16) / 3;
  const ch = 88;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawCard(doc, {
      x: MARGIN + col * (cw + 8),
      y: y + row * (ch + 12),
      w: cw,
      h: ch,
      title: c.t,
      body: c.b,
    });
  });
  y += (ch + 12) * Math.ceil(cards.length / 3);

  y += 8;
  drawParagraph(
    doc,
    "O investimento em uma solução bem projetada é uma decisão preventiva. Esperar o problema acontecer costuma sair mais caro do que estruturar a solução correta desde o início.",
    y,
    { color: PALETTE.black, size: 10.5 },
  );
}

function renderDiagnosisPage(doc: jsPDF, ctx: { quote: PdfQuote }) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Análise", y);
  y = drawSectionTitle(doc, "Diagnóstico da necessidade", y);

  const q = ctx.quote;
  const structured: { label: string; value?: string | null }[] = [
    { label: "Problema identificado", value: q.diagnosis_problem },
    { label: "Necessidade do cliente", value: q.diagnosis_need },
    { label: "Ambiente atendido", value: q.diagnosis_environment },
    { label: "Objetivo da solução", value: q.diagnosis_objective },
    { label: "Pontos críticos observados", value: q.diagnosis_critical_points },
    { label: "Observações técnicas", value: q.diagnosis_technical_notes },
  ].filter((r) => r.value && String(r.value).trim().length > 0);

  if (structured.length > 0) {
    structured.forEach((r) => {
      y = ensureSpace(doc, y, 60);
      setText(doc, PALETTE.gold);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(r.label.toUpperCase(), MARGIN, y);
      y += 14;
      y = drawParagraph(doc, String(r.value), y, { color: PALETTE.black });
      y += 6;
    });
    return;
  }

  const text =
    q.customer_notes?.trim() ||
    "Durante a análise da necessidade, foram considerados os pontos críticos do ambiente, a rotina de uso, a exposição a riscos, a necessidade de monitoramento, o controle de acesso e a viabilidade técnica da instalação. A solução proposta busca atender ao cenário atual e permitir futuras ampliações de forma organizada.";
  drawParagraph(doc, text, y);
}


function renderSolutionSummaryPage(doc: jsPDF, ctx: { quote: PdfQuote; items: PdfItem[] }) {
  const content = getSolutionContent(ctx.quote, ctx.items);
  let y = newPage(doc);
  y = drawEyebrow(doc, "Solução Proposta", y);
  y = drawSectionTitle(doc, content.solutionTitle, y);

  const totalItems = ctx.items.filter((i) => i.kind !== "LABOR")
    .reduce((s, i) => s + i.quantity, 0);

  y = drawParagraph(doc, content.solutionIntro, y);
  y += 12;

  // Quick facts
  setFill(doc, PALETTE.graphite);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 60, 6, 6, "F");
  const fW = (A4.w - MARGIN * 2) / 2;
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ESCOPO PRINCIPAL", MARGIN + 16, y + 20);
  doc.text("ITENS PREVISTOS", MARGIN + 16 + fW, y + 20);
  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(ctx.quote.title || content.subtitle, MARGIN + 16, y + 42, { maxWidth: fW - 24 });
  doc.text(
    `${ctx.items.filter((i) => i.kind !== "LABOR").length} produtos · ${String(totalItems).replace(".", ",")} unidades`,
    MARGIN + 16 + fW,
    y + 42,
  );
  y += 78;

  // Dynamic benefits per solution type
  const benefits = content.solutionBenefits;
  const cw = (A4.w - MARGIN * 2 - 16) / 3;
  const ch = 78;
  benefits.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawCard(doc, {
      x: MARGIN + col * (cw + 8),
      y: y + row * (ch + 12),
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

async function renderMaterialsTablePage(
  doc: jsPDF,
  ctx: { items: PdfItem[]; thumbnails: Map<string, string> },
) {
  let y = newPage(doc);
  y = drawEyebrow(doc, "Materiais", y);
  y = drawSectionTitle(doc, "Materiais e itens do projeto", y);

  const visible = ctx.items.filter((it) => it.kind !== "LABOR");

  if (visible.length === 0) {
    setFill(doc, PALETTE.grayLight);
    doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 70, 6, 6, "F");
    setText(doc, PALETTE.grayDark);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text(
      "Nenhum material cadastrado neste orçamento.",
      A4.w / 2,
      y + 40,
      { align: "center" },
    );
    return;
  }

  const ROW_H = 44;
  autoTable(doc, {
    startY: y,
    head: [["#", "Foto", "Código", "Item / Descrição", "Qtd", "Un"]],
    body: visible.map((it, i) => [
      String(i + 1),
      "",
      (it.sku ?? "").toString() || "—",
      it.description ? `${it.name}\n${it.description}` : it.name,
      String(Number(it.quantity)).replace(".", ","),
      it.unit || "UN",
    ]),
    styles: { fontSize: 10, cellPadding: 6, valign: "middle", textColor: [30, 30, 30], minCellHeight: ROW_H },
    headStyles: {
      fillColor: [11, 11, 11],
      textColor: [201, 162, 75],
      fontStyle: "bold",
      halign: "left",
      minCellHeight: 24,
    },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: {
      0: { cellWidth: 24, halign: "center", textColor: [120, 120, 120] },
      1: { cellWidth: 46, halign: "center" },
      2: { cellWidth: 64, halign: "left", textColor: [90, 90, 90], fontStyle: "bold" },
      4: { cellWidth: 40, halign: "center" },
      5: { cellWidth: 34, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 60 },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const it = visible[data.row.index];
      if (!it) return;
      const url = it.image_url ?? null;
      const dataUrl = url ? ctx.thumbnails.get(url) ?? null : null;
      const cell = data.cell;
      const size = Math.min(cell.width, cell.height) - 6;
      const cx = cell.x + (cell.width - size) / 2;
      const cy = cell.y + (cell.height - size) / 2;
      if (dataUrl) {
        try {
          const fmt = detectImageFormat(dataUrl);
          doc.addImage(dataUrl, fmt, cx, cy, size, size, undefined, "FAST");
        } catch {
          /* ignore */
        }
      } else {
        setFill(doc, PALETTE.grayLight);
        doc.roundedRect(cx, cy, size, size, 3, 3, "F");
        setText(doc, PALETTE.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text("sem foto", cx + size / 2, cy + size / 2 + 2, { align: "center" });
      }
    },
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
  ctx: { item: PdfItem; imageDataUrl: string | null; index: number; total: number; category: HighlightCategory },
) {
  let y = newPage(doc);
  y = drawEyebrow(doc, `Produto estratégico da solução · ${ctx.index + 1}/${ctx.total}`, y);
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
    "Este equipamento foi selecionado por ser uma peça importante para o funcionamento da solução proposta. Ele contribui para maior segurança, estabilidade e confiabilidade do sistema, reduzindo riscos de falhas e facilitando a operação no dia a dia.";
  const rLines = doc.splitTextToSize(reason, tw) as string[];
  let cy = y + 32;
  rLines.forEach((ln) => { doc.text(ln, tx, cy); cy += 13; });

  cy += 6;
  setText(doc, PALETTE.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("O QUE ESTE PRODUTO RESOLVE", tx, cy);
  cy += 12;
  setText(doc, PALETTE.grayDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const resolves = RESOLVES_COPY[ctx.category] ?? RESOLVES_COPY.other;
  const resLines = doc.splitTextToSize(resolves, tw) as string[];
  resLines.forEach((ln) => { doc.text(ln, tx, cy); cy += 12; });

  if (ctx.item.description) {
    cy += 6;
    setText(doc, PALETTE.gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DESCRIÇÃO CADASTRADA", tx, cy);
    cy += 12;
    setText(doc, PALETTE.grayDark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const dLines = doc.splitTextToSize(ctx.item.description, tw) as string[];
    dLines.slice(0, 6).forEach((ln) => { doc.text(ln, tx, cy); cy += 12; });
  }

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
    const valueText = String(r.value);
    if (r.label === "WhatsApp") {
      const digits = valueText.replace(/\D/g, "");
      if (digits) {
        const intlDigits = digits.startsWith("55") ? digits : `55${digits}`;
        const waUrl = `https://wa.me/${intlDigits}`;
        setText(doc, PALETTE.gold);
        doc.textWithLink(valueText, MARGIN + 140, y, { url: waUrl });
        setText(doc, PALETTE.gray);
        doc.setFontSize(8);
        doc.text(waUrl, MARGIN + 140, y + 12);
      } else {
        doc.text(valueText, MARGIN + 140, y);
      }
    } else if (r.label === "E-mail") {
      setText(doc, PALETTE.gold);
      doc.textWithLink(valueText, MARGIN + 140, y, { url: `mailto:${valueText}` });
    } else {
      doc.text(valueText, MARGIN + 140, y);
    }
    setStroke(doc, PALETTE.grayLight);
    doc.line(MARGIN, y + 18, A4.w - MARGIN, y + 18);
    y += r.label === "WhatsApp" && String(r.value).replace(/\D/g, "") ? 36 : 28;
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

  // Compact mode is the new default: enxuto, mais vendedor.
  const compact = cfg.compactPremiumPdf;
  const effective = {
    showCompanyIntro: !compact,
    showAbout: true,
    showCftPage: cfg.showCftPage && !compact,
    showCftvImportance: cfg.showCftvImportance && !compact,
    showDiagnosis: cfg.showDiagnosis,
    showSolutionSummary: cfg.showSolutionSummary,
    showScope: cfg.showScope && !compact,
    showProductHighlights: cfg.showProductHighlights,
    showMaterialsTable: cfg.showMaterialsTable,
    showExecutionProcess: cfg.showExecutionProcess && !compact,
    showWarrantySupport: cfg.showWarrantySupport && !compact,
    showCommercialConditions: cfg.showCommercialConditions,
    showImportantNotes: cfg.showImportantNotes && !compact,
    showAcceptancePage: cfg.showAcceptancePage,
  };
  const maxHighlights = Math.min(compact ? 3 : cfg.maxProductHighlights, 3);

  // Preload images in parallel
  const logoPromise = loadLogoForDarkBg(opts.company?.logo_url ?? null);

  // Strategic selection — only equipamentos principais get a página própria.
  const solutionKey = detectSolutionKey(opts.quote, opts.items);
  const strategicItems = effective.showProductHighlights
    ? selectStrategicQuoteItems(opts.items, solutionKey, maxHighlights)
    : [];
  const strategicCategories = strategicItems.map((it) => categorizeItem(it));
  const productImagesPromise = Promise.all(
    strategicItems.map((it) => loadImageAsDataUrl(it.image_url)),
  );

  // Preload all material thumbnails (deduped by URL) for the materials table
  const thumbUrls = Array.from(
    new Set(
      opts.items
        .filter((it) => it.kind !== "LABOR" && it.image_url)
        .map((it) => it.image_url as string),
    ),
  );
  const thumbnailsPromise = Promise.all(thumbUrls.map((u) => loadImageAsDataUrl(u))).then(
    (results) => {
      const map = new Map<string, string>();
      thumbUrls.forEach((u, i) => {
        const r = results[i];
        if (r) map.set(u, r);
      });
      return map;
    },
  );

  const [logoDataUrl, productImages, thumbnails] = await Promise.all([
    logoPromise,
    productImagesPromise,
    thumbnailsPromise,
  ]);

  // Render pages
  await renderCoverPage(doc, {
    quote: opts.quote,
    items: opts.items,
    company: opts.company,
    customer: opts.customer,
    cfg,
    logoDataUrl,
  });
  if (effective.showCompanyIntro) renderCompanyIntroPage(doc, { company: opts.company });
  if (effective.showAbout) renderAboutPage(doc, { company: opts.company, cfg });
  if (effective.showCftPage) renderTechnicalAuthorityPage(doc, { settings: opts.settings, company: opts.company });
  if (effective.showCftvImportance) renderCftvImportancePage(doc, { quote: opts.quote, items: opts.items });
  if (effective.showDiagnosis) renderDiagnosisPage(doc, { quote: opts.quote });
  if (effective.showSolutionSummary) renderSolutionSummaryPage(doc, { quote: opts.quote, items: opts.items });
  if (effective.showScope) renderScopePage(doc);
  if (effective.showMaterialsTable) await renderMaterialsTablePage(doc, { items: opts.items, thumbnails });
  if (effective.showProductHighlights) {
    for (let i = 0; i < strategicItems.length; i++) {
      await renderProductHighlight(doc, {
        item: strategicItems[i],
        imageDataUrl: productImages[i] ?? null,
        index: i,
        total: strategicItems.length,
        category: strategicCategories[i],
      });
    }
  }
  if (effective.showExecutionProcess) renderExecutionProcessPage(doc);
  if (effective.showWarrantySupport) renderWarrantySupportPage(doc);
  if (effective.showCommercialConditions) renderCommercialConditionsPage(doc, { quote: opts.quote });
  if (effective.showImportantNotes) renderImportantNotesPage(doc, { quote: opts.quote });
  if (effective.showAcceptancePage) {
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
  // Re-paint cover bottom area (footer overwrote it) — keep the new green cover intact
  doc.setPage(1);
  setFill(doc, COVER_GRAPHITE);
  doc.rect(0, A4.h - 90, A4.w, 90, "F");
  setFill(doc, COVER_GREEN);
  doc.rect(0, A4.h - 3, A4.w, 3, "F");
  // Re-draw contact strip
  const _company = opts.company;
  setText(doc, COVER_GREEN_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CONTATO", A4.w / 2, A4.h - 60, { align: "center" });
  const _contactBits: string[] = [];
  const _site = (_company as any)?.website || (_company as any)?.site;
  if (_site) _contactBits.push(String(_site));
  const _tel = _company?.whatsapp || _company?.phone;
  if (_tel) _contactBits.push(String(_tel));
  if (_company?.email) _contactBits.push(String(_company.email));
  const _line = _contactBits.join("  •  ");
  if (_line) {
    setText(doc, "#E5E7EB");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(_line, A4.w / 2, A4.h - 46, { align: "center", maxWidth: A4.w - 100 });
  }

  if (opts.output === "blob") return doc.output("blob");
  doc.save(`Proposta-${opts.quote.quote_number}.pdf`);
}

