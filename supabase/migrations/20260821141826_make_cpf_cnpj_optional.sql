-- Drop NOT NULL constraint from customers.cpf_cnpj
ALTER TABLE public.customers
  ALTER COLUMN cpf_cnpj DROP NOT NULL;

-- Confirm index definition for documentation (NO ALTERATION AUTHORIZED)
-- CREATE UNIQUE INDEX customers_company_doc_unique ON public.customers USING btree (company_id, cpf_cnpj) WHERE ((deleted_at IS NULL) AND (cpf_cnpj IS NOT NULL) AND (btrim(cpf_cnpj) <> ''::text));
