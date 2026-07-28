-- =====================================================================
-- MIGRATION 1 — VISITAS TÉCNICAS: schema, RLS, permissões
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABELA: visits
-- ---------------------------------------------------------------------
CREATE TABLE public.visits (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  visit_number             text NOT NULL,
  visit_type               text NOT NULL DEFAULT 'DIAGNOSIS',
  status                   text NOT NULL DEFAULT 'DRAFT',

  customer_id              uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_address_id      uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  customer_contact_id      uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,

  responsible_user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_technician_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  service_order_id         uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  quote_id                 uuid REFERENCES public.quotes(id) ON DELETE SET NULL,

  title                    text NOT NULL,
  description              text,
  pre_diagnosis            text,
  recommended_solution     text,
  internal_notes           text,

  scheduled_start_at       timestamptz NOT NULL,
  scheduled_end_at         timestamptz NOT NULL,

  address_snapshot         jsonb,

  checked_in_at            timestamptz,
  checkin_latitude         numeric(9,6),
  checkin_longitude        numeric(9,6),
  checkin_accuracy_m       numeric(10,2),
  checkin_distance_m       numeric(12,2),
  checkin_manual_reason    text,

  checked_out_at           timestamptz,
  checkout_latitude        numeric(9,6),
  checkout_longitude       numeric(9,6),
  checkout_accuracy_m      numeric(10,2),
  checkout_distance_m      numeric(12,2),
  checkout_manual_reason   text,

  cancellation_reason      text,
  cancelled_at             timestamptz,
  cancelled_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  client_request_id        uuid,

  created_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visits_number_per_company UNIQUE (company_id, visit_number),
  CONSTRAINT visits_type_check         CHECK (visit_type IN ('DIAGNOSIS','INSPECTION','MAINTENANCE','PRE_SALE','OTHER')),
  CONSTRAINT visits_status_check       CHECK (status IN ('DRAFT','SCHEDULED','CONFIRMED','ON_THE_WAY','CHECKED_IN','COMPLETED','CANCELLED','NO_SHOW')),
  CONSTRAINT visits_schedule_range     CHECK (scheduled_end_at > scheduled_start_at),
  CONSTRAINT visits_lat_range          CHECK (checkin_latitude  IS NULL OR (checkin_latitude  BETWEEN -90 AND 90)),
  CONSTRAINT visits_lon_range          CHECK (checkin_longitude IS NULL OR (checkin_longitude BETWEEN -180 AND 180)),
  CONSTRAINT visits_out_lat_range      CHECK (checkout_latitude  IS NULL OR (checkout_latitude  BETWEEN -90 AND 90)),
  CONSTRAINT visits_out_lon_range      CHECK (checkout_longitude IS NULL OR (checkout_longitude BETWEEN -180 AND 180)),
  CONSTRAINT visits_accuracy_positive  CHECK (checkin_accuracy_m  IS NULL OR checkin_accuracy_m  >= 0),
  CONSTRAINT visits_out_accuracy_positive CHECK (checkout_accuracy_m IS NULL OR checkout_accuracy_m >= 0)
);

CREATE INDEX visits_company_idx           ON public.visits(company_id);
CREATE INDEX visits_customer_idx          ON public.visits(company_id, customer_id);
CREATE INDEX visits_technician_idx        ON public.visits(company_id, assigned_technician_id);
CREATE INDEX visits_responsible_idx       ON public.visits(company_id, responsible_user_id);
CREATE INDEX visits_status_idx            ON public.visits(company_id, status);
CREATE INDEX visits_scheduled_start_idx   ON public.visits(company_id, scheduled_start_at);
CREATE INDEX visits_service_order_idx     ON public.visits(service_order_id) WHERE service_order_id IS NOT NULL;
CREATE UNIQUE INDEX visits_client_req_uniq
  ON public.visits(company_id, client_request_id)
  WHERE client_request_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 2) TABELA: visit_events (imutável)
-- ---------------------------------------------------------------------
CREATE TABLE public.visit_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  visit_id            uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  event_type          text NOT NULL,
  actor_user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_request_id   uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visit_events_type_check CHECK (event_type IN (
    'CREATED','SCHEDULED_UPDATED','ASSIGNED','UNASSIGNED',
    'CONFIRMED','ON_THE_WAY','CHECKED_IN','CHECKED_OUT',
    'COMPLETED','CANCELLED','NO_SHOW','PHOTO_ADDED','PHOTO_UPDATED','PHOTO_REMOVED'
  ))
);

CREATE INDEX visit_events_visit_idx    ON public.visit_events(visit_id, created_at);
CREATE INDEX visit_events_company_idx  ON public.visit_events(company_id, created_at);
CREATE UNIQUE INDEX visit_events_client_req_uniq
  ON public.visit_events(company_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3) TABELA: visit_photos
