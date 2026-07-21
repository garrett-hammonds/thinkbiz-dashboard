-- INCIDENT FIX (2nd occurrence — see repo migration 20260512150000_fix_published_pages_view.sql).
-- Someone set security_invoker=true on public.published_pages again (likely an
-- automated "security definer view" lint remediation). anon has SELECT revoked
-- on the underlying pages/page_versions tables by design, so with
-- security_invoker the view throws "permission denied for table pages" for
-- every anonymous visitor, and every CMS-driven marketing page 404s.
--
-- This view MUST run with owner (postgres) privileges. It is the single,
-- intentional anon-visible entrypoint to published content; the raw tables
-- stay locked down. Do NOT re-apply security_invoker to this view.
--
-- NOTE: this was applied to production on 2026-07-09 via the Supabase
-- dashboard and is committed here after the fact so the repo's migration
-- directory matches the remote migration history (version 20260709160839) —
-- otherwise branch syncs fail with "Remote migration versions not found in
-- local migrations directory". The to_regclass guard mirrors the other
-- migrations so this no-ops on Supabase preview branches that spin up without
-- the baseline schema, and is safe to replay.

DO $mig$
BEGIN
  IF to_regclass('public.pages') IS NULL
     OR to_regclass('public.page_versions') IS NULL THEN
    RAISE NOTICE 'restore_published_pages_view migration skipped: baseline schema not present';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.published_pages;

  CREATE VIEW public.published_pages AS
  SELECT
    p.slug,
    p.title,
    p.meta_description,
    p.og_image,
    v.id           AS version_id,
    v.sections     AS sections,
    v.meta         AS version_meta,
    v.published_at AS published_at
  FROM public.pages p
  JOIN public.page_versions v ON v.id = p.published_version_id;

  GRANT SELECT ON public.published_pages TO anon, authenticated;
END;
$mig$;
