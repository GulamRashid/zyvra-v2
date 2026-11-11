import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, MessageCircle, RefreshCw, Share2, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ensureReferralCode, getReferralSettings } from '../../lib/referrals';

export default function ShareAndEarnCard({ className = '' }) {
  const { user, profile, supabase } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [code, setCode] = useState(profile?.referral_code || user?.referral_code || '');
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState({ enabled: true, referrerCoins: 50, referredCoins: 20 });

  useEffect(() => {
    const existing = profile?.referral_code || user?.referral_code;
    if (existing) {
      setCode(existing);
    } else if (user?.id && supabase) {
      ensureReferralCode(supabase, user.id).then((generated) => {
        if (generated) setCode(generated);
      }).catch((err) => console.warn('Could not auto-generate referral code:', err));
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

  const activeCode = code || profile?.referral_code || user?.referral_code || 'Z-INVITE';
  const hasRealCode = Boolean(code || profile?.referral_code || user?.referral_code);

  const handleGenerateCode = async () => {
    if (!user?.id || !supabase) {
      setCode('Z-INVITE');
      return;
    }
    setGenerating(true);
    try {
      const generated = await ensureReferralCode(supabase, user.id);
      setCode(generated || 'Z-INVITE');
    } catch {
      setCode('Z-INVITE');
    } finally {
      setGenerating(false);
    }
  };

  const shareUrl = useMemo(() => {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://zyvra-v2.vercel.app';
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
    } catch {
      // Fallback
    }
  };

  const copyCodeOnly = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      // Fallback
    }
  };

  const shareViaWhatsApp = () => {
    const message = `Join Zyvra for exam preparation and get free coins for test series! Use my code ${activeCode}: ${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!settings || settings.enabled === false) return null;

  return (
    <article className={`share-earn-card panel-card ${className}`}>
      <div className="share-earn-header">
        <div className="share-earn-icon">
          <Gift size={24} />
        </div>
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <Sparkles size={13} /> SHARE & EARN COINS
          </div>
          <h2>Invite Friends & Earn Free Coins</h2>
          <p>
            Give your friends <strong>+{settings.referredCoins || 20} coins</strong> on signup and get <strong>+{settings.referrerCoins || 50} coins</strong> credited to your wallet for each friend who joins!
          </p>
        </div>
      </div>

      <div className="share-earn-code-box">
        <div className="referral-code-display">
          <span className="code-label">YOUR INVITE CODE</span>
          <div className="code-value-row">
            <strong className="referral-code-text">{activeCode}</strong>
            <button
              type="button"
              className="icon-button copy-code-btn"
              onClick={copyCodeOnly}
              title="Copy code"
            >
              {copiedCode ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            </button>
            {!hasRealCode && (
              <button
                type="button"
                className="button button-small button-gold"
                onClick={handleGenerateCode}
                disabled={generating}
                style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: '30px' }}
              >
                <RefreshCw size={12} className={generating ? 'spin' : ''} /> {generating ? 'Generating…' : 'Generate Code'}
              </button>
            )}
          </div>
        </div>

        <div className="share-earn-actions">
          <button
            type="button"
            className="button button-outline copy-link-btn min-h-[44px]"
            onClick={copyLink}
            disabled={!shareUrl}
          >
            {copied ? (
              <>
                <Check size={15} className="text-emerald-400" /> Link copied!
              </>
            ) : (
              <>
                <Copy size={15} /> Copy invite link
              </>
            )}
          </button>

          <button
            type="button"
            className="button whatsapp-share-btn min-h-[44px]"
            onClick={shareViaWhatsApp}
          >
            <MessageCircle size={16} /> Share via WhatsApp
          </button>
        </div>
      </div>

      {/* Milestone Counters */}
      <div className="share-earn-milestones">
        <div className="milestone-item">
          <Users size={16} className="text-amber-400" />
          <span>Invited friends: <strong>{invitedCount}</strong></span>
        </div>
        <div className="milestone-divider" />
        <div className="milestone-item">
          <Coins size={16} className="text-amber-400" />
          <span>Coins earned: <strong>+{coinsEarned.toLocaleString()}</strong></span>
        </div>
      </div>
    </article>
  );
}
