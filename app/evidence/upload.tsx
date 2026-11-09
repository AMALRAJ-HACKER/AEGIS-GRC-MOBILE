import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCurrentOrg } from '@/hooks/useOrg';
import { uploadEvidence, fetchMembers } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';

type Picked = { uri: string; name: string; mimeType?: string; size?: number };

export default function UploadEvidence(){
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const params = useLocalSearchParams<{ assessmentId?: string }>();

  const [file, setFile] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiry, setExpiry] = useState('');
  const [assessmentId, setAssessmentId] = useState<string|null>(params.assessmentId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const { data: assessments } = useQuery({
    enabled: !!org?.orgId, queryKey: ['allAssessments', org?.orgId],
    queryFn: async () => {
      const { data } = await supabase.from('compliance_assessments')
        .select('id, status, framework_controls(control_id, title, frameworks(name))')
        .eq('organization_id', org!.orgId);
      return data ?? [];
    },
  });

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size && a.size > 25 * 1024 * 1024) { Alert.alert('File too large', 'Maximum size is 25 MB.'); return; }
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size ?? undefined });
    if (!title) setTitle(a.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const save = async () => {
    setError(null);
    if (!file) { setError('Choose a file first.'); return; }
    if (!title.trim()) { setError('Title is required.'); return; }
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) { setError('Expiry must be YYYY-MM-DD.'); return; }
    if (!org?.orgId) return;
    setSaving(true);
    setProgress('Uploading file…');
    try {
      const ev = await uploadEvidence(org.orgId, org.userId, file, {
        title: title.trim(), description, expiry, assessmentId,
      });
      setProgress('Saving record…');
      await logActivity(org.orgId, 'evidence_uploaded', 'evidence', ev.id, { title: ev.title });
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['fwStats'] });
      qc.invalidateQueries({ queryKey: ['controlLinked'] });
      Alert.alert('Uploaded', `${ev.title} is in the library (status: pending review).`, [
        { text: 'View', onPress: ()=> r.replace(`/evidence/${ev.id}`) },
        { text: 'Done', onPress: ()=> r.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Check your connection and try again.');
    } finally { setSaving(false); setProgress(null); }
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: colors.bg }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: spacing.md, gap: spacing.md, maxWidth: 640, width:'100%', alignSelf:'center' }}>
        <Pressable onPress={()=> r.back()}><Text style={{ color: colors.navy, fontWeight:'600' }}>‹ Back</Text></Pressable>
        <Text style={{ fontSize:22, fontWeight:'800', color: colors.navy }}>Upload Evidence</Text>

        <Pressable onPress={pick}>
          <Card style={{ alignItems:'center', gap:6, paddingVertical:26, borderStyle:'dashed', borderColor: colors.lightBlue }}>
            <Text style={{ fontSize:30 }}>{file ? '✅' : '📁'}</Text>
            <Text style={{ fontWeight:'700', color: file ? colors.teal : colors.navy }}>{file ? file.name : 'Tap to choose a file'}</Text>
            <Text style={{ color: colors.textMuted, fontSize:12 }}>{file ? (file.size ? `${Math.round(file.size / 1024)} KB · ${file.mimeType ?? 'document'}` : 'document') : 'PDF, image, document — up to 25 MB'}</Text>
          </Card>
        </Pressable>

        <Input label="Title" value={title} onChangeText={setTitle} placeholder="ISO 27001 Statement of Applicability" />
        <Input label="Description" value={description} onChangeText={setDescription} multiline placeholder="What this evidence proves, version, owner" />
        <Input label="Expiry / Review Date (optional)" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />

        <View style={{ gap:6 }}>
          <Text style={{ fontSize:13, fontWeight:'600' }}>Link to Control (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:6 }}>
            <Pressable onPress={()=> setAssessmentId(null)}
              style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor: !assessmentId? colors.navy: colors.border, backgroundColor: !assessmentId? colors.navy: colors.white }}>
              <Text style={{ fontSize:12, fontWeight:'600', color: !assessmentId? 'white': colors.textMuted }}>None</Text>
            </Pressable>
            {(assessments ?? []).map((a: any) => (
              <Pressable key={a.id} onPress={()=> setAssessmentId(a.id)}
                style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor: assessmentId===a.id? colors.navy: colors.border, backgroundColor: assessmentId===a.id? colors.navy: colors.white }}>
                <Text style={{ fontSize:12, fontWeight:'600', color: assessmentId===a.id? 'white': colors.textMuted }}>
                  {a.framework_controls?.frameworks?.name?.split(/[:(]/)[0]?.trim() ?? ''} {a.framework_controls?.control_id ?? ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={{ color: colors.red, fontSize:13 }}>{error}</Text> : null}
        <Button title={saving ? (progress ?? 'Uploading…') : 'Upload Evidence'} loading={saving} onPress={save} />
        <Text style={{ color: colors.textMuted, fontSize:11, textAlign:'center' }}>Stored in a private bucket — only your organization can access it.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
