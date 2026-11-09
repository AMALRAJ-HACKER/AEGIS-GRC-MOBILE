import { useState, useEffect } from 'react';
import { Pressable, Text, View, Keyboard, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { SlideIn } from '@/components/motion/SlideIn';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { RiskForm, type RiskFormValues } from '@/components/risks/RiskForm';
import { useCurrentOrg } from '@/hooks/useOrg';
import { canAddRisk } from '@/lib/permissions';
import { createRisk } from '@/services/api';
import { logActivity } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function AddRisk() {
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org, isLoading } = useCurrentOrg();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ assessmentId?: string }>();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  const allowed = isLoading ? false : (org?.role ? canAddRisk(org.role) : false);

  const save = async (values: RiskFormValues) => {
    if (!org?.orgId || !org?.userId) {
      setError('Your workspace is still loading. Try again in a moment.');
      return;
    }
    if (!allowed) {
      setError('Your role cannot create risks. Ask an administrator for access.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const created = await createRisk(org.orgId, org.userId, values);
      await logActivity(org.orgId, 'risk_created', 'risk', created.id, { title: values.title });
      await qc.invalidateQueries({ queryKey: ['risks', org.orgId] });
      await qc.invalidateQueries({ queryKey: ['fwStats', org.orgId] });
      r.replace('/(tabs)/risks');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save risk.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SwipeBackContainer onBack={goBackToRisks}>
        <SlideIn>
          <View style={{ flex: 1, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={goBackToRisks} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to risks">
                <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 13 }}>‹ Back</Text>
              </Pressable>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading, flex: 1 }}>New Risk</Text>
              {keyboardVisible ? (
                <Pressable
                  onPress={() => Keyboard.dismiss()}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.teal,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.teal }}>Dismiss ▾</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
              Score likelihood × impact to derive the inherent severity, then record residual risk after
              existing safeguards.
            </Text>

            {isLoading ? (
              <Card>
                <Text style={{ color: colors.textMuted }}>Loading workspace…</Text>
              </Card>
            ) : !allowed ? (
              <Card style={{ gap: 8 }}>
                <Text style={{ fontWeight: '800', color: colors.heading }}>You do not have permission to add risks</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                  Risk creation is limited to super admins, organization admins, GRC analysts and IT security.
                  Ask an administrator to update your role.
                </Text>
              </Card>
            ) : (
              <RiskForm
                mode="create"
                saving={saving}
                serverError={error}
                initialValues={{
                  owner_id: org?.userId ?? '',
                  status: 'open',
                  assessment_ids: params.assessmentId ? [params.assessmentId] : [],
                }}
                onSubmit={save}
                onCancel={goBackToRisks}
              />
            )}
          </View>
        </SlideIn>
      </SwipeBackContainer>
    </Screen>
  );
}
