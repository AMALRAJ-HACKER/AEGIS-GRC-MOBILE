import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Screen } from '@/components/ui/Screen';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { useCurrentOrg } from '@/hooks/useOrg';
import { useResponsive } from '@/lib/responsive';
import { uploadEvidence } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { ChevronLeftIcon } from '@/components/icons/ActionIcons';

type Picked = { uri: string; name: string; mimeType?: string; size?: number };

export default function UploadEvidence() {
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { colors, isDark } = useTheme();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const params = useLocalSearchParams<{ assessmentId?: string }>();

  const [file, setFile] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiry, setExpiry] = useState('');
  const [assessmentId, setAssessmentId] = useState<string | null>(params.assessmentId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const { data: assessments } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['allAssessments', org?.orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_assessments')
        .select('id, status, framework_controls(control_id, title, frameworks(name))')
        .eq('organization_id', org!.orgId);
      return data ?? [];
    },
  });

  const isImageFile =
    Boolean(file?.mimeType?.startsWith('image/')) ||
    Boolean(file?.name?.match(/\.(webp|png|jpe?g|gif|svg)$/i));

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size && a.size > 25 * 1024 * 1024) {
      Alert.alert('File too large', 'Maximum size is 25 MB.');
      return;
    }
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size ?? undefined });
    if (!title) setTitle(a.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const save = async () => {
    setError(null);
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError('Expiry must be formatted YYYY-MM-DD.');
      return;
    }
    if (!org?.orgId) return;

    setSaving(true);
    setProgress('Uploading file…');
    try {
      const ev = await uploadEvidence(org.orgId, org.userId, file, {
        title: title.trim(),
        description,
        expiry,
        assessmentId,
      });
      setProgress('Saving record…');
      await logActivity(org.orgId, 'evidence_uploaded', 'evidence', ev.id, { title: ev.title });
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['fwStats'] });
      qc.invalidateQueries({ queryKey: ['controlLinked'] });
      Alert.alert('Uploaded', `${ev.title} is now in the library (status: pending review).`, [
        { text: 'View', onPress: () => r.replace(`/evidence/${ev.id}` as any) },
        { text: 'Done', onPress: () => r.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Check your connection and try again.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const activeChipBg = isDark ? colors.primary : '#0F172A';
  const activeChipFg = isDark ? colors.onPrimary : '#FFFFFF';

  return (
    <Screen>
      <SwipeBackContainer onBack={() => r.back()}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.bg }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: topInset + spacing.sm,
              paddingBottom: Math.max(bottomInset + 40, 60),
              paddingHorizontal: hPad,
              gap: spacing.md,
              maxWidth: maxContent,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            {/* Header with back navigation */}
            <View style={{ gap: 6 }}>
              <Pressable
                onPress={() => r.back()}
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
              >
                <ChevronLeftIcon color={colors.primary} size={18} />
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                  Evidence Library
                </Text>
              </Pressable>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading, marginTop: 4 }}>
                Upload Evidence
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Attach proof of implementation, policies, logs, or audit certifications.
              </Text>
            </View>

            {/* Dropzone / File Picker Card */}
            <Pressable onPress={pick}>
              <Card
                style={{
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: file ? 20 : 28,
                  paddingHorizontal: 16,
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: file ? colors.teal : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                {file && isImageFile ? (
                  <Image
                    source={{ uri: file.uri }}
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={{ fontSize: 36 }}>{file ? '📄' : '📁'}</Text>
                )}

                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: file ? colors.heading : colors.text }}>
                    {file ? file.name : 'Tap to choose a file'}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12.5, textAlign: 'center' }}>
                    {file
                      ? `${file.size ? `${Math.round(file.size / 1024)} KB` : ''} · ${file.mimeType ?? 'document'}`
                      : 'WebP, PNG, JPG, PDF, document — up to 25 MB'}
                  </Text>
                </View>

                {file ? (
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                      Tap to replace file
                    </Text>
                  </View>
                ) : null}
              </Card>
            </Pressable>

            {/* Input Form Fields */}
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. ISO 27001 Statement of Applicability"
            />

            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="What this evidence proves, version, scope or owner"
            />

            <Input
              label="Expiry / Review Date (optional)"
              value={expiry}
              onChangeText={setExpiry}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />

            {/* Link to Control */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.heading }}>
                Link to Control (optional)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                <Pressable
                  onPress={() => setAssessmentId(null)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: !assessmentId ? activeChipBg : colors.border,
                    backgroundColor: !assessmentId ? activeChipBg : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: !assessmentId ? activeChipFg : colors.textMuted,
                    }}
                  >
                    None
                  </Text>
                </Pressable>

                {(assessments ?? []).map((a: any) => {
                  const isSelected = assessmentId === a.id;
                  const label = `${a.framework_controls?.frameworks?.name?.split(/[:(]/)[0]?.trim() ?? ''} ${a.framework_controls?.control_id ?? ''}`;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setAssessmentId(a.id)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: isSelected ? activeChipBg : colors.border,
                        backgroundColor: isSelected ? activeChipBg : colors.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isSelected ? activeChipFg : colors.text,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {error ? (
              <View
                style={{
                  backgroundColor: colors.criticalBg,
                  borderRadius: 10,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.red,
                }}
              >
                <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{error}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View style={{ gap: 10, marginTop: 4 }}>
              <Button
                title={saving ? (progress ?? 'Uploading…') : 'Upload Evidence'}
                loading={saving}
                onPress={save}
              />
              <Button
                title="Cancel"
                variant="secondary"
                disabled={saving}
                onPress={() => r.back()}
              />
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 11.5, textAlign: 'center', marginTop: 4 }}>
              Stored in encrypted organization storage · Only authorized members can view.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SwipeBackContainer>
    </Screen>
  );
}
