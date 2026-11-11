import { useEffect, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Bell, Check, CheckCircle2, Coins, Eye, EyeOff,
  Globe2, KeyRound, Mail, Monitor, Moon, Shield, Sun, Trash2, UserRound, X, ChartNoAxesColumn
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import ShareAndEarnCard from '../../components/common/ShareAndEarnCard';

const exams = ['BPSC', 'SSC', 'CTET', 'NCERT'];
const themeOptions = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor }
];

export default function StudentProfile() {
  const { user, profile, guest, coinBalance, supabase, signOut, refreshAccount } = useAuth();
  const { theme, setTheme, language, setLanguage } = useThemeLanguage();
  const [targets, setTargets] = useState(profile?.target_exams || []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  const navigate = useNavigate();
  const email = user?.email || 'Guest account';
  const name = profile?.full_name || profile?.name || user?.user_metadata?.full_name || 'Learner';
  const avatarLetter = (name ? name.charAt(0) : 'L').toUpperCase();
  const displayCoins = Number(coinBalance || 0).toLocaleString();
  const referralCode = profile?.referral_code || (user?.referral_code || 'Z-INVITE');

  useEffect(() => {
    if (profile?.target_exams) {
      setTargets(profile.target_exams);
    }
  }, [profile?.target_exams]);

  const saveTargets = async (nextTargets) => {
    setTargets(nextTargets);
    if (!user || !supabase) return;
    setSaving(true);
    setFeedback('');
    try {
      const { error } = await supabase.from('profiles').update({ target_exams: nextTargets }).eq('id', user.id);
      if (error) throw error;
      setFeedback('Your exam preferences are saved.');
      await refreshAccount();
    } catch (error) {
      setFeedback(error.message || 'Could not save your exam preferences.');
      setFeedbackError(true);
    } finally { setSaving(false); }
  };

  const toggleTarget = (exam) => saveTargets(targets.includes(exam) ? targets.filter((item) => item !== exam) : [...targets, exam]);

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    setPasswordFeedback('');
    setPasswordError(false);

    if (!newPassword || newPassword.length < 6) {
      setPasswordFeedback('Password must be at least 6 characters long.');
      setPasswordError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback('Passwords do not match. Please re-enter.');
      setPasswordError(true);
      return;
    }

    if (!supabase) {
      setPasswordFeedback('Authentication service is currently unavailable.');
      setPasswordError(true);
      return;
    }

    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordFeedback('Password updated successfully! You can now use it to sign in.');
      setPasswordError(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordFeedback(error.message || 'Unable to update password. Please try again.');
      setPasswordError(true);
    } finally {
      setPasswordUpdating(false);
    }
  };

  const requestDeletion = async (event) => {
    event.preventDefault();
    setFeedback('');
    try {
      const { error } = await supabase.from('account_deletion_requests').insert({ user_id: user.id, reason: deleteReason.trim() || null });
      if (error) throw error;
      setDeleteOpen(false);
      setFeedback('Your account deletion request has been submitted for review.');
      setFeedbackError(false);
    } catch (error) {
      setFeedback(error.message || 'Unable to submit your request. Please contact support.');
      setFeedbackError(true);
    }
  };

  const logout = async () => {
    try { await signOut(); navigate('/auth'); }
    catch (error) { setFeedback(error.message || 'Unable to sign out.'); setFeedbackError(true); }
  };

  return <div className="profile-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>Profile & settings</h1><p>Your details, preferences and account controls.</p></div><button className="button button-outline" onClick={logout}>Sign out</button></div>
    {feedback && <div className={`feedback ${feedbackError ? 'error-feedback' : 'success-feedback'}`}>{feedback}</div>}
    <div className="profile-layout">
      <section className="panel-card profile-identity"><div className="profile-avatar">{avatarLetter}</div><h2>{name}</h2><p>{email}</p><div className="verification-row"><span><BadgeCheck size={16} /> {user?.email_confirmed_at ? 'Email verified' : 'Email status'}</span><span className="status-pill">{user?.email_confirmed_at ? 'VERIFIED' : 'PENDING'}</span></div><div className="verification-row"><span><Shield size={16} /> Account type</span><strong>{guest ? 'Guest' : 'Student'}</strong></div><div className="profile-stat"><Coins size={18} /><div><span>ZYVRA COINS</span><strong>{displayCoins}</strong></div><span>Available balance</span></div></section>
      <div className="profile-settings">
        <section className="panel-card setting-card"><div className="setting-card-title"><div className="setting-symbol"><UserRound size={17} /></div><div><h2>Personal details</h2><p>How you appear in your learning space.</p></div></div><label className="field-label">Full name<input className="text-input" value={name} readOnly /></label><label className="field-label">Email address<div className="input-with-icon"><Mail size={16} /><input className="text-input" value={email} readOnly /></div></label><p className="field-hint">To update verified contact details, contact Zyvra support.</p></section>
        
        <section className="panel-card setting-card">
          <div className="setting-card-title"><div className="setting-symbol"><Globe2 size={17} /></div><div><h2>Study preferences</h2><p>Personalise your discovery and interface.</p></div></div>
          <div className="setting-label">Target exams {saving && <span>Saving…</span>}</div>
          <div className="exam-chips">{exams.map((exam) => <button key={exam} type="button" className={`exam-chip ${targets.includes(exam) ? 'selected' : ''}`} onClick={() => toggleTarget(exam)}>{exam}{targets.includes(exam) && <CheckCircle2 size={14} />}</button>)}</div>
          
          <div className="setting-label">Interface language</div>
          <div className="preference-options">{[['en', 'English'], ['hi', 'हिन्दी']].map(([value, label]) => <button key={value} type="button" className={`preference-choice ${language === value ? 'chosen' : ''}`} onClick={() => setLanguage(value)}>{label}{language === value && <Check size={14} />}</button>)}</div>
          
          <div className="setting-label">Appearance</div>
          <div className="preference-options">{themeOptions.map(({ value, label, Icon }) => <button key={value} type="button" className={`preference-choice ${theme === value ? 'chosen' : ''}`} onClick={() => setTheme(value, user?.id).catch((err) => { setFeedback(err.message); setFeedbackError(true); })}><Icon size={14} /> {label}{theme === value && <Check size={14} />}</button>)}</div>
        </section>

        <section className="panel-card setting-card">
          <div className="setting-card-title"><div className="setting-symbol"><KeyRound size={17} /></div><div><h2>Password & security</h2><p>Set or change your password for fast 1-click login.</p></div></div>
          {guest ? (
            <p className="field-hint">Password setup is available for registered student accounts. Sign in or create an account to configure a password.</p>
          ) : (
            <form onSubmit={handlePasswordUpdate}>
              <label className="field-label">
                New password
                <div className="input-with-icon">
                  <KeyRound size={16} />
                  <input
                    className="text-input"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="field-label" style={{ marginTop: '12px' }}>
                Confirm new password
                <div className="input-with-icon">
                  <KeyRound size={16} />
                  <input
                    className="text-input"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your new password"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </label>

              {passwordFeedback && (
                <div className={`feedback ${passwordError ? 'error-feedback' : 'success-feedback'}`} style={{ marginTop: '12px' }}>
                  {passwordFeedback}
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <button
                  type="submit"
                  className="button button-gold"
                  disabled={passwordUpdating || !newPassword}
                >
                  {passwordUpdating ? 'Updating password…' : 'Update password'}
                </button>
              </div>
            </form>
          )}
        </section>

        <ShareAndEarnCard className="profile-share-card" />

        <section className="panel-card setting-card"><div className="setting-card-title"><div className="setting-symbol"><Bell size={17} /></div><div><h2>Wallet summary</h2><p>Your practice rewards at a glance.</p></div></div><div className="wallet-summary"><div><span>Available Zyvra Coins</span><strong><Coins size={18} /> {displayCoins}</strong></div><span>Coin activity and rewards will appear here as you learn.</span></div><div className="profile-quick-links"><Link to="/wallet"><Coins size={15} /> Open coin ledger <ArrowRight size={14} /></Link><Link to="/analytics"><ChartNoAxesColumn size={15} /> View performance analytics <ArrowRight size={14} /></Link></div></section>
        <section className="danger-card"><div><h2>Account deletion</h2><p>Request review of your account and personal data deletion.</p></div><button className="button danger-button" onClick={() => setDeleteOpen(true)} disabled={!user}><Trash2 size={15} /> Request deletion</button></section>
      </div>
    </div>
    {deleteOpen && <div className="modal-backdrop"><form className="confirm-modal" onSubmit={requestDeletion}><button type="button" className="modal-close" onClick={() => setDeleteOpen(false)} aria-label="Close"><X size={18} /></button><div className="setting-symbol danger-symbol"><Trash2 size={18} /></div><h2>Request account deletion?</h2><p>This sends a request to the Zyvra team for review. Your account is not deleted immediately.</p><label className="field-label">Reason (optional)<textarea className="text-input" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} rows="3" /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button type="submit" className="button danger-button">Submit request</button></div></form></div>}
  </div>;
}
