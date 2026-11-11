import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, MessageCircle, Share2, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ensureReferralCode, getReferralSettings } from '../../lib/referrals';

export default function ShareAndEarnCard({ className = '' }) {
  const { user, profile, supabase } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [code, setCode] = useState(profile?.referral_code || '');
  const [settings, setSettings] = useState({ enabled: true, referrerCoins: 50, referredCoins: 20 });

  useEffect(() => {
    if (profile?.referral_code) {
      setCode(profile.referral_code);
    } else if (user && supabase) {
      ensureReferralCode(supabase, user.id).then((generated) => {
        if (generated) setCode(generated);
      });
    }
  }, [profile?.referral_code, user, supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
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
  }, [supabase, user]);

  const shareUrl = useMemo(() => {
    if (!code) return '';
    const base = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://zyvra-v2.vercel.app';
    return `${base}/auth?ref=${code}`;
  }, [code]);

  const invitedCount = referrals.length;
  const coinsEarned = referrals.reduce((acc, r) => acc + Number(r.referrer_coins_awarded || settings.referrerCoins), 0);

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
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      // Fallback
    }
  };

  const shareViaWhatsApp = () => {
    if (!code) return;
    const message = `Join Zyvra for exam preparation and get free coins for test series! Use my code ${code}: ${shareUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!settings.enabled) return null;

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
            Give your friends <strong>+{settings.referredCoins} coins</strong> on signup and get <strong>+{settings.referrerCoins} coins</strong> credited to your wallet for each friend who joins!
          </p>
        </div>
      </div>

      <div className="share-earn-code-box">
        <div className="referral-code-display">
          <span className="code-label">YOUR INVITE CODE</span>
          <div className="code-value-row">
            <strong className="referral-code-text">{code || 'Generating…'}</strong>
            <button
              type="button"
              className="icon-button copy-code-btn"
              onClick={copyCodeOnly}
              title="Copy code"
              disabled={!code}
            >
              {copiedCode ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            </button>
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
            disabled={!code}
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
