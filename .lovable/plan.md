
# Fase 2.9 — PDF Premium de Proposta SmartCom DF

Implementar um novo modelo de PDF de proposta comercial, premium e persuasivo, mantendo o gerador atual (`src/lib/quote-pdf.ts`) intacto como "modelo simples" e adicionando o novo "modelo premium" como padrão.

## Arquitetura

- Manter `src/lib/quote-pdf.ts` (modelo simples, fallback).
- Criar `src/lib/quote-pdf-premium.ts` com função `generatePremiumQuotePDF(opts)`, mesma assinatura de entrada + `config` opcional de seções visíveis.
- Criar dispatcher `src/lib/quote-pdf-index.ts` exportando `generateQuotePDF({ template: "simple" | "premium", ... })`. Default: `premium`.
- Atualizar chamadas existentes (em `QuoteSendSheet.tsx` e onde o botão "Baixar PDF" existe) para usar o dispatcher com `premium` por padrão.
- Configurações por orçamento (futuras) ficam num objeto `pdfConfig` no `QuoteSendSheet` — nesta fase só usamos defaults sensatos, sem migração de banco.

## Stack do PDF

- Continuar com **jsPDF + jspdf-autotable** (já instalado). Sem novas deps.
- Carregar logo da empresa via `company.logo_url` (já existe). Imagens de produto via `product.image_url` quando houver — carregadas como dataURL (fetch + FileReader) com fallback elegante.
- QR Codes: usar `qrcode` (adicionar via `bun add qrcode`) para gerar dataURL do link público da proposta e do WhatsApp.

## Identidade visual

- Paleta: preto `#0B0B0B`, grafite `#1A1A1A`, dourado/champagne `#C9A24B`, branco `#FFFFFF`, cinza `#9CA3AF`.
- Tipografia: helvetica (built-in jsPDF) com pesos bold/normal/italic; títulos grandes 22-28pt, subtítulos 14pt, corpo 10-11pt.
- Linha dourada de 2pt como separador de seções.
- Rodapé fixo: barra preta + logo/marca + número da página `X / Y` em dourado.

## Estrutura de páginas (helpers privados em `quote-pdf-premium.ts`)

Cada helper recebe `(doc, ctx)` e retorna `void`, chamando `doc.addPage()` ao final quando aplicável.

1. `renderCoverPage` — fundo preto, logo centralizado, faixa dourada, título "PROPOSTA TÉCNICA E COMERCIAL", subtítulo dinâmico inferido pelo `quote.title` ou categoria, bloco branco com: cliente, projeto, nº, data, validade, responsável, contato, e frase de impacto.
2. `renderCompanyIntroPage` — carta "Prezado cliente," + 3 parágrafos + fechamento.
3. `renderAboutPage` — "Sobre a SmartCom DF" + 3 pilares + indicadores (cards: 500+ projetos, 30+ cidades, etc — valores de `company.settings.kpis` se existir, senão defaults).
4. `renderTechnicalAuthorityPage` — CFT, NR-10, NR-35 (só mostra registros se cadastrados em `company`).
5. `renderCftvImportancePage` — 6 cards de benefícios.
6. `renderDiagnosisPage` — campos de `quote.diagnosis` (novo campo opcional no objeto; se ausente, texto padrão curto).
7. `renderSolutionSummaryPage` — resumo da solução + 6 cards de benefícios.
8. `renderScopePage` — incluso / não incluso (lendo `quote.scope_included` / `quote.scope_excluded` se existirem; defaults senão).
9. `renderMaterialsTablePage` — autoTable: #, item, descrição, qtd, unidade. **Sem valor unitário**, **sem subtotal**, **sem LABOR**. Linhas zebradas.
10. `renderProductHighlights` — uma página por produto com `image_url` cadastrada (limite configurável, default top 4 por valor). Imagem + nome + descrição + "por que foi escolhido".
11. `renderExecutionProcessPage` — timeline 8 passos.
12. `renderWarrantySupportPage` — texto + 6 cards.
13. `renderCommercialConditionsPage` — valor total destacado em caixa dourada, pagamento, entrada, parcelas, prazo, validade, disclaimer obrigatório.
14. `renderImportantNotesPage` — `quote.customer_notes` + observações padrão.
15. `renderAcceptancePage` — campos cliente/CPF/data/assinatura + QR codes (link público + WhatsApp) + CTA.
16. `renderCompanyDataPage` — dados completos da empresa.

