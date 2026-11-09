import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useCurrentOrg } from '@/hooks/useOrg';
import {
  fetchAudit,
  updateAudit,
  createAuditFinding,
  updateAuditFinding,
  type AuditFinding,
  type AuditRow,
} from '@/services/api';
import { fmtDate, logActivity } from '@/lib/format';
import { colors, spacing, radius } from '@/lib/design-tokens';

const STATUS_LABEL: Record<AuditRow['status'], string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUSES: { key: AuditRow['status']; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

function statusTone(s: string): 'success' | 'warning' | 'critical' | 'info' | 'default' {
  return s === 'completed' ? 'success' : s === 'in_progress' ? 'warning' : s === 'cancelled' ? 'critical' : 'info';
}

function severityTone(s?: string | null): 'success' | 'warning' | 'critical' | 'info' | 'default' {
  return s === 'critical' ? 'critical' : s === 'high' ? 'warning' : s === 'medium' ? 'info' : s === 'low' ? 'success' : 'default';
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          borderRadius: 4,
          backgroundColor: pct >= 80 ? colors.teal : pct >= 40 ? colors.amber : colors.navy,
        }}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.navy : colors.border,
        backgroundColor: active ? colors.navy : colors.white,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: active ? 'white' : colors.textMuted }}>{label}</Text>
    </Pressable>
  );
}

