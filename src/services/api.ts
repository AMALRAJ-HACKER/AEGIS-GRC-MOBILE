import { fileToArrayBuffer } from '@/lib/fileBytes';
import { supabase } from '@/lib/supabase';
import { severityFromScore } from '@/lib/format';

// ============================================================
// Frameworks & Controls (PRD 2.3)
// ============================================================

export interface FrameworkStat {
  id: string; name: string; slug: string; version: string; description: string; category: string;
  total: number; applicable: number; implemented: number; inProgress: number; notStarted: number;
  needsReview: number; nonCompliant: number; notApplicable: number;
  score: number; activated: boolean; lastAssessed: string | null;
}

export async function fetchFrameworkCatalog() {
  const { data, error } = await supabase.from('frameworks').select('*, framework_controls(id)').order('category');
  if (error) throw error;
  return (data ?? []).map((f: any) => ({
    ...f,
    controlCount: f.framework_controls?.length ?? 0,
    framework_controls: undefined,
  }));
}

/** Activated frameworks for the org with real compliance stats from compliance_assessments. */
export async function fetchFrameworkStats(orgId: string): Promise<FrameworkStat[]> {
  const [{ data: frameworks, error: fErr }, { data: assessments, error: aErr }] = await Promise.all([
    supabase.from('frameworks').select('*').order('category'),
    supabase.from('compliance_assessments')
      .select('id, status, control_id, updated_at, framework_controls!inner(framework_id)')
      .eq('organization_id', orgId),
  ]);
  if (fErr) throw fErr;
  if (aErr) throw aErr;

  return (frameworks ?? []).map((f: any) => {
    const mine = (assessments ?? []).filter((a: any) => a.framework_controls?.framework_id === f.id);
    const count = (s: string) => mine.filter((a: any) => a.status === s).length;
    const notApplicable = count('not_applicable');
    // N/A controls do not count for or against the compliance score.
    const applicable = Math.max(0, mine.length - notApplicable);
    const score = applicable ? Math.round((count('implemented') / applicable) * 100) : 0;
    const last = mine.map((a: any) => a.updated_at).filter(Boolean).sort().pop() ?? null;
    return {
      id: f.id, name: f.name, slug: f.slug, version: f.version, description: f.description, category: f.category,
      total: mine.length, applicable, implemented: count('implemented'), inProgress: count('in_progress'),
      notStarted: count('not_started'), needsReview: count('needs_review'), nonCompliant: count('non_compliant'),
      notApplicable,
      score, activated: mine.length > 0, lastAssessed: last,
    };
  });
}

/** Create a new framework for the organization. */
export async function createFramework(
  orgId: string,
  userIdOrFields: string | { name: string; category?: string; version?: string; description?: string; code?: string },
  maybeFields?: { name: string; code?: string; description?: string; version?: string; category?: string; owner?: string; status?: string }
) {
  const fields = typeof userIdOrFields === 'object' ? userIdOrFields : (maybeFields || { name: '', category: 'Custom' });
  const rawCode = (fields as any).code || fields.name;
  const slug = rawCode ? rawCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'framework';

  const { data, error } = await supabase.from('frameworks').insert({
    name: fields.name.trim(),
    slug: slug,
    version: fields.version?.trim() || '1.0',
    description: fields.description?.trim() || '',
    category: fields.category?.trim() || 'Custom',
    is_demo: false,
  }).select().single();

  if (error) throw error;
  if (!data?.id) return data;

  // Auto-seed assessments if framework controls exist
  try {
    await activateFramework(orgId, data.id);
  } catch {
    /* framework created; seeding is best-effort */
  }

  return data as any;
}

/** Clone a framework and copy all of its controls, then activate it. */
export async function cloneFramework(orgId: string, sourceId: string, newName: string) {
  const { data: src, error: sErr } = await supabase.from('frameworks').select('*').eq('id', sourceId).single();
  if (sErr) throw sErr;

  const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const { data: cloned, error: cErr } = await supabase.from('frameworks').insert({
    name: newName.trim(),
    slug,
    category: src?.category ?? 'Custom',
    version: src?.version ?? '1.0',
    description: src?.description ?? '',
    is_demo: false,
  }).select().single();

  if (cErr) throw cErr;

  if (cloned?.id) {
    const { data: controls } = await supabase.from('framework_controls').select('*').eq('framework_id', sourceId);
    if (controls?.length) {
      const rows = controls.map((c: any) => ({
        framework_id: cloned.id,
        control_id: c.control_id,
        title: c.title,
        description: c.description ?? null,
        category: c.category ?? null,
        implementation_guidance: c.implementation_guidance ?? null,
      }));
      await supabase.from('framework_controls').insert(rows);
      try {
        await activateFramework(orgId, cloned.id);
      } catch {
        /* best-effort */
      }
    }
  }

  return cloned;
}

