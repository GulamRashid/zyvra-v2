import { useCallback, useEffect, useState } from 'react';
import { History, Plus, RefreshCw, Save, Settings2, Shield, Users } from 'lucide-react';
import SettingsPreview from './SettingsPreview';
import TestCoinsToggleCard from '../../components/admin/TestCoinsToggleCard';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_ROLE_PERMISSIONS, logAdminAction, PERMISSION_LABELS } from '../../lib/auditLog';

export default function AdminSettings() {
  const { user, supabase } = useAuth();
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'roles' | 'audit'

  // Roles & Permissions state
  const [roleMatrix, setRoleMatrix] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [staffUsers, setStaffUsers] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleMessage, setRoleMessage] = useState('');
  const [roleError, setRoleError] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('editor');
  const [assignReason, setAssignReason] = useState('');

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');

  const loadRolesAndStaff = useCallback(async () => {
    if (!supabase) {
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    try {
      const [settingsRes, staffRes] = await Promise.all([
        supabase
          .from('platform_settings')
          .select('value, setting_value')
          .or('key.eq.admin_role_permissions,setting_key.eq.admin_role_permissions')
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('role', ['super_admin', 'admin', 'editor', 'support_agent'])
          .order('created_at', { ascending: false })
      ]);
      const val = settingsRes.data?.setting_value || settingsRes.data?.value;
      if (val && typeof val === 'object') {
        setRoleMatrix({ ...DEFAULT_ROLE_PERMISSIONS, ...val });
      }
      if (!staffRes.error && staffRes.data) {
        setStaffUsers(staffRes.data);
      }
    } catch (err) {
      setRoleError(err.message || 'Unable to load roles.');
    } finally {
      setRolesLoading(false);
    }
  }, [supabase]);

  const loadAuditLogs = useCallback(async () => {
    if (!supabase) {
      setAuditLoading(false);
      return;
    }
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        setAuditLogs(data);
      }
    } catch (err) {
      console.warn('Audit logs load error:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadRolesAndStaff();
    loadAuditLogs();
  }, [loadRolesAndStaff, loadAuditLogs]);

  const togglePermission = (roleKey, permKey) => {
    if (roleKey === 'super_admin') return; // Super Admin always retains full permissions
    setRoleMatrix((prev) => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        [permKey]: !prev[roleKey]?.[permKey]
      }
    }));
  };

  const handleSaveRoleMatrix = async () => {
    if (!supabase) return;
    setSavingRoles(true);
    setRoleError('');
    setRoleMessage('');
    try {
      const payload = {
        key: 'admin_role_permissions',
        setting_key: 'admin_role_permissions',
        value: roleMatrix,
        setting_value: roleMatrix,
        updated_at: new Date().toISOString()
      };
      let { error } = await supabase.from('platform_settings').upsert(payload, { onConflict: 'setting_key' });
      if (error) {
        const fb = await supabase.from('platform_settings').upsert(payload, { onConflict: 'key' });
        if (fb.error) throw fb.error;
      }
      await logAdminAction(supabase, {
        actor: user,
        action: 'update_role_permissions',
        targetType: 'platform_settings',
        targetId: 'admin_role_permissions',
        details: { roles: Object.keys(roleMatrix) }
      });
      setRoleMessage('Role permissions saved.');
      loadAuditLogs();
    } catch (err) {
      setRoleError(err.message || 'Unable to save role permissions.');
    } finally {
      setSavingRoles(false);
    }
  };

  const handleCreateRole = (e) => {
    e.preventDefault();
    const key = newRoleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key || roleMatrix[key]) return;
    setRoleMatrix((prev) => ({
      ...prev,
      [key]: {
        label: newRoleLabel.trim() || key,
        can_manage_content: true,
        can_manage_tests: true,
        can_manage_users: false,
        can_manage_orders: false,
        can_manage_coins: false,
        can_manage_support: false,
        can_manage_settings: false,
        can_manage_roles: false
      }
    }));
    setNewRoleKey('');
    setNewRoleLabel('');
  };

  const handleAssignUserRole = async (e) => {
    e.preventDefault();
    if (!supabase || !assignEmail.trim() || !assignReason.trim()) return;
    setRoleError('');
    setRoleMessage('');
    try {
      const { data: target, error: findErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .ilike('email', assignEmail.trim())
        .maybeSingle();
      if (findErr || !target) {
        setRoleError('No user found with that email address.');
        return;
      }
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role: assignRole, updated_at: new Date().toISOString() })
        .eq('id', target.id);
      if (updateErr) throw updateErr;

      await logAdminAction(supabase, {
        actor: user,
        action: 'assign_staff_role',
        targetType: 'profile',
        targetId: target.id,
        details: { email: target.email, previous_role: target.role, new_role: assignRole, reason: assignReason.trim() }
      });
      setRoleMessage(`Updated ${target.email} to ${assignRole}.`);
      setAssignEmail('');
      setAssignReason('');
      loadRolesAndStaff();
      loadAuditLogs();
    } catch (err) {
      setRoleError(err.message || 'Unable to assign role.');
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    return `${log.action || ''} ${log.actor_email || ''} ${log.target_type || ''} ${log.target_id || ''} ${JSON.stringify(log.details || {})}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">SYSTEM &amp; GOVERNANCE</div>
          <h1>Settings, Roles &amp; Audit Log</h1>
          <p>Configure reward rules, manage editor/staff permissions, and inspect who changed what and when.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'settings', label: 'Platform Settings', Icon: Settings2 },
          { id: 'roles', label: 'Roles & Permissions', Icon: Shield },
          { id: 'audit', label: `Audit Log (${auditLogs.length})`, Icon: History }
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              activeTab === id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <TestCoinsToggleCard />
          <SettingsPreview />
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          {roleError && <div className="feedback error-feedback">{roleError}</div>}
          {roleMessage && <div className="feedback success-feedback">{roleMessage}</div>}

          <section className="panel-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="eyebrow">ACCESS CONTROL MATRIX</div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Role Permissions</h2>
              </div>
              <button
                type="button"
                onClick={handleSaveRoleMatrix}
                disabled={savingRoles}
                className="button button-primary"
              >
                <Save size={15} /> {savingRoles ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>

            {rolesLoading ? (
              <LoadingSkeleton rows={4} />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Permission</th>
                      {Object.entries(roleMatrix).map(([roleKey, cfg]) => (
                        <th key={roleKey} className="py-2.5 px-3 text-center">
                          <div className="font-bold text-slate-900 dark:text-white">{cfg?.label || roleKey}</div>
                          <div className="text-[10px] font-mono text-slate-400">{roleKey}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_LABELS.map(({ key, label }) => (
                      <tr key={key} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200">{label}</td>
                        {Object.entries(roleMatrix).map(([roleKey, cfg]) => (
                          <td key={`${roleKey}-${key}`} className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(cfg?.[key])}
                              disabled={roleKey === 'super_admin'}
                              onChange={() => togglePermission(roleKey, key)}
                              aria-label={`${cfg?.label || roleKey} ${label}`}
                              className="h-4 w-4 accent-indigo-600 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={handleCreateRole} className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-3">
              <label className="field-label text-xs">
                New Role Key
                <input
                  className="text-input"
                  placeholder="e.g. reviewer"
                  value={newRoleKey}
                  onChange={(e) => setNewRoleKey(e.target.value)}
                />
              </label>
              <label className="field-label text-xs">
                Display Label
                <input
                  className="text-input"
                  placeholder="e.g. Content Reviewer"
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                />
              </label>
              <button type="submit" className="button button-outline">
                <Plus size={14} /> Add Role
              </button>
            </form>
          </section>

          <section className="panel-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-indigo-500" />
              <div>
                <div className="eyebrow">STAFF ASSIGNMENT</div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assign Role to User</h2>
              </div>
            </div>

            <form onSubmit={handleAssignUserRole} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <label className="field-label text-xs">
                User Email *
                <input className="text-input" type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="user@example.com" required />
              </label>
              <label className="field-label text-xs">
                Role *
                <select className="text-input" value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
                  {Object.entries(roleMatrix).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg?.label || k}</option>
                  ))}
                  <option value="student">Student (Remove Admin)</option>
                </select>
              </label>
              <label className="field-label text-xs">
                Audit Reason *
                <input className="text-input" value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder="Why role is assigned" required />
              </label>
              <button type="submit" className="button button-gold">Assign Role</button>
            </form>

            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Admin &amp; Editor Accounts ({staffUsers.length})</h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {staffUsers.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-900 dark:text-white">{s.full_name || 'Staff'}</strong>
                      <span className="text-slate-400 ml-2">{s.email}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-500 uppercase text-[10px]">
                      {s.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'audit' && (
        <section className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">CHANGE HISTORY</div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Admin Audit Log</h2>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="search"
                aria-label="Search audit log"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filter action, actor, or ID…"
                className="text-input text-xs"
              />
              <button type="button" onClick={loadAuditLogs} className="button button-outline">
                <RefreshCw size={14} className={auditLoading ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {auditLoading ? (
            <LoadingSkeleton rows={5} />
          ) : filteredLogs.length === 0 ? (
            <div className="empty-content py-10 text-center">
              <History size={24} className="mx-auto opacity-40 mb-2" />
              <span>No audit log entries recorded yet. Admin actions will appear here automatically.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Date &amp; Time (IST)</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{log.actor_email || log.actor_id || 'System'}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{log.actor_role || 'admin'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-500 font-semibold">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {log.target_type ? `${log.target_type}: ${log.target_id || ''}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs break-words">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
