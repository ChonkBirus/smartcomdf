import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  A4,
  MARGIN,
  fmtBRL,
  fmtDate,
  loadImageAsDataUrl,
  loadLogoForDarkBg,
  detectImageFormat,
} from "./quote-pdf-helpers";

// ============================================================
// TYPES
// ============================================================
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
  zipcode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
} | null;

type PdfSettings = Record<string, any> | null;

type PdfItem = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  sku: string | null;
  image_url: string | null;
  position: number;
};

export type PremiumPdfConfig = {
  showAboutPage?: boolean;
  showObservationsPage?: boolean;
  maxProductHighlights?: number;
  kpis?: { projects?: string; cities?: string; clients?: string };
  aboutText?: string | null;
  website?: string | null;
  responsibleName?: string | null;
  responsiblePhone?: string | null;
  // legacy fields kept for backwards compat (ignored)
  compactPremiumPdf?: boolean;
  showCftPage?: boolean;
  showCftvImportance?: boolean;
  showDiagnosis?: boolean;
  showSolutionSummary?: boolean;
  showScope?: boolean;
  showProductHighlights?: boolean;
  showMaterialsTable?: boolean;
  showExecutionProcess?: boolean;
  showWarrantySupport?: boolean;
  showCommercialConditions?: boolean;
  showImportantNotes?: boolean;
  showAcceptancePage?: boolean;
  showWhatsappQr?: boolean;
  showAcceptanceQr?: boolean;
};

