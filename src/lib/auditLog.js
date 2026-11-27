export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: {
    label: 'Super Admin',
    can_manage_content: true,
    can_manage_tests: true,
    can_manage_users: true,
    can_manage_orders: true,
    can_manage_coins: true,
    can_manage_settings: true,
    can_manage_support: true,
    can_manage_roles: true
  },
  admin: {
    label: 'Admin',
    can_manage_content: true,
    can_manage_tests: true,
    can_manage_users: true,
    can_manage_orders: true,
    can_manage_coins: true,
    can_manage_settings: true,
    can_manage_support: true,
    can_manage_roles: false
  },
  editor: {
    label: 'Content Editor',
    can_manage_content: true,
    can_manage_tests: true,
    can_manage_users: false,
    can_manage_orders: false,
    can_manage_coins: false,
    can_manage_settings: false,
    can_manage_support: false,
    can_manage_roles: false
  },
  support_agent: {
    label: 'Support Agent',
    can_manage_content: false,
    can_manage_tests: false,
    can_manage_users: true,
    can_manage_orders: false,
    can_manage_coins: false,
    can_manage_settings: false,
    can_manage_support: true,
    can_manage_roles: false
  }
};

export const PERMISSION_LABELS = [
  { key: 'can_manage_content', label: 'Manage Content & QBank' },
  { key: 'can_manage_tests', label: 'Manage Tests' },
  { key: 'can_manage_users', label: 'View/Edit Users' },
  { key: 'can_manage_orders', label: 'Orders & Refunds' },
  { key: 'can_manage_coins', label: 'Coins & Referrals' },
  { key: 'can_manage_support', label: 'Support Chat' },
  { key: 'can_manage_settings', label: 'Platform Settings' },
  { key: 'can_manage_roles', label: 'Roles & Permissions' }
];

export async function logAdminAction(supabase, { actor, action, targetType, targetId, details = {} }) {
  if (!supabase || !action) return;
  try {
    const payload = {
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      actor_role: actor?.role || 'admin',
      action: String(action),
      target_type: targetType ? String(targetType) : null,
      target_id: targetId ? String(targetId) : null,
      details: details && typeof details === 'object' ? details : { note: String(details) },
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('admin_audit_logs').insert(payload);
    if (error) {
      console.warn('Audit log insert failed:', error.message);
    }
  } catch (err) {
    console.warn('Audit log skipped:', err?.message || err);
  }
}
