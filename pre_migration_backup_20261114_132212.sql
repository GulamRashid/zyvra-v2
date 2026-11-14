SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict ULPIPwwEXWevvEpJh60kEdfuXQulCMZcpKyFKq4z2cSomvWNwQF7gxVOePZ62CN

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "full_name", "email", "mobile", "email_verified", "mobile_verified", "avatar_url", "preferred_language", "theme", "target_exams", "role", "account_status", "daily_goal_type", "daily_goal_target", "daily_goal_progress", "current_streak", "last_active_date", "onboarding_completed", "created_at", "updated_at", "referral_code") VALUES
	('dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'Gulam Rashid', 'zyvra.education@gmail.com', NULL, false, false, NULL, 'en', 'light', '{BPSC,SSC,CTET,NCERT}', 'student', 'active', 'questions', 20, 0, 0, NULL, true, '2026-11-10 15:00:19.017354+00', '2026-11-10 15:00:19.017354+00', 'ZYV9EW'),
	('67c2f370-b4bd-4da1-833d-3a927c899ec6', 'Gulam Rashid', 'gulamrashid170@gmail.com', NULL, false, false, NULL, 'en', 'dark', '{BPSC,SSC,CTET,NCERT}', 'super_admin', 'active', 'questions', 20, 0, 0, NULL, true, '2026-11-10 14:57:01.405845+00', '2026-11-10 14:57:01.405845+00', 'ZYVDTE');


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."exams" ("id", "title", "slug", "description", "icon_name", "status", "display_order", "created_at", "updated_at", "access_mode", "pass_price", "icon", "price") VALUES
	('3af6407d-520a-40cd-943f-66ddbddb84b4', 'NCERT', 'ncert', 'Complete NCERT Test Series for Classes 6–12, covering all subjects with chapter-wise practice and exam-oriented questions.', 'GraduationCap', 'published', 1, '2026-11-12 04:04:01.331845+00', '2026-11-12 11:58:06.604753+00', 'paid_own', 0, 'BookOpen', 499.00),
	('79aab0d0-212b-4f4b-82b7-becd25004f19', 'BPSC', 'bpsc', NULL, 'GraduationCap', 'published', 2, '2026-11-14 04:46:37.985031+00', '2026-11-14 04:46:37.985031+00', 'paid_own', 0, 'BookMarked', 499.00);


--
-- Data for Name: folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."folders" ("id", "exam_id", "parent_id", "title", "slug", "description", "icon_name", "display_order", "status", "pricing_mode", "base_price", "effective_price", "allow_tests", "allow_practice", "allow_notes", "created_at", "updated_at", "parent_folder_id", "price") VALUES
	('d35c989e-0c1f-4dda-afcc-8d2926fdc71a', '3af6407d-520a-40cd-943f-66ddbddb84b4', NULL, 'Class 6', 'class-6', 'Test Series based on NCERT Class 6 textbooks, covering all subjects with chapter-wise practice questions to strengthen basic concepts.', 'Folder', 1, 'published', 'paid_own', 0.00, 0.00, true, true, true, '2026-11-12 04:49:34.797298+00', '2026-11-12 04:49:34.797298+00', NULL, 99.00),
	('d29d052f-09fb-4e23-a3f5-c11a706cf498', '3af6407d-520a-40cd-943f-66ddbddb84b4', 'd35c989e-0c1f-4dda-afcc-8d2926fdc71a', 'Tests', 'tests', NULL, 'Folder', 1, 'published', 'free', 0.00, 0.00, true, true, true, '2026-11-12 08:15:36.808197+00', '2026-11-12 08:32:35.177642+00', 'd35c989e-0c1f-4dda-afcc-8d2926fdc71a', NULL),
	('86f01cda-9455-4bb6-aa29-4dd756e9acd8', '3af6407d-520a-40cd-943f-66ddbddb84b4', NULL, 'NCERT Class 7', 'ncert-class-7', NULL, 'Folder', 2, 'published', 'paid_own', 0.00, 0.00, true, true, true, '2026-11-14 04:45:26.871472+00', '2026-11-14 04:45:26.871472+00', NULL, 59.00);


--
-- Data for Name: chapters; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."chapters" ("id", "folder_id", "title", "slug", "subject", "description", "thumbnail_url", "estimated_study_time_mins", "display_order", "status", "access_mode", "custom_price", "created_at", "updated_at", "estimated_study_time_minutes", "price") VALUES
	('e53f57b7-42e8-4bf3-ba10-609f2205ec99', 'd29d052f-09fb-4e23-a3f5-c11a706cf498', 'CH 1-Introduction: Why Social Science?', 'ch-1-introduction-why-social-science', 'Class 6 SST Chapter 1', NULL, NULL, 45, 1, 'published', 'inherit', 0.00, '2026-11-12 08:22:15.410832+00', '2026-11-12 08:22:15.410832+00', 30, NULL),
	('fe36464f-75f3-40e6-aa5c-4b57048e14da', 'd35c989e-0c1f-4dda-afcc-8d2926fdc71a', 'CH 1-Introduction: Why Social Science? (Notes)', 'cintroduction-why-social-science-nots', 'Social Science', NULL, NULL, 45, 1, 'published', 'free', 0.00, '2026-11-12 05:13:57.716191+00', '2026-11-12 09:27:39.790862+00', 120, NULL);


--
-- Data for Name: chapter_resources; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."chapter_resources" ("id", "chapter_id", "title", "resource_type", "file_url", "file_size_kb", "page_count", "is_downloadable", "is_free_preview", "display_order", "status", "created_at", "updated_at", "file_size") VALUES
	('c280850e-6ee8-4000-860b-38353a92c17b', 'fe36464f-75f3-40e6-aa5c-4b57048e14da', 'NCERT Class 6 Chapter 1', 'notes', 'https://drive.google.com/file/d/1JccvVz5A3X8t8I782bDnSxt6-g4qzAt9/view?usp=drive_link', 0, NULL, false, true, 1, 'published', '2026-11-12 08:07:26.187463+00', '2026-11-12 12:03:47.784923+00', NULL),
	('31c2d651-543e-4612-85cd-655078ee1da5', 'fe36464f-75f3-40e6-aa5c-4b57048e14da', 'Class 6 CH 1', 'pdf', 'https://drive.google.com/file/d/1JccvVz5A3X8t8I782bDnSxt6-g4qzAt9/view?usp=drive_link', 0, NULL, true, true, 1, 'archived', '2026-11-12 12:03:33.494267+00', '2026-11-12 12:04:07.531098+00', NULL);


--
-- Data for Name: coin_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."coin_ledger" ("id", "user_id", "amount", "tx_type", "source", "reason", "reference_id", "balance_after", "created_by", "created_at") VALUES
	('66419591-1128-461a-ab9c-9bfd62a4d5ae', '67c2f370-b4bd-4da1-833d-3a927c899ec6', 20, 'credit', 'welcome_bonus', 'Welcome to Zyvra Bonus Coins', NULL, 20, NULL, '2026-11-10 14:57:01.405845+00'),
	('ee2f98ab-ffae-4ca1-9220-15a323aee3d1', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 20, 'credit', 'welcome_bonus', 'Welcome to Zyvra Bonus Coins', NULL, 20, NULL, '2026-11-10 15:00:19.017354+00');


--
-- Data for Name: coin_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: coin_wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."coin_wallets" ("user_id", "balance", "total_earned", "total_redeemed", "updated_at", "total_spent") VALUES
	('67c2f370-b4bd-4da1-833d-3a927c899ec6', 20, 20, 0, '2026-11-10 14:57:01.405845+00', 0),
	('dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 20, 20, 0, '2026-11-10 15:00:19.017354+00', 0);


--
-- Data for Name: payment_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payment_orders" ("id", "user_id", "order_type", "item_id", "item_title", "base_amount", "coin_discount", "coins_redeemed", "final_amount", "currency", "razorpay_order_id", "razorpay_payment_id", "status", "created_at", "updated_at", "amount", "amount_paise", "gateway_order_id", "gateway_payment_id", "payment_signature", "item_type", "tier", "base_price", "coins_used", "discount_amount", "razorpay_signature", "item_name", "amount_before_discount", "coin_discount_amount", "amount_paid") VALUES
	('bb0f6c0c-92e2-41f7-a3fe-0dacd2a0eaf6', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'exam', '3af6407d-520a-40cd-943f-66ddbddb84b4', 'NCERT', 499.00, 0.00, 20, 497.00, 'INR', 'order_TzKZp9I0XDOHRV', NULL, 'created', '2026-11-12 16:32:02.700808+00', '2026-11-12 16:32:02.700808+00', 497.00, 49700, 'order_TzKZp9I0XDOHRV', NULL, NULL, 'exam', 'exam', 499.00, 20, 2.00, NULL, NULL, 0.00, 0.00, 0.00),
	('18bafe01-2e8c-4f54-b5aa-c20656b6dc1c', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'folder', 'd35c989e-0c1f-4dda-afcc-8d2926fdc71a', 'Class 6', 99.00, 0.00, 20, 97.00, 'INR', 'order_TzKaN4RYZjtpd0', NULL, 'created', '2026-11-12 16:32:33.828622+00', '2026-11-12 16:32:33.828622+00', 97.00, 9700, 'order_TzKaN4RYZjtpd0', NULL, NULL, 'folder', 'folder', 99.00, 20, 2.00, NULL, NULL, 0.00, 0.00, 0.00),
	('b2b9452d-6f3f-4aa2-ae3d-1239ca69f686', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'folder', 'd35c989e-0c1f-4dda-afcc-8d2926fdc71a', 'Class 6', 99.00, 0.00, 20, 97.00, 'INR', 'order_TzKbMEd2troT6K', NULL, 'created', '2026-11-12 16:33:29.874343+00', '2026-11-12 16:33:29.874343+00', 97.00, 9700, 'order_TzKbMEd2troT6K', NULL, NULL, 'folder', 'folder', 99.00, 20, 2.00, NULL, NULL, 0.00, 0.00, 0.00),
	('c29e2c84-8e42-4412-8669-4b0c3be01cbc', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'exam', '3af6407d-520a-40cd-943f-66ddbddb84b4', 'NCERT', 499.00, 0.00, 20, 497.00, 'INR', 'order_TzL2wJV9Ky3gWX', NULL, 'created', '2026-11-12 16:59:36.402091+00', '2026-11-12 16:59:36.402091+00', 497.00, 49700, 'order_TzL2wJV9Ky3gWX', NULL, NULL, 'exam', 'exam', 499.00, 20, 2.00, NULL, NULL, 0.00, 0.00, 0.00),
	('44e444ec-c231-4e64-b385-c0daefe8a7ee', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'exam', '3af6407d-520a-40cd-943f-66ddbddb84b4', 'NCERT', 499.00, 0.00, 20, 497.00, 'INR', 'order_TzL46FVuxdL65f', NULL, 'created', '2026-11-12 17:00:42.413672+00', '2026-11-12 17:00:42.413672+00', 497.00, 49700, 'order_TzL46FVuxdL65f', NULL, NULL, 'exam', 'exam', 499.00, 20, 2.00, NULL, NULL, 0.00, 0.00, 0.00),
	('00590075-97e6-483f-8bac-b1a2a307f147', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'exam', '79aab0d0-212b-4f4b-82b7-becd25004f19', 'BPSC', 499.00, 0.00, 20, 497.00, 'INR', NULL, NULL, 'created', '2026-11-14 04:46:58.886409+00', '2026-11-14 04:46:58.886409+00', 497.00, 49700, NULL, NULL, NULL, 'exam', 'exam', 499.00, 20, 2.00, NULL, NULL, 0.00, 0.00, 0.00);


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."platform_settings" ("setting_key", "setting_value", "updated_by", "updated_at", "description", "value", "key") VALUES
	('guest_demo_enabled', 'false', NULL, '2026-11-10 17:46:29.228941+00', NULL, 'false', 'guest_demo_enabled'),
	('general', '{"tagline": "Learn. Practise. Succeed.", "default_theme": "dark", "platform_name": "ZYVRA", "default_language": "hi", "guest_demo_enabled": true}', NULL, '2026-11-10 12:58:39.944733+00', NULL, '{"tagline": "Learn. Practise. Succeed.", "default_theme": "dark", "platform_name": "ZYVRA", "default_language": "hi", "guest_demo_enabled": true}', 'general'),
	('coins_config', '{"coin_to_inr_rate": 1, "welcome_bonus_coins": 20, "max_order_redemption_percent": 50}', NULL, '2026-11-10 12:58:39.944733+00', NULL, '{"coin_to_inr_rate": 1, "welcome_bonus_coins": 20, "max_order_redemption_percent": 50}', 'coins_config'),
	('payment_config', '{"upi_id": "zyvra@upi", "upi_qr_url": "", "razorpay_enabled": true, "manual_upi_fallback_enabled": true}', NULL, '2026-11-10 12:58:39.944733+00', NULL, '{"upi_id": "zyvra@upi", "upi_qr_url": "", "razorpay_enabled": true, "manual_upi_fallback_enabled": true}', 'payment_config'),
	('coin_redemption_config', '{"is_enabled": true, "coins_per_rupee": 10, "max_discount_percent": 20}', NULL, '2026-11-10 16:55:20.195434+00', 'Rules for spending wallet coins on content checkout', '{"is_enabled": true, "coins_per_rupee": 10, "max_discount_percent": 20}', 'coin_redemption_config'),
	('referral_program_config', '{"referral_enabled": true, "referred_reward_coins": 20, "referrer_reward_coins": 50}', NULL, '2026-11-11 08:01:41.109129+00', NULL, '{"referral_enabled": true, "referred_reward_coins": 20, "referrer_reward_coins": 50}', 'referral_program_config'),
	('referral_enabled', 'true', NULL, '2026-11-11 08:01:41.109129+00', NULL, 'true', 'referral_enabled'),
	('referrer_reward_coins', '50', NULL, '2026-11-11 08:01:41.109129+00', NULL, '50', 'referrer_reward_coins'),
	('referred_reward_coins', '20', NULL, '2026-11-11 08:01:41.109129+00', NULL, '20', 'referred_reward_coins'),
	('toolbox_pricing', '{"combo": {"price": 0, "validity_days": 30}, "tools": {"pomodoro": {"price": 0, "access_type": "free", "validity_days": 30}, "formula-sheet": {"price": 0, "access_type": "free", "validity_days": 30}, "math-shortcuts": {"price": 0, "access_type": "free", "validity_days": 30}, "polity-articles": {"price": 0, "access_type": "free", "validity_days": 30}}}', NULL, '2026-11-11 09:44:17.744737+00', NULL, NULL, 'toolbox_pricing'),
	('test_coin_reward_slabs', '[{"coins": 50, "min_percentage": 90}, {"coins": 30, "min_percentage": 80}]', NULL, '2026-11-10 12:58:39.944733+00', NULL, '[{"coins": 50, "min_percentage": 90}, {"coins": 30, "min_percentage": 80}]', 'test_coin_reward_slabs'),
	('study_toolbox_config', '[{"id": "pomodoro", "icon": "Clock", "name": "Pomodoro Study Timer", "price": 0, "enabled": true, "popular": true, "category": "Productivity", "access_type": "free", "purchaseType": "Always Free", "validity_days": 30}, {"id": "math-shortcuts", "icon": "Calculator", "name": "Speed Math & Mental Calculation", "price": 29, "enabled": true, "popular": true, "category": "Quantitative Aptitude", "access_type": "paid", "purchaseType": "Always Free", "validity_days": 30}, {"id": "polity-articles", "icon": "BookOpen", "name": "Constitution & Articles Quick Navigator", "price": 0, "enabled": true, "popular": true, "category": "General Studies", "access_type": "free", "purchaseType": "Always Free", "validity_days": 30}, {"id": "formula-sheet", "icon": "Brain", "name": "Reasoning & Logic Formula Hub", "price": 0, "enabled": true, "popular": false, "category": "Reasoning", "access_type": "free", "purchaseType": "Always Free", "validity_days": 30}]', NULL, '2026-11-11 09:44:17.443182+00', NULL, NULL, 'study_toolbox_config'),
	('coupon_codes', '[{"id": "1794581731376-ZYVRA75", "code": "ZYVRA75", "scope": "global", "active": true, "created_at": "2026-11-13T14:55:31.376Z", "discount_type": "percent", "discount_value": 75, "target_folder_id": null}, {"id": "1794581696424-NEW60", "code": "NEW60", "scope": "folder", "active": true, "created_at": "2026-11-13T14:54:56.424Z", "discount_type": "percent", "discount_value": 60, "target_folder_id": "d35c989e-0c1f-4dda-afcc-8d2926fdc71a"}]', NULL, '2026-11-13 14:54:57.351311+00', NULL, NULL, 'coupon_codes');


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: student_bookmarks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tests" ("id", "folder_id", "chapter_id", "title", "slug", "description", "instructions", "pattern_type", "options_count", "positive_marks", "negative_marks", "unattempted_e_penalty", "duration_mins", "attempt_limit", "is_free", "coin_reward_enabled", "status", "created_at", "updated_at", "duration_minutes", "duration", "unattempted_penalty", "blank_penalty", "question_pattern", "pattern", "rewards_enabled", "availability", "total_marks", "passing_marks", "mandatory_option_e_penalty", "option_e_penalty", "solution_mode") VALUES
	('89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', NULL, 'e53f57b7-42e8-4bf3-ba10-609f2205ec99', 'NCERT Class 6 SST CH 1', 'ncert-class-6-sst-ch-1', NULL, NULL, 'bpsc_mandatory_e_penalty', 5, 1.00, 0.00, 0.33, 60, 15, true, false, 'published', '2026-11-12 09:54:07.873435+00', '2026-11-12 17:02:09.596047+00', 30, 60, 0.25, 0.25, 'bpsc_mandatory_option_e', 'standard-4', true, 'draft', 0, 0, 0, 0.25, 'immediate');


--
-- Data for Name: test_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."test_attempts" ("id", "test_id", "user_id", "attempt_number", "status", "started_at", "submitted_at", "time_spent_seconds", "total_questions", "attempted_count", "correct_count", "incorrect_count", "skipped_with_e_count", "blank_penalty_count", "score", "max_score", "percentage", "coins_awarded", "created_at", "remaining_seconds", "current_question_index", "state_json", "paused_at", "updated_at", "answers", "completed_at", "total_score", "total_marks") VALUES
	('0cf683f0-f60e-4396-b680-f337ed577052', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 11:21:43.752191+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 11:21:43.752191+00', NULL, 0, '{}', NULL, '2026-11-12 11:21:43.752191+00', '{}', NULL, 0.00, 0.00),
	('bac5073f-a1ba-4507-8a62-ce04badf3208', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 17:49:41.618769+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 17:49:41.618769+00', 1364, 16, '{"status": "in_progress", "testId": "89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb", "userId": "dced397e-5cc0-4fe0-801b-e5bdb1b8ef24", "answers": {"093d7d48-e4f2-4885-8224-68d9d08ee436": "B", "1a12c8f4-5a20-4f06-a688-064789c1e49c": "B", "1cf01722-f285-45c0-b34d-e129587e20d8": "C", "3a3500f5-0cc0-4b79-b7c1-75893a36c60e": "D", "4c0eb128-db69-4e45-99a6-601d91025c9b": "B", "4c626274-7aba-4018-88ab-f6b842c431e2": "A", "4ea027e2-7261-44bf-954b-755fd4eb9bd0": "A", "649119cd-0502-4ccf-b18f-a0afd34bbf6c": "C", "67f8d401-05ac-47fc-8280-79a63d868544": "A", "832b674e-34e9-4bef-afdf-dd100620a6bc": "C", "864f314f-744d-4602-8928-6398b079e166": "A", "926bb60b-848c-45fc-a454-9d1a06b05784": "A", "949b1414-7607-4bf5-9075-955ed477603b": "C", "ba55c4ad-3ad6-477f-8162-1405414ac30b": "C", "d4adf727-1059-4ba2-8de5-c8b7001ed30f": "D", "d85d83ca-5c46-4bb8-a329-8bba8c9520de": "B", "e16ac5b5-3a52-4fd4-9ba0-c146681d4f69": "B"}, "visited": ["d4adf727-1059-4ba2-8de5-c8b7001ed30f", "ba55c4ad-3ad6-477f-8162-1405414ac30b", "4c626274-7aba-4018-88ab-f6b842c431e2", "864f314f-744d-4602-8928-6398b079e166", "4c0eb128-db69-4e45-99a6-601d91025c9b", "926bb60b-848c-45fc-a454-9d1a06b05784", "949b1414-7607-4bf5-9075-955ed477603b", "093d7d48-e4f2-4885-8224-68d9d08ee436", "832b674e-34e9-4bef-afdf-dd100620a6bc", "e16ac5b5-3a52-4fd4-9ba0-c146681d4f69", "3a3500f5-0cc0-4b79-b7c1-75893a36c60e", "67f8d401-05ac-47fc-8280-79a63d868544", "1cf01722-f285-45c0-b34d-e129587e20d8", "4ea027e2-7261-44bf-954b-755fd4eb9bd0", "1a12c8f4-5a20-4f06-a688-064789c1e49c", "d85d83ca-5c46-4bb8-a329-8bba8c9520de", "649119cd-0502-4ccf-b18f-a0afd34bbf6c"], "language": "hi", "attemptId": "bac5073f-a1ba-4507-8a62-ce04badf3208", "responses": {"093d7d48-e4f2-4885-8224-68d9d08ee436": {"selected_option": "B"}, "1a12c8f4-5a20-4f06-a688-064789c1e49c": {"selected_option": "B"}, "1cf01722-f285-45c0-b34d-e129587e20d8": {"selected_option": "C"}, "3a3500f5-0cc0-4b79-b7c1-75893a36c60e": {"selected_option": "D"}, "4c0eb128-db69-4e45-99a6-601d91025c9b": {"selected_option": "B"}, "4c626274-7aba-4018-88ab-f6b842c431e2": {"selected_option": "A"}, "4ea027e2-7261-44bf-954b-755fd4eb9bd0": {"selected_option": "A"}, "649119cd-0502-4ccf-b18f-a0afd34bbf6c": {"selected_option": "C"}, "67f8d401-05ac-47fc-8280-79a63d868544": {"selected_option": "A"}, "832b674e-34e9-4bef-afdf-dd100620a6bc": {"selected_option": "C"}, "864f314f-744d-4602-8928-6398b079e166": {"selected_option": "A"}, "926bb60b-848c-45fc-a454-9d1a06b05784": {"selected_option": "A"}, "949b1414-7607-4bf5-9075-955ed477603b": {"selected_option": "C"}, "ba55c4ad-3ad6-477f-8162-1405414ac30b": {"selected_option": "C"}, "d4adf727-1059-4ba2-8de5-c8b7001ed30f": {"selected_option": "D"}, "d85d83ca-5c46-4bb8-a329-8bba8c9520de": {"selected_option": "B"}, "e16ac5b5-3a52-4fd4-9ba0-c146681d4f69": {"selected_option": "B"}}, "timeSpent": {"1a12c8f4-5a20-4f06-a688-064789c1e49c": 35, "1cf01722-f285-45c0-b34d-e129587e20d8": 33, "4ea027e2-7261-44bf-954b-755fd4eb9bd0": 16, "649119cd-0502-4ccf-b18f-a0afd34bbf6c": 12, "d85d83ca-5c46-4bb8-a329-8bba8c9520de": 36}, "updatedAt": "2026-11-14T04:41:49.632Z", "currentIndex": 16, "dropoffEvents": [{"at": "2026-11-14T04:39:04.482Z", "type": "pause", "section": "Geography", "questionId": "1cf01722-f285-45c0-b34d-e129587e20d8", "questionIndex": 12, "remainingSeconds": 1476}, {"at": "2026-11-14T04:39:59.201Z", "type": "pause", "section": "Geography", "questionId": "1a12c8f4-5a20-4f06-a688-064789c1e49c", "questionIndex": 14, "remainingSeconds": 1428}, {"at": "2026-11-14T04:41:20.529Z", "type": "pause", "section": "Geography", "questionId": "d85d83ca-5c46-4bb8-a329-8bba8c9520de", "questionIndex": 15, "remainingSeconds": 1383}], "violationCount": 0, "markedForReview": [], "remainingSeconds": 1364}', NULL, '2026-11-14 04:41:50.145925+00', '{}', NULL, 0.00, 0.00),
	('2ab9dc21-be3e-4ce3-b754-49b2188d94fd', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 09:55:24.4029+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 09:55:24.4029+00', NULL, 0, '{}', NULL, '2026-11-12 09:55:24.4029+00', '{}', NULL, 0.00, 0.00),
	('e4730332-9a1d-421d-b24e-cc271a408889', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 10:22:40.438824+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 10:22:40.438824+00', NULL, 0, '{}', NULL, '2026-11-12 10:22:40.438824+00', '{}', NULL, 0.00, 0.00),
	('2f7eb5c9-9710-45e4-a989-dd52550d7ad0', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 10:22:51.844215+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 10:22:51.844215+00', NULL, 0, '{}', NULL, '2026-11-12 10:22:51.844215+00', '{}', NULL, 0.00, 0.00),
	('c1283ee4-1412-44ab-8003-e408de436080', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 10:23:23.739162+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 10:23:23.739162+00', NULL, 0, '{}', NULL, '2026-11-12 10:23:23.739162+00', '{}', NULL, 0.00, 0.00),
	('8943c0b4-6033-4472-a744-297dcfe60abf', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 10:24:54.838908+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 10:24:54.838908+00', 1164, 16, '{"savedAt": "2026-11-12T10:53:22.656Z", "language": "hi", "responses": {"093d7d48-e4f2-4885-8224-68d9d08ee436": {"selected_option": "B"}, "1a12c8f4-5a20-4f06-a688-064789c1e49c": {"selected_option": "A"}, "1cf01722-f285-45c0-b34d-e129587e20d8": {"selected_option": "D"}, "3a3500f5-0cc0-4b79-b7c1-75893a36c60e": {"selected_option": "B"}, "4c0eb128-db69-4e45-99a6-601d91025c9b": {"selected_option": "B"}, "4c626274-7aba-4018-88ab-f6b842c431e2": {"selected_option": "A"}, "4ea027e2-7261-44bf-954b-755fd4eb9bd0": {"selected_option": "A"}, "649119cd-0502-4ccf-b18f-a0afd34bbf6c": {"selected_option": "C"}, "67f8d401-05ac-47fc-8280-79a63d868544": {"selected_option": "A"}, "832b674e-34e9-4bef-afdf-dd100620a6bc": {"selected_option": "C"}, "864f314f-744d-4602-8928-6398b079e166": {"selected_option": "A"}, "926bb60b-848c-45fc-a454-9d1a06b05784": {"selected_option": "A"}, "949b1414-7607-4bf5-9075-955ed477603b": {"selected_option": "C"}, "ba55c4ad-3ad6-477f-8162-1405414ac30b": {"selected_option": "B"}, "d4adf727-1059-4ba2-8de5-c8b7001ed30f": {"selected_option": "A"}, "d85d83ca-5c46-4bb8-a329-8bba8c9520de": {"selected_option": "D"}, "e16ac5b5-3a52-4fd4-9ba0-c146681d4f69": {"selected_option": "B"}}, "currentIndex": 16, "remainingSeconds": 1164, "visitedQuestions": ["d4adf727-1059-4ba2-8de5-c8b7001ed30f", "ba55c4ad-3ad6-477f-8162-1405414ac30b", "4c626274-7aba-4018-88ab-f6b842c431e2", "864f314f-744d-4602-8928-6398b079e166", "4c0eb128-db69-4e45-99a6-601d91025c9b", "926bb60b-848c-45fc-a454-9d1a06b05784", "949b1414-7607-4bf5-9075-955ed477603b", "093d7d48-e4f2-4885-8224-68d9d08ee436", "832b674e-34e9-4bef-afdf-dd100620a6bc", "e16ac5b5-3a52-4fd4-9ba0-c146681d4f69", "3a3500f5-0cc0-4b79-b7c1-75893a36c60e", "67f8d401-05ac-47fc-8280-79a63d868544", "1cf01722-f285-45c0-b34d-e129587e20d8", "4ea027e2-7261-44bf-954b-755fd4eb9bd0", "1a12c8f4-5a20-4f06-a688-064789c1e49c", "d85d83ca-5c46-4bb8-a329-8bba8c9520de", "649119cd-0502-4ccf-b18f-a0afd34bbf6c"]}', NULL, '2026-11-12 10:53:22.671+00', '{}', NULL, 0.00, 0.00),
	('4efa7279-bf16-4e7d-a4a1-6bfc6d5a4e34', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 11:08:13.519171+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 11:08:13.519171+00', NULL, 0, '{}', NULL, '2026-11-12 11:08:13.519171+00', '{}', NULL, 0.00, 0.00),
	('bc444bdc-f1ec-44b9-ad76-1f02bcb5474d', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 12:16:48.396987+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 12:16:48.396987+00', NULL, 0, '{}', NULL, '2026-11-12 12:16:48.396987+00', '{}', NULL, 0.00, 0.00),
	('04881450-3895-4bb7-b287-c54e5cd10e53', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'in_progress', '2026-11-12 12:18:16.87395+00', NULL, 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0.00, 0, '2026-11-12 12:18:16.87395+00', 1780, 1, '{"status": "in_progress", "testId": "89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb", "userId": "dced397e-5cc0-4fe0-801b-e5bdb1b8ef24", "answers": {"ba55c4ad-3ad6-477f-8162-1405414ac30b": "C", "d4adf727-1059-4ba2-8de5-c8b7001ed30f": "A"}, "visited": ["d4adf727-1059-4ba2-8de5-c8b7001ed30f", "ba55c4ad-3ad6-477f-8162-1405414ac30b"], "language": "hi", "attemptId": "04881450-3895-4bb7-b287-c54e5cd10e53", "responses": {"ba55c4ad-3ad6-477f-8162-1405414ac30b": {"selected_option": "C"}, "d4adf727-1059-4ba2-8de5-c8b7001ed30f": {"selected_option": "A"}}, "updatedAt": "2026-11-12T12:34:57.241Z", "currentIndex": 1, "markedForReview": [], "remainingSeconds": 1780}', NULL, '2026-11-12 12:34:57.241+00', '{}', NULL, 0.00, 0.00),
	('d9f84594-b72a-49f4-b880-c87d0d05c400', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'completed', '2026-11-12 17:02:23.954376+00', '2026-11-12 17:34:29.573269+00', 1925, 30, 3, 2, 1, 27, 0, 2.00, 30.00, 6.67, 0, '2026-11-12 17:02:23.954376+00', 1717, 2, '{"status": "in_progress", "testId": "89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb", "userId": "dced397e-5cc0-4fe0-801b-e5bdb1b8ef24", "answers": {"4c626274-7aba-4018-88ab-f6b842c431e2": "A", "ba55c4ad-3ad6-477f-8162-1405414ac30b": "C", "d4adf727-1059-4ba2-8de5-c8b7001ed30f": "B"}, "visited": ["d4adf727-1059-4ba2-8de5-c8b7001ed30f", "ba55c4ad-3ad6-477f-8162-1405414ac30b", "4c626274-7aba-4018-88ab-f6b842c431e2"], "language": "hi", "attemptId": "d9f84594-b72a-49f4-b880-c87d0d05c400", "responses": {"4c626274-7aba-4018-88ab-f6b842c431e2": {"selected_option": "A"}, "ba55c4ad-3ad6-477f-8162-1405414ac30b": {"selected_option": "C"}, "d4adf727-1059-4ba2-8de5-c8b7001ed30f": {"selected_option": "B"}}, "updatedAt": "2026-11-12T17:34:28.609Z", "currentIndex": 2, "markedForReview": [], "remainingSeconds": 1717}', NULL, '2026-11-12 17:34:28.61+00', '{}', '2026-11-12 17:34:29.573269+00', 2.00, 30.00),
	('76c07b6f-dae4-4e91-8886-82e5938c813e', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'completed', '2026-11-12 15:10:29.591496+00', '2026-11-12 16:31:34.653186+00', 4865, 30, 3, 3, 0, 27, 0, 3.00, 30.00, 10.00, 0, '2026-11-12 15:10:29.591496+00', 1664, 4, '{"status": "in_progress", "testId": "89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb", "userId": "dced397e-5cc0-4fe0-801b-e5bdb1b8ef24", "answers": {"4c0eb128-db69-4e45-99a6-601d91025c9b": "B", "4c626274-7aba-4018-88ab-f6b842c431e2": "A", "864f314f-744d-4602-8928-6398b079e166": "A"}, "visited": ["d4adf727-1059-4ba2-8de5-c8b7001ed30f", "ba55c4ad-3ad6-477f-8162-1405414ac30b", "4c626274-7aba-4018-88ab-f6b842c431e2", "864f314f-744d-4602-8928-6398b079e166", "4c0eb128-db69-4e45-99a6-601d91025c9b"], "language": "hi", "attemptId": "76c07b6f-dae4-4e91-8886-82e5938c813e", "responses": {"4c0eb128-db69-4e45-99a6-601d91025c9b": {"selected_option": "B"}, "4c626274-7aba-4018-88ab-f6b842c431e2": {"selected_option": "A"}, "864f314f-744d-4602-8928-6398b079e166": {"selected_option": "A"}}, "updatedAt": "2026-11-12T16:05:56.707Z", "currentIndex": 4, "markedForReview": [], "remainingSeconds": 1664}', NULL, '2026-11-12 16:05:56.708+00', '{}', '2026-11-12 16:31:34.653186+00', 3.00, 30.00),
	('4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 1, 'completed', '2026-11-12 17:34:40.877421+00', '2026-11-12 17:49:01.764451+00', 860, 30, 3, 1, 2, 27, 0, 1.00, 30.00, 3.33, 0, '2026-11-12 17:34:40.877421+00', 1727, 2, '{"status": "in_progress", "testId": "89d9f135-9d8b-4ec8-ac36-c2ba58fd8cdb", "userId": "dced397e-5cc0-4fe0-801b-e5bdb1b8ef24", "answers": {"4c626274-7aba-4018-88ab-f6b842c431e2": "D", "ba55c4ad-3ad6-477f-8162-1405414ac30b": "C", "d4adf727-1059-4ba2-8de5-c8b7001ed30f": "B"}, "visited": ["d4adf727-1059-4ba2-8de5-c8b7001ed30f", "ba55c4ad-3ad6-477f-8162-1405414ac30b", "4c626274-7aba-4018-88ab-f6b842c431e2"], "language": "hi", "attemptId": "4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26", "responses": {"4c626274-7aba-4018-88ab-f6b842c431e2": {"selected_option": "D"}, "ba55c4ad-3ad6-477f-8162-1405414ac30b": {"selected_option": "C"}, "d4adf727-1059-4ba2-8de5-c8b7001ed30f": {"selected_option": "B"}}, "updatedAt": "2026-11-12T17:48:58.055Z", "currentIndex": 2, "markedForReview": [], "remainingSeconds": 1727}', NULL, '2026-11-12 17:48:58.055+00', '{}', '2026-11-12 17:49:01.764451+00', 1.00, 30.00);


--
-- Data for Name: test_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."test_responses" ("id", "attempt_id", "question_id", "selected_answers", "is_marked_for_review", "is_correct", "marks_obtained", "time_spent_seconds", "created_at") VALUES
	('d2326bbf-500e-4c89-8a78-c55e396048ba', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'd4adf727-1059-4ba2-8de5-c8b7001ed30f', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('8d1fa236-9da6-4ee5-b496-f6ee8c10585b', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'ba55c4ad-3ad6-477f-8162-1405414ac30b', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('4eec881e-76b3-4aac-b3c7-cdf4440a5298', '76c07b6f-dae4-4e91-8886-82e5938c813e', '4c626274-7aba-4018-88ab-f6b842c431e2', '{A}', false, true, 1.00, 0, '2026-11-12 16:31:34.653186+00'),
	('6e6cfe30-ee74-4516-bea9-812d636d7e2f', '76c07b6f-dae4-4e91-8886-82e5938c813e', '864f314f-744d-4602-8928-6398b079e166', '{A}', false, true, 1.00, 0, '2026-11-12 16:31:34.653186+00'),
	('86a2bb5d-bbfd-4cc3-bbc9-71b90e3fea6f', '76c07b6f-dae4-4e91-8886-82e5938c813e', '4c0eb128-db69-4e45-99a6-601d91025c9b', '{B}', false, true, 1.00, 0, '2026-11-12 16:31:34.653186+00'),
	('8fe4eae5-7f82-4c2d-8daf-23d408208eeb', '76c07b6f-dae4-4e91-8886-82e5938c813e', '926bb60b-848c-45fc-a454-9d1a06b05784', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('5d710218-cae5-478a-9bfe-bf14a0a7ed11', '76c07b6f-dae4-4e91-8886-82e5938c813e', '949b1414-7607-4bf5-9075-955ed477603b', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('06304baa-66aa-4eda-b778-f7f13feb3edb', '76c07b6f-dae4-4e91-8886-82e5938c813e', '093d7d48-e4f2-4885-8224-68d9d08ee436', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('27962118-adf0-44e6-95d6-9a6de6c2adae', '76c07b6f-dae4-4e91-8886-82e5938c813e', '832b674e-34e9-4bef-afdf-dd100620a6bc', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('efac3707-7910-4f27-93ac-c8524a64cb0d', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'e16ac5b5-3a52-4fd4-9ba0-c146681d4f69', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('8b406379-0fae-4403-8aae-1bed53547130', '76c07b6f-dae4-4e91-8886-82e5938c813e', '3a3500f5-0cc0-4b79-b7c1-75893a36c60e', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('570d5389-7250-4ffa-ae6a-5ccdc06767e6', '76c07b6f-dae4-4e91-8886-82e5938c813e', '67f8d401-05ac-47fc-8280-79a63d868544', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('c23d0a79-8275-4fd0-95c7-79ba44c4aebb', '76c07b6f-dae4-4e91-8886-82e5938c813e', '1cf01722-f285-45c0-b34d-e129587e20d8', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('126cb875-5493-4371-98af-613d7f6eec88', '76c07b6f-dae4-4e91-8886-82e5938c813e', '4ea027e2-7261-44bf-954b-755fd4eb9bd0', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('076766cb-6f86-4e78-a095-82f2d9d6fa25', '76c07b6f-dae4-4e91-8886-82e5938c813e', '1a12c8f4-5a20-4f06-a688-064789c1e49c', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('b741e6d7-6012-4e0a-a74f-44316b7f11d2', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'd85d83ca-5c46-4bb8-a329-8bba8c9520de', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('0dc15056-fc85-4155-9b0e-ebd107371c63', '76c07b6f-dae4-4e91-8886-82e5938c813e', '649119cd-0502-4ccf-b18f-a0afd34bbf6c', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('8075c0e2-bf0a-4650-9e3f-a4000bee2f80', '76c07b6f-dae4-4e91-8886-82e5938c813e', '5b3a10eb-49cc-4b05-9499-87201ddec753', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('1caaaad1-6f8b-4b7f-a123-09ab0051991a', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'f842986d-efd4-4a6e-a87d-6398a09ecdd6', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('31a83ed5-3a2c-4792-93ff-b13ee0028837', '76c07b6f-dae4-4e91-8886-82e5938c813e', '2bb877b4-06e5-41dc-bf87-5e3b35051135', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('69c0befd-fc8b-44d3-88e1-58c48b4d1a4c', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'f947ad93-ed77-4e6d-998f-21bb9fe7faee', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('404a7d99-f623-4b27-93cf-4c8cdb57ee59', '76c07b6f-dae4-4e91-8886-82e5938c813e', '8ef137cc-9d97-4d74-b39d-4dec9620a872', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('d56b410b-d83e-41d2-8685-9690674efb1d', '76c07b6f-dae4-4e91-8886-82e5938c813e', '30804cb8-b753-409e-a8f7-8af2412d5787', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('b5c1699b-a7f3-4587-94a3-6df1a5752dca', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'e62aeb94-acf0-44d1-a65d-e1306c7dc7b7', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('0903c4ad-2b85-4fc4-9db3-10bcc1c956db', '76c07b6f-dae4-4e91-8886-82e5938c813e', '42b69a38-2e9e-4218-9fab-bf61006d1484', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('6ac18b61-a0eb-4f1a-935e-ee7c6a1ee06d', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'fa39dea3-1275-477e-b48c-d45b2ff68297', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('b4a94332-2013-458b-90cf-e257c9848360', '76c07b6f-dae4-4e91-8886-82e5938c813e', '383d50b1-1296-49b7-958e-193e6c033cd0', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('3f33d2c6-fe55-48d7-b8bd-9f0ede2efa49', '76c07b6f-dae4-4e91-8886-82e5938c813e', '5bb9a9c9-6396-4a0a-b1b1-af72a5112f18', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('a8fd985a-da18-493f-8896-33d306a9acf4', '76c07b6f-dae4-4e91-8886-82e5938c813e', 'a9f12081-fa3e-4a36-83f4-58a234e393cd', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('a05dc0eb-dfd5-414d-815e-8ed5451b9c65', '76c07b6f-dae4-4e91-8886-82e5938c813e', '45d30060-ac1a-4cc0-8c4e-a0229b125e29', '{}', false, false, 0.00, 0, '2026-11-12 16:31:34.653186+00'),
	('b80259ee-a95e-4ca1-bed7-513365739a7c', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'd4adf727-1059-4ba2-8de5-c8b7001ed30f', '{B}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('ed9cfbfe-db7e-4d6e-9b04-bd0c6d50235a', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'ba55c4ad-3ad6-477f-8162-1405414ac30b', '{C}', false, true, 1.00, 0, '2026-11-12 17:34:29.573269+00'),
	('d035976f-c4d1-4bd3-b88d-e2a6635e407b', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '4c626274-7aba-4018-88ab-f6b842c431e2', '{A}', false, true, 1.00, 0, '2026-11-12 17:34:29.573269+00'),
	('784c03f0-b069-4a3d-b50a-e42719732c85', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '864f314f-744d-4602-8928-6398b079e166', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('397fb9a5-42ce-456a-8c95-d91a18c1e0ec', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '4c0eb128-db69-4e45-99a6-601d91025c9b', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('746ecfb2-3295-4d70-ace5-d1ef35155712', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '926bb60b-848c-45fc-a454-9d1a06b05784', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('368213cc-aa49-4d3a-b3b5-5953187e0bf4', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '949b1414-7607-4bf5-9075-955ed477603b', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('b2560e7f-8235-4568-8149-f6d92cf7f3a5', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '093d7d48-e4f2-4885-8224-68d9d08ee436', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('77bd2467-942f-4fd4-8191-3a10ab12377d', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '832b674e-34e9-4bef-afdf-dd100620a6bc', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('1b025021-b9fc-4977-98f2-7a27764f8b66', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'e16ac5b5-3a52-4fd4-9ba0-c146681d4f69', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('779c0d0c-770c-446e-b1c6-194076f10416', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '3a3500f5-0cc0-4b79-b7c1-75893a36c60e', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('c849ebf3-bce8-4ede-bc7a-c039e18ab74d', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '67f8d401-05ac-47fc-8280-79a63d868544', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('f051124d-5e92-49e4-b56b-e5ed4c7d54fd', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '1cf01722-f285-45c0-b34d-e129587e20d8', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('08bb5017-c497-47ae-97d9-76571827da71', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '4ea027e2-7261-44bf-954b-755fd4eb9bd0', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('fde6069e-d01e-423f-ba60-382338a2d36d', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '1a12c8f4-5a20-4f06-a688-064789c1e49c', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('8f19b826-1cda-49af-a92d-68fa84c46211', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'd85d83ca-5c46-4bb8-a329-8bba8c9520de', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('ddcb8919-b9eb-4bc8-988d-feee06cc2afd', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '649119cd-0502-4ccf-b18f-a0afd34bbf6c', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('0659be71-53a5-43d6-8fc5-63f81974f893', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '5b3a10eb-49cc-4b05-9499-87201ddec753', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('0257d3ab-08c7-409f-a364-5a31e4f9f3ed', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'f842986d-efd4-4a6e-a87d-6398a09ecdd6', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('fb2e44bf-8a81-4e05-b6df-37d2c6b67044', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '2bb877b4-06e5-41dc-bf87-5e3b35051135', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('61513023-8ed4-4554-93e2-5abba52b500f', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'f947ad93-ed77-4e6d-998f-21bb9fe7faee', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('930ccbca-29c6-405a-9d19-c471bfc12f69', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '8ef137cc-9d97-4d74-b39d-4dec9620a872', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('351069e6-4bc5-4625-be79-7fed029de844', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '30804cb8-b753-409e-a8f7-8af2412d5787', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('fc423f57-a745-409d-b798-695dee511907', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'e62aeb94-acf0-44d1-a65d-e1306c7dc7b7', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('28db84b3-2f21-4fd4-bfa4-e08925e914bc', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '42b69a38-2e9e-4218-9fab-bf61006d1484', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('ae3366bf-6445-430e-9038-aa0251919996', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'fa39dea3-1275-477e-b48c-d45b2ff68297', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('68e908a5-9422-4783-8060-ffe5f099be53', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '383d50b1-1296-49b7-958e-193e6c033cd0', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('5058b552-36f1-42a3-9cb2-70b4eda38097', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '5bb9a9c9-6396-4a0a-b1b1-af72a5112f18', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('832e0c92-997e-4638-8d3e-d61f7a942061', 'd9f84594-b72a-49f4-b880-c87d0d05c400', 'a9f12081-fa3e-4a36-83f4-58a234e393cd', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('a823bc30-9935-4f20-9a87-48d80a0d042b', 'd9f84594-b72a-49f4-b880-c87d0d05c400', '45d30060-ac1a-4cc0-8c4e-a0229b125e29', '{}', false, false, 0.00, 0, '2026-11-12 17:34:29.573269+00'),
	('690dd667-4790-4688-878a-3766b96339e5', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'd4adf727-1059-4ba2-8de5-c8b7001ed30f', '{B}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('f97836d2-408f-4172-8a32-01f91c757ca9', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'ba55c4ad-3ad6-477f-8162-1405414ac30b', '{C}', false, true, 1.00, 0, '2026-11-12 17:49:01.764451+00'),
	('7dd8a8bf-52fb-47d5-b847-a9c91f6c88a0', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '4c626274-7aba-4018-88ab-f6b842c431e2', '{D}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('20f77dcf-a839-46ed-9a50-8c346c12f0da', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '864f314f-744d-4602-8928-6398b079e166', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('554380ae-7092-4378-a832-b03f5c9ef692', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '4c0eb128-db69-4e45-99a6-601d91025c9b', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('6bb37000-4a51-4e4a-9d13-d787cb376f58', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '926bb60b-848c-45fc-a454-9d1a06b05784', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('ef9d5639-b402-4140-b332-2c75b618e42f', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '949b1414-7607-4bf5-9075-955ed477603b', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('7b503d81-9b53-4a36-b8b4-71da479be56e', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '093d7d48-e4f2-4885-8224-68d9d08ee436', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('7cbc05ef-26fa-4584-a244-ff7ab5a9149c', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '832b674e-34e9-4bef-afdf-dd100620a6bc', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('6bc58033-127a-4880-9778-0a5fb9f7be56', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'e16ac5b5-3a52-4fd4-9ba0-c146681d4f69', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('b183d187-68bf-4b0a-b4be-60e11bca9dc0', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '3a3500f5-0cc0-4b79-b7c1-75893a36c60e', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('fdb400af-cc37-448a-a734-c1b0b6af70a6', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '67f8d401-05ac-47fc-8280-79a63d868544', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('db044bc5-b1a4-44c4-b8c6-0da0b8871f10', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '1cf01722-f285-45c0-b34d-e129587e20d8', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('660702f2-cb40-4ec5-ac55-bc392dcc277d', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '4ea027e2-7261-44bf-954b-755fd4eb9bd0', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('0e6bf357-f37c-4cd5-aca0-66524e97a94e', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '1a12c8f4-5a20-4f06-a688-064789c1e49c', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('819e9f66-3777-4fa1-a9f5-3368426c1c73', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'd85d83ca-5c46-4bb8-a329-8bba8c9520de', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('565bf30a-cdb1-4a78-875c-6e82ee2891a6', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '649119cd-0502-4ccf-b18f-a0afd34bbf6c', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('2f5bd270-15b0-44db-b2cd-3082cf4f64f8', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '5b3a10eb-49cc-4b05-9499-87201ddec753', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('0f4a4e31-9fff-47dc-b6ad-de9e9402b601', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'f842986d-efd4-4a6e-a87d-6398a09ecdd6', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('ddbd9348-8979-4f64-b3d1-d28e0fee1673', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '2bb877b4-06e5-41dc-bf87-5e3b35051135', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('fed1acee-563e-44d4-ad43-4916fb512f4e', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'f947ad93-ed77-4e6d-998f-21bb9fe7faee', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('f5e4e27d-8e22-4b86-a86a-dd7055ff277b', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '8ef137cc-9d97-4d74-b39d-4dec9620a872', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('1a303bcc-1010-43eb-86c7-aeca1354dc08', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '30804cb8-b753-409e-a8f7-8af2412d5787', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('65065a33-4a40-4f40-84f6-d80aaed3e79f', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'e62aeb94-acf0-44d1-a65d-e1306c7dc7b7', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('c686c95e-7f2f-42ab-b499-add940804983', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '42b69a38-2e9e-4218-9fab-bf61006d1484', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('acf163f7-5fb3-4011-869d-f7ddb733309f', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'fa39dea3-1275-477e-b48c-d45b2ff68297', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('c03b0b71-5485-4457-877c-69f7bbfa2c19', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '383d50b1-1296-49b7-958e-193e6c033cd0', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('1f208275-ddc6-4751-8f2f-b467304ef02f', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '5bb9a9c9-6396-4a0a-b1b1-af72a5112f18', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('d6cc39a7-224e-4b52-bd86-0a11a65c6bc6', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', 'a9f12081-fa3e-4a36-83f4-58a234e393cd', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00'),
	('0b98a69a-0b3e-4615-8697-79d585f404b9', '4d1fc6f4-2e47-4bfe-baff-f7b3bcd51c26', '45d30060-ac1a-4cc0-8c4e-a0229b125e29', '{}', false, false, 0.00, 0, '2026-11-12 17:49:01.764451+00');


--
-- Data for Name: user_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_access" ("id", "user_id", "item_type", "item_id", "order_id", "grant_source", "granted_at", "expires_at", "status", "is_active", "starts_at", "granted_by", "reason", "created_at", "updated_at") VALUES
	('358f88ec-5e06-49a6-99b1-18ab09a523d2', 'dced397e-5cc0-4fe0-801b-e5bdb1b8ef24', 'exam', '3af6407d-520a-40cd-943f-66ddbddb84b4', NULL, 'purchase', '2026-11-12 17:01:20.98482+00', NULL, 'active', true, '2026-11-12 17:01:20.476+00', NULL, NULL, '2026-11-12 17:01:20.98482+00', '2026-11-12 17:01:20.476+00');


--
-- PostgreSQL database dump complete
--

-- \unrestrict ULPIPwwEXWevvEpJh60kEdfuXQulCMZcpKyFKq4z2cSomvWNwQF7gxVOePZ62CN

RESET ALL;
