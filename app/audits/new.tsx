import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useCurrentOrg } from '@/hooks/useOrg';
import { createAudit, type AuditRow } from '@/services/api';
import { logActivity } from '@/lib/format';
import { colors, spacing, radius } from '@/lib/design-tokens';

const STATUSES: { key: AuditRow['status']; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const isDate = (v: string) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function NewAudit() {
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();

  const [form, setForm] = useState({
    title: '',
    scope: '',
    objectives: '',
    scheduled_start: '',
    scheduled_end: '',
    status: 'planned' as AuditRow['status'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!org?.orgId || !org?.userId) {
      setError('Your workspace is still loading. Try again in a moment.');
      return;
    }
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!isDate(form.scheduled_start) || !isDate(form.scheduled_end)) {
      setError('Dates must use YYYY-MM-DD.');
      return;
    }
    if (form.scheduled_start && form.scheduled_end && form.scheduled_end < form.scheduled_start) {
      setError('End date cannot be before the start date.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const created = await createAudit(org.orgId, org.userId, {
        ...form,
        title: form.title.trim(),
        scope: form.scope.trim(),
        objectives: form.objectives.trim(),
        scheduled_start: form.scheduled_start.trim() || null,
        scheduled_end: form.scheduled_end.trim() || null,
      });
      await logActivity(org.orgId, 'audit_created', 'audit', created.id, { title: form.title.trim() });
      await qc.invalidateQueries({ queryKey: ['audits', org.orgId] });
      Alert.alert('Audit created', `"${form.title.trim()}" is ready to plan.`, [
        { text: 'Open audit', onPress: () => r.replace(`/audits/${created.id}`) },
        { text: 'Done', onPress: () => r.replace('/audits') },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create audit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => r.back()} hitSlop={8}>
            <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 13 }}>‹ Back</Text>
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy, flex: 1 }}>New Audit</Text>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
          Define the audit scope and objectives, then schedule the review window. You can add findings and
          corrective actions from the audit detail page.
        </Text>

        {error ? (
          <View style={{ backgroundColor: colors.redLight, borderRadius: radius.sm, padding: 10 }}>
            <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Input
            label="Title"
            value={form.title}
            onChangeText={(v: string) => set('title', v)}
            placeholder="e.g. ISO 27001 Internal Audit — Q4"
          />
          <Input
            label="Scope"
            value={form.scope}
            onChangeText={(v: string) => set('scope', v)}
            placeholder="Teams, systems, locations, and control families in scope…"
            multiline
            numberOfLines={4}
          />
          <Input
            label="Objectives"
            value={form.objectives}
            onChangeText={(v: string) => set('objectives', v)}
            placeholder="What should this audit verify or produce?"
            multiline
            numberOfLines={3}
          />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map((s) => {
                const active = form.status === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => set('status', s.key)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.navy : colors.border,
                      backgroundColor: active ? colors.navy : colors.white,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: active ? 'white' : colors.textMuted }}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Start Date"
                value={form.scheduled_start}
                onChangeText={(v: string) => set('scheduled_start', v)}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="End Date"
                value={form.scheduled_end}
                onChangeText={(v: string) => set('scheduled_end', v)}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="secondary" onPress={() => r.back()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Create Audit" loading={saving} onPress={save} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
