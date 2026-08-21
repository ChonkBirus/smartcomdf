ALTER TABLE public.customers
  ALTER COLUMN cpf_cnpj DROP NOT NULL;

SELECT 
    column_name, 
    is_nullable 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = 'customers'
    AND column_name = 'cpf_cnpj';

SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
    AND tablename = 'customers'
    AND indexname = 'customers_company_doc_unique';