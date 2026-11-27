import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';

export default function AdminLaunchChecklist() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState([]);
  const [cleanupTargets, setCleanupTargets] = useState({ duplicateAccounts: [], testAccounts: [], botResolvedThreads: [] });

  const runAudit = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

      const [
        testsRes,
        testQuestionsRes,
        questionsCountRes,
        pubQuestionsRes,
        draftQuestionsRes,
        orphanQuestionsRes,
        walletsRes,
        coinTxRes,
        pendingOrdersRes,
        qotdRes,
        bannersRes,
        profilesRes
      ] = await Promise.all([
        supabase.from('tests').select('id, title, status'),
        supabase.from('test_questions').select('test_id'),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('questions').select('*', { count: 'exact', head: true }).is('chapter_id', null),
        supabase.from('coin_wallets').select('balance'),
        supabase.from('coin_transactions').select('*', { count: 'exact', head: true }),
        supabase.from('payment_orders').select('id, amount, status').eq('status', 'pending'),
        supabase.from('daily_questions').select('id, active_date').eq('active_date', todayIST),
        supabase.from('promotional_banners').select('id, title, is_active, text_color, overlay_opacity, alt_text').eq('is_active', true),
        supabase.from('profiles').select('id, full_name, email, mobile, created_at').limit(1000)
      ]);

      // 1. Empty Published tests
      const qCountByTest = new Map();
      (testQuestionsRes.data || []).forEach((row) => {
        qCountByTest.set(row.test_id, (qCountByTest.get(row.test_id) || 0) + 1);
      });
      const publishedTests = (testsRes.data || []).filter((t) => t.status === 'published');
      const emptyPublished = publishedTests.filter((t) => (qCountByTest.get(t.id) || 0) === 0);

      // 2. Qbank reconciliation
      const totalQ = questionsCountRes.count ?? 0;
      const pubQ = pubQuestionsRes.count ?? 0;
      const draftQ = draftQuestionsRes.count ?? 0;
      const orphanQ = orphanQuestionsRes.count ?? 0;

      // 3. Coins ledger
      const totalCoins = (walletsRes.data || []).reduce((s, w) => s + (Number(w.balance) || 0), 0);
      const txCount = coinTxRes.count ?? 0;

      // 4. Pending orders
      const pendingOrders = pendingOrdersRes.data || [];

      // 5. QotD scheduled for today
      const qotdTodayCount = (qotdRes.data || []).length;

      // 6. Banners check
      const activeBanners = bannersRes.data || [];
      const bannerIssues = activeBanners.filter((b) => !b.alt_text || !b.text_color);

      // 7. Duplicate & test accounts (list only, never auto-delete)
      const profiles = profilesRes.data || [];
      const phoneMap = new Map();
      profiles.forEach((p) => {
        const digits = String(p.mobile || '').replace(/\D/g, '').slice(-10);
        if (digits.length === 10) {
          if (!phoneMap.has(digits)) phoneMap.set(digits, []);
          phoneMap.get(digits).push(p);
        }
      });
      const duplicateAccounts = Array.from(phoneMap.entries())
        .filter(([, list]) => list.length > 1)
        .flatMap(([phone, list]) => list.map((u) => ({ ...u, duplicatePhone: phone })));
      const testAccounts = profiles.filter((p) =>
        /test|demo|dummy|fake/i.test(`${p.full_name || ''} ${p.email || ''}`)
      );

      setCleanupTargets({ duplicateAccounts, testAccounts, botResolvedThreads: [] });

      setChecks([
        {
          id: 'empty-tests',
          title: 'Empty Published Tests',
          ok: emptyPublished.length === 0,
          summary: emptyPublished.length === 0
            ? `All ${publishedTests.length} published tests have questions.`
            : `${emptyPublished.length} of ${publishedTests.length} published tests have 0 questions.`,
          to: '/admin/tests'
        },
        {
          id: 'qbank-reconcile',
          title: 'Question Bank Reconciliation',
          ok: totalQ > 0 && orphanQ === 0,
          summary: `Total: ${totalQ.toLocaleString()} · Published: ${pubQ.toLocaleString()} · Draft: ${draftQ.toLocaleString()} · Unlinked/Orphan: ${orphanQ.toLocaleString()}`,
          to: '/admin/qbank'
        },
        {
          id: 'coins-ledger',
          title: 'Coins Ledger & Circulation',
          ok: totalCoins === 0 || txCount > 0,
          summary: `${totalCoins.toLocaleString()} coins in circulation across ${txCount.toLocaleString()} ledger transaction(s).`,
          to: '/admin/coins'
        },
        {
          id: 'pending-orders',
          title: 'Stuck PENDING Payment Orders',
          ok: pendingOrders.length === 0,
          summary: pendingOrders.length === 0
            ? 'No stuck PENDING payment orders.'
            : `${pendingOrders.length} PENDING order(s) require verification or expiry.`,
          to: '/admin/orders'
        },
        {
          id: 'qotd-today',
          title: 'Question of the Day (IST Today)',
          ok: qotdTodayCount > 0,
          summary: qotdTodayCount > 0
            ? `${qotdTodayCount} QotD scheduled for ${todayIST}.`
            : `No QotD scheduled for ${todayIST} yet (optional until launch).`,
          to: '/admin/engagement'
        },
        {
          id: 'banner-contrast',
          title: 'Dashboard Banner Contrast & Alt Text',
          ok: activeBanners.length > 0 && bannerIssues.length === 0,
          summary: activeBanners.length === 0
            ? 'No active banners published.'
            : bannerIssues.length === 0
              ? `${activeBanners.length} active banner(s) have alt text and text-color configured.`
              : `${bannerIssues.length} active banner(s) missing alt text or text-color config.`,
          to: '/admin/engagement'
        },
        {
          id: 'test-accounts',
          title: 'Duplicate & Test Accounts Review',
          ok: duplicateAccounts.length === 0 && testAccounts.length === 0,
          summary: `${duplicateAccounts.length} duplicate-phone account(s) and ${testAccounts.length} test-named account(s) tagged below for manual review.`,
          to: '/admin/users'
        }
      ]);
    } catch (err) {
      console.warn('Launch checklist audit error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const passedCount = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">PRE-LAUNCH VERIFICATION</div>
          <h1>Launch Readiness Checklist</h1>
          <p>Live audit of tests, question bank, coins ledger, pending orders, banners, and test accounts tagged for cleanup.</p>
        </div>
        <button type="button" onClick={runAudit} disabled={loading} className="button button-outline">
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Re-run Audit
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : (
        <>
          <div className="panel-card p-5 flex items-center justify-between">
            <div>
              <div className="eyebrow">OVERALL READINESS</div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {passedCount} / {checks.length} Checks Passing
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${passedCount === checks.length ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
              {passedCount === checks.length ? 'Ready to Launch' : 'Action Recommended'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checks.map((item) => (
              <div key={item.id} className="panel-card p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {item.ok ? (
                    <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.summary}</p>
                  </div>
                </div>
                <Link
                  to={item.to}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white shrink-0"
                >
                  Open <ExternalLink size={12} />
                </Link>
              </div>
            ))}
          </div>

          <section className="panel-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-500" />
              <div>
                <div className="eyebrow">MANUAL CLEANUP LIST (NOT AUTO-DELETED)</div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Accounts Tagged for Pre-Launch Review
                </h2>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Duplicate and test accounts are listed here for your review and are never deleted automatically. Use Users &amp; Access to merge duplicates.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <strong className="block text-slate-900 dark:text-white">Duplicate Phone Accounts ({cleanupTargets.duplicateAccounts.length})</strong>
                {cleanupTargets.duplicateAccounts.length === 0 ? (
                  <span className="text-slate-400">None detected.</span>
                ) : (
                  <ul className="space-y-1">
                    {cleanupTargets.duplicateAccounts.map((u) => (
                      <li key={u.id} className="text-slate-600 dark:text-slate-300">
                        • {u.full_name || 'Student'} ({u.email || u.id.slice(0, 8)}) — +91 {u.duplicatePhone}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <strong className="block text-slate-900 dark:text-white">Test-Named Accounts ({cleanupTargets.testAccounts.length})</strong>
                {cleanupTargets.testAccounts.length === 0 ? (
                  <span className="text-slate-400">None detected.</span>
                ) : (
                  <ul className="space-y-1">
                    {cleanupTargets.testAccounts.map((u) => (
                      <li key={u.id} className="text-slate-600 dark:text-slate-300">
                        • {u.full_name || 'Student'} ({u.email || u.id.slice(0, 8)})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
