import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigurationError } from '../lib/supabase';
import { useThemeLanguage } from './ThemeLanguageContext';
import { ensureReferralCode, processReferralAward } from '../lib/referrals';
import { getFriendlyErrorMessage } from '../lib/errors';

const AuthContext = createContext(null);
const ACCOUNT_QUERY_TIMEOUT_MS = 7000;

function withTimeout(request, label) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ACCOUNT_QUERY_TIMEOUT_MS);
    Promise.resolve(request).then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); }
    );
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [coinBalance, setCoinBalance] = useState(0);
  const [accountAccess, setAccountAccess] = useState({ userId: null, loading: Boolean(supabase), ready: false, isPremium: false, unlockedCount: 0, validTill: 'Free plan' });
  const [loading, setLoading] = useState(Boolean(supabase));
  const [guest, setGuest] = useState(false);
  const [guestDemoEnabled, setGuestDemoEnabled] = useState(false);
  const { setTheme, setLanguage } = useThemeLanguage();
  const isHydratedRef = useRef(false);
  const userRef = useRef(null);

  const loadAccount = useCallback(async (activeSession) => {
    if (!activeSession?.user || !supabase) {
      setProfile(null);
      setCoinBalance(0);
      setAccountAccess({ userId: null, loading: false, ready: true, isPremium: false, unlockedCount: 0, validTill: 'Free plan' });
      return;
    }
    const userId = activeSession.user.id;
    setProfileError('');
    setAccountAccess((current) => current.userId === userId && current.ready
      ? { ...current, loading: true }
      : { userId, loading: true, ready: false, isPremium: false, unlockedCount: 0, validTill: 'Free plan' });
    const results = await Promise.allSettled([
      withTimeout(supabase.from('profiles').select('account_status,avatar_url,created_at,current_streak,daily_goal_progress,daily_goal_target,daily_goal_type,email,email_verified,full_name,id,last_active_date,mobile,mobile_verified,onboarding_completed,preferred_language,referral_code,role,target_exams,theme,updated_at').eq('id', userId).maybeSingle(), 'Profile lookup'),
      withTimeout(supabase.from('coin_wallets').select('balance').eq('user_id', userId).maybeSingle(), 'Coin balance lookup'),
      // `user_access` stores the active flag as `is_active`; selecting the
      // legacy/nonexistent `active` column makes PostgREST reject the whole
      // query and leaves every profile stuck in “access status unavailable”.
      withTimeout(supabase.from('user_access').select('is_active,status,expires_at').eq('user_id', userId), 'Account access lookup')
    ]);
    if (userRef.current !== userId) return;
    const profileResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const walletResult = results[1].status === 'fulfilled' ? results[1].value : null;
    const accessResult = results[2].status === 'fulfilled' ? results[2].value : null;
    if (!profileResult || profileResult.error) {
      const error = profileResult?.error || results[0].reason;
      console.error('Unable to load profile data:', error);
      setProfile(null);
      setProfileError(getFriendlyErrorMessage(error, 'Profile data abhi load nahi ho paya.'));
    } else {
      setProfile(profileResult.data);
    }
    if (!walletResult || (walletResult.error && walletResult.error.code !== 'PGRST116')) {
      console.warn('Unable to load wallet balance:', walletResult?.error || results[1].reason);
      setCoinBalance(0);
    } else {
      setCoinBalance(Number(walletResult.data?.balance || 0));
    }

    if (!accessResult || accessResult.error) {
      console.warn('Unable to load account access:', accessResult?.error || results[2].reason);
      setAccountAccess((current) => current.userId === userId
        ? { ...current, loading: false, ready: false }
        : current);
    } else {
      const now = Date.now();
      const activeGrants = (accessResult.data || []).filter((grant) => {
        if (grant.is_active === false) return false;
        if (grant.status && !['active', 'granted', 'lifetime'].includes(String(grant.status).toLowerCase())) return false;
        return !grant.expires_at || new Date(grant.expires_at).getTime() > now;
      });
      const isPremium = activeGrants.length > 0 || ['admin', 'super_admin'].includes(profileResult?.data?.role);
      const latestExpiry = activeGrants.find((grant) => grant.expires_at)?.expires_at;
      const validTill = latestExpiry
        ? new Date(latestExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : isPremium ? 'Lifetime Access' : 'Free plan';
      setAccountAccess({ userId, loading: false, ready: true, isPremium, unlockedCount: activeGrants.length, validTill });
    }

    if (profileResult?.data && !profileResult.data.referral_code) {
      ensureReferralCode(supabase, userId).then((code) => {
        if (code) setProfile((current) => current ? ({ ...current, referral_code: code }) : current);
      });
    }

    const savedRef = sessionStorage.getItem('zyvra_ref_code') || localStorage.getItem('zyvra_ref_code');
    if (savedRef) {
      processReferralAward(supabase, userId, savedRef).then(async (result) => {
        if (result && !result.retryable) {
          sessionStorage.removeItem('zyvra_ref_code');
          localStorage.removeItem('zyvra_ref_code');
        }
        if (result?.success) {
          try {
            const { data: freshWallet } = await supabase
              .from('coin_wallets')
              .select('balance')
              .eq('user_id', userId)
              .maybeSingle();
            if (freshWallet && Number.isFinite(Number(freshWallet.balance))) {
              setCoinBalance(Number(freshWallet.balance));
            }
          } catch (freshErr) {
            console.warn('Unable to immediately refresh coin balance after referral claim:', freshErr);
          }
        }
      });
    }
    if (profileResult?.data?.theme) {
      localStorage.setItem('zyvra-theme', profileResult.data.theme);
      await setTheme(profileResult.data.theme);
    }
    if (['en', 'hi'].includes(profileResult?.data?.preferred_language)) {
      setLanguage(profileResult.data.preferred_language, { syncProfile: false });
    }
  }, [setTheme, setLanguage]);

  useEffect(() => {
    if (!supabase) {
      isHydratedRef.current = true;
      setLoading(false);
      return undefined;
    }
    let active = true;
    const initialize = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session hydration timeout')), 8000);
        });
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        userRef.current = data.session?.user?.id || null;
        await loadAccount(data.session);
      } catch (error) {
        console.error('Unable to initialize account session:', error);
      } finally {
        if (active) {
          isHydratedRef.current = true;
          setLoading(false);
        }
      }
    };
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      const nextUserId = nextSession?.user?.id || null;
      const prevUserId = userRef.current;
      userRef.current = nextUserId;

      setSession(nextSession);
      if (nextSession) {
        setGuest(false);
        sessionStorage.removeItem('zyvra-guest');
      }

      const isDifferentUser = prevUserId !== nextUserId;
      // Do not set loading = true during background token refreshes or tab switches for the same user.
      if (!isHydratedRef.current) {
        // Initial hydration is in progress
      } else if (isDifferentUser && nextUserId) {
        setLoading(true);
      }

      queueMicrotask(() => {
        loadAccount(nextSession)
          .catch((error) => console.error('Unable to load account:', error))
          .finally(() => {
            if (active && (!isHydratedRef.current || isDifferentUser)) {
              isHydratedRef.current = true;
              setLoading(false);
            }
          });
      });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadAccount]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.from('platform_settings').select('value').eq('key', 'guest_demo_enabled').maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          if (error.code !== 'PGRST116') console.error('Unable to load guest demo setting:', error);
          return;
        }
        const setting = data?.value;
        const enabled = typeof setting === 'object' && setting !== null ? setting.enabled : setting;
        if (!active) return;
        const isEnabled = enabled === true || enabled === 'true';
        setGuestDemoEnabled(isEnabled);
        if (isEnabled && sessionStorage.getItem('zyvra-guest') === 'true') setGuest(true);
        if (!isEnabled) {
          sessionStorage.removeItem('zyvra-guest');
          setGuest(false);
        }
      })
      .catch((error) => console.error('Unable to load guest demo setting:', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      if (session) {
        loadAccount(session);
      }
    };
    window.addEventListener('zyvra:refresh-account', handleRefresh);
    window.addEventListener('zyvra:coins-updated', handleRefresh);
    return () => {
      window.removeEventListener('zyvra:refresh-account', handleRefresh);
      window.removeEventListener('zyvra:coins-updated', handleRefresh);
    };
  }, [loadAccount, session]);

  const enterGuestMode = useCallback(() => {
    if (!guestDemoEnabled) throw new Error('Guest demo access is currently disabled.');
    sessionStorage.setItem('zyvra-guest', 'true');
    setGuest(true);
  }, [guestDemoEnabled]);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem('zyvra_active_route');
    sessionStorage.removeItem('zyvra_cm_exam_id');
    sessionStorage.removeItem('zyvra_cm_path_ids');
    sessionStorage.removeItem('zyvra_cm_dialog');
    sessionStorage.removeItem('zyvra_cm_resource_chapter');
    if (guest) {
      sessionStorage.removeItem('zyvra-guest');
      setGuest(false);
      return;
    }
    if (!supabase) throw new Error(supabaseConfigurationError);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [guest]);
  const refreshAccount = useCallback(() => loadAccount(session), [loadAccount, session]);
  const role = profile?.role || (guest ? 'guest' : 'student');
  const value = useMemo(() => ({
    supabase, session, user: session?.user || null, profile, profileError, coinBalance, accountAccess, loading, guest,
    guestDemoEnabled, role, isAdmin: ['admin', 'super_admin'].includes(role),
    enterGuestMode, signOut, refreshAccount, configurationError: supabaseConfigurationError
  }), [session, profile, profileError, coinBalance, accountAccess, loading, guest, guestDemoEnabled, role, enterGuestMode, signOut, refreshAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
