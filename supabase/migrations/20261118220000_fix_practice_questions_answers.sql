-- ==============================================================================
-- Fix get_practice_questions RPC to include correct_answer, explanations, and distractor_notes
-- Ensures Practice Mode properly validates answers and displays explanations
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_practice_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_practice_questions(p_chapter_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
  WITH RECURSIVE folder_tree AS (
    SELECT f.id, f.parent_folder_id, f.price, f.exam_id
    FROM public.chapters c
    JOIN public.folders f ON f.id = c.folder_id
    WHERE c.id = p_chapter_id
    UNION ALL
    SELECT parent.id, parent.parent_folder_id, parent.price, parent.exam_id
    FROM public.folders parent
    JOIN folder_tree child ON child.parent_folder_id = parent.id
  ),
  access_context AS (
    SELECT
      EXISTS (
        SELECT 1
        FROM public.chapters c
        WHERE c.id = p_chapter_id
          AND lower(coalesce(c.access_mode, 'inherit')) IN ('paid-own', 'paid_own')
          AND coalesce(c.price, 0) > 0
      )
      OR EXISTS (
        SELECT 1
        FROM folder_tree
        WHERE coalesce(price, 0) > 0
      )
      OR EXISTS (
        SELECT 1
        FROM public.exams e
        JOIN folder_tree ft ON ft.exam_id = e.id
        WHERE coalesce(e.price, 0) > 0
           OR lower(coalesce(e.access_mode, '')) IN ('paid-own', 'paid_own')
      ) AS access_required
  )
  SELECT jsonb_build_object(
    'questions',
    coalesce(jsonb_agg(to_jsonb(question_rows) ORDER BY question_rows.display_order, question_rows.id), '[]'::jsonb)
  )
  FROM (
    SELECT DISTINCT
      q.id,
      q.question_text,
      q.question_text_hi,
      q.options,
      q.correct_answer,
      q.explanation,
      q.explanation_hi,
      q.distractor_notes,
      q.subject,
      q.topic,
      q.tags,
      q.difficulty,
      coalesce(tq.display_order, 0) AS display_order
    FROM public.questions q
    LEFT JOIN public.test_questions tq ON tq.question_id = q.id
    LEFT JOIN public.tests t ON t.id = tq.test_id
    WHERE q.status = 'published'
      AND (q.chapter_id = p_chapter_id OR (
        t.chapter_id = p_chapter_id
        AND t.status IN ('published', 'live', 'available')
      ))
      AND (
        public.is_admin_user()
        OR NOT (SELECT access_required FROM access_context)
        OR EXISTS (
          SELECT 1
          FROM public.user_access ua
          WHERE ua.user_id = auth.uid()
            AND coalesce(ua.is_active, false) = true
            AND lower(coalesce(ua.status, 'active')) = 'active'
            AND (
              (ua.item_type = 'chapter' AND ua.item_id::text = p_chapter_id::text)
              OR (ua.item_type = 'folder' AND EXISTS (
                SELECT 1 FROM folder_tree ft WHERE ft.id::text = ua.item_id::text
              ))
              OR (ua.item_type = 'exam' AND EXISTS (
                SELECT 1 FROM folder_tree ft WHERE ft.exam_id::text = ua.item_id::text
              ))
            )
        )
      )
  ) AS question_rows;
$$;

REVOKE ALL ON FUNCTION public.get_practice_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid) TO authenticated, service_role;
