import { useState, useEffect } from 'react';
import {
  Pressable,
  Text,
  View,
  ScrollView,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchMembers } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { riskStatusLabel, severityFromScore } from '@/lib/format';
import { radius, spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export const RISK_CATEGORIES = ['Operational', 'Technical', 'Compliance', 'Strategic', 'Financial', 'Other'];
export const LIKELIHOOD_HINTS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
export const IMPACT_HINTS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];
export const RISK_STATUSES = ['open', 'mitigating', 'accepted', 'closed'];

export type RiskFormValues = {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  residual_likelihood: number;
  residual_impact: number;
  existing_safeguards: string;
  mitigation_plan: string;
  target_date: string;
  owner_id: string;
  status: string;
  assessment_ids: string[];
};

export const EMPTY_RISK: RiskFormValues = {
  title: '',
  description: '',
  category: 'Technical',
  likelihood: 3,
  impact: 3,
  residual_likelihood: 3,
  residual_impact: 3,
  existing_safeguards: '',
  mitigation_plan: '',
  target_date: '',
  owner_id: '',
  status: 'open',
  assessment_ids: [],
};

function severityTone(sev: string): 'critical' | 'warning' | 'info' | 'success' {
  if (sev === 'critical') return 'critical';
  if (sev === 'high') return 'warning';
  if (sev === 'medium') return 'info';
  return 'success';
}

