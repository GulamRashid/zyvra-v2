-- ==============================================================================
-- ZYVRA PRODUCTION DATABASE PERFORMANCE INDEXING & CONCURRENCY SCALING
-- 
-- Adds high-performance B-tree and partial indexes across high-traffic tables
-- to support 10,000+ concurrent students with sub-100ms response times:
-- - Fast chapter syllabus & question loading
-- - Instant paywall / access resolution
-- - Zero-lag mock test evaluation & result rendering
-- - Instant wallet & transaction history
-- ==============================================================================

-- 1. QUESTIONS: Partial index on published questions by chapter for instant syllabus retrieval
CREATE INDEX IF NOT EXISTS idx_questions_chapter_published
  ON public.questions (chapter_id, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_questions_subject_difficulty
  ON public.questions (subject, difficulty)
  WHERE status = 'published';

-- 2. TEST_QUESTIONS: Speed up exam question sequencing
CREATE INDEX IF NOT EXISTS idx_test_questions_test_order
  ON public.test_questions (test_id, order_index);

-- 3. TEST_RESPONSES: Speed up instant quiz result evaluation and analytics
CREATE INDEX IF NOT EXISTS idx_test_responses_attempt_id
  ON public.test_responses (attempt_id, question_id);

-- 4. USER_ACCESS: Instant sub-millisecond paywall validation
CREATE INDEX IF NOT EXISTS idx_user_access_user_item_expires
  ON public.user_access (user_id, access_type, item_id, expires_at);

-- 5. PAYMENT_ORDERS: Fast purchase history & pending webhook resolution
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created
  ON public.payment_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_pending
  ON public.payment_orders (created_at)
  WHERE status = 'pending';

-- 6. COIN_TRANSACTIONS: Fast wallet ledger history
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created
  ON public.coin_transactions (user_id, created_at DESC);

-- 7. STUDENT_BOOKMARKS: Fast bookmarks retrieval
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user_created
  ON public.student_bookmarks (user_id, created_at DESC);

-- 8. PROFILES: Fast referral code resolution
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- 9. CHAPTERS: Instant folder syllabus rendering
CREATE INDEX IF NOT EXISTS idx_chapters_folder_published
  ON public.chapters (folder_id, order_index)
  WHERE status = 'published';

-- 10. TESTS: Fast test catalog retrieval
CREATE INDEX IF NOT EXISTS idx_tests_chapter_published
  ON public.tests (chapter_id, created_at DESC)
  WHERE status = 'published';