/** Add controls to an existing or custom framework. */
export async function addFrameworkControls(
  frameworkId: string,
  controls: Array<{ control_id: string; title: string; description?: string; category?: string; implementation_guidance?: string }>
) {
  const rows = controls.map((c) => ({
    framework_id: frameworkId,
    control_id: c.control_id.trim(),
    title: c.title.trim(),
    description: c.description?.trim() || null,
    category: c.category?.trim() || null,
    implementation_guidance: c.implementation_guidance?.trim() || null,
  }));
  const { error } = await supabase.from('framework_controls').insert(rows);
  if (error) throw error;
}

/** Activate a framework for the org: seed a not_started assessment per control. */
export async function activateFramework(orgId: string, frameworkId: string) {
  const { data: controls, error } = await supabase.from('framework_controls').select('id').eq('framework_id', frameworkId);
  if (error) throw error;
  if (!controls?.length) return 0;
  const rows = controls.map((c) => ({ organization_id: orgId, control_id: c.id, status: 'not_started' }));
  const { error: insErr } = await supabase
    .from('compliance_assessments')
    .upsert(rows, { onConflict: 'organization_id,control_id', ignoreDuplicates: true });
  if (insErr) throw insErr;
  return controls.length;
}

/** Fetch controls for a framework, merged with this org's assessment status. */
export async function fetchControls(orgId: string, frameworkId: string) {
  const [{ data: fw, error: fwErr }, { data: controls, error: cErr }, { data: assessments, error: aErr }, { data: links }] = await Promise.all([
    supabase.from('frameworks').select('*').eq('id', frameworkId).single(),
    supabase.from('framework_controls').select('*').eq('framework_id', frameworkId).order('control_id'),
    supabase.from('compliance_assessments')
      .select('*, owner:profiles!compliance_assessments_owner_id_fkey(full_name)')
      .eq('organization_id', orgId),
    supabase.from('evidence_control_links').select('control_assessment_id'),
  ]);
  if (fwErr) throw fwErr; if (cErr) throw cErr; if (aErr) throw aErr;
  const byControl = new Map((assessments ?? []).map((a: any) => [a.control_id, a]));
  const evidenceCounts = new Map<string, number>();
  (links ?? []).forEach((l: any) => {
    if (!l.control_assessment_id) return;
    evidenceCounts.set(l.control_assessment_id, (evidenceCounts.get(l.control_assessment_id) ?? 0) + 1);
  });
  const rows: ControlRow[] = (controls ?? []).map((c: any) => {
    const a = byControl.get(c.id) as any;
    return {
      assessmentId: a?.id ?? null, controlId: c.id, controlCode: c.control_id, title: c.title,
      description: c.description ?? '', category: c.category ?? 'General', guidance: c.implementation_guidance ?? '',
      status: a?.status ?? 'not_started', notes: a?.implementation_notes ?? null, updatedAt: a?.updated_at ?? null,
      ownerId: a?.owner_id ?? null, ownerName: a?.owner?.full_name ?? null,
      evidenceCount: a?.id ? (evidenceCounts.get(a.id) ?? 0) : 0,
    };
  });
  return { framework: fw, controls: rows };
}

export interface ControlRow {
  assessmentId: string | null; controlId: string; controlCode: string; title: string; description: string;
  category: string; guidance: string; status: string; notes: string | null; updatedAt: string | null;
  ownerId: string | null; ownerName: string | null; evidenceCount: number;
}