export default function AuditDetail() {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();

  const { data: audit, isLoading } = useQuery({
    enabled: !!auditId,
    queryKey: ['audit', auditId],
    queryFn: () => fetchAudit(auditId!),
  });

  const [saving, setSaving] = useState(false);
  const [findingError, setFindingError] = useState<string | null>(null);
  const [finding, setFinding] = useState({
    title: '',
    description: '',
    severity: 'medium' as (typeof SEVERITIES)[number],
    remediation_deadline: '',
    corrective_action: '',
  });

  const setFindingField = (key: string, value: any) => {
    setFinding((prev) => ({ ...prev, [key]: value }));
  };

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['audit', auditId] });
    if (org?.orgId) await qc.invalidateQueries({ queryKey: ['audits', org.orgId] });
  };

  const applyAudit = async (fields: any, action: string) => {
    if (!audit || !org?.orgId) return;
    setSaving(true);
    try {
      await updateAudit(audit.id, fields);
      await logActivity(org.orgId, action, 'audit', audit.id, { title: audit.title, ...fields });
      await refresh();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const addFinding = async () => {
    if (!audit || !org?.orgId) return;
    if (!finding.title.trim()) {
      setFindingError('Finding title is required.');
      return;
    }
    if (finding.remediation_deadline && !/^\d{4}-\d{2}-\d{2}$/.test(finding.remediation_deadline.trim())) {
      setFindingError('Deadline must use YYYY-MM-DD.');
      return;
    }

    setFindingError(null);
    setSaving(true);
    try {
      const created = await createAuditFinding(audit.id, {
        ...finding,
        title: finding.title.trim(),
        description: finding.description.trim(),
        remediation_deadline: finding.remediation_deadline.trim() || null,
        corrective_action: finding.corrective_action.trim(),
      });
      await logActivity(org.orgId, 'audit_finding_created', 'audit_finding', created.id, {
        audit_id: audit.id,
        title: finding.title.trim(),
      });
      await refresh();
      setFinding({
        title: '',
        description: '',
        severity: 'medium',
        remediation_deadline: '',
        corrective_action: '',
      });
      Alert.alert('Finding added', 'The finding is now tracked against this audit.');
    } catch (e: any) {
      setFindingError(e?.message ?? 'Could not add finding.');
    } finally {
      setSaving(false);
    }
  };

  const resolveFinding = async (f: AuditFinding) => {
    if (!audit || !org?.orgId) return;
    setSaving(true);
    try {
      await updateAuditFinding(f.id, { status: 'closed' });
      await logActivity(org.orgId, 'audit_finding_closed', 'audit_finding', f.id, {
        audit_id: audit.id,
        title: f.title,
      });
      await refresh();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Screen loading style={{ paddingTop: spacing.xl }}>
        <Text style={{ color: colors.textMuted }}>Loading audit…</Text>
      </Screen>
    );
  }

  if (!audit) {
    return (
      <Screen style={{ paddingTop: spacing.xl, gap: spacing.md }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy }}>Audit not found</Text>
        <Text style={{ color: colors.textMuted }}>It may have been deleted or you may not have access.</Text>
        <Button title="Back to audits" onPress={() => r.replace('/audits')} />
      </Screen>
    );
  }

  const pct = Math.max(0, Math.min(100, audit.progress_pct ?? 0));
  const findings = (audit.findings ?? [])
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const openCount = findings.filter((f) => String(f.status ?? '').toLowerCase() !== 'closed').length;
  const schedule =
    audit.scheduled_start || audit.scheduled_end
      ? `${fmtDate(audit.scheduled_start)} → ${fmtDate(audit.scheduled_end)}`
      : 'No schedule';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => r.back()} hitSlop={8}>
          <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 13 }}>‹ Back to audits</Text>
        </Pressable>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: colors.navy }}>{audit.title}</Text>
            <Badge label={STATUS_LABEL[audit.status] ?? 'Unknown'} tone={statusTone(audit.status)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>📅 {schedule}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>· {pct}% complete</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>· {openCount} open finding{openCount === 1 ? '' : 's'}</Text>
          </View>
        </View>

        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: colors.navy }}>Progress</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>{pct}%</Text>
          </View>
          <ProgressBar pct={pct} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {[0, 25, 50, 75, 100].map((n) => (
              <Chip
                key={n}
                label={`${n}%`}
                active={pct === n}
                disabled={saving}
                onPress={() => applyAudit({ progress_pct: n }, 'audit_progress_updated')}
              />
            ))}
          </View>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700', color: colors.navy }}>Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STATUSES.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                active={audit.status === s.key}
                disabled={saving}
                onPress={() => applyAudit({ status: s.key }, 'audit_status_changed')}
              />
            ))}
          </View>
        </Card>

        {audit.scope ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 }}>SCOPE</Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>{audit.scope}</Text>
          </Card>
        ) : null}

        {audit.objectives ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 }}>OBJECTIVES</Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>{audit.objectives}</Text>
          </Card>
        ) : null}

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.navy }}>Findings</Text>
            <Badge label={`${findings.length} total`} tone="default" />
          </View>

          {findings.length === 0 ? (
            <Card>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>No findings recorded yet.</Text>
            </Card>
          ) : (
            findings.map((f) => (
              <Card key={f.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>{f.title}</Text>
                  <Badge label={f.severity ?? 'medium'} tone={severityTone(f.severity)} />
                </View>

                {f.description ? (
                  <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18 }}>{f.description}</Text>
                ) : null}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Badge
                    label={f.status ?? 'open'}
                    tone={String(f.status ?? '').toLowerCase() === 'closed' ? 'success' : 'warning'}
                  />
                  {f.remediation_deadline ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Due {fmtDate(f.remediation_deadline)}</Text>
                  ) : null}
                  {String(f.status ?? '').toLowerCase() !== 'closed' ? (
                    <Pressable onPress={() => resolveFinding(f)} disabled={saving} hitSlop={6}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.teal }}>Mark closed</Text>
                    </Pressable>
                  ) : null}
                </View>

                {f.corrective_action ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17 }}>
                    Corrective action: {f.corrective_action}
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </View>

        <Card style={{ gap: spacing.md }}>
          <View>
            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.navy }}>Record a Finding</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Log gaps, non-conformities, and corrective actions.</Text>
          </View>

          {findingError ? (
            <View style={{ backgroundColor: colors.redLight, borderRadius: radius.sm, padding: 10 }}>
              <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{findingError}</Text>
            </View>
          ) : null}

          <Input
            label="Title"
            value={finding.title}
            onChangeText={(v: string) => setFindingField('title', v)}
            placeholder="e.g. Access reviews not documented"
          />
          <Input
            label="Description"
            value={finding.description}
            onChangeText={(v: string) => setFindingField('description', v)}
            placeholder="What was observed, and why it matters…"
            multiline
            numberOfLines={3}
          />

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Severity</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {SEVERITIES.map((s) => (
                <Chip
                  key={s}
                  label={s[0].toUpperCase() + s.slice(1)}
                  active={finding.severity === s}
                  onPress={() => setFindingField('severity', s)}
                />
              ))}
            </View>
          </View>

          <Input
            label="Remediation Deadline (optional)"
            value={finding.remediation_deadline}
            onChangeText={(v: string) => setFindingField('remediation_deadline', v)}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          <Input
            label="Corrective Action"
            value={finding.corrective_action}
            onChangeText={(v: string) => setFindingField('corrective_action', v)}
            placeholder="Owner, action, and expected evidence…"
            multiline
            numberOfLines={3}
          />

          <Button title="Add Finding" loading={saving} onPress={addFinding} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
