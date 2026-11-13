import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigurationError } from '../lib/supabase';
import { useThemeLanguage } from './ThemeLanguageContext';
import { ensureReferralCode, processReferralAward } from '../lib/referrals';
import { getFriendlyErrorMessage } from '../lib/errors';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [coinBalance, setCoinBalance] = useState(0);
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
      return;
    }
    const userId = activeSession.user.id;
    setProfileError('');
    const [profileResult, walletResult] = await Promise.all([
      supabase.from('profiles').select('id,full_name,target_exams,daily_goal_target,theme,preferred_language,current_streak,onboarding_completed,referral_code,role,is_pro,avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('coin_wallets').select('balance').eq('user_id', userId).maybeSingle()
    ]);
    if (profileResult.error) {
      console.error('Unable to load profile data:', profileResult.error);
      setProfile(null);
      setProfileError(getFriendlyErrorMessage(profileResult.error, 'Profile data abhi load nahi ho paya.'));
    } else {
      setProfile(profileResult.data);
    }
    if (walletResult.error && walletResult.error.code !== 'PGRST116') throw walletResult.error;
    setCoinBalance(Number(walletResult.data?.balance || 0));

    if (profileResult.data && !profileResult.data.referral_code) {
      ensureReferralCode(supabase, userId).then((code) => {
        if (code) setProfile((current) => current ? ({ ...current, referral_code: code }) : current);
      });
    }

    const savedRef = sessionStorage.getItem('zyvra_ref_code');
    if (savedRef) {
      processReferralAward(supabase, userId, savedRef).then(() => {
        sessionStorage.removeItem('zyvra_ref_code');
      });
    }
    if (profileResult.data?.theme) {
      localStorage.setItem('zyvra-theme', profileResult.data.theme);
      await setTheme(profileResult.data.theme);
    }
    if (['en', 'hi'].includes(profileResult.data?.preferred_language)) {
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
        const { data, error } = await supabase.auth.getSession();
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

  const enterGuestMode = () => {
    if (!guestDemoEnabled) throw new Error('Guest demo access is currently disabled.');
    sessionStorage.setItem('zyvra-guest', 'true');
    setGuest(true);
  };
  const signOut = async () => {
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
  };
  const refreshAccount = useCallback(() => loadAccount(session), [loadAccount, session]);
  const role = profile?.role || (guest ? 'guest' : 'student');
  const value = useMemo(() => ({
    supabase, session, user: session?.user || null,     profile, profileError, coinBalance, loading, guest,
    guestDemoEnabled, role, isAdmin: ['admin', 'super_admin'].includes(role),
    enterGuestMode, signOut, refreshAccount, configurationError: supabaseConfigurationError
  }), [session, profile, coinBalance, loading, guest, guestDemoEnabled, role, loadAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
