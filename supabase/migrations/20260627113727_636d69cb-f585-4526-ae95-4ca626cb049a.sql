
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('reports.export', 'reports', 'export', 'Exportar relatórios (CSV/PDF)'),
  ('reports.financial', 'reports', 'manage', 'Ver relatórios financeiros'),
  ('reports.operational', 'reports', 'process', 'Ver relatórios operacionais'),
  ('reports.stock', 'reports', 'adjust', 'Ver relatórios de estoque'),
  ('reports.sales', 'reports', 'approve', 'Ver relatórios comerciais'),
  ('reports.technicians', 'reports', 'assign_technician', 'Ver relatórios de técnicos')
ON CONFLICT (slug) DO NOTHING;

-- Bind to roles
WITH new_perms AS (
  SELECT id, slug FROM public.permissions
  WHERE slug IN ('reports.view','reports.export','reports.financial','reports.operational','reports.stock','reports.sales','reports.technicians')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN new_perms p
WHERE
  (r.slug IN ('super_admin','owner')) OR
  (r.slug = 'manager' AND p.slug IN ('reports.view','reports.export','reports.operational','reports.stock','reports.sales','reports.technicians')) OR
  (r.slug = 'financial' AND p.slug IN ('reports.view','reports.export','reports.financial','reports.sales')) OR
  (r.slug = 'commercial' AND p.slug IN ('reports.view','reports.sales','reports.export')) OR
  (r.slug = 'stock' AND p.slug IN ('reports.view','reports.stock','reports.export'))
ON CONFLICT (role_id, permission_id) DO NOTHING;
