import { createFileRoute } from "@tanstack/react-router";

const MESSAGE = `A implementação da busca server-side está aprovada, mas a correção ainda NÃO está encerrada.

Antes de considerar concluído, validar os pontos abaixo.

==================================================
1. NÃO USAR client_request_id NA PESQUISA
==================================================

A pesquisa de produtos é uma operação de leitura.

Não usar client_request_id para:

- pesquisa;
- debounce;
- controle de concorrência;
- CatalogPicker;
- queryKey.

client_request_id deve permanecer reservado às mutações que realmente precisam de idempotência.

Para a pesquisa, usar apenas:

- searchTerm;
- debouncedSearchTerm;
- queryKey;
- cancelamento/isolamento da query conforme TanStack Query.

Se client_request_id foi introduzido apenas para a pesquisa, remover.

Não alterar os fluxos idempotentes legítimos já existentes no orçamento.

==================================================
2. CONFIRMAR CONTRATO FINAL DA BUSCA
==================================================

Informar o contrato físico final de listQuoteCatalog:

- parâmetros;
- campos retornados;
- limite;
- filtros;
- ordenação;
- RLS/company_id;
- comportamento com termo vazio.

Confirmar que:

- limite = 50;
- somente produtos ativos;
- nenhuma empresa externa aparece;
- não usa service_role;
- sanitizePostgrestSearch permanece aplicado.

==================================================
3. VALIDAR PRIORIDADE DA BUSCA
==================================================

A prioridade informada foi:

1. SKU exato;
2. início do nome;
3. início do SKU.

Confirmar que isso é realmente implementado de forma determinística.

Testar pelo menos:

- SKU exato;
- início do nome;
- início do SKU;
- termo inexistente;
- troca rápida entre dois termos;
- apagar completamente a busca.

A lista final deve sempre corresponder ao último termo digitado.

==================================================
4. SCROLL — O PROBLEMA ORIGINAL AINDA PRECISA SER VALIDADO
==================================================

O problema relatado originalmente incluía:

- mouse wheel não funcionando;
- scroll no celular não funcionando.

Informar a CAUSA FÍSICA encontrada.

Não basta informar que foi criado CatalogPicker.

Precisamos saber:

- onde o PopoverContent está montado;
- se existe Portal;
- onde o CommandList está montado;
- qual elemento tem overflow-y-auto;
- qual elemento recebe wheel;
- qual elemento recebe touchmove;
- se havia conflito com Sheet/Dialog/Radix;
- qual alteração exata resolveu.

Depois testar de fato.

==================================================
5. TESTE DESKTOP — MOUSE
==================================================

Abrir o seletor com quantidade de resultados suficiente para existir scroll.

Testar:

- roda do mouse;
- trackpad;
- clicar após rolar;
- clicar no primeiro item;
- clicar em item do meio;
- clicar no último item visível.

Esperado:

- scroll funciona;
- dropdown não fecha durante scroll;
- item correto é selecionado;
- nenhuma seleção acidental;
- formulário não é submetido.

==================================================
6. TESTE MOBILE / TOUCH
==================================================

Executar em viewport mobile e, se disponível, dispositivo real.

Testar:

1. abrir CatalogPicker;
2. fazer swipe vertical;
3. rolar vários itens;
4. parar;
5. tocar em produto;
6. repetir em outro termo de busca.

Esperado:

- gesto rola a lista;
- não seleciona produto durante swipe;
- depois do scroll, o toque seleciona exatamente o item escolhido;
- Sheet não trava;
- página não fica congelada;
- dropdown continua utilizável.

==================================================
7. SELEÇÃO POR ID
==================================================

Confirmar fisicamente no CatalogPicker:

- React key = product.id;
- CommandItem value = product.id;
- onSelect resolve pelo product.id;
- nenhum índice é usado como identidade;
- nome/SKU não são usados como identidade.

Testar dois produtos com nomes semelhantes.

Esperado:

cada um seleciona seu próprio product_id.

==================================================
8. IMAGENS
==================================================

Foi citado “suporte a imagens”.

Auditar se isso já existia ou se foi introduzido agora.

Não ampliar o escopo desnecessariamente.

Se a imagem:

- já fazia parte do catálogo atual: manter;
- foi adicionada agora sem necessidade para corrigir o bug: justificar.

Garantir fallback quando não existir imagem.

Imagem nunca deve impedir:

- pesquisa;
- seleção;
- scroll;
- renderização do item.

==================================================
9. REGRESSÃO BÁSICA DO ORÇAMENTO
==================================================

Executar:

- abrir orçamento existente;
- pesquisar produto;
- selecionar produto;
- adicionar ao orçamento;
- editar quantidade;
- editar preço/desconto dentro das regras atuais;
- salvar;
- reabrir;
- confirmar item e total.

Não alterar cálculos.

==================================================
10. VALIDAÇÃO TÉCNICA
==================================================

Executar:

- typecheck;
- lint;
- build.

Informar resultado individual.

==================================================
ENTREGA
==================================================

Responder com:

1. causa física do bug de busca;
2. causa física do bug de scroll;
3. arquivos alterados;
4. contrato final de listQuoteCatalog;
5. queryKey final;
6. debounce final;
7. confirmação de shouldFilter={false};
8. confirmação de seleção por product.id;
9. resultado do teste de mouse;
10. resultado do teste de trackpad;
11. resultado do teste mobile/touch;
12. resultado da regressão do orçamento;
13. typecheck;
14. lint;
15. build;
16. confirmação de que não foi criada migration;
17. confirmação de que nenhuma regra comercial foi alterada;
18. confirmação de que client_request_id não está sendo usado para a pesquisa.

Somente após esses pontos passarem declarar:

PESQUISA DE PRODUTOS NO ORÇAMENTO — CORREÇÃO CONCLUÍDA

Não iniciar ainda os problemas 2 e 3.`;

export const Route = createFileRoute("/")({
  component: () => (
    <div style={{ whiteSpace: "pre-wrap", padding: "20px", fontFamily: "monospace" }}>
      {MESSAGE}
    </div>
  ),
});
