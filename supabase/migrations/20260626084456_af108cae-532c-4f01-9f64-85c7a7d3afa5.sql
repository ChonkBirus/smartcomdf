
-- Feature: ai_assistant (Pro + Business)
INSERT INTO public.features (code, name, description)
VALUES ('ai_assistant', 'SmartCom IA', 'Copiloto administrativo e operacional')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM public.plans p, public.features f
WHERE f.code = 'ai_assistant' AND p.slug IN ('pro','business')
ON CONFLICT DO NOTHING;

-- Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conv_select_own_company" ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "ai_conv_insert_own" ON public.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ai_conv_update_own" ON public.ai_conversations
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_conv_delete_own" ON public.ai_conversations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON public.ai_conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;

-- Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_msg_select_own" ON public.ai_messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ai_msg_insert_own" ON public.ai_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON public.ai_messages(conversation_id, created_at ASC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.ai_conv_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ai_conv_touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ai_conv_touch ON public.ai_conversations;
CREATE TRIGGER trg_ai_conv_touch BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.ai_conv_touch_updated_at();
