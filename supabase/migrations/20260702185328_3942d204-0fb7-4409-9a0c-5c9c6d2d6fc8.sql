
-- =========================================================
-- CRM SmartPro — Etapa 1: schema, RLS, permissões, seeds
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.crm_stage_type AS ENUM ('open','won','lost','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_temperature AS ENUM ('cold','warm','hot','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_source AS ENUM ('whatsapp','instagram','indicacao','site','cliente_antigo','google','prospeccao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_customer_type AS ENUM ('residencial','empresa','condominio','comercio','industria','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_lead_type AS ENUM ('pf','pj');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_activity_type AS ENUM ('call','whatsapp','email','visit','meeting','proposal_sent','follow_up','maintenance','commercial_return','internal_task','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_activity_status AS ENUM ('pending','completed','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1) crm_pipelines
-- =========================================================
CREATE TABLE public.crm_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_pipelines_company ON public.crm_pipelines(company_id);
CREATE UNIQUE INDEX uq_crm_pipelines_default ON public.crm_pipelines(company_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_pipelines company members read"
  ON public.crm_pipelines FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "crm_pipelines company members write"
  ON public.crm_pipelines FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_pipelines company members update"
  ON public.crm_pipelines FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_pipelines company members delete"
  ON public.crm_pipelines FOR DELETE TO authenticated
  USING (public.is_company_member(company_id));

-- =========================================================
-- 2) crm_stages
-- =========================================================
CREATE TABLE public.crm_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  stage_type public.crm_stage_type NOT NULL DEFAULT 'open',
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_stages_pipeline ON public.crm_stages(pipeline_id, position);
CREATE INDEX idx_crm_stages_company ON public.crm_stages(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT ALL ON public.crm_stages TO service_role;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_stages read" ON public.crm_stages FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "crm_stages insert" ON public.crm_stages FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_stages update" ON public.crm_stages FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_stages delete" ON public.crm_stages FOR DELETE TO authenticated
  USING (public.is_company_member(company_id));

-- =========================================================
-- 3) crm_opportunities
-- =========================================================
CREATE TABLE public.crm_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_name TEXT NOT NULL,
  lead_type public.crm_lead_type NOT NULL DEFAULT 'pf',
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  customer_type public.crm_customer_type,
  source public.crm_source,
  service_interest TEXT,
  description TEXT,
  estimated_value NUMERIC(14,2) DEFAULT 0,
  temperature public.crm_temperature NOT NULL DEFAULT 'warm',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action TEXT,
  next_follow_up_at TIMESTAMPTZ,
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_crm_opp_company ON public.crm_opportunities(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opp_stage ON public.crm_opportunities(stage_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opp_assigned ON public.crm_opportunities(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opp_followup ON public.crm_opportunities(next_follow_up_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_opp_customer ON public.crm_opportunities(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_opportunities TO authenticated;
GRANT ALL ON public.crm_opportunities TO service_role;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_opp read" ON public.crm_opportunities FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "crm_opp insert" ON public.crm_opportunities FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_opp update" ON public.crm_opportunities FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_opp delete" ON public.crm_opportunities FOR DELETE TO authenticated
  USING (public.is_company_member(company_id));

-- =========================================================
-- 4) crm_activities
-- =========================================================
CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  activity_type public.crm_activity_type NOT NULL DEFAULT 'follow_up',
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status public.crm_activity_status NOT NULL DEFAULT 'pending',
  priority public.crm_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_crm_act_company ON public.crm_activities(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_act_opp ON public.crm_activities(opportunity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_act_assigned ON public.crm_activities(assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_act_due ON public.crm_activities(due_at) WHERE deleted_at IS NULL AND status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_act read" ON public.crm_activities FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "crm_act insert" ON public.crm_activities FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_act update" ON public.crm_activities FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_act delete" ON public.crm_activities FOR DELETE TO authenticated
  USING (public.is_company_member(company_id));

-- =========================================================
-- 5) crm_notes
-- =========================================================
CREATE TABLE public.crm_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_notes_opp ON public.crm_notes(opportunity_id);
CREATE INDEX idx_crm_notes_company ON public.crm_notes(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_notes TO authenticated;
GRANT ALL ON public.crm_notes TO service_role;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notes read" ON public.crm_notes FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "crm_notes insert" ON public.crm_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_notes update" ON public.crm_notes FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "crm_notes delete" ON public.crm_notes FOR DELETE TO authenticated
  USING (public.is_company_member(company_id));

-- =========================================================
-- 6) crm_timeline (append-only history)
-- =========================================================
CREATE TABLE public.crm_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_tl_opp ON public.crm_timeline(opportunity_id, created_at DESC);
CREATE INDEX idx_crm_tl_company ON public.crm_timeline(company_id);

GRANT SELECT, INSERT ON public.crm_timeline TO authenticated;
GRANT ALL ON public.crm_timeline TO service_role;
ALTER TABLE public.crm_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_tl read" ON public.crm_timeline FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "crm_tl insert" ON public.crm_timeline FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- =========================================================
-- Triggers: updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.crm_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_crm_pipelines_touch BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();
CREATE TRIGGER trg_crm_stages_touch BEFORE UPDATE ON public.crm_stages
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();
CREATE TRIGGER trg_crm_opp_touch BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();
CREATE TRIGGER trg_crm_act_touch BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();
CREATE TRIGGER trg_crm_notes_touch BEFORE UPDATE ON public.crm_notes
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- =========================================================
-- Seed helper: create default pipeline + 11 stages for a company
-- =========================================================
CREATE OR REPLACE FUNCTION public.crm_seed_default_pipeline(_company_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.crm_pipelines WHERE company_id=_company_id AND is_default) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.crm_pipelines(company_id, name, is_default)
    VALUES (_company_id, 'Comercial', true)
    RETURNING id INTO v_pipeline_id;

  INSERT INTO public.crm_stages(company_id, pipeline_id, name, position, color, stage_type, is_won, is_lost) VALUES
    (_company_id, v_pipeline_id, 'Novo lead',                 1,  '#64748b', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Primeiro contato',          2,  '#0ea5e9', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Diagnóstico / levantamento', 3,  '#06b6d4', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Visita técnica agendada',   4,  '#8b5cf6', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Orçamento em elaboração',   5,  '#f59e0b', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Proposta enviada',          6,  '#f97316', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Follow-up',                 7,  '#eab308', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Negociação',                8,  '#ec4899', 'open',     false, false),
    (_company_id, v_pipeline_id, 'Fechado ganho',             9,  '#22c55e', 'won',      true,  false),
    (_company_id, v_pipeline_id, 'Fechado perdido',           10, '#ef4444', 'lost',     false, true),
    (_company_id, v_pipeline_id, 'Reativar futuramente',      11, '#94a3b8', 'archived', false, false);

  RETURN v_pipeline_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.crm_seed_default_pipeline(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_seed_default_pipeline(UUID) TO authenticated, service_role;

-- Trigger: auto-seed on new company
CREATE OR REPLACE FUNCTION public.crm_on_company_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.crm_seed_default_pipeline(NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_crm_seed_on_company AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_company_created();

-- Backfill existing companies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.crm_seed_default_pipeline(r.id);
  END LOOP;
END $$;

-- =========================================================
-- Trigger: timeline event on opportunity creation
-- =========================================================
CREATE OR REPLACE FUNCTION public.crm_opp_timeline_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.crm_timeline(company_id, opportunity_id, event_type, title, description, created_by, metadata)
  VALUES (
    NEW.company_id, NEW.id, 'created', 'Lead criado',
    'Oportunidade "' || NEW.lead_name || '" foi cadastrada.',
    NEW.created_by,
    jsonb_build_object('stage_id', NEW.stage_id, 'source', NEW.source)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_crm_opp_timeline_insert AFTER INSERT ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.crm_opp_timeline_on_insert();

-- =========================================================
-- Permissions catalog
-- =========================================================
INSERT INTO public.permissions (slug, module, action, description) VALUES
  ('crm.view',                    'crm', 'view',   'Visualizar CRM'),
  ('crm.manage',                  'crm', 'manage', 'Gerenciar CRM (todos os recursos)'),
  ('crm.opportunities.create',    'crm', 'create', 'Criar oportunidades'),
  ('crm.opportunities.update',    'crm', 'update', 'Editar oportunidades'),
  ('crm.opportunities.delete',    'crm', 'delete', 'Excluir oportunidades'),
  ('crm.activities.create',       'crm', 'create', 'Criar atividades/follow-ups'),
  ('crm.activities.update',       'crm', 'update', 'Editar atividades'),
  ('crm.activities.delete',       'crm', 'delete', 'Excluir atividades'),
  ('crm.reports.view',            'crm', 'view',   'Ver relatórios do CRM'),
  ('crm.pipeline.manage',         'crm', 'manage', 'Gerenciar funis e estágios')
ON CONFLICT (slug) DO NOTHING;
