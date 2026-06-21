-- ============ Products module: categories, brands, manufacturers, products, product_images ============

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own_company" ON public.categories
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());

CREATE POLICY "categories_insert_own_company" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_permission('products.create'));

CREATE POLICY "categories_update_own_company" ON public.categories
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.edit'))
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "categories_delete_own_company" ON public.categories
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.delete'));

CREATE INDEX idx_categories_company ON public.categories(company_id);
CREATE UNIQUE INDEX uq_categories_company_name ON public.categories(company_id, lower(name));

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BRANDS
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_own_company" ON public.brands
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "brands_insert_own_company" ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_permission('products.create'));
CREATE POLICY "brands_update_own_company" ON public.brands
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.edit'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "brands_delete_own_company" ON public.brands
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.delete'));

CREATE INDEX idx_brands_company ON public.brands(company_id);
CREATE UNIQUE INDEX uq_brands_company_name ON public.brands(company_id, lower(name));
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MANUFACTURERS
CREATE TABLE public.manufacturers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturers TO authenticated;
GRANT ALL ON public.manufacturers TO service_role;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manufacturers_select_own_company" ON public.manufacturers
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "manufacturers_insert_own_company" ON public.manufacturers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_permission('products.create'));
CREATE POLICY "manufacturers_update_own_company" ON public.manufacturers
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.edit'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "manufacturers_delete_own_company" ON public.manufacturers
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.delete'));

CREATE INDEX idx_manufacturers_company ON public.manufacturers(company_id);
CREATE UNIQUE INDEX uq_manufacturers_company_name ON public.manufacturers(company_id, lower(name));
CREATE TRIGGER trg_manufacturers_updated_at BEFORE UPDATE ON public.manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT UNIT enum
DO $$ BEGIN
  CREATE TYPE public.product_unit AS ENUM ('UN','CX','MT','M2','M3','RL','KIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT NOT NULL,
  barcode TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  unit public.product_unit NOT NULL DEFAULT 'UN',
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  minimum_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_own_company" ON public.products
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "products_insert_own_company" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_permission('products.create'));
CREATE POLICY "products_update_own_company" ON public.products
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.edit'))
  WITH CHECK (company_id = public.current_company_id());
-- No hard-delete policy (soft delete via update setting deleted_at)

CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_manufacturer ON public.products(manufacturer_id);
CREATE INDEX idx_products_name_lower ON public.products(company_id, lower(name));
CREATE INDEX idx_products_barcode ON public.products(company_id, barcode);
CREATE UNIQUE INDEX uq_products_company_sku ON public.products(company_id, lower(sku)) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT IMAGES
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images_select_own_company" ON public.product_images
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
CREATE POLICY "product_images_insert_own_company" ON public.product_images
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_permission('products.edit'));
CREATE POLICY "product_images_update_own_company" ON public.product_images
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.edit'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "product_images_delete_own_company" ON public.product_images
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_permission('products.edit'));

CREATE INDEX idx_product_images_product ON public.product_images(product_id);
CREATE UNIQUE INDEX uq_product_images_primary ON public.product_images(product_id) WHERE is_primary = TRUE;

-- Ensure only one primary image per product
CREATE OR REPLACE FUNCTION public.product_images_enforce_single_primary()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.product_images
      SET is_primary = FALSE
      WHERE product_id = NEW.product_id AND id <> NEW.id AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_product_images_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.product_images_enforce_single_primary();
