
-- ============================================================
-- Refactor products → items (Catálogo Unificado de Itens)
-- ============================================================

-- Enums
CREATE TYPE public.item_type AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE public.category_type AS ENUM ('PRODUCT', 'SERVICE', 'BOTH');

-- 1) Categories: add category_type (default BOTH)
ALTER TABLE public.categories
  ADD COLUMN category_type public.category_type NOT NULL DEFAULT 'BOTH';

-- 2) Rename products → items
ALTER TABLE public.products RENAME TO items;
ALTER INDEX products_pkey RENAME TO items_pkey;
ALTER INDEX idx_products_barcode RENAME TO idx_items_barcode;
ALTER INDEX idx_products_brand RENAME TO idx_items_brand;
ALTER INDEX idx_products_category RENAME TO idx_items_category;
ALTER INDEX idx_products_company RENAME TO idx_items_company;
ALTER INDEX idx_products_manufacturer RENAME TO idx_items_manufacturer;
ALTER INDEX idx_products_name_lower RENAME TO idx_items_name_lower;
ALTER INDEX uq_products_company_sku RENAME TO uq_items_company_sku;

-- SKU should be optional (services may not have one)
ALTER TABLE public.items ALTER COLUMN sku DROP NOT NULL;

-- New typing columns
ALTER TABLE public.items
  ADD COLUMN item_type public.item_type NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN controls_stock BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_items_type ON public.items(company_id, item_type);

-- Replace old products RLS policies with items RLS (same rules, same permission slugs)
DROP POLICY IF EXISTS products_select_own_company ON public.items;
DROP POLICY IF EXISTS products_insert_own_company ON public.items;
DROP POLICY IF EXISTS products_update_own_company ON public.items;

CREATE POLICY items_select_own_company ON public.items
  FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin());

CREATE POLICY items_insert_own_company ON public.items
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND has_permission('products.create'));

CREATE POLICY items_update_own_company ON public.items
  FOR UPDATE TO authenticated
  USING ((company_id = current_company_id()) AND has_permission('products.edit'))
  WITH CHECK (company_id = current_company_id());

ALTER TRIGGER trg_products_updated_at ON public.items RENAME TO trg_items_updated_at;

-- 3) Rename product_images → item_images, product_id → item_id
ALTER TABLE public.product_images RENAME TO item_images;
ALTER TABLE public.item_images RENAME COLUMN product_id TO item_id;
ALTER INDEX product_images_pkey RENAME TO item_images_pkey;
ALTER INDEX idx_product_images_product RENAME TO idx_item_images_item;
ALTER INDEX uq_product_images_primary RENAME TO uq_item_images_primary;

DROP POLICY IF EXISTS product_images_select_own_company ON public.item_images;
DROP POLICY IF EXISTS product_images_insert_own_company ON public.item_images;
DROP POLICY IF EXISTS product_images_update_own_company ON public.item_images;
DROP POLICY IF EXISTS product_images_delete_own_company ON public.item_images;

CREATE POLICY item_images_select_own_company ON public.item_images
  FOR SELECT TO authenticated
  USING ((company_id = current_company_id()) OR is_super_admin());
CREATE POLICY item_images_insert_own_company ON public.item_images
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = current_company_id()) AND has_permission('products.edit'));
CREATE POLICY item_images_update_own_company ON public.item_images
  FOR UPDATE TO authenticated
  USING ((company_id = current_company_id()) AND has_permission('products.edit'))
  WITH CHECK (company_id = current_company_id());
CREATE POLICY item_images_delete_own_company ON public.item_images
  FOR DELETE TO authenticated
  USING ((company_id = current_company_id()) AND has_permission('products.edit'));

-- Recreate primary-image enforcement trigger to use new column name
DROP TRIGGER IF EXISTS trg_product_images_single_primary ON public.item_images;

CREATE OR REPLACE FUNCTION public.item_images_enforce_single_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.item_images
      SET is_primary = FALSE
      WHERE item_id = NEW.item_id AND id <> NEW.id AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_item_images_single_primary
AFTER INSERT OR UPDATE OF is_primary ON public.item_images
FOR EACH ROW EXECUTE FUNCTION public.item_images_enforce_single_primary();

-- Old function no longer used
DROP FUNCTION IF EXISTS public.product_images_enforce_single_primary();
