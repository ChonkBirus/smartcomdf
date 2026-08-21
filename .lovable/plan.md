# Plano de Correção: Pesquisa de Produtos em Orçamentos (Parte 1)

Auditada a causa raiz dos problemas relatados no seletor de produtos. Nenhuma alteração em regras comerciais ou banco de dados será realizada.

## Auditoria e Causa Raiz

*   **Busca Inconsistente:** A busca atual em `listQuoteCatalog` é realizada client-side via `catalogItems.find` ou filtro local do `Command` (cmdk). O catálogo é carregado uma única vez no `QuoteFormSheet.tsx` via `listQuoteCatalog`, que retorna todos os produtos ativos.
*   **Concorrência/Seleção:** O `CommandItem` utiliza um `value` concatenado (`name`, `sku`, `description`) para o filtro interno do `cmdk`. Isso causa "falsos positivos" ou ocultação de itens quando o filtro do componente interfere com o que o usuário espera. A seleção já utiliza `it.id`, mas a re-filtragem local pode selecionar o item errado se a lista mudar bruscamente sem `shouldFilter={false}`.
*   **Scroll Desktop/Mobile:** O `CommandList` possui `max-h-[300px] overflow-y-auto`. O problema de "trava" ocorre frequentemente em `Popover` dentro de `Sheet` (Drawer) devido ao bloqueio de scroll/pointer-events do Radix UI.
*   **Performance:** Carregar o catálogo inteiro pode ser lento para empresas com milhares de itens.

## Etapas de Implementação

### 1. Busca Server-side (Etapa 2 e 3)
*   Refatorar `listQuoteCatalog` em `src/lib/quotes.functions.ts` para aceitar um parâmetro `search`.
*   Implementar busca determinística no banco:
    1.  SKU exato (ilike);
    2.  Nome (ilike com `%term%`);
    3.  SKU parcial.
*   Utilizar `sanitizePostgrestSearch` para segurança.
*   Garantir isolamento por `company_id`.

### 2. Controle de Concorrência e Debounce (Etapa 3)
*   No frontend (`QuoteFormSheet.tsx`), implementar `searchTerm` com debounce de 300ms.
*   Utilizar `queryKey: ["quote-catalog", companyId, searchTerm]` no TanStack Query para garantir que respostas antigas não sobrescrevam a atual e aproveitar o cache.

### 3. Seleção e Identidade (Etapa 4 e 6)
*   Configurar `<Command shouldFilter={false}>` para desativar a filtragem local do `cmdk`, confiando apenas no servidor.
*   Garantir que `CommandItem` use `value={it.id}` para evitar colisões de texto.
*   Certificar que botões de movimentação/exclusão na `LineRow` tenham `type="button"`.

### 4. Correção de Scroll (Etapa 5)
*   Ajustar `PopoverContent` para garantir que `pointer-events` e `touch-action` não sejam bloqueados pelo `Sheet`.
*   Verificar o `CommandList` para garantir que o scroll nativo funcione sem interferência do Radix `FocusScope`.

## Detalhes Técnicos

*   **Arquivos:**
    *   `src/lib/quotes.functions.ts` (Busca server-side).
    *   `src/components/quotes/QuoteFormSheet.tsx` (Debounce, QueryKey, Command logic).
*   **Segurança:** Manter RLS; usar `sanitizePostgrestSearch`.
*   **Build:** Validar com `tsc` e `lint`.
