import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div style={{ whiteSpace: "pre-wrap", padding: "20px", fontFamily: "monospace" }}>
      Plano aprovado com ajustes obrigatórios antes de implementar.

Pode seguir com a correção da busca, concorrência e seleção, mas antes de mexer no scroll preciso que a causa física seja confirmada.

==================================================
1. BUSCA SERVER-SIDE — APROVADA
==================================================

Pode alterar listQuoteCatalog para aceitar pesquisa server-side.

Porém:

- primeiro auditar todos os callers atuais de listQuoteCatalog;
- não quebrar outros pontos do sistema que dependam dela;
- preferir parâmetro opcional se houver outros consumidores;
- manter RLS e company_id da sessão;
- não confiar em companyId enviado pelo frontend para autorização;
- não usar service_role;
- não criar migration.

A pesquisa deve trabalhar somente com produtos ativos.

Campos de pesquisa:

- usar somente colunas físicas existentes;
- auditar os nomes antes de implementar.

Se SKU existir:

1. SKU exato;
2. nome contendo o termo;
3. SKU contendo o termo.

Para SKU exato, pode usar comparação case-insensitive equivalente a igualdade sem wildcard.

Para buscas parciais, usar ilike com termo sanitizado.

Usar obrigatoriamente:

sanitizePostgrestSearch

Não interpolar o texto bruto na consulta.

Adicionar limite explícito de resultados.

Sugestão inicial:

LIMIT 50

Não devolver milhares de produtos para o autocomplete.

==================================================
2. DEBOUNCE / TANSTACK QUERY
==================================================

Aprovado debounce de 300 ms.

Implementar estados separados:

searchTerm
debouncedSearchTerm

O input deve usar searchTerm.

A consulta deve usar debouncedSearchTerm.

A queryKey deve utilizar o termo efetivamente consultado:

["quote-catalog", debouncedSearchTerm]

ou equivalente dentro da convenção já usada no projeto.

Não usar o searchTerm não-debounced na queryKey se a query estiver consultando debouncedSearchTerm.

Se o company_id já vem obrigatoriamente da sessão autenticada no servidor, não usar companyId do frontend como mecanismo de segurança.

Pode existir na queryKey somente se houver necessidade real de segregação do cache após auditoria.

Garantir que:

- pesquisa anterior não sobrescreva a atual;
- resultados anteriores não sejam apresentados como pertencentes ao novo termo;
- loading não apague o texto digitado.

==================================================
3. CMDK — APROVADO
==================================================

Como os resultados passarão a ser filtrados no servidor:

usar:

<Command shouldFilter={false}>

se confirmado que esse é o Command usado fisicamente.

CommandItem:

- key={it.id}
- value={it.id}

A seleção deve continuar baseada exclusivamente em:

it.id

Não usar nome, SKU, descrição ou índice como identidade.

==================================================
4. SCROLL — NÃO CORRIGIR POR HIPÓTESE
==================================================

Neste ponto o diagnóstico apresentado ainda não comprova a causa raiz.

A frase:

“o problema ocorre frequentemente em Popover dentro de Sheet devido ao bloqueio de scroll/pointer-events”

é uma hipótese.

Antes de alterar CSS, Portal, pointer-events, touch-action ou FocusScope:

REPRODUZIR E IDENTIFICAR A CAUSA FÍSICA.

Auditar no componente montado:

1. QuoteFormSheet é realmente um Sheet/Dialog modal?
2. Onde PopoverContent é renderizado?
3. Existe Portal?
4. Em qual elemento o CommandList fica montado?
5. Qual elemento possui overflow-y-auto?
6. Qual elemento está recebendo wheel?
7. Existe preventDefault em wheel/touchmove?
8. Existe ancestor com overflow-hidden?
9. Existe pointer-events bloqueando o conteúdo?
10. Radix está aplicando body pointer-events:none?
11. O Popover está sendo considerado conteúdo externo ao Sheet?
12. O problema acontece porque o portal do Popover está fora do container modal?
13. O CommandList possui altura real suficiente para overflow?
14. Algum overlay está acima da lista por z-index?
15. No mobile, quem recebe touchmove durante o gesto?

Usar inspeção do DOM/CSS e reprodução real.

Não aplicar:

pointer-events-auto
touch-action
onWheel stopPropagation
preventDefault
mudança de Portal
z-index arbitrário

sem comprovar que isso resolve a causa encontrada.

Quero no relatório:

CAUSA FÍSICA DO SCROLL:
[explicação objetiva]

e não apenas “possível conflito do Radix”.

==================================================
5. NÃO CRIAR HANDLERS ARTIFICIAIS DE SCROLL
==================================================

Prioridade:

scroll nativo.

Evitar soluções como:

onWheel={(e) => ...}
onTouchMove={(e) => ...}
preventDefault()
scrollTop manual

salvo se tecnicamente indispensável e justificado.

O resultado deve funcionar naturalmente com:

- mouse wheel;
- trackpad;
- touch.

==================================================
6. BOTÕES
==================================================

Auditar todos os botões dentro do formulário relacionados ao seletor e LineRow.

Botões que não submetem o orçamento:

type="button"

Não alterar o botão legítimo de submit/salvar.

==================================================
7. NÃO ALTERAR REGRAS DO ORÇAMENTO
==================================================

Não alterar:

- cálculo;
- preço;
- custo;
- margem;
- desconto;
- impostos;
- quantidade;
- snapshots;
- salvamento do orçamento;
- estrutura do banco.

Após selecionar um produto, todos os dados atuais devem continuar sendo preenchidos da mesma forma.

==================================================
8. IMPLEMENTAÇÃO AUTORIZADA
==================================================

Depois de confirmar a causa física do scroll, pode implementar somente:

- busca server-side;
- limite dos resultados;
- sanitizePostgrestSearch;
- debounce;
- queryKey correta;
- proteção contra resultado obsoleto;
- shouldFilter={false};
- seleção por product.id;
- correção física comprovada do scroll;
- type="button" onde necessário.

Arquivos esperados:

- src/lib/quotes.functions.ts
- src/components/quotes/QuoteFormSheet.tsx

Se descobrir necessidade de alterar outro arquivo:

- informar o motivo;
- manter a alteração estritamente relacionada ao bug.

==================================================
9. VALIDAÇÃO DESTA PARTE
==================================================

Após implementar executar:

- typecheck;
- lint;
- build.

Fazer também smoke test básico:

1. pesquisar um produto pelo nome;
2. pesquisar outro logo em seguida;
3. selecionar resultado específico;
4. confirmar product_id correto;
5. testar wheel;
6. testar touch/mobile;
7. confirmar que selecionar não submete o orçamento.

==================================================
ENTREGA
==================================================

Informar:

1. causa física confirmada da busca inconsistente;
2. causa física confirmada do scroll;
3. arquivos alterados;
4. contrato final de listQuoteCatalog;
5. limite de resultados aplicado;
6. debounce utilizado;
7. queryKey final;
8. confirmação de shouldFilter={false};
9. confirmação de key/value por product.id;
10. correção exata aplicada ao scroll;
11. resultado do smoke test;
12. typecheck;
13. lint;
14. build;
15. confirmação de nenhuma migration;
16. confirmação de nenhuma alteração nas regras comerciais.

Depois parar.

Não executar ainda a Parte 2 completa dos 14 testes.
Não trabalhar nos problemas 2 e 3.
    </div>
  ),
});