-- ---------------------------------------------------------------------
CREATE TABLE public.visit_photos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  visit_id         uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  uploaded_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_path        text NOT NULL,
  file_name        text NOT NULL,
  mime_type        text NOT NULL,
  file_size        bigint NOT NULL,
  photo_category   text NOT NULL DEFAULT 'OTHER',
  caption          text,
  sort_order       integer NOT NULL DEFAULT 0,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vp_path_unique       UNIQUE (file_path),
  CONSTRAINT vp_mime_check        CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  CONSTRAINT vp_size_check        CHECK (file_size > 0 AND file_size <= 10 * 1024 * 1024),
  CONSTRAINT vp_category_check    CHECK (photo_category IN ('BEFORE','PROBLEM','DURING','AFTER','MATERIAL','OTHER'))
);

CREATE INDEX vp_visit_idx    ON public.visit_photos(visit_id, sort_order);
CREATE INDEX vp_company_idx  ON public.visit_photos(company_id);

-- ---------------------------------------------------------------------
-- 4) TABELA: visit_number_counters
-- ---------------------------------------------------------------------
CREATE TABLE public.visit_number_counters (
  company_id  uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_counter_positive CHECK (last_number >= 0),
  CONSTRAINT visit_counter_max      CHECK (last_number < 1000000)
);

-- ---------------------------------------------------------------------
-- 5) GRANTS (somente SELECT para authenticated; escrita via RPCs)
-- ---------------------------------------------------------------------
GRANT SELECT ON public.visits         TO authenticated;
GRANT SELECT ON public.visit_events   TO authenticated;
GRANT SELECT ON public.visit_photos   TO authenticated;
-- visit_number_counters: sem grant a authenticated (só service_role/RPCs SECURITY DEFINER)
GRANT ALL ON public.visits                 TO service_role;
GRANT ALL ON public.visit_events           TO service_role;
GRANT ALL ON public.visit_photos           TO service_role;
GRANT ALL ON public.visit_number_counters  TO service_role;

-- ---------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.visits                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_number_counters ENABLE ROW LEVEL SECURITY;

-- visits: SELECT por empresa; técnico só vê atribuídas (a menos que tenha visits.view)
CREATE POLICY "visits_select_scope" ON public.visits
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND company_id = public.current_company_id()
    AND (
      public.has_permission('visits.view')
      OR (
        public.has_permission('visits.view_assigned_only')
        AND assigned_technician_id = auth.uid()
      )
    )
  );

-- visit_events: só se puder ver a visita
CREATE POLICY "visit_events_select_scope" ON public.visit_events
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = visit_events.visit_id
        AND v.deleted_at IS NULL
        AND (
          public.has_permission('visits.view')
          OR (public.has_permission('visits.view_assigned_only')
              AND v.assigned_technician_id = auth.uid())
        )
    )
  );

-- visit_photos: mesma lógica
CREATE POLICY "visit_photos_select_scope" ON public.visit_photos
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = visit_photos.visit_id
        AND v.deleted_at IS NULL
        AND (
          public.has_permission('visits.view')
          OR (public.has_permission('visits.view_assigned_only')
              AND v.assigned_technician_id = auth.uid())
        )
    )
  );

-- visit_number_counters: sem policy = sem acesso (só via service_role/definer)

-- ---------------------------------------------------------------------
-- 7) PERMISSÕES
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('visits.view',                 'visits', 'view',               'Visualizar todas as visitas da empresa'),
  ('visits.view_assigned_only',   'visits', 'view_assigned_only', 'Visualizar apenas visitas atribuídas ao próprio usuário'),
  ('visits.create',               'visits', 'create',             'Agendar nova visita técnica'),
  ('visits.edit',                 'visits', 'edit',               'Reagendar ou alterar dados de agenda'),
  ('visits.execute',              'visits', 'execute',            'Registrar check-in e check-out em visitas atribuídas'),
  ('visits.upload_photos',        'visits', 'upload_photos',      'Registrar fotos vinculadas à visita'),
  ('visits.assign_technician',    'visits', 'assign_technician',  'Atribuir ou trocar técnico responsável pela execução'),
  ('visits.cancel',               'visits', 'cancel',             'Cancelar visita técnica')
ON CONFLICT (slug) DO NOTHING;

-- Atribuir aos papéis padrão
WITH perms AS (
  SELECT id, slug FROM public.permissions WHERE slug LIKE 'visits.%'
),
rp AS (
  SELECT r.id AS role_id, p.id AS permission_id, r.slug AS role_slug, p.slug AS perm_slug
  FROM public.roles r CROSS JOIN perms p
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM rp
WHERE
  (role_slug IN ('owner','manager'))                                                              -- todas
  OR (role_slug = 'commercial'  AND perm_slug IN ('visits.view','visits.create','visits.edit','visits.assign_technician'))
  OR (role_slug = 'technician'  AND perm_slug IN ('visits.view_assigned_only','visits.execute','visits.upload_photos'))
  OR (role_slug = 'super_admin' AND perm_slug IN ('visits.view'))
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 8) Trigger updated_at
-- ---------------------------------------------------------------------
CREATE TRIGGER visits_set_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER visit_photos_set_updated_at
  BEFORE UPDATE ON public.visit_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
