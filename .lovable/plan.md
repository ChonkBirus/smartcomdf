## Objetivo

Resolver o erro `contacts[0].email Required`, padronizar autopreenchimento de CEP e CNPJ em todas as telas cadastrais, e ativar o botão "Importar clientes". Sem mexer em billing/Asaas/PDF/OS/estoque/financeiro.

## Diagnóstico do erro reportado

Olhando `src/lib/customers.functions.ts:264-279`, o schema do servidor já trata `email` como opcional (`z.preprocess(...).optional()`). O erro reproduzido vem do **client form** (`src/components/customers/CustomerFormSheet.tsx`) montando contato com `email: null` e enviando, e em alguns pontos o payload do contato é construído sem normalização (ex.: `EMPTY_CONTACT` espalhado, contato vazio adicionado pelo botão "Adicionar contato" indo junto). Vamos garantir:

- normalização do payload no envio (remover contato 100% vazio; coerção `null/undefined → ""` em strings antes do `parse`),
- schema do servidor com `email` sempre opcional + `.nullable()` para tolerar tanto `null` quanto `""` quanto `undefined`,
- mesma regra aplicada no schema do form.

## Entrega por lotes

### Lote 1 — Cliente PJ salvar com contato sem e-mail (PARTES 1, 2, 8)

1. `src/lib/customers.functions.ts`
   - `contactSchema.email`: `z.preprocess(v → v ?? "", z.string().trim()).transform(v => v || null).refine(v => !v || isEmail(v), "E-mail inválido").nullable().optional()`.
   - `contactSchema.name`: tornar opcional; adicionar `.superRefine` para exigir pelo menos um entre `name | phone | whatsapp | email | role`.
   - No `saveCustomer.handler`, filtrar contatos completamente vazios antes do insert.
2. `src/components/customers/CustomerFormSheet.tsx`
   - Antes de chamar `saveCustomerFn`, mapear contatos: `{ name: c.name ?? "", role: c.role ?? "", email: c.email ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "" }` e descartar os totalmente vazios.
   - Atualizar validação local (`validate()`) para refletir a nova regra.
3. Verificar RLS de `customer_contacts` (já existe `company_id` checagem; só revalidar — sem migration nova).

Critério: criar PJ com contato (telefone, sem e-mail) → salva sem erro Zod.

### Lote 2 — Helper de CEP + CnpjLookupInput/CepLookupInput (PARTES 3, 7)

1. Criar `src/lib/address-lookup.ts`:
   - `lookupCep(cep)` → tenta `viacep.com.br/ws/{cep}/json/` e fallback `brasilapi.com.br/api/cep/v2/{cep}`; devolve `{ street, district, city, state, complement, ibge } | null`.
   - `normalizeAddress(a)` / `normalizeContact(c)` reutilizáveis.
2. Criar `src/components/shared/CepInput.tsx` (Input + ícone de loading + onResolve callback).
3. Aplicar em:
   - `CustomerFormSheet.tsx` (aba Endereços) — cada linha com CEP usa `CepInput`.
   - `SupplierFormSheet.tsx` (aba/seção endereço).
   - `CompanySettingsPage.tsx` (campo CEP).
4. Mensagem de erro: toast "Não foi possível buscar o CEP. Preencha o endereço manualmente." Falha de API não bloqueia salvamento.

### Lote 3 — CNPJ automático em Empresa e Fornecedor (PARTES 4, 5)

1. Reutilizar `lookupCnpj` já existente em CustomerForm (extrair para `src/lib/cnpj-lookup.ts` se ainda estiver inline).
2. Criar `src/components/shared/CnpjLookupInput.tsx` (Input + botão de busca + loading + toast).
3. `src/components/settings/CompanySettingsPage.tsx`:
   - Substituir input de CNPJ por `CnpjLookupInput`; ao resolver, preencher `corporate_name`, `trade_name`, `email`, `phone`, `cep`, `street`, `number`, `district`, `city`, `state`, `complement` (com prompt "Dados encontrados. Revise antes de salvar.").
4. `src/components/suppliers/SupplierFormSheet.tsx`:
   - Adicionar `CnpjLookupInput` quando `supplier_type === "COMPANY"`.
   - Validar e respeitar `company_id` no save (já existente — revalidar).

### Lote 4 — Botão "Importar clientes" funcional (PARTE 6)

Já existe `customer-import.functions.ts` com parser de planilhas e jobs. O botão atual provavelmente está sem `onClick` ou sem rota.

1. Localizar `CustomersPage.tsx` botão "Importar clientes" → trocar para `<Link to="/customers/import">` ou abrir `ImportCustomersSheet`.
2. Conferir rota `src/routes/_authenticated/customers.import.tsx`. Se não existir, criar wrapper de página que monta o componente de importação já implementado (wizard de 5 etapas).
3. Garantir botão "Baixar modelo CSV" servindo arquivo estático `public/templates/clientes-modelo.csv` com cabeçalhos: `tipo_cliente,nome_razao_social,nome_fantasia,cpf_cnpj,telefone,email,cep,endereco,numero,complemento,bairro,cidade,uf,contato_nome,contato_telefone,contato_email,observacoes`.
4. Preview já existe — só conectar UX.

## Detalhes técnicos

- Nenhuma migração nova obrigatória (schemas Postgres já permitem `email` nulo em `customer_contacts`). Se durante o Lote 1 acharmos uma `NOT NULL` em `customer_contacts.email`, abrimos migration adicional alterando para `NULL`.
- `lookupCep`/`lookupCnpj` são chamadas client-side (sem secret), usando `fetch` com `AbortController` e timeout 4s.
- Telas de Empresa e Fornecedor não devem ter perda de dados: autopreenchimento só toca campos vazios (não sobrescreve).
- RLS: nenhum bypass; importação continua via server fn já existente que injeta `company_id`.

## Fora de escopo

Billing, Asaas, PDF, dashboard, OS, estoque, financeiro, permissões globais.

## Sugestão

Vou começar pelo **Lote 1** (resolve o erro bloqueante imediato). Confirme se quer que eu siga direto Lote 1 → 2 → 3 → 4, ou se prefere parar entre lotes para validar.
