import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCurrentOrg } from '@/hooks/useOrg';
import { Screen } from '@/components/ui/Screen';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { createFramework } from '@/services/api';
import { logActivity } from '@/lib/format';
import { canCreateFramework } from '@/lib/permissions';
import { colors, spacing, radius } from '@/lib/design-tokens';

const CATEGORIES = ['ISO 27001', 'NIST CSF', 'CERT-In', 'DPDP', 'RBI', 'Other'];
const STATUSES = ['Active', 'Inactive', 'Draft'] as const;

function statusTone(s: string): 'success' | 'warning' | 'critical' | 'info' | 'default' {
  return s === 'Active' ? 'success' : s === 'Inactive' ? 'warning' : 'info';
}

export default function NewFramework() {
  const r = useRouter();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    version: '1.0',
    category: 'Other',
    owner: '',
    status: 'Active' as const,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = canCreateFramework(org?.role);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const goBackToFrameworks = () => {
    try {
      r.replace('/(tabs)/frameworks' as any);
    } catch {
      try {
        r.navigate('/(tabs)/frameworks' as any);
      } catch {
        r.push('/(tabs)/frameworks' as any);
      }
    }
  };

  const save = async () => {
    if (!org?.orgId || !org?.userId) {
      setError('Your workspace is still loading. Try again in a moment.');
      return;
    }
    if (!canCreate) {
      setError('Only Super Admins and Organization Administrators can create frameworks.');
      return;
    }
    if (!form.name.trim()) {
      setError('Framework name is required.');
      return;
    }
    if (!form.code.trim()) {
      setError('Framework code (slug) is required.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.code.trim())) {
      setError('Framework code must be lowercase alphanumeric with hyphens.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created: any = await createFramework(org.orgId, org.userId, {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        version: form.version,
        category: form.category,
        owner: form.owner.trim() || undefined,
        status: form.status,
      });
      await logActivity(org.orgId, 'framework_created', 'framework', created.id, {
        name: form.name.trim(),
      });
      await qc.invalidateQueries({ queryKey: ['fwStats', org.orgId] });
      await qc.invalidateQueries({ queryKey: ['frameworkCatalog'] });
      Alert.alert('Framework created', `"${form.name.trim()}" was added to the register.`, [
        { text: 'View frameworks', onPress: () => r.replace('/(tabs)/frameworks') },
        { text: 'Done', onPress: () => r.replace('/(tabs)/frameworks') },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create framework.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SwipeBackContainer onBack={goBackToFrameworks}>
        <ScrollView
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={goBackToFrameworks} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to frameworks">
              <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 13 }}>‹ Back</Text>
            </Pressable>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy, flex: 1 }}>
              Add Framework
            </Text>
          </View>

        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
          Create a new framework to establish your control baseline and assign ownership.
        </Text>

        {error ? (
          <View style={{ backgroundColor: colors.redLight, borderRadius: radius.sm, padding: 10 }}>
            <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Input
            label="Framework Name"
            value={form.name}
            onChangeText={(v: string) => setField('name', v)}
            placeholder="e.g. ISO 27001"
          />
          <Input
            label="Framework Code"
            value={form.code}
            onChangeText={(v: string) => setField('code', v)}
            placeholder="e.g. iso-27001"
            keyboardType="default"
            autoCapitalize="none"
          />
          <Input
            label="Description"
            value={form.description}
            onChangeText={(v: string) => setField('description', v)}
            placeholder="Purpose, scope, and key objectives…"
            multiline
            numberOfLines={3}
          />
          <Input
            label="Version"
            value={form.version}
            onChangeText={(v: string) => setField('version', v)}
            placeholder="1.0"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map((c) => {
                const active = form.category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setField('category', c)}
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
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Owner</Text>
            <Input
              label="Owner"
              value={form.owner}
              onChangeText={(v: string) => setField('owner', v)}
              placeholder="e.g. amraj or team email"
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map((s) => {
                const active = form.status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setField('status', s)}
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
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="secondary" onPress={goBackToFrameworks} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Save Framework" loading={saving} onPress={save} />
          </View>
        </View>
      </ScrollView>
      </SwipeBackContainer>
    </Screen>
  );
}