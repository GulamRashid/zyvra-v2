import { useState } from 'react';
import { ArrowRight, BadgeCheck, Bell, CheckCircle2, Coins, Globe2, Mail, Shield, Trash2, UserRound, X, ChartNoAxesColumn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const exams = ['BPSC', 'SSC', 'CTET', 'NCERT'];

export default function StudentProfile() {
  const { user, profile, coinBalance, supabase, signOut, refreshAccount } = useAuth();
  const { theme, setTheme, language, setLanguage } = useThemeLanguage();
  const [targets, setTargets] = useState(profile?.target_exams || []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const navigate = useNavigate();
  const email = user?.email || 'Guest account';
  const name = profile?.full_name || profile?.name || 'Learner';
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
      <section className="panel-card profile-identity"><div className="profile-avatar">{name.slice(0, 1).toUpperCase()}</div><h2>{name}</h2><p>{email}</p><div className="verification-row"><span><BadgeCheck size={16} /> {user?.email_confirmed_at ? 'Email verified' : 'Email status'}</span><span className="status-pill">{user?.email_confirmed_at ? 'VERIFIED' : 'PENDING'}</span></div><div className="verification-row"><span><Shield size={16} /> Account type</span><strong>Student</strong></div><div className="profile-stat"><Coins size={18} /><div><span>ZYVRA COINS</span><strong>{coinBalance.toLocaleString()}</strong></div><span>Available balance</span></div></section>
      <div className="profile-settings">
        <section className="panel-card setting-card"><div className="setting-card-title"><div className="setting-symbol"><UserRound size={17} /></div><div><h2>Personal details</h2><p>How you appear in your learning space.</p></div></div><label className="field-label">Full name<input className="text-input" value={name} readOnly /></label><label className="field-label">Email address<div className="input-with-icon"><Mail size={16} /><input className="text-input" value={email} readOnly /></div></label><p className="field-hint">To update verified contact details, contact Zyvra support.</p></section>
        <section className="panel-card setting-card"><div className="setting-card-title"><div className="setting-symbol"><Globe2 size={17} /></div><div><h2>Study preferences</h2><p>Personalise your discovery and interface.</p></div></div><div className="setting-label">Target exams {saving && <span>Saving…</span>}</div><div className="exam-chips">{exams.map((exam) => <button key={exam} className={`exam-chip ${targets.includes(exam) ? 'selected' : ''}`} onClick={() => toggleTarget(exam)}>{exam}{targets.includes(exam) && <CheckCircle2 size={14} />}</button>)}</div><div className="setting-label">Language</div><div className="preference-options">{[['en', 'English'], ['hi', 'हिन्दी']].map(([value, label]) => <button key={value} className={`preference-choice ${language === value ? 'chosen' : ''}`} onClick={() => setLanguage(value)}>{label}</button>)}</div><div className="setting-label">Appearance</div><select className="text-input compact-select" value={theme} onChange={(event) => setTheme(event.target.value, user?.id).catch((error) => { setFeedback(error.message); setFeedbackError(true); })}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></section>
        <section className="panel-card setting-card"><div className="setting-card-title"><div className="setting-symbol"><Bell size={17} /></div><div><h2>Wallet summary</h2><p>Your practice rewards at a glance.</p></div></div><div className="wallet-summary"><div><span>Available Zyvra Coins</span><strong><Coins size={18} /> {coinBalance.toLocaleString()}</strong></div><span>Coin activity and rewards will appear here as you learn.</span></div><div className="profile-quick-links"><Link to="/wallet"><Coins size={15} /> Open coin ledger <ArrowRight size={14} /></Link><Link to="/analytics"><ChartNoAxesColumn size={15} /> View performance analytics <ArrowRight size={14} /></Link></div></section>
        <section className="danger-card"><div><h2>Account deletion</h2><p>Request review of your account and personal data deletion.</p></div><button className="button danger-button" onClick={() => setDeleteOpen(true)} disabled={!user}><Trash2 size={15} /> Request deletion</button></section>
      </div>
    </div>
    {deleteOpen && <div className="modal-backdrop"><form className="confirm-modal" onSubmit={requestDeletion}><button type="button" className="modal-close" onClick={() => setDeleteOpen(false)} aria-label="Close"><X size={18} /></button><div className="setting-symbol danger-symbol"><Trash2 size={18} /></div><h2>Request account deletion?</h2><p>This sends a request to the Zyvra team for review. Your account is not deleted immediately.</p><label className="field-label">Reason (optional)<textarea className="text-input" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} rows="3" /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button type="submit" className="button danger-button">Submit request</button></div></form></div>}
  </div>;
}
