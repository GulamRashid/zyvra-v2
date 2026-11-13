import { AlertCircle, CheckCircle2, Clock3, PauseCircle, XCircle } from 'lucide-react';

const VARIANT_BY_STATUS = {
  active: 'success',
  completed: 'success',
  paid: 'success',
  published: 'published',
  pending: 'pending',
  created: 'pending',
  in_progress: 'pending',
  draft: 'draft',
  paused: 'paused',
  failed: 'failed',
  expired: 'failed',
  revoked: 'failed',
  unavailable: 'unavailable'
};

const ICON_BY_VARIANT = {
  success: CheckCircle2,
  published: CheckCircle2,
  pending: Clock3,
  paused: PauseCircle,
  failed: XCircle,
  unavailable: AlertCircle
};

export default function StatusBadge({ status, variant, label }) {
  const normalizedStatus = String(status || '').toLowerCase().replace(/\s+/g, '_');
  const resolvedVariant = variant || VARIANT_BY_STATUS[normalizedStatus] || 'unavailable';
  const Icon = ICON_BY_VARIANT[resolvedVariant];

  return (
    <span className={`admin-status-badge admin-status-badge-${resolvedVariant}`}>
      {Icon && <Icon size={12} />}
      {label || String(status || 'Unavailable').replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}
