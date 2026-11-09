import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { SlideIn } from '@/components/motion/SlideIn';
import { RiskForm, type RiskFormValues } from '@/components/risks/RiskForm';
import { useCurrentOrg } from '@/hooks/useOrg';
import { canAddRisk } from '@/lib/permissions';
import { fetchRisk, updateRisk, fetchRiskLinks, addRiskHistory } from '@/services/api';
import { logActivity } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditRisk() {
  const { riskId } = useLocalSearchParams<{ riskId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { colors } = useTheme();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = canAddRisk(org?.role);

  const riskQuery = useQuery({
    enabled: !!riskId,
    queryKey: ['risk', riskId],
    queryFn: () => fetchRisk(riskId),
  });

  const linksQuery = useQuery({
    enabled: !!riskId,
    queryKey: ['riskLinks', riskId],
    queryFn: () => fetchRiskLinks(riskId),
  });

  const risk: any = riskQuery.data;

  const save = async (values: RiskFormValues) => {
    if (!risk?.id || !org?.orgId) return;
    if (!allowed) {
      setError('Your role cannot edit risks. Ask an administrator for access.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await updateRisk(risk.id, values);
      const tracked: Array<[string, any, any]> = [
        ['title', risk.title, values.title],
        ['description', risk.description, values.description],
        ['category', risk.category, values.category],
        ['status', risk.status, values.status],
        ['owner_id', risk.owner_id, values.owner_id],
        ['target_date', risk.target_date, values.target_date],
        ['likelihood', risk.likelihood, values.likelihood],
        ['impact', risk.impact, values.impact],
        ['residual_likelihood', risk.residual_likelihood, values.residual_likelihood],
        ['residual_impact', risk.residual_impact, values.residual_impact],
        ['mitigation_plan', risk.mitigation_plan, values.mitigation_plan],
        ['existing_safeguards', risk.existing_safeguards, values.existing_safeguards],
      ];
      for (const [field, before, after] of tracked) {
        if (String(before ?? '') !== String(after ?? '')) {
          await addRiskHistory(risk.id, org.userId, field, before, after);
        }
      }
      await logActivity(org.orgId, 'risk_updated', 'risk', risk.id, { title: values.title });
      await qc.invalidateQueries({ queryKey: ['risks', org.orgId] });
      await qc.invalidateQueries({ queryKey: ['risk', risk.id] });
      await qc.invalidateQueries({ queryKey: ['riskLinks', risk.id] });
      await qc.invalidateQueries({ queryKey: ['riskHistory', risk.id] });
      r.replace('/(tabs)/risks');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save risk.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SlideIn>
        <View style={{ flex: 1, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => r.back()} hitSlop={8}>
              <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 13 }}>‹ Back</Text>
            </Pressable>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading, flex: 1 }}>Edit Risk</Text>
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
            Update the inherent and residual scoring, safeguards, mitigation plan and target date.
          </Text>

          {riskQuery.isLoading ? (
            <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
              <ActivityIndicator color={colors.teal} />
              <Text style={{ color: colors.textMuted }}>Loading risk…</Text>
            </Card>
          ) : riskQuery.error ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ fontWeight: '800', color: colors.heading }}>Could not load this risk</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {(riskQuery.error as any)?.message ?? 'Try again from the risk register.'}
              </Text>
            </Card>
          ) : !allowed ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ fontWeight: '800', color: colors.heading }}>You do not have permission to edit risks</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                Risk editing is limited to super admins, organization admins, GRC analysts and IT security.
                Ask an administrator to update your role.
              </Text>
            </Card>
          ) : risk ? (
            <RiskForm
              mode="edit"
              initialValues={{
                title: risk.title ?? '',
                description: risk.description ?? '',
                category: risk.category ?? 'Technical',
                likelihood: risk.likelihood ?? 3,
                impact: risk.impact ?? 3,
                residual_likelihood: risk.residual_likelihood ?? 3,
                residual_impact: risk.residual_impact ?? 3,
                existing_safeguards: risk.existing_safeguards ?? '',
                mitigation_plan: risk.mitigation_plan ?? '',
                target_date: risk.target_date ?? '',
                owner_id: risk.owner_id ?? '',
                status: risk.status ?? 'open',
                assessment_ids: (linksQuery.data ?? []).map((l: any) => l.control_assessment_id),
              }}
              saving={saving}
              serverError={error}
              onSubmit={save}
              onCancel={() => r.back()}
            />
          ) : null}
        </View>
      </SlideIn>
    </Screen>
  );
}