## Configurações do modelo (objeto `PremiumPdfConfig`)

```ts
type PremiumPdfConfig = {
  showCftPage?: boolean;          // default true
  showCftvImportance?: boolean;   // default true
  showProductHighlights?: boolean;// default true
  maxProductHighlights?: number;  // default 4
  showMaterialsTable?: boolean;   // default true
  showCommercialConditions?: boolean; // default true
  showAcceptancePage?: boolean;   // default true
  showWhatsappQr?: boolean;       // default true
  showAcceptanceQr?: boolean;     // default true
  primaryColor?: string;          // default "#C9A24B"
  coverImageDataUrl?: string;     // optional override
  kpis?: { projects?: number; cities?: number; clients?: string };
};
```

Defaults aplicados via `{ ...DEFAULT_CONFIG, ...opts.config }`.

## Regras comerciais (estritas)

- Nunca renderizar: `unit_price`, subtotal por item, `cost`, margem, `LABOR` como linha.
- Sempre renderizar: quantidade por item + `quote.total_amount` único.
- Disclaimer obrigatório em condições comerciais: "Valor total com materiais, serviços e mão de obra inclusos."
- CFT/certificações: só exibir números reais de `company.settings` (campos `cft_registry`, `nr10`, `nr35`). Se ausentes, exibir bloco genérico sem número.

## Helpers utilitários

- `loadImageAsDataUrl(url): Promise<string | null>` — fetch + blob → base64, com try/catch.
- `drawFooter(doc, ctx, pageNum, total)` — barra preta inferior, texto dourado.
- `drawSectionTitle(doc, text, y)` — título + faixa dourada.
- `drawCard(doc, x, y, w, h, title, body)` — card com borda cinza, título em dourado.
- `wrapText(doc, text, maxWidth)` — splitTextToSize wrapper.
- `ensureSpace(doc, y, needed)` — addPage se y + needed > pageHeight - footerH.

## Integração no app

- `src/components/quotes/QuoteSendSheet.tsx`: trocar import de `generateQuotePDF` por dispatcher; passar `template: "premium"` por padrão. Adicionar dropdown "Modelo: Premium / Simples" no header do sheet (opcional nesta fase — incluir como toggle simples).
- `src/routes/q.$token.tsx`: botão "Baixar PDF" usa o dispatcher com `premium`.

## Entregáveis (arquivos)

- `src/lib/quote-pdf-premium.ts` (novo, ~800 linhas)
- `src/lib/quote-pdf-index.ts` (novo, dispatcher fino)
- `src/lib/quote-pdf-helpers.ts` (novo, image loader + draw utils + QR)
- Edits: `src/components/quotes/QuoteSendSheet.tsx`, `src/routes/q.$token.tsx`
- `bun add qrcode @types/qrcode`

## Fora de escopo (não nesta fase)

- Persistir `PremiumPdfConfig` por orçamento no banco (deixar como prop em memória).
- Editor visual de template.
- Migração de campos `diagnosis`, `scope_included`, `scope_excluded` no schema — usar `customer_notes` + defaults agora; campos dedicados podem vir em fase futura.
- Remoção do modelo simples (mantido como fallback selecionável).

## Validação

- Build limpo (`tsgo`).
- Testar geração com orçamento real via preview, baixar PDF e inspecionar visualmente:
  - capa renderiza com logo
  - todas as páginas presentes, sem sobreposição
  - tabela de materiais sem valor unitário
  - total único exibido
  - QR codes legíveis
  - rodapé com numeração X / Y
- Fluxo atual (modelo simples) continua funcionando ao trocar o toggle.

Confirma que sigo com essa abordagem (premium como padrão, simples mantido como fallback, sem nova migração de banco)?