// ============================================================
// PALETTE — institutional (black / white / gray + subtle accents)
// ============================================================
const C = {
  black: "#0B0B0B",
  ink: "#1A1A1A",
  gray: "#6B7280",
  grayLight: "#D1D5DB",
  grayBg: "#F3F4F6",
  white: "#FFFFFF",
  accent: "#0F7A4E", // Smart green
  tableBlue: "#DCE7F5",
  tableGray: "#F1F1F1",
  tableHead: "#0B0B0B",
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function setFill(doc: jsPDF, hex: string) { const [r, g, b] = hexToRgb(hex); doc.setFillColor(r, g, b); }
function setStroke(doc: jsPDF, hex: string) { const [r, g, b] = hexToRgb(hex); doc.setDrawColor(r, g, b); }
function setText(doc: jsPDF, hex: string) { const [r, g, b] = hexToRgb(hex); doc.setTextColor(r, g, b); }

// ============================================================
// SOLUTION DETECTION — used for product-highlight copy only.
// (Structure of the PDF is the SAME for every solution type;
// only the copy on the highlight pages changes.)
// ============================================================
type SolutionKey =
  | "cftv" | "alarm" | "intercom" | "access" | "network"
  | "automation" | "solar" | "ev" | "audio" | "motor"
  | "lighting" | "it_maintenance" | "generic";

type Category =
  | "camera" | "dvr" | "switch" | "alarm_central" | "sensor" | "siren"
  | "intercom" | "lock" | "access_reader" | "controller" | "router" | "ap"
  | "motor" | "inverter" | "solar_panel" | "ev_charger" | "amp" | "speaker"
  | "led_panel" | "radio" | "luminaire" | "computer" | "labor" | "other";

const NEGATIVE_RE =
  /(cabo|canaleta|conector|parafuso|caixa\s*de\s*passag|disjuntor|protetor|suporte|abraçad|abracad|braçad|bracad|eletrod|terminal|presilha|fita|bucha|chumb|silicone|adaptador\s*simples|pente\s*de\s*mem[óo]ria|pasta\s*t[ée]rmica)/i;

function categorize(it: PdfItem): Category {
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
  if (/(access\s*point|\bap\b|repet|mesh)/.test(s)) return "ap";
  if (/(motor|automatizador|m[áa]quina\s*de\s*port|portão|porta\s*social|elevador)/.test(s)) return "motor";
  if (/(inversor)/.test(s)) return "inverter";
  if (/(m[óo]dulo\s*solar|placa\s*solar|painel\s*solar|fotovolt)/.test(s)) return "solar_panel";
  if (/(carregador|wallbox|veicular)/.test(s)) return "ev_charger";
  if (/(amplificad|matriz\s*de\s*som)/.test(s)) return "amp";
  if (/(caixa\s*ac[úu]st|alto[- ]?falante|speaker)/.test(s)) return "speaker";
  if (/(painel\s*de\s*led|tela\s*led)/.test(s)) return "led_panel";
  if (/(r[áa]dio|enlace|antena)/.test(s)) return "radio";
  if (/(lumin[áa]ria|l[âa]mpada|plafon|spot|refletor|arandela|pendente)/.test(s)) return "luminaire";
  if (/(computador|cpu\b|notebook|monitor|processador|mem[óo]ria|ssd|hd\b|placa[- ]?m[ãa]e|servidor|micro\b)/.test(s)) return "computer";
  if (/(m[ãa]o\s*de\s*obra|manutenç|instalaç|serviço)/.test(s)) return "labor";
  return "other";
}

function detectSolution(quote: PdfQuote, items: PdfItem[]): SolutionKey {
  const hay = [quote.title ?? "", ...items.map((i) => `${i.name} ${i.description ?? ""}`)].join(" ").toLowerCase();
  const t = (re: RegExp) => re.test(hay);
  if (t(/(interfon|porteiro\s*eletr|video[- ]?porteir)/)) return "intercom";
  if (t(/(controle\s*de\s*acesso|catraca|biometr|leitor\s*(rfid|nfc|tag)|fechadura\s*(eletr|digital))/)) return "access";
  if (t(/(alarme|sensor\s*(de\s*)?(presen|movim|abert)|central\s*de\s*alarme|sirene)/)) return "alarm";
  if (t(/(carregador|wallbox|veic|ev\b|recarga)/)) return "ev";
  if (t(/(solar|fotovolt|inversor|placa\s*solar)/)) return "solar";
  if (t(/(automa(c|ç)ão|domot|cena|smart\s*home)/)) return "automation";
  if (t(/(motor|automatizador|portão|porta\s*social|elevador)/)) return "motor";
  if (t(/(lumin[áa]ria|l[âa]mpada|ilumin|plafon|spot|refletor)/)) return "lighting";
  if (t(/(manutenç|computador|cpu\b|notebook|inform[áa]tic|servidor|upgrade)/)) return "it_maintenance";
  if (t(/(rede|switch|roteador|wifi|wi[- ]fi|cabea(mento)?\s*estrutur|patch\s*panel|rack|fibra)/)) return "network";
  if (t(/(som\s*ambient|caixa\s*acust|amplificad|painel\s*de\s*led|mídia|midia)/)) return "audio";
  if (t(/(cftv|c(â|a)mer|dvr|nvr|vigil|monitor)/)) return "cftv";
  return "generic";
}

const SOLUTION_SUBTITLE: Record<SolutionKey, string> = {
  cftv: "Solução em CFTV e Segurança Eletrônica",
  alarm: "Solução em Alarme e Detecção de Intrusão",
  intercom: "Solução em Interfonia e Comunicação",
  access: "Solução em Controle de Acesso",
  network: "Solução em Redes e Infraestrutura",
  automation: "Solução em Automação",
  solar: "Solução em Energia Solar",
  ev: "Solução em Recarga Veicular Elétrica",
  audio: "Solução em Som Ambiente e Comunicação Visual",
  motor: "Automação de Portas e Portões",
  lighting: "Solução em Iluminação",
  it_maintenance: "Serviços de Informática e Manutenção",
  generic: "Solução Técnica Personalizada",
};

// Category → benefits list (short, safe, commercial)
const CAT_BENEFITS: Record<Category, string[]> = {
  camera: ["Cobertura visual dos pontos críticos", "Melhor identificação de movimentações", "Integração com gravação e acesso remoto"],
  dvr: ["Gravação centralizada das imagens", "Consulta posterior de eventos", "Compatível com câmeras do projeto"],
  switch: ["Alimentação dos dispositivos pela rede", "Menos pontos de energia", "Infraestrutura mais organizada"],
  alarm_central: ["Processamento confiável dos sensores", "Notificações em caso de disparo", "Operação por partições e usuários"],
  sensor: ["Detecção adequada ao ambiente", "Redução de falso alarme", "Cobertura de pontos críticos"],
  siren: ["Sinalização audível eficaz", "Reforço do efeito dissuasivo", "Resposta clara em caso de evento"],
  intercom: ["Comunicação clara entre pontos", "Controle da entrada de visitantes", "Praticidade e segurança no dia a dia"],
  lock: ["Acionamento eletrônico seguro", "Integração com controle de acesso", "Redução do uso de chaves físicas"],
  access_reader: ["Identificação confiável do usuário", "Registro automatizado de acessos", "Redução de acessos indevidos"],
  controller: ["Integração dos dispositivos do sistema", "Operação centralizada", "Base estável para o restante da solução"],
  router: ["Conectividade estável", "Distribuição adequada da rede", "Base para os demais sistemas"],
  ap: ["Cobertura Wi-Fi nas áreas certas", "Redução de zonas mortas", "Melhor experiência de uso"],
  motor: ["Automação da abertura", "Praticidade e conforto", "Mais controle e segurança no acesso"],
  inverter: ["Conversão eficiente da energia gerada", "Compatibilidade com os módulos do projeto", "Monitoramento da geração"],
  solar_panel: ["Geração de energia limpa", "Redução da conta de energia", "Vida útil longa"],
  ev_charger: ["Recarga segura em casa", "Compatível com o veículo informado", "Instalação elétrica adequada"],
  amp: ["Potência compatível com o ambiente", "Distribuição sonora equilibrada", "Base do sistema de áudio"],
  speaker: ["Cobertura sonora equilibrada", "Instalação discreta", "Boa experiência de uso"],
  led_panel: ["Comunicação visual com destaque", "Conteúdos dirigidos", "Fortalece a apresentação do ambiente"],
  radio: ["Enlace estável entre pontos", "Comunicação sem depender de cabos", "Boa cobertura de distância"],
  luminaire: ["Iluminação eficiente e confortável", "Acabamento adequado ao ambiente", "Melhor experiência visual"],
  computer: ["Desempenho e estabilidade", "Substituição de componentes", "Preparado para uso contínuo"],
  labor: ["Execução por equipe técnica qualificada", "Boas práticas de instalação", "Testes e entrega assistida"],
  other: ["Contribui para o funcionamento da solução", "Desempenho adequado ao projeto", "Confiabilidade no uso"],
};

const CAT_DESCRIPTION: Record<Category, string> = {
  camera: "Câmera destinada à cobertura visual dos pontos críticos do ambiente, com qualidade de imagem adequada ao uso pretendido.",
  dvr: "Gravador digital responsável por centralizar as imagens do sistema, permitindo consulta e organização do monitoramento.",
  switch: "Switch de rede que interliga os dispositivos e, quando compatível, fornece alimentação pela própria rede.",
  alarm_central: "Central de alarme responsável por processar os sensores, disparar avisos e organizar a operação do sistema.",
  sensor: "Sensor destinado a detectar movimento, abertura ou impacto em pontos definidos do ambiente.",
  siren: "Sirene destinada a sinalizar eventos de forma audível, reforçando o efeito dissuasivo do sistema.",
  intercom: "Módulo de interfonia que interliga a portaria ao ambiente interno, permitindo comunicação e controle da entrada.",
  lock: "Fechadura/atuador eletrônico para liberação controlada do acesso.",
  access_reader: "Leitor de acesso que identifica o usuário autorizado e libera a entrada com rastreabilidade.",
  controller: "Módulo controlador responsável por integrar dispositivos e centralizar a operação da solução.",
  router: "Roteador responsável por organizar o tráfego da rede local e a saída para a internet.",
  ap: "Access Point (ponto de acesso Wi-Fi) responsável pela cobertura sem fio do ambiente.",
  motor: "Motor/automatizador para portão ou porta, dimensionado para o porte e a rotina de uso previstos.",
  inverter: "Inversor solar responsável por converter a energia dos módulos para uso no imóvel.",
  solar_panel: "Módulo fotovoltaico responsável pela geração de energia elétrica a partir da luz solar.",
  ev_charger: "Carregador para veículos elétricos, dimensionado conforme veículo e instalação elétrica do imóvel.",
  amp: "Amplificador de áudio responsável por distribuir o sinal para as caixas do ambiente.",
  speaker: "Caixa acústica destinada à cobertura sonora do ambiente de instalação.",
  led_panel: "Painel de LED para comunicação visual e exibição de conteúdo com boa legibilidade.",
  radio: "Rádio/enlace destinado à comunicação entre pontos distantes.",
  luminaire: "Luminária destinada a compor o projeto de iluminação com eficiência e acabamento adequados.",
  computer: "Item de informática destinado à composição/manutenção do equipamento do cliente.",
  labor: "Serviço técnico executado por equipe qualificada, seguindo boas práticas de instalação.",
  other: "Item que compõe a solução proposta, com desempenho e confiabilidade adequados ao projeto.",
};

// ============================================================
// HELPERS: layout, text, footer
// ============================================================
function companyName(c: PdfCompany): string {
  return c?.trade_name || c?.corporate_name || "SmartCom";
}
function customerName(c: PdfCustomer): string {
  return c?.trade_name || c?.name || c?.corporate_name || "Cliente";
}
function customerDoc(c: PdfCustomer): string | null {
  return c?.cpf_cnpj ? String(c.cpf_cnpj) : null;
}
function companyAddress(c: PdfCompany): string | null {
  if (!c) return null;
  const parts = [
    [c.street, c.number].filter(Boolean).join(", "),
    c.complement,
    c.district,
    [c.city, c.state].filter(Boolean).join(" - "),
    c.zipcode,
  ].filter(Boolean) as string[];
  const s = parts.filter((p) => p && p.trim()).join(" · ");
  return s || null;
}

function newPage(doc: jsPDF): number {
  doc.addPage();
  return MARGIN + 24;
}

const FOOTER_H = 26;
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > A4.h - FOOTER_H - 20) return newPage(doc);
  return y;
}

function drawParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  opts?: { size?: number; color?: string; lineHeight?: number; maxWidth?: number; x?: number; bold?: boolean },
): number {
  const size = opts?.size ?? 10.5;
  const color = opts?.color ?? C.ink;
  const lh = opts?.lineHeight ?? 1.5;
  const maxW = opts?.maxWidth ?? A4.w - MARGIN * 2;
  const x = opts?.x ?? MARGIN;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(size);
  setText(doc, color);
  const lines = doc.splitTextToSize(text, maxW) as string[];
  lines.forEach((ln, i) => doc.text(ln, x, y + i * size * lh));
  return y + lines.length * size * lh + 4;
}

// Section header with a small black bar + label, mimicking reference PDFs
function drawSectionHeader(doc: jsPDF, label: string, y: number): number {
  setFill(doc, C.black);
  doc.rect(MARGIN, y, A4.w - MARGIN * 2, 30, "F");
  setText(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(label.toUpperCase(), MARGIN + 14, y + 20);
  return y + 30 + 18;
}

function drawFooter(doc: jsPDF, pageNum: number, total: number, ctx: { company: PdfCompany; logo: string | null }) {
  const y = A4.h - FOOTER_H;
  setFill(doc, C.black);
  doc.rect(0, y, A4.w, FOOTER_H, "F");
  // Left: company name
  setText(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(companyName(ctx.company).toUpperCase(), MARGIN, y + 16);
  // Right: page num
  doc.setFont("helvetica", "normal");
  doc.text(`${pageNum} / ${total}`, A4.w - MARGIN, y + 16, { align: "right" });
}

function applyFooters(doc: jsPDF, ctx: { company: PdfCompany; logo: string | null }, skipFirst = true) {
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    if (skipFirst && i === 1) continue;
    doc.setPage(i);
    drawFooter(doc, i, total, ctx);
  }
}

// ============================================================
// PAGE 1 — COVER (dark, institutional)
// ============================================================
function renderCoverPage(
  doc: jsPDF,
  ctx: { quote: PdfQuote; items: PdfItem[]; company: PdfCompany; customer: PdfCustomer; logoDataUrl: string | null; solution: SolutionKey },
) {
  setFill(doc, C.black);
  doc.rect(0, 0, A4.w, A4.h, "F");

  // Thin accent line
  setFill(doc, C.accent);
  doc.rect(0, 0, A4.w, 3, "F");
  doc.rect(0, A4.h - 3, A4.w, 3, "F");

  // Logo centered ~ top third
  if (ctx.logoDataUrl) {
    try {
      const lw = 180;
      const lh = 90;
      doc.addImage(ctx.logoDataUrl, "PNG", A4.w / 2 - lw / 2, 150, lw, lh, undefined, "FAST");
    } catch { /* ignore */ }
  } else {
    setText(doc, C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text(companyName(ctx.company).toUpperCase(), A4.w / 2, 210, { align: "center" });
  }

  // Company segment
  setText(doc, C.grayLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(SOLUTION_SUBTITLE[ctx.solution] ?? SOLUTION_SUBTITLE.generic, A4.w / 2, 270, { align: "center" });

  // Big title
  setText(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("PROPOSTA", A4.w / 2, 420, { align: "center" });
  doc.text("COMERCIAL", A4.w / 2, 460, { align: "center" });

  // Accent divider
  setFill(doc, C.accent);
  doc.rect(A4.w / 2 - 40, 478, 80, 2, "F");

  // Customer name
  setText(doc, C.grayLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  const cn = doc.splitTextToSize(customerName(ctx.customer), A4.w - 120) as string[];
  let cy = 520;
  cn.slice(0, 2).forEach((ln) => { doc.text(ln, A4.w / 2, cy, { align: "center" }); cy += 20; });

  if (ctx.quote.title) {
    setText(doc, C.gray);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const tl = doc.splitTextToSize(ctx.quote.title, A4.w - 160) as string[];
    tl.slice(0, 2).forEach((ln) => { doc.text(ln, A4.w / 2, cy + 6, { align: "center" }); cy += 16; });
  }

  // Bottom company address
  const addr = companyAddress(ctx.company);
  setText(doc, C.grayLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let by = A4.h - 80;
  if (addr) { doc.text(addr, A4.w / 2, by, { align: "center", maxWidth: A4.w - 80 }); by += 14; }
  const contact = [ctx.company?.phone, ctx.company?.whatsapp].filter(Boolean).join(" · ");
  if (contact) { doc.text(contact, A4.w / 2, by, { align: "center" }); by += 12; }
  if (ctx.company?.email) { doc.text(ctx.company.email, A4.w / 2, by, { align: "center" }); }
}

// ============================================================
// PAGE 2 — PROPOSAL HEADER (title + contact + quote meta + customer)
// ============================================================
function renderProposalHeaderPage(
  doc: jsPDF,
  ctx: { quote: PdfQuote; company: PdfCompany; customer: PdfCustomer; cfg: Required<Pick<PremiumPdfConfig, "website">> },
) {
  let y = newPage(doc);

  // Big title
  setText(doc, C.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("PROPOSTA COMERCIAL", MARGIN, y + 20);
  y += 40;

  setFill(doc, C.accent);
  doc.rect(MARGIN, y, 60, 3, "F");
  y += 26;

  // Empresa / contato
  setText(doc, C.gray);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("EMPRESA CONTRATADA", MARGIN, y);
  y += 14;
  setText(doc, C.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(companyName(ctx.company), MARGIN, y);
  y += 16;

  const rows: string[] = [];
  const addr = companyAddress(ctx.company);
  if (addr) rows.push(addr);
  if (ctx.company?.cnpj) rows.push(`CNPJ: ${ctx.company.cnpj}`);
  const contact = [
    ctx.company?.phone ? `Tel: ${ctx.company.phone}` : null,
    ctx.company?.whatsapp ? `WhatsApp: ${ctx.company.whatsapp}` : null,
  ].filter(Boolean).join(" · ");
  if (contact) rows.push(contact);
  if (ctx.company?.email) rows.push(`E-mail: ${ctx.company.email}`);
  if (ctx.cfg.website) rows.push(`Site: ${ctx.cfg.website}`);

  setText(doc, C.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rows.forEach((r) => {
    const lines = doc.splitTextToSize(r, A4.w - MARGIN * 2) as string[];
    lines.forEach((ln) => { doc.text(ln, MARGIN, y); y += 14; });
  });

  y += 12;
  setStroke(doc, C.grayLight);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, A4.w - MARGIN, y);
  y += 22;

  // Cliente
  setText(doc, C.gray);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CLIENTE", MARGIN, y);
  y += 14;
  setText(doc, C.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(customerName(ctx.customer), MARGIN, y);
  y += 16;

  const cRows: string[] = [];
  if (customerDoc(ctx.customer)) cRows.push(`CPF/CNPJ: ${customerDoc(ctx.customer)}`);
  const cContact = [
    ctx.customer?.phone ? `Tel: ${ctx.customer.phone}` : null,
    ctx.customer?.whatsapp ? `WhatsApp: ${ctx.customer.whatsapp}` : null,
  ].filter(Boolean).join(" · ");
  if (cContact) cRows.push(cContact);
  if (ctx.customer?.email) cRows.push(`E-mail: ${ctx.customer.email}`);
  setText(doc, C.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  cRows.forEach((r) => { doc.text(r, MARGIN, y); y += 14; });

  y += 12;
  setStroke(doc, C.grayLight);
  doc.line(MARGIN, y, A4.w - MARGIN, y);
  y += 22;

  // Meta grid: nº proposta, emissão, validade, título
  const colW = (A4.w - MARGIN * 2 - 20) / 2;
  const meta: { label: string; value: string }[] = [
    { label: "Nº DA PROPOSTA", value: ctx.quote.quote_number },
    { label: "DATA DE EMISSÃO", value: fmtDate(ctx.quote.issue_date) },
    { label: "VALIDADE", value: fmtDate(ctx.quote.valid_until) },
  ];
  if (ctx.quote.title) meta.push({ label: "REFERÊNCIA", value: ctx.quote.title });

  meta.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const mx = MARGIN + col * (colW + 20);
    const my = y + row * 46;
    setText(doc, C.gray);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(m.label, mx, my);
    setText(doc, C.black);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(m.value, colW) as string[];
    lines.slice(0, 2).forEach((ln, li) => doc.text(ln, mx, my + 14 + li * 13));
  });
}

// ============================================================
// PAGE 3 — SOBRE A EMPRESA
// ============================================================
function renderAboutCompanyPage(
  doc: jsPDF,
  ctx: { company: PdfCompany; cfg: { aboutText: string | null; kpis: { projects: string; cities: string; clients: string } } },
) {
  let y = newPage(doc);
  y = drawSectionHeader(doc, "Sobre a Empresa", y);

  const intro =
    "Antes de apresentar a proposta, listamos alguns pontos importantes a serem observados na contratação de soluções técnicas e de infraestrutura.";
  y = drawParagraph(doc, intro, y, { color: C.ink, size: 10.5 });
  y += 8;

  const bullets: { t: string; b: string }[] = [
    { t: "Definição dos equipamentos a partir de levantamento técnico", b: "Cada projeto é dimensionado conforme necessidade e características do ambiente." },
    { t: "Documentação técnica do projeto", b: "Registro do que foi instalado para consulta futura e manutenção por outras equipes." },
    { t: "Suporte técnico e garantia", b: "Cobertura de equipamentos e serviços conforme condições comerciais desta proposta." },
    { t: "Experiência no Distrito Federal e Entorno", b: "Atendimento a residências, empresas e condomínios com equipe própria." },
    { t: "Atendimento completo", b: "Desde a elaboração do projeto até manutenções preventivas e corretivas." },
  ];

  bullets.forEach((b) => {
    y = ensureSpace(doc, y, 42);
    setFill(doc, C.accent);
    doc.circle(MARGIN + 3, y - 3, 2.4, "F");
    setText(doc, C.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const tLines = doc.splitTextToSize(b.t, A4.w - MARGIN * 2 - 14) as string[];
    tLines.forEach((ln, i) => doc.text(ln, MARGIN + 14, y + i * 13));
    y += tLines.length * 13;
    y = drawParagraph(doc, b.b, y + 2, { color: C.gray, size: 9.5, x: MARGIN + 14, maxWidth: A4.w - MARGIN * 2 - 14 });
    y += 4;
  });

  const custom = ctx.cfg.aboutText?.trim();
  if (custom) {
    y = ensureSpace(doc, y, 60);
    y += 6;
    y = drawParagraph(doc, custom, y, { color: C.ink, size: 10 });
  }

  // KPIs footer bar
  const barH = 70;
  const by = A4.h - FOOTER_H - barH - 10;
  setFill(doc, C.black);
  doc.rect(0, by, A4.w, barH, "F");
  setFill(doc, C.accent);
  doc.rect(0, by, A4.w, 2, "F");
  const kpis = [
    { n: ctx.cfg.kpis.projects, l: "Projetos executados" },
    { n: ctx.cfg.kpis.cities, l: "Cidades atendidas" },
    { n: ctx.cfg.kpis.clients, l: "Clientes satisfeitos" },
  ];
  const cw = A4.w / 3;
  kpis.forEach((k, i) => {
    setText(doc, C.accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(k.n, cw * i + cw / 2, by + 34, { align: "center" });
    setText(doc, C.white);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(k.l, cw * i + cw / 2, by + 52, { align: "center" });
  });
}

// ============================================================
// PAGE 4 — MATERIAIS DO PROJETO (table)
// ============================================================
function renderMaterialsTablePage(doc: jsPDF, ctx: { items: PdfItem[] }) {
  let y = newPage(doc);
  y = drawSectionHeader(doc, "Materiais do Projeto", y);

  const rows = ctx.items.map((it) => [
    it.description ? `${it.name}\n${it.description}` : it.name,
    (it.sku && it.sku.trim()) || "-",
    `${String(Number(it.quantity)).replace(".", ",")} ${it.unit || "UN"}`,
  ]);

  if (rows.length === 0) {
    setFill(doc, C.grayBg);
    doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 70, 4, 4, "F");
    setText(doc, C.gray);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("Nenhum item cadastrado neste orçamento.", A4.w / 2, y + 40, { align: "center" });
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [["PRODUTO", "CÓDIGO", "QUANTIDADE"]],
    body: rows,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 8,
      valign: "middle",
      textColor: [26, 26, 26],
      lineColor: [220, 220, 220],
      lineWidth: 0,
    },
    headStyles: {
      fillColor: hexToRgb(C.tableHead) as any,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
      cellPadding: 10,
      fontSize: 10,
    },
    // Zebra: blue / gray alternating rows, like the reference PDFs
    didParseCell: (data) => {
      if (data.section === "body") {
        const bg = data.row.index % 2 === 0 ? C.tableBlue : C.tableGray;
        (data.cell.styles as any).fillColor = hexToRgb(bg);
      }
    },
    columnStyles: {
      0: { cellWidth: "auto", halign: "left" },
      1: { cellWidth: 90, halign: "center" },
      2: { cellWidth: 110, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_H + 30 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 14;
  setText(doc, C.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "Relação de itens que compõem o escopo. Os valores unitários não são detalhados nesta página — o valor total da proposta consta em CONDIÇÕES DA PROPOSTA.",
    MARGIN,
    finalY,
    { maxWidth: A4.w - MARGIN * 2 },
  );
}

// ============================================================
// PAGE N — PRODUCT HIGHLIGHTS
// ============================================================
function scoreForHighlight(it: PdfItem, solution: SolutionKey): number {
  const cat = categorize(it);
  const name = `${it.name} ${it.description ?? ""}`;
  let s = 0;
  if (cat === "labor" && solution !== "it_maintenance") return -100;
  if (NEGATIVE_RE.test(name)) s -= 3;
  if (cat !== "other" && cat !== "labor") s += 3;
  if (it.image_url) s += 2;
  if (it.description && it.description.trim().length > 20) s += 2;
  if (Number(it.quantity) >= 1) s += 1;
  // Solution affinity
  const affinity: Record<SolutionKey, Category[]> = {
    cftv: ["camera", "dvr", "switch"],
    alarm: ["alarm_central", "sensor", "siren"],
    intercom: ["intercom", "lock"],
    access: ["access_reader", "controller", "lock"],
    network: ["switch", "router", "ap"],
    automation: ["controller", "motor"],
    solar: ["inverter", "solar_panel"],
    ev: ["ev_charger"],
    audio: ["amp", "speaker", "led_panel"],
    motor: ["motor", "controller"],
    lighting: ["luminaire"],
    it_maintenance: ["computer", "labor"],
    generic: [],
  };
  if (affinity[solution].includes(cat)) s += 4;
  return s;
}

function selectHighlights(items: PdfItem[], solution: SolutionKey, max: number): PdfItem[] {
  const scored = items
    .map((it) => ({ it, s: scoreForHighlight(it, solution), cat: categorize(it) }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s);
  const seen = new Set<Category>();
  const out: PdfItem[] = [];
  for (const x of scored) {
    if (x.cat !== "other" && seen.has(x.cat)) continue;
    seen.add(x.cat);
    out.push(x.it);
    if (out.length >= max) break;
  }
  return out;
}

function renderProductHighlightPage(
  doc: jsPDF,
  ctx: { item: PdfItem; imageDataUrl: string | null },
) {
  const it = ctx.item;
  doc.addPage();

  // Black header bar with product name
  setFill(doc, C.black);
  doc.rect(0, 0, A4.w, 60, "F");
  setFill(doc, C.accent);
  doc.rect(0, 60, A4.w, 2, "F");
  setText(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const nameLines = doc.splitTextToSize(it.name.toUpperCase(), A4.w - MARGIN * 2) as string[];
  const startY = nameLines.length === 1 ? 38 : 30;
  nameLines.slice(0, 2).forEach((ln, i) => doc.text(ln, MARGIN, startY + i * 18));

  let y = 90;
  const cat = categorize(it);

  // Description block
  const desc = (it.description && it.description.trim()) || CAT_DESCRIPTION[cat];
  setText(doc, C.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  y = drawParagraph(doc, desc, y, { size: 10.5, color: C.ink });
  y += 6;

  // Benefits
  setText(doc, C.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Benefícios", MARGIN, y);
  y += 14;
  setText(doc, C.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const benefits = CAT_BENEFITS[cat];
  benefits.forEach((b) => {
    y = ensureSpace(doc, y, 20);
    setFill(doc, C.accent);
    doc.circle(MARGIN + 3, y - 3, 2, "F");
    const lines = doc.splitTextToSize(b, A4.w - MARGIN * 2 - 14) as string[];
    lines.forEach((ln, i) => doc.text(ln, MARGIN + 14, y + i * 13));
    y += lines.length * 13 + 3;
  });

  // Image area (large, lower half)
  y = Math.max(y + 10, A4.h * 0.5);
  const availH = A4.h - FOOTER_H - y - 20;
  const boxH = Math.max(200, Math.min(availH, 360));
  const boxW = A4.w - MARGIN * 2;
  setFill(doc, C.grayBg);
  doc.roundedRect(MARGIN, y, boxW, boxH, 6, 6, "F");
  if (ctx.imageDataUrl) {
    try {
      const fmt = detectImageFormat(ctx.imageDataUrl);
      // Fit contained (assume square-ish); use max square inside box
      const pad = 10;
      const s = Math.min(boxW - pad * 2, boxH - pad * 2);
      doc.addImage(ctx.imageDataUrl, fmt, MARGIN + (boxW - s) / 2, y + (boxH - s) / 2, s, s, undefined, "FAST");
    } catch { /* ignore */ }
  } else {
    setText(doc, C.gray);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("Imagem ilustrativa", A4.w / 2, y + boxH / 2, { align: "center" });
  }

  // Small qty badge
  const bx = A4.w - MARGIN - 130;
  const by = y + boxH + 6;
  if (by + 14 < A4.h - FOOTER_H) {
    setText(doc, C.gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Quantidade prevista: ${String(Number(it.quantity)).replace(".", ",")} ${it.unit || "UN"}`, bx, by);
  }
}

// ============================================================
// PAGE — CONDIÇÕES DA PROPOSTA
// ============================================================
function renderConditionsPage(doc: jsPDF, ctx: { quote: PdfQuote }) {
  let y = newPage(doc);
  y = drawSectionHeader(doc, "Condições da Proposta", y);

  const q = ctx.quote;

  // Total card
  setFill(doc, C.black);
  doc.roundedRect(MARGIN, y, A4.w - MARGIN * 2, 100, 6, 6, "F");
  setFill(doc, C.accent);
  doc.rect(MARGIN, y, 5, 100, "F");
  setText(doc, C.grayLight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VALOR TOTAL DA PROPOSTA", MARGIN + 20, y + 28);
  setText(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(fmtBRL(q.total_amount), MARGIN + 20, y + 66);
  setText(doc, C.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Materiais, serviços e mão de obra inclusos.", MARGIN + 20, y + 88);
  y += 120;

  const rows: { label: string; value: string | null | undefined }[] = [];
  if (q.down_payment_percent > 0) {
    rows.push({
      label: `Entrada (${q.down_payment_percent}%)`,
      value: `${fmtBRL(q.down_payment_amount)} · Saldo restante ${fmtBRL(q.remaining_amount)}`,
    });
  }
  rows.push(
    { label: "Condição de pagamento", value: q.payment_terms || "A combinar." },
    { label: "Prazo de entrega / execução", value: q.delivery_terms || "A definir após aceite da proposta." },
    { label: "Estimativa de conclusão", value: q.completion_estimate },
    { label: "Validade da proposta", value: fmtDate(q.valid_until) },
    { label: "Garantia", value: q.warranty_terms || "Equipamentos conforme fabricante; serviços conforme política da empresa." },
  );

  rows.forEach((r) => {
    if (!r.value) return;
    y = ensureSpace(doc, y, 46);
    setText(doc, C.gray);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(r.label.toUpperCase(), MARGIN, y);
    y += 14;
    y = drawParagraph(doc, String(r.value), y, { color: C.black, size: 10.5 });
    setStroke(doc, C.grayLight);
    doc.line(MARGIN, y + 2, A4.w - MARGIN, y + 2);
    y += 14;
  });
}

// ============================================================
// PAGE — OBSERVAÇÕES DA PROPOSTA
// ============================================================
function renderObservationsPage(doc: jsPDF, ctx: { quote: PdfQuote }) {
  let y = newPage(doc);
  y = drawSectionHeader(doc, "Observações da Proposta", y);

  const items: string[] = [];
  const cn = ctx.quote.customer_notes?.trim();
  if (cn) items.push(cn);
  items.push(
    "Sistema cotado conforme informações disponíveis no momento da análise.",
    "Pode ser necessária conferência técnica no local após o aceite da proposta.",
    "Garantia dos equipamentos conforme política do fabricante.",
    "Garantia dos serviços conforme condição comercial informada nesta proposta.",
    "Serviços executados por equipe técnica qualificada, seguindo boas práticas de instalação.",
    "Alterações de escopo podem gerar revisão de valores.",
    "Imagens dos produtos são meramente ilustrativas.",
    "Proposta válida até a data informada em CONDIÇÕES DA PROPOSTA.",
  );

  items.forEach((t, i) => {
    y = ensureSpace(doc, y, 40);
    setText(doc, C.gray);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(String(i + 1).padStart(2, "0"), MARGIN, y);
    setText(doc, C.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(t, A4.w - MARGIN * 2 - 22) as string[];
    lines.forEach((ln, li) => doc.text(ln, MARGIN + 22, y + li * 13));
    y += lines.length * 13 + 8;
  });
}

// ============================================================
// MAIN
// ============================================================
const DEFAULT_KPIS = { projects: "500+", cities: "30+", clients: "99%" };

export function selectStrategicQuoteItems(items: PdfItem[], solution: SolutionKey, max = 4): PdfItem[] {
  return selectHighlights(items, solution, max);
}

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
  const cfg = opts.config ?? {};
  const showAbout = cfg.showAboutPage ?? true;
  const showObs = cfg.showObservationsPage ?? true;
  const maxHighlights = Math.min(Math.max(cfg.maxProductHighlights ?? 4, 0), 4);
  const kpis = { ...DEFAULT_KPIS, ...(cfg.kpis ?? {}) };
  const aboutText = cfg.aboutText ?? null;
  const website = cfg.website ?? null;

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  // Preload assets
  const logoPromise = loadLogoForDarkBg(opts.company?.logo_url ?? null);
  const solution = detectSolution(opts.quote, opts.items);

  // Items shown on materials table: no LABOR rows unless it's an IT-maintenance-style quote
  const includeLabor = solution === "it_maintenance";
  const materialItems = opts.items.filter((it) => (includeLabor ? true : it.kind !== "LABOR"));

  const highlights = selectHighlights(materialItems, solution, maxHighlights);
  const highlightImages = await Promise.all(highlights.map((it) => loadImageAsDataUrl(it.image_url)));
  const logoDataUrl = await logoPromise;

  // Render pages
  renderCoverPage(doc, {
    quote: opts.quote,
    items: opts.items,
    company: opts.company,
    customer: opts.customer,
    logoDataUrl,
    solution,
  });

  renderProposalHeaderPage(doc, {
    quote: opts.quote,
    company: opts.company,
    customer: opts.customer,
    cfg: { website },
  });

  if (showAbout) {
    renderAboutCompanyPage(doc, { company: opts.company, cfg: { aboutText, kpis } });
  }

  renderMaterialsTablePage(doc, { items: materialItems });

  for (let i = 0; i < highlights.length; i++) {
    renderProductHighlightPage(doc, { item: highlights[i], imageDataUrl: highlightImages[i] ?? null });
  }

  renderConditionsPage(doc, { quote: opts.quote });

  if (showObs) renderObservationsPage(doc, { quote: opts.quote });

  // Footers on every page except cover
  applyFooters(doc, { company: opts.company, logo: logoDataUrl }, true);

  if (opts.output === "blob") return doc.output("blob");
  doc.save(`Proposta-${opts.quote.quote_number}.pdf`);
}
