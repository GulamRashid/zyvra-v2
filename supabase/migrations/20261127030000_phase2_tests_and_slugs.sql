-- Phase 2 Data Truth & Cleanup:
-- 1. Move published tests that have 0 linked questions in test_questions to 'draft'
-- 2. Fix corrupted slug 'cintroduction-why-social-science' -> 'locating-places-on-the-earth'
-- 3. Backfill missing chapter descriptions so none show 'No description'

DO $$
BEGIN
  -- 1. Demote empty published tests to draft
  UPDATE public.tests t
  SET status = 'draft',
      updated_at = now()
  WHERE lower(coalesce(t.status, '')) = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM public.test_questions tq WHERE tq.test_id = t.id
    );

  -- 2. Fix corrupted chapter slug for Chapter 1: Locating Places on the Earth
  UPDATE public.chapters
  SET slug = 'locating-places-on-the-earth',
      updated_at = now()
  WHERE slug = 'cintroduction-why-social-science'
     OR (lower(title) LIKE '%locating places on the earth%' AND slug LIKE 'cintroduction%');

  -- 3. Backfill missing chapter descriptions
  UPDATE public.chapters
  SET description = 'Practice questions, concepts, and chapter tests for ' || title || '.',
      updated_at = now()
  WHERE description IS NULL OR btrim(description) = '';
END $$;
