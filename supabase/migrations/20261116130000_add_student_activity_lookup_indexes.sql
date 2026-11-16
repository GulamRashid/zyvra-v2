-- Add lookup indexes used by student activity and access checks.
-- Question counts are served by get_published_test_question_counts; this migration
-- intentionally does not grant direct student access to test_questions.
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test_created
  ON public.test_attempts (user_id, test_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_attempts_user_status
  ON public.test_attempts (user_id, status);