function Scale({
  label,
  value,
  onChange,
  hints,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hints: string[];
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${n} ${hints[n - 1]}`}
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                minHeight: 58,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 2,
                paddingVertical: 6,
                gap: 2,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: active ? colors.onPrimary : colors.text }}>
                {n}
              </Text>
              <Text
                style={{
                  fontSize: 8,
                  lineHeight: 10,
                  textAlign: 'center',
                  color: active ? colors.onPrimary : colors.text,
                  opacity: active ? 0.78 : 1,
                }}
              >
                {hints[n - 1]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ScoreSummary({ label, score, severity, muted = false }: { label: string; score: number; severity: string; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '800', color: muted ? colors.textMuted : colors.heading }}>{score}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
        {label} → {severity}
      </Text>
    </View>
  );
}

export function RiskForm({
  mode,
  initialValues,
  saving,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initialValues?: Partial<RiskFormValues>;
  saving: boolean;
  serverError?: string | null;
  onSubmit: (values: RiskFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const { data: org } = useCurrentOrg();
  const [form, setForm] = useState<RiskFormValues>({ ...EMPTY_RISK, ...initialValues });
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: members } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['members', org?.orgId],
    queryFn: () => fetchMembers(org!.orgId),
  });

  const { data: assessments } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['assessmentsForRisk', org?.orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('compliance_assessments')
        .select('id, status, framework_controls(control_id, title, framework_id, frameworks(name))')
        .eq('organization_id', org!.orgId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleControl = (id: string) => {
    setForm((prev) => {
      const has = prev.assessment_ids.includes(id);
      return {
        ...prev,
        assessment_ids: has ? prev.assessment_ids.filter((x) => x !== id) : [...prev.assessment_ids, id],
      };
    });
  };

  const set = <K extends keyof RiskFormValues>(key: K, value: RiskFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inherent = form.likelihood * form.impact;
  const residual = form.residual_likelihood * form.residual_impact;
  const inherentSeverity = severityFromScore(inherent);
  const residualSeverity = severityFromScore(residual);
  const error = localError ?? serverError ?? null;

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const submit = () => {
    if (!form.title.trim()) {
      setLocalError('Risk title is required.');
      return;
    }
    if (form.target_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.target_date)) {
      setLocalError('Choose a valid target date.');
      return;
    }
    setLocalError(null);
    void onSubmit({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      existing_safeguards: form.existing_safeguards.trim(),
      mitigation_plan: form.mitigation_plan.trim(),
      target_date: form.target_date,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {keyboardVisible ? (
          <Pressable
            onPress={() => Keyboard.dismiss()}
            style={{
              alignSelf: 'flex-end',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.teal,
              marginBottom: -4,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.teal }}>
              Dismiss Keyboard ▾
            </Text>
          </Pressable>
        ) : null}
      {error ? (
        <View
          style={{
            backgroundColor: colors.criticalBg,
            borderWidth: 1,
            borderColor: colors.red,
            borderRadius: radius.sm,
            padding: 10,
          }}
        >
          <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{error}</Text>
        </View>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.heading }}>Basic Info</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Name the risk and describe what could happen.</Text>
        </View>

        <Input
          label="Risk Title *"
          value={form.title}
          onChangeText={(v: string) => set('title', v)}
          placeholder="e.g. Unencrypted customer data at rest"
          autoCapitalize="sentences"
        />
        <Input
          label="Description"
          value={form.description}
          onChangeText={(v: string) => set('description', v)}
          placeholder="What could happen, how, and which assets are affected…"
          multiline
          numberOfLines={4}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {RISK_CATEGORIES.map((c) => {
              const active = form.category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => set('category', c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: active ? colors.onPrimary : colors.text }}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.heading }}>Ownership & Status</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Assign an accountable owner and track treatment state.</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Risk Owner</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(members ?? []).map((m: any) => {
              const active = form.owner_id === m.user_id;
              const label = m.profile?.full_name || m.profile?.email || 'Member';
              return (
                <Pressable
                  key={m.id ?? m.user_id}
                  onPress={() => set('owner_id', m.user_id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: active ? colors.onPrimary : colors.text }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            {!members?.length ? <Text style={{ fontSize: 11, color: colors.textMuted }}>Loading team…</Text> : null}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {RISK_STATUSES.map((s) => {
              const active = form.status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => set('status', s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: active ? colors.onPrimary : colors.text }}>
                    {riskStatusLabel(s)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.heading }}>Inherent Risk</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Likelihood × Impact before controls</Text>
          </View>
          <Badge label={inherentSeverity} tone={severityTone(inherentSeverity)} />
        </View>

        <Scale
          label={`Likelihood (${form.likelihood})`}
          value={form.likelihood}
          onChange={(n) => set('likelihood', n)}
          hints={LIKELIHOOD_HINTS}
        />
        <Scale
          label={`Impact (${form.impact})`}
          value={form.impact}
          onChange={(n) => set('impact', n)}
          hints={IMPACT_HINTS}
        />
        <ScoreSummary label="Inherent Score" score={inherent} severity={inherentSeverity} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.heading }}>Residual Risk</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Score again after existing safeguards</Text>
          </View>
          <Badge label={residualSeverity} tone={severityTone(residualSeverity)} />
        </View>

        <Scale
          label={`Residual Likelihood (${form.residual_likelihood})`}
          value={form.residual_likelihood}
          onChange={(n) => set('residual_likelihood', n)}
          hints={LIKELIHOOD_HINTS}
        />
        <Scale
          label={`Residual Impact (${form.residual_impact})`}
          value={form.residual_impact}
          onChange={(n) => set('residual_impact', n)}
          hints={IMPACT_HINTS}
        />
        <ScoreSummary label="Residual Score" score={residual} severity={residualSeverity} muted />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.heading }}>Linked Controls</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>
            Optional — connect this risk to the controls that treat it.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(assessments ?? []).map((a: any) => {
            const active = form.assessment_ids.includes(a.id);
            const code = a.framework_controls?.control_id ?? 'Control';
            const fw = a.framework_controls?.frameworks?.name?.split(/[:(]/)[0]?.trim();
            return (
              <Pressable
                key={a.id}
                onPress={() => toggleControl(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  maxWidth: '100%',
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.surface,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 10, fontWeight: '600', color: active ? colors.onPrimary : colors.text }}
                >
                  {fw ? `${fw} · ` : ''}{code}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!(assessments ?? []).length ? (
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Activate a framework to link controls.</Text>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Input
          label="Existing Safeguards"
          value={form.existing_safeguards}
          onChangeText={(v: string) => set('existing_safeguards', v)}
          placeholder="Controls already in place…"
          multiline
          numberOfLines={3}
          style={{ minHeight: 82, textAlignVertical: 'top' }}
        />
        <Input
          label="Mitigation Plan"
          value={form.mitigation_plan}
          onChangeText={(v: string) => set('mitigation_plan', v)}
          placeholder="Steps to reduce the risk…"
          multiline
          numberOfLines={3}
          style={{ minHeight: 82, textAlignVertical: 'top' }}
        />
        <DatePickerField
          label="Target Date"
          value={form.target_date}
          onChange={(v) => set('target_date', v)}
          placeholder="Select a target date"
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={mode === 'edit' ? 'Save Changes' : 'Create Risk'} loading={saving} onPress={submit} />
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
