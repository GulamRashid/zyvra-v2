import { useEffect, useMemo, useState } from 'react';
import { Check, Coins, Copy, Gift, MessageCircle, RefreshCw, Send, Share2, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ensureReferralCode, getReferralSettings } from '../../lib/referrals';

export default function ShareAndEarnCard({ className = '' }) {
  const { user, profile, supabase } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [code, setCode] = useState(String(profile?.referral_code || user?.referral_code || ''));
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState({ enabled: true, referrerCoins: 50, referredCoins: 20 });

  useEffect(() => {
    const existing = profile?.referral_code || (user?.referral_code || '');
    if (existing) {
      setCode(existing);
    } else if (user?.id && supabase) {
      setGenerating(true);
      ensureReferralCode(supabase, user.id).then((generated) => {
        if (generated) setCode(generated);
      }).catch((err) => console.warn('Could not auto-generate referral code:', err))
      .finally(() => setGenerating(false));
    }
  }, [profile?.referral_code, user?.referral_code, user?.id, supabase]);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    let active = true;

    // Load referral history & reward settings
    Promise.all([
      supabase.from('referrals').select('id, referrer_coins_awarded, created_at').eq('referrer_id', user.id),
      getReferralSettings(supabase)
    ]).then(([refResult, settingsData]) => {
      if (!active) return;
      if (!refResult.error && refResult.data) {
        setReferrals(refResult.data);
      }
      if (settingsData) {
        setSettings(settingsData);
      }
    }).catch((err) => console.warn('Could not load user referrals:', err));

    return () => { active = false; };
  }, [supabase, user?.id]);

  const activeCode = String(code || profile?.referral_code || user?.referral_code || '');
  const hasRealCode = Boolean(code || profile?.referral_code || user?.referral_code);

  const handleGenerateCode = async () => {
    if (!user?.id || !supabase) return;
    setGenerating(true);
    try {
      const generated = await ensureReferralCode(supabase, user.id);
      if (generated) setCode(generated);
    } catch (error) {
      console.warn('Could not generate referral code:', error);
    } finally {
      setGenerating(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (!activeCode) return '';
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://zyvra.in';
    return `${base}/auth?ref=${activeCode}`;
  }, [activeCode]);

  const invitedCount = Number(referrals?.length || 0);
  const coinsEarned = Number((referrals || []).reduce((acc, r) => acc + Number(r?.referrer_coins_awarded || settings?.referrerCoins || 50), 0) || 0);

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.warn('Could not copy invite link:', error);
    }
  };

  const copyCodeOnly = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch (error) {
      console.warn('Could not copy referral code:', error);
    }
  };

  const [shareFeedback, setShareFeedback] = useState('');

  const inviteMessage = `Zyvra par mere saath exams ki taiyari karein! 🚀\nUse my referral code ${activeCode} to get free bonus coins on signup:\n${shareUrl}`;

  const shareViaWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareViaTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Zyvra par exam preparation ke liye judein! Use referral code: ${activeCode}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Zyvra & Earn Coins',
          text: inviteMessage,
          url: shareUrl
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share error:', err);
        }
      }
    }
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setShareFeedback('Invite message clipboard me copy ho gaya!');
      setTimeout(() => setShareFeedback(''), 2500);
    } catch {
      setShareFeedback('Share message copy nahi ho paya.');
      setTimeout(() => setShareFeedback(''), 2500);
    }
  };

  if (!settings || settings.enabled === false) return null;

  return (
    <article className={`p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-500 shrink-0">
          <Gift size={20} />
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1.5 tracking-wider">
            <Sparkles size={12} /> Share & Earn Coins
          </div>
          <h2 className="text-base font-black dark:text-white text-slate-900">
            Invite Friends & Earn Free Coins
          </h2>
          <p className="text-xs dark:text-slate-400 text-slate-600 font-medium mt-0.5 leading-relaxed">
            Give your friends <strong className="dark:text-white text-slate-900">+{settings.referredCoins || 20} coins</strong> on signup and get <strong className="text-amber-500 dark:text-amber-400">+{settings.referrerCoins || 50} coins</strong> credited to your wallet for each friend who joins!
          </p>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-700/50 border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block">
              Your Invite Code
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <strong className="font-mono text-base font-black dark:text-amber-400 text-amber-600 tracking-wider">
                {activeCode || (generating ? 'Generating...' : 'Loading code...')}
              </strong>
              {hasRealCode ? (
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors"
                  onClick={copyCodeOnly}
                  title="Copy code"
                >
                  {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              ) : (
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg bg-amber-400 text-black text-[11px] font-black shadow-glowGold flex items-center gap-1"
                  onClick={handleGenerateCode}
                  disabled={generating}
                >
                  <RefreshCw size={11} className={generating ? 'animate-spin' : ''} />
                  <span>{generating ? 'Generating…' : 'Generate Code'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            <button
              type="button"
              className="px-3 py-2 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors min-h-[38px] shadow-xs hover:border-indigo-500"
              onClick={copyLink}
              disabled={!shareUrl}
              title="Copy invite URL"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" /> <span>Link copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} /> <span>Copy link</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors min-h-[38px]"
              onClick={handleNativeShare}
              title="Share via device"
            >
              <Share2 size={14} /> <span>Share</span>
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors min-h-[38px]"
              onClick={shareViaWhatsApp}
              title="Share on WhatsApp"
            >
              <MessageCircle size={14} /> <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors min-h-[38px]"
              onClick={shareViaTelegram}
              title="Share on Telegram"
            >
              <Send size={14} /> <span>Telegram</span>
            </button>
          </div>
        </div>

        {shareFeedback && (
          <div className="text-[11px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-center">
            {shareFeedback}
          </div>
        )}
      </div>

      {/* Milestone Counters */}
      <div className="flex items-center justify-around p-2.5 rounded-xl dark:bg-slate-900/40 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-amber-500" />
          <span className="dark:text-slate-300 text-slate-700">
            Invited: <strong className="dark:text-white text-slate-900 font-extrabold">{invitedCount}</strong>
          </span>
        </div>
        <div className="w-px h-4 dark:bg-slate-700 bg-slate-300" />
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-amber-500" />
          <span className="dark:text-slate-300 text-slate-700">
            Coins: <strong className="text-amber-500 dark:text-amber-400 font-extrabold">+{coinsEarned.toLocaleString()}</strong>
          </span>
        </div>
      </div>
    </article>
  );
}
