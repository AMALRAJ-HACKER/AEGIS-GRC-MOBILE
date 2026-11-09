import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { useCurrentOrg } from '@/hooks/useOrg';
import { useResponsive } from '@/lib/responsive';
import { canAddRisk } from '@/lib/permissions';
import { fetchRisks, fetchRiskLinks, updateRisk, archiveRisk } from '@/services/api';
import { fmtDate, logActivity, riskStatusLabel, timeAgo, severityFromScore } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { ChevronLeftIcon, PencilIcon } from '@/components/icons/ActionIcons';
import { LIKELIHOOD_HINTS, IMPACT_HINTS } from '@/components/risks/RiskForm';

const STATUSES = ['open', 'mitigating', 'accepted', 'closed'] as const;

const zoneColor = (score: number) => {
  if (score >= 17) return '#EF4444';
  if (score >= 10) return '#F97316';
  if (score >= 5) return '#F59E0B';
  return '#10B981';
};

export default function RiskDetail() {
  const { riskId } = useLocalSearchParams<{ riskId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { colors, isDark } = useTheme();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const canEdit = canAddRisk(org?.role);

  const [saving, setSaving] = useState(false);
  const [savingMitigation, setSavingMitigation] = useState(false);
  const [mitigation, setMitigation] = useState<string | null>(null);

  const { data: risks, isLoading: risksLoading } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['risks', org?.orgId],
    queryFn: () => fetchRisks(org!.orgId),
  });
  const risk = (risks ?? []).find((k: any) => k.id === riskId) as any;

  const { data: riskLinks } = useQuery({
    enabled: !!riskId,
    queryKey: ['riskLinks', riskId],
    queryFn: () => fetchRiskLinks(riskId!),
  });

  const { data: history } = useQuery({
    enabled: !!riskId,
    queryKey: ['riskHistory', riskId],
    queryFn: async () => {
      const { data } = await supabase
        .from('risk_history')
        .select('*, user:profiles(full_name)')
        .eq('risk_id', riskId!)
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const goBackToRisks = () => {
    try {
      r.replace('/(tabs)/risks' as any);
    } catch {
      try {
        r.navigate('/(tabs)/risks' as any);
      } catch {
        r.push('/(tabs)/risks' as any);
      }
    }
  };

  const setStatus = async (status: string) => {
    if (!risk) return;
    setSaving(true);
    try {
      const patch: any = { status };
      if (status === 'accepted') patch.accepted_at = new Date().toISOString();
      if (mitigation !== null) patch.mitigation_plan = mitigation;
      await updateRisk(risk.id, patch);
      await supabase.from('risk_history').insert({
        risk_id: risk.id,
        changed_by: org?.userId,
        field_changed: 'status',
        old_value: risk.status,
        new_value: status,
      });
      await logActivity(org!.orgId, 'status_changed', 'risk', risk.id, { from: risk.status, to: status });
      qc.invalidateQueries({ queryKey: ['risks'] });
      qc.invalidateQueries({ queryKey: ['riskHistory'] });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMitigation = async () => {
    if (!risk || mitigation === null) return;
    setSavingMitigation(true);
    try {
      await updateRisk(risk.id, { mitigation_plan: mitigation });
      await logActivity(org!.orgId, 'risk_updated', 'risk', risk.id, { field: 'mitigation_plan' });
      qc.invalidateQueries({ queryKey: ['risks'] });
      Alert.alert('Saved', 'Mitigation plan updated successfully.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not update mitigation plan.');
    } finally {
      setSavingMitigation(false);
    }
  };

  const archive = () => {
    if (!risk) return;
    Alert.alert(
      'Archive risk',
      `Archive “${risk.title}”? It will be removed from the active register but its history is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveRisk(risk.id, true);
              await logActivity(org!.orgId, 'risk_archived', 'risk', risk.id, { title: risk.title });
              qc.invalidateQueries({ queryKey: ['risks'] });
              goBackToRisks();
            } catch (e: any) {
              Alert.alert('Archive failed', e?.message ?? 'Try again.');
            }
          },
        },
      ],
    );
  };

  if (!risk) {
    return (
      <Screen>
        <SwipeBackContainer onBack={goBackToRisks}>
          <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: 'center' }}>
              {risksLoading ? 'Loading risk details…' : 'This risk was not found or has been archived.'}
            </Text>
            <Button title="‹ Back to Risk Register" variant="secondary" onPress={goBackToRisks} />
          </View>
        </SwipeBackContainer>
      </Screen>
    );
  }

  const code = `RSK-${String(risk.id).slice(0, 8).toUpperCase()}`;
  const inherentScore = Number(risk.inherent_score || (risk.likelihood * risk.impact) || 0);
  const residualScore = risk.residual_score != null ? Number(risk.residual_score) : null;

  return (
    <Screen>
      <SwipeBackContainer onBack={goBackToRisks}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: Math.max(bottomInset + 120, 160),
            paddingHorizontal: hPad,
            gap: spacing.md,
            maxWidth: maxContent ?? 760,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {/* Top Header Row: Navigation & Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Pressable
              onPress={goBackToRisks}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to risks register"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
            >
              <ChevronLeftIcon color={colors.textMuted} size={20} />
              <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 14 }}>
                Risk Register
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {canEdit ? (
                <Pressable
                  onPress={() => r.push(`/(tabs)/risks/${risk.id}/edit` as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit risk"
                  hitSlop={8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <PencilIcon color={colors.heading} size={14} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.heading }}>Edit</Text>
                </Pressable>
              ) : null}

              {canEdit ? (
                <Pressable
                  onPress={archive}
                  accessibilityRole="button"
                  accessibilityLabel="Archive risk"
                  hitSlop={8}
                  style={{
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(239,68,68,0.4)' : '#FCA5A5',
                    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red }}>Archive</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Risk Title & Status Banner */}
          <Card style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? colors.teal : '#0284C7', letterSpacing: 0.8 }}>
                  {code}
                </Text>
                <Badge
                  label={risk.severity.toUpperCase()}
                  tone={
                    risk.severity === 'critical'
                      ? 'critical'
                      : risk.severity === 'high'
                      ? 'warning'
                      : risk.severity === 'medium'
                      ? 'info'
                      : 'default'
                  }
                />
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceAlt,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.heading }}>
                  Status: {riskStatusLabel(risk.status)}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.heading, lineHeight: 26 }}>
              {risk.title}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Category: <Text style={{ fontWeight: '600', color: colors.text }}>{risk.category ?? 'Uncategorised'}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>·</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Owner: <Text style={{ fontWeight: '600', color: colors.text }}>{risk.owner?.full_name ?? 'Unassigned'}</Text>
              </Text>
              {risk.target_date ? (
                <>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>·</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    Target: <Text style={{ fontWeight: '600', color: colors.text }}>{fmtDate(risk.target_date)}</Text>
                  </Text>
                </>
              ) : null}
            </View>
          </Card>

          {/* Inherent & Residual Score Cards */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Inherent Risk Card */}
            <Card
              style={{
                flex: 1,
                alignItems: 'center',
                padding: 14,
                gap: 4,
                borderTopWidth: 3,
                borderTopColor: zoneColor(inherentScore),
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.textMuted }}>
                INHERENT SCORE
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '900', color: zoneColor(inherentScore), marginVertical: 2 }}>
                {inherentScore}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.heading }}>
                {risk.likelihood} × {risk.impact} ({risk.severity.toUpperCase()})
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>
                L: {LIKELIHOOD_HINTS[risk.likelihood - 1] ?? risk.likelihood} · I: {IMPACT_HINTS[risk.impact - 1] ?? risk.impact}
              </Text>
            </Card>

            {/* Residual Risk Card */}
            <Card
              style={{
                flex: 1,
                alignItems: 'center',
                padding: 14,
                gap: 4,
                borderTopWidth: 3,
                borderTopColor: residualScore != null ? zoneColor(residualScore) : colors.border,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.textMuted }}>
                RESIDUAL SCORE
              </Text>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '900',
                  color: residualScore != null ? zoneColor(residualScore) : colors.textMuted,
                  marginVertical: 2,
                }}
              >
                {residualScore != null ? residualScore : '—'}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.heading }}>
                {risk.residual_likelihood && risk.residual_impact
                  ? `${risk.residual_likelihood} × ${risk.residual_impact} (${severityFromScore(residualScore!).toUpperCase()})`
                  : 'Not Assessed'}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>
                {risk.residual_likelihood && risk.residual_impact
                  ? `L: ${LIKELIHOOD_HINTS[risk.residual_likelihood - 1] ?? risk.residual_likelihood} · I: ${IMPACT_HINTS[risk.residual_impact - 1] ?? risk.residual_impact}`
                  : 'After safeguards evaluation'}
              </Text>
            </Card>
          </View>

          {/* Description */}
          {risk.description ? (
            <Card style={{ padding: 14, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.heading }}>Description</Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.text }}>{risk.description}</Text>
            </Card>
          ) : null}

          {/* Existing Safeguards */}
          {risk.existing_safeguards ? (
            <Card style={{ padding: 14, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.heading }}>Existing Safeguards</Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.text }}>{risk.existing_safeguards}</Text>
            </Card>
          ) : null}

          {/* Linked Controls */}
          <Card style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.heading }}>
                Linked Controls ({riskLinks?.length ?? 0})
              </Text>
              {canEdit ? (
                <Pressable
                  onPress={() => r.push(`/(tabs)/risks/${risk.id}/edit` as any)}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? colors.teal : '#0284C7' }}>
                    Manage ›
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {riskLinks?.length ? (
              riskLinks.map((l: any) => {
                const fc = l.assessment?.framework_controls;
                if (!fc) return null;
                return (
                  <Pressable
                    key={l.control_assessment_id}
                    onPress={() =>
                      fc.framework_id &&
                      r.push(`/(tabs)/frameworks/${fc.framework_id}/${fc.id}` as any)
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? colors.teal : '#0284C7' }}>
                        {fc.control_id}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{fc.title}</Text>
                    </View>
                    <Badge
                      label={fc.frameworks?.name?.split(/[:(]/)[0]?.trim() ?? 'Control'}
                      tone="default"
                    />
                  </Pressable>
                );
              })
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>No controls linked to this risk yet.</Text>
            )}
          </Card>

          {/* Mitigation Plan Card */}
          <Card style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.heading }}>Mitigation Plan</Text>
              {mitigation !== null && mitigation !== (risk.mitigation_plan ?? '') ? (
                <Button
                  title="Save Plan"
                  size="sm"
                  loading={savingMitigation}
                  onPress={handleSaveMitigation}
                />
              ) : null}
            </View>
            <Input
              value={mitigation ?? risk.mitigation_plan ?? ''}
              onChangeText={setMitigation}
              multiline
              numberOfLines={3}
              placeholder="Planned treatment steps…"
            />
          </Card>

          {/* Status Actions */}
          <Card style={{ padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.heading }}>Update Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {STATUSES.map((s) => {
                const isSelected = risk.status === s;
                return (
                  <Pressable
                    key={s}
                    disabled={saving || isSelected}
                    onPress={() => setStatus(s)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.navy : colors.border,
                      backgroundColor: isSelected ? colors.navy : colors.surfaceAlt,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isSelected ? '#FFFFFF' : colors.text,
                      }}
                    >
                      {s === 'accepted' ? 'Risk Accepted' : s[0].toUpperCase() + s.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Action Button: Create Task from Risk */}
          <Button
            title="+ Create Task from Risk"
            variant="secondary"
            onPress={() =>
              r.push({
                pathname: '/(tabs)/tasks/new' as any,
                params: { riskId: risk.id },
              })
            }
          />

          {/* History */}
          {history?.length ? (
            <Card style={{ padding: 14, gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.heading }}>Audit History</Text>
              {history.map((h: any) => (
                <View
                  key={h.id}
                  style={{
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>
                    {h.user?.full_name ?? 'Staff member'} changed {h.field_changed}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {h.old_value ? `From: ${h.old_value} → ` : ''}To: {h.new_value} · {timeAgo(h.created_at)}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </SwipeBackContainer>
    </Screen>
  );
}