/** Append-only history for one control assessment. */
export async function fetchControlActivity(assessmentId: string) {
  const { data, error } = await supabase.from('activity_logs')
    .select('*, actor:profiles(full_name)')
    .eq('resource_id', assessmentId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function setAssessmentStatus(assessmentId: string, status: string, notes?: string | null) {
  const { error } = await supabase.from('compliance_assessments')
    .update({
      status,
      ...(notes !== undefined ? { implementation_notes: notes } : {}),
      last_assessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', assessmentId);
  if (error) throw error;
}

// ============================================================
// Risks (PRD 2.4)
// ============================================================

export async function fetchRisks(orgId: string, options?: { includeArchived?: boolean }) {
  let query = supabase.from('risks')
    .select('*, owner:profiles!risks_owner_id_fkey(full_name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (!options?.includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchRisk(riskId: string) {
  const { data, error } = await supabase.from('risks')
    .select('*, owner:profiles!risks_owner_id_fkey(full_name)')
    .eq('id', riskId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchRiskHistory(riskId: string) {
  const { data, error } = await supabase.from('risk_history')
    .select('*, actor:profiles(full_name)')
    .eq('risk_id', riskId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function createRisk(orgId: string, userId: string, fields: any) {
  const inherent = fields.likelihood * fields.impact;
  const residual =
    fields.residual_likelihood && fields.residual_impact
      ? fields.residual_likelihood * fields.residual_impact
      : null;

  const { data, error } = await supabase.from('risks').insert({
    organization_id: orgId,
    title: fields.title,
    description: fields.description || null,
    category: fields.category || null,
    likelihood: fields.likelihood,
    impact: fields.impact,
    severity: severityFromScore(inherent),
    residual_likelihood: fields.residual_likelihood || null,
    residual_impact: fields.residual_impact || null,
    residual_score: residual,
    existing_safeguards: fields.existing_safeguards || null,
    mitigation_plan: fields.mitigation_plan || null,
    target_date: fields.target_date || null,
    status: fields.status ?? 'open',
    owner_id: fields.owner_id ?? userId,
  }).select().single();

  if (error) throw error;
  if (Array.isArray(fields.assessment_ids)) {
    await syncRiskControls(data.id, fields.assessment_ids);
  }
  return data;
}

const RISK_COLUMNS = [
  'title', 'description', 'category', 'likelihood', 'impact', 'residual_likelihood', 'residual_impact',
  'existing_safeguards', 'mitigation_plan', 'target_date', 'owner_id', 'status', 'accepted_at',
  'accepted_by', 'archived_at',
];

export async function updateRisk(id: string, fields: any) {
  const patch: any = {};
  for (const key of RISK_COLUMNS) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  if (fields.likelihood != null && fields.impact != null) {
    patch.severity = severityFromScore(fields.likelihood * fields.impact);
  }
  if (fields.residual_likelihood != null && fields.residual_impact != null) {
    patch.residual_score = fields.residual_likelihood * fields.residual_impact;
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('risks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  if (Array.isArray(fields.assessment_ids)) {
    await syncRiskControls(id, fields.assessment_ids);
  }
  return data;
}

export async function archiveRisk(id: string, archived = true) {
  const { error } = await supabase
    .from('risks')
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

async function syncRiskControls(riskId: string, assessmentIds: string[]) {
  const { error: delErr } = await supabase.from('risk_control_links').delete().eq('risk_id', riskId);
  if (delErr) throw delErr;
  const ids = Array.from(new Set((assessmentIds ?? []).filter(Boolean)));
  if (!ids.length) return;
  const { error } = await supabase.from('risk_control_links').insert(
    ids.map((control_assessment_id) => ({ risk_id: riskId, control_assessment_id })),
  );
  if (error) throw error;
}

export async function fetchRiskLinks(riskId: string) {
  const { data, error } = await supabase.from('risk_control_links')
    .select('control_assessment_id, assessment:compliance_assessments(id, status, framework_controls(control_id, title, framework_id, frameworks(name)))')
    .eq('risk_id', riskId);
  if (error) throw error;
  return data ?? [];
}

export async function addRiskHistory(riskId: string, userId: string, field: string, oldValue: any, newValue: any) {
  await supabase.from('risk_history').insert({
    risk_id: riskId,
    changed_by: userId,
    field_changed: field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? null : String(newValue),
  });
}

// ============================================================
// Tasks & Approvals (PRD 2.5 / 2.7)
// ============================================================

export async function fetchTasks(orgId: string) {
  const { data, error } = await supabase.from('tasks').select(`
    *, assignee:profiles!tasks_assigned_to_fkey(full_name),
    reviewer:profiles!tasks_reviewer_id_fkey(full_name),
    risk:linked_risk_id(title),
    assessment:linked_control_id(id, framework_controls(id, framework_id, control_id, title))
  `).eq('organization_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(orgId: string, userId: string, fields: any) {
  const linked_control_id =
    fields.linked_control_id && String(fields.linked_control_id).trim() !== ''
      ? fields.linked_control_id
      : null;

  const linked_risk_id =
    fields.linked_risk_id && String(fields.linked_risk_id).trim() !== ''
      ? fields.linked_risk_id
      : null;

  const due_date =
    fields.due_date && String(fields.due_date).trim() !== '' ? fields.due_date : null;

  const assigned_to =
    fields.assigned_to && String(fields.assigned_to).trim() !== '' ? fields.assigned_to : userId;

  const { data, error } = await supabase.from('tasks').insert({
    organization_id: orgId,
    title: fields.title,
    description: fields.description || null,
    priority: fields.priority ?? 'medium',
    status: fields.status ?? 'todo',
    recurrence: fields.recurrence ?? 'none',
    due_date,
    assigned_to,
    reviewer_id: fields.reviewer_id || null,
    created_by: userId,
    linked_control_id,
    linked_risk_id,
  }).select().single();

  if (error) throw error;
  // Assignment notifications are generated by the DB trigger in 0010_notification_alerts.sql.
  return data;
}

const TASK_COLUMNS = [
  'title', 'description', 'status', 'priority', 'assigned_to', 'owner_id', 'due_date',
  'linked_risk_id', 'linked_control_id', 'linked_audit_id', 'review_note',
  'review_requested_at', 'recurrence', 'reviewer_id',
];

export async function updateTask(id: string, fields: any) {
  const patch: any = {};
  for (const key of TASK_COLUMNS) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) throw error;
}

export async function fetchComments(taskId: string) {
  const { data, error } = await supabase.from('task_comments')
    .select('*, user:profiles(full_name)')
    .eq('task_id', taskId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function addComment(taskId: string, userId: string, comment: string) {
  const { error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: userId, comment });
  if (error) throw error;
}

// ============================================================
// Evidence (PRD 2.6)
// ============================================================

export async function fetchEvidence(orgId: string) {
  const { data, error } = await supabase.from('evidence')
    .select('*, uploader:profiles!evidence_owner_id_fkey(full_name), links:evidence_control_links(control_assessment_id), versions:evidence_versions(id, version, created_at)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvidenceLinks(evidenceId: string) {
  const { data, error } = await supabase.from('evidence_control_links')
    .select('control_assessment_id, assessment:compliance_assessments(id, status, framework_controls(control_id, title, framework_id, frameworks(name)))')
    .eq('evidence_id', evidenceId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Upload binary to the private evidence bucket (path: orgId/timestamp_name),
 * then insert the evidence row and optional control link.
 */
export async function uploadEvidence(
  orgId: string,
  userId: string,
  file: { uri: string; name: string; mimeType?: string; size?: number },
  meta: { title: string; description?: string; expiry?: string; assessmentId?: string | null; assessmentIds?: string[] },
) {
  if (file.size && file.size > 25 * 1024 * 1024) throw new Error('File exceeds the 25 MB limit.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${orgId}/${Date.now()}_${safeName}`;
  const contentType = file.mimeType || 'application/octet-stream';

  const bytes = await fileToArrayBuffer(file.uri);
  const { error: upErr } = await supabase.storage.from('evidence').upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.from('evidence').insert({
    organization_id: orgId,
    title: meta.title,
    description: meta.description || null,
    type: file.name.split('.').pop()?.toLowerCase() ?? null,
    file_path: path,
    file_size: file.size ?? null,
    mime_type: file.mimeType ?? null,
    expiry_date: meta.expiry || null,
    owner_id: userId,
    status: 'pending',
    version: 1,
  }).select().single();
  if (error) throw error;

  const assessmentIds = Array.from(new Set([
    ...(meta.assessmentIds ?? []),
    ...(meta.assessmentId ? [meta.assessmentId] : []),
  ].filter(Boolean)));

  if (assessmentIds.length) {
    const { error: linkErr } = await supabase.from('evidence_control_links').insert(
      assessmentIds.map((control_assessment_id) => ({ evidence_id: data.id, control_assessment_id })),
    );
    if (linkErr && linkErr.code !== '23505') throw linkErr;
    await supabase
      .from('compliance_assessments')
      .update({ updated_at: new Date().toISOString() })
      .in('id', assessmentIds);
  }

  return data;
}

const EVIDENCE_COLUMNS = ['title', 'description', 'expiry_date', 'status'];

export async function updateEvidence(id: string, fields: any) {
  const patch: any = {};
  for (const key of EVIDENCE_COLUMNS) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('evidence').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setEvidenceStatus(id: string, status: 'pending' | 'approved' | 'rejected' | 'expired') {
  await updateEvidence(id, { status });
}

export async function fetchEvidenceVersions(evidenceId: string) {
  const { data, error } = await supabase.from('evidence_versions')
    .select('*, uploader:profiles(full_name)')
    .eq('evidence_id', evidenceId)
    .order('version', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addEvidenceVersion(
  evidenceId: string,
  orgId: string,
  userId: string,
  file: { uri: string; name: string; mimeType?: string; size?: number },
) {
  if (file.size && file.size > 25 * 1024 * 1024) throw new Error('File exceeds the 25 MB limit.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${orgId}/${Date.now()}_v_${safeName}`;
  const bytes = await fileToArrayBuffer(file.uri);
  const { error: upErr } = await supabase.storage.from('evidence').upload(path, bytes, {
    contentType: file.mimeType || 'application/octet-stream',
    upsert: false,
    cacheControl: '3600',
  });
  if (upErr) throw upErr;

  const { data: current, error: curErr } = await supabase.from('evidence')
    .select('version').eq('id', evidenceId).single();
  if (curErr) throw curErr;
  const nextVersion = (current?.version ?? 1) + 1;

  const { error: verErr } = await supabase.from('evidence_versions').insert({
    evidence_id: evidenceId,
    file_path: path,
    version: nextVersion,
    uploaded_by: userId,
  });
  if (verErr) throw verErr;

  const { error: evErr } = await supabase.from('evidence').update({
    file_path: path,
    file_size: file.size ?? null,
    mime_type: file.mimeType ?? null,
    type: file.name.split('.').pop()?.toLowerCase() ?? null,
    version: nextVersion,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }).eq('id', evidenceId);
  if (evErr) throw evErr;
}

export async function linkEvidenceToControl(evidenceId: string, assessmentId: string) {
  const { error } = await supabase.from('evidence_control_links').insert({
    evidence_id: evidenceId,
    control_assessment_id: assessmentId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function signedEvidenceUrl(path: string) {
  const { data, error } = await supabase.storage.from('evidence').createSignedUrl(path, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not create a signed URL for this file.');
  return data.signedUrl;
}

export async function deleteEvidence(id: string, path: string) {
  await supabase.storage.from('evidence').remove([path]);
  const { error } = await supabase.from('evidence').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Members, Invitations & Org
// ============================================================

export async function fetchMembers(orgId: string) {
  const { data, error } = await supabase.from('organization_memberships')
    .select('*, profile:profiles(email, full_name, job_title)')
    .eq('organization_id', orgId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createInvitation(orgId: string, email: string, role: string, invitedBy: string) {
  const { data, error } = await supabase.from('invitations').upsert(
    { organization_id: orgId, email: email.toLowerCase().trim(), role, invited_by: invitedBy },
    { onConflict: 'organization_id,email' },
  ).select().single();
  if (error) throw error;
  return data;
}

export async function fetchInvitations(orgId: string) {
  const { data, error } = await supabase.from('invitations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Redeem an invite token (supabase/migrations/0007_accept_invitation.sql). */
export async function acceptInvitation(token: string) {
  const { data, error } = await supabase.rpc('accept_invitation', { invite_token: token });
  if (error) throw error;
  return data as { organization_id: string; role: string }[];
}

export async function updateOrg(orgId: string, fields: any) {
  const { error } = await supabase.from('organizations').update(fields).eq('id', orgId);
  if (error) throw error;
}

export async function updateProfile(userId: string, fields: any) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateMemberRole(orgId: string, userId: string, role: string) {
  const { error } = await supabase.from('organization_memberships')
    .update({ role })
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setMemberStatus(orgId: string, userId: string, status: 'active' | 'inactive') {
  const { error } = await supabase.from('organization_memberships')
    .update({ status })
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeMember(orgId: string, userId: string) {
  const { error } = await supabase.from('organization_memberships')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ============================================================
// Notifications & Activity (PRD 2.9 / 2.8)
// ============================================================

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function markAllRead(userId: string) {
  const { error } = await supabase.from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function markRead(notificationId: string) {
  const { error } = await supabase.from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function fetchActivity(orgId: string) {
  const { data, error } = await supabase.from('activity_logs')
    .select('*, actor:profiles(full_name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/** Activity for one record (control, risk, task, evidence). */
export async function fetchResourceActivity(resourceId: string) {
  const { data, error } = await supabase.from('activity_logs')
    .select('*, actor:profiles(full_name)')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return data ?? [];
}

/** Paginated, filterable audit log for the dedicated audit screen. */
export async function fetchAuditLog(
  orgId: string,
  options: { resourceType?: string; search?: string; from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  let query = supabase.from('activity_logs')
    .select('*, actor:profiles(full_name)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (options.resourceType && options.resourceType !== 'all') {
    query = query.eq('resource_type', options.resourceType);
  }
  if (options.search?.trim()) {
    const q = options.search.trim().replace(/[%,]/g, '');
    query = query.or(`action.ilike.%${q}%,resource_type.ilike.%${q}%`);
  }
  if (options.from) query = query.gte('created_at', `${options.from}T00:00:00`);
  if (options.to) query = query.lte('created_at', `${options.to}T23:59:59`);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

// ============================================================
// Audits & Findings
// ============================================================

export interface AuditFinding {
  id: string;
  audit_id: string;
  title: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  status: string | null;
  remediation_deadline: string | null;
  corrective_action: string | null;
  created_at: string;
}

export interface AuditRow {
  id: string;
  organization_id: string;
  title: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  scope: string | null;
  objectives: string | null;
  auditor_ids: string[] | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  progress_pct: number | null;
  created_by: string | null;
  created_at: string;
  findings?: Pick<AuditFinding, 'id' | 'severity' | 'status'>[];
}

export async function fetchAudits(orgId: string) {
  const { data, error } = await supabase.from('audits')
    .select('*, findings:audit_findings(id, severity, status)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AuditRow[];
}

export async function fetchAudit(auditId: string) {
  const { data, error } = await supabase.from('audits')
    .select('*, findings:audit_findings(*)')
    .eq('id', auditId)
    .single();
  if (error) throw error;
  return data as Omit<AuditRow, 'findings'> & { findings: AuditFinding[] };
}

export async function createAudit(orgId: string, userId: string, fields: any) {
  const { data, error } = await supabase.from('audits').insert({
    organization_id: orgId,
    title: fields.title,
    scope: fields.scope || null,
    objectives: fields.objectives || null,
    status: fields.status ?? 'planned',
    scheduled_start: fields.scheduled_start || null,
    scheduled_end: fields.scheduled_end || null,
    progress_pct: fields.progress_pct ?? 0,
    created_by: userId,
  }).select().single();
  if (error) throw error;
  return data as AuditRow;
}

export async function updateAudit(id: string, fields: any) {
  const { error } = await supabase.from('audits').update(fields).eq('id', id);
  if (error) throw error;
}

export async function createAuditFinding(auditId: string, fields: any) {
  const { data, error } = await supabase.from('audit_findings').insert({
    audit_id: auditId,
    title: fields.title,
    description: fields.description || null,
    severity: fields.severity || 'medium',
    status: fields.status ?? 'open',
    remediation_deadline: fields.remediation_deadline || null,
    corrective_action: fields.corrective_action || null,
  }).select().single();
  if (error) throw error;
  return data as AuditFinding;
}

export async function updateAuditFinding(id: string, fields: any) {
  const { error } = await supabase.from('audit_findings').update(fields).eq('id', id);
  if (error) throw error;
}

/** Update the implementation notes on a compliance_assessment. */
export async function setAssessmentNotes(assessmentId: string, notes: string | null) {
  const { error } = await supabase
    .from('compliance_assessments')
    .update({ implementation_notes: notes, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (error) throw error;
}

/** Update the owner_id on a compliance_assessment. */
export async function setAssessmentOwner(assessmentId: string, ownerId: string | null) {
  const { error } = await supabase
    .from('compliance_assessments')
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (error) throw error;
}

// ============================================================
// AI Assistant (PRD 2.6) — via Edge Function, key never on client
// ============================================================

export async function askAI(
  orgId: string,
  query: string,
  context?: string,
): Promise<{ answer: string; sources: string[]; is_demo: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { query, organization_id: orgId, context: context ?? 'general' },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { answer: data.answer ?? 'No response.', sources: data.sources ?? [], is_demo: !!data.is_demo };
  } catch {
    return {
      answer: `[DEMO — AI service unavailable] "${query}". General guidance: prioritise controls with missing evidence, review open critical risks weekly, and keep CERT-In 6-hour reporting and 180-day log retention automated. This is not legal advice.`,
      sources: ['DPDP Act 2023', 'CERT-In Directions', 'ISO 27001'],
      is_demo: true,
    };
  }
}
