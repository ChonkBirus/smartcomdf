
-- Tabela de rate limit persistente
CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_rate_limits_reset_at_idx
  ON public.public_rate_limits (reset_at);

-- Sem GRANTs para anon/authenticated. Somente service_role.
GRANT ALL ON public.public_rate_limits TO service_role;

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: RLS habilitado + sem policy = bloqueio total para anon/authenticated.

-- RPC atômica de consumo de rate limit
CREATE OR REPLACE FUNCTION public.try_consume_rate_limit(
  _bucket TEXT,
  _limit INTEGER,
  _window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, retry_after_sec INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _new_reset TIMESTAMPTZ := _now + make_interval(secs => _window_seconds);
  _row public.public_rate_limits;
BEGIN
  IF _bucket IS NULL OR length(_bucket) = 0 OR _limit <= 0 OR _window_seconds <= 0 THEN
    RETURN QUERY SELECT false, 0, _window_seconds;
    RETURN;
  END IF;

  -- Insert-or-update atômico. Se a linha expirou, reseta.
  INSERT INTO public.public_rate_limits AS r (bucket, count, reset_at, updated_at)
  VALUES (_bucket, 1, _new_reset, _now)
  ON CONFLICT (bucket) DO UPDATE
    SET count = CASE WHEN r.reset_at <= _now THEN 1 ELSE r.count + 1 END,
        reset_at = CASE WHEN r.reset_at <= _now THEN EXCLUDED.reset_at ELSE r.reset_at END,
        updated_at = _now
  RETURNING * INTO _row;

  IF _row.count > _limit THEN
    RETURN QUERY SELECT
      false,
      0,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_row.reset_at - _now)))::INTEGER);
  ELSE
    RETURN QUERY SELECT
      true,
      GREATEST(0, _limit - _row.count),
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_row.reset_at - _now)))::INTEGER);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- Limpeza de buckets expirados
CREATE OR REPLACE FUNCTION public.cleanup_public_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.public_rate_limits WHERE reset_at <= now() - interval '1 hour';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_public_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_public_rate_limits() TO service_role;
