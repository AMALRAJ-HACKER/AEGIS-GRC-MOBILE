import { supabase } from '@/lib/supabase';

// ---------- Formatting & label helpers ----------

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
};

export const initials = (name?: string | null) =>
  (name || 'U').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const severityFromScore = (score: number): 'critical' | 'high' | 'medium' | 'low' =>
  score >= 17 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';

// Control status (compliance_assessments.status)
export const controlLabel = (s: string) =>
  ({ not_started: 'Not Started', in_progress: 'In Progress', implemented: 'Implemented', needs_review: 'Under Review', non_compliant: 'Non-Compliant', not_applicable: 'Not Applicable' } as any)[s] ?? s;
export const controlTone = (s: string): 'success' | 'warning' | 'critical' | 'info' | 'default' =>
  s === 'implemented' ? 'success' : s === 'in_progress' ? 'warning' : s === 'needs_review' ? 'info' : s === 'non_compliant' ? 'critical' : 'default';

// Risk status
export const riskStatusLabel = (s: string) =>
  ({ open: 'Open', mitigating: 'Mitigating', accepted: 'Accepted', closed: 'Closed' } as any)[s] ?? s;

// Recurring task schedule
export const recurrenceLabel = (s: string) =>
  ({ none: 'One-off', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' } as any)[s] ?? s;

// Task status (task_status)
export const taskLabel = (s: string) =>
  ({ todo: 'Open', in_progress: 'In Progress', pending_review: 'Pending Review', approved: 'Approved', done: 'Closed', blocked: 'Blocked' } as any)[s] ?? s;
export const taskTone = (s: string): 'success' | 'warning' | 'critical' | 'info' | 'default' =>
  s === 'done' || s === 'approved' ? 'success' : s === 'pending_review' ? 'info' : s === 'in_progress' ? 'warning' : s === 'blocked' ? 'critical' : 'default';

export const priorityTone = (p: string): 'success' | 'warning' | 'critical' | 'info' | 'default' =>
  p === 'critical' ? 'critical' : p === 'high' ? 'warning' : p === 'medium' ? 'info' : 'default';

// Evidence health derived from expiry_date (PRD: Valid / Expiring ≤30d / Expired)
export const evidenceHealth = (expiry?: string | null): 'valid' | 'expiring' | 'expired' | 'none' => {
  if (!expiry) return 'none';
  const days = (new Date(expiry).getTime() - Date.now()) / 86400000;
  return days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'valid';
};
export const healthTone = (h: string): 'success' | 'warning' | 'critical' | 'default' =>
  h === 'valid' ? 'success' : h === 'expiring' ? 'warning' : h === 'expired' ? 'critical' : 'default';

// ---------- Activity log (append-only audit trail) ----------

export async function logActivity(orgId: string, action: string, resourceType: string, resourceId?: string | null, metadata?: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({
      organization_id: orgId, actor_id: user?.id ?? null, action, resource_type: resourceType,
      resource_id: resourceId ?? null, metadata: metadata ?? null,
    });
  } catch (e) { console.warn('[AEGIS] logActivity failed:', (e as any)?.message); }
}

export async function notify(userId: string, orgId: string, type: string, title: string, body?: string, resourceType?: string, resourceId?: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId, organization_id: orgId, type, title, body: body ?? null,
      resource_type: resourceType ?? null, resource_id: resourceId ?? null,
    });
  } catch (e) { console.warn('[AEGIS] notify failed:', (e as any)?.message); }
}
