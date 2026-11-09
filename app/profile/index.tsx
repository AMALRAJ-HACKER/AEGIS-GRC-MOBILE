import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { fileToArrayBuffer } from '@/lib/fileBytes';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { FadeIn } from '@/components/motion/FadeIn';
import { useCurrentOrg } from '@/hooks/useOrg';
import { updateProfile } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { initials, logActivity } from '@/lib/format';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function Profile(){
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { colors: theme } = useTheme();

  const [fullName, setFullName] = useState(org?.profile?.full_name ?? '');
  const [jobTitle, setJobTitle] = useState(org?.profile?.job_title ?? '');
  const [department, setDepartment] = useState(org?.profile?.department ?? '');
  const [phone, setPhone] = useState(org?.profile?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(org?.profile?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !org) return;
    const a = res.assets[0];
    if (a.size && a.size > 5 * 1024 * 1024) { Alert.alert('Image too large', 'Maximum 5 MB.'); return; }
    setUploadingAvatar(true);
    const steps: string[] = [];
    try {
      const ext = (a.name.split('.').pop() ?? 'png').toLowerCase();
      const path = `${org.userId}/avatar.${ext}`;
      const body = await fileToArrayBuffer(a.uri, (m) => steps.push(m));
      const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: a.mimeType ?? 'image/*', upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(`${pub.publicUrl}?v=${Date.now()}`);
    } catch (e: any) {
      Alert.alert('Avatar upload failed', `${e?.message ?? 'Try again.'}`);
    }
    finally { setUploadingAvatar(false); }
  };

  const save = async () => {
    if (!org?.userId) return;
    if (!fullName.trim()) { Alert.alert('Name required', 'Please enter your full name.'); return; }
    setSaving(true);
    try {
      await updateProfile(org.userId, { full_name: fullName.trim(), job_title: jobTitle || null, department: department || null, phone: phone || null, avatar_url: avatarUrl || null });
      await logActivity(org.orgId, 'profile_updated', 'system', org.userId, {});
      qc.invalidateQueries({ queryKey: ['currentOrg'] });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) { Alert.alert('Save failed', e?.message ?? 'Try again.'); }
    finally { setSaving(false); }
  };

  const displayName = fullName || org?.profile?.full_name || 'AEGIS user';

  return (
    <Screen maxWidth={640}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
          <FadeIn delay={40} distance={14}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
              <Pressable onPress={()=> r.back()} hitSlop={8}>
                <Text style={{ color: theme.lightBlue, fontWeight:'600' }}>‹ Back</Text>
              </Pressable>
              <Text style={{ fontSize:20, fontWeight:'800', color: theme.navy, flex:1 }}>My Profile</Text>
            </View>
          </FadeIn>

          {/* Profile header + avatar */}
          <FadeIn delay={80} distance={14}>
            <Card style={{ alignItems:'center', gap: spacing.md, paddingVertical: spacing.xl }}>
              <Pressable onPress={pickAvatar} disabled={uploadingAvatar} hitSlop={12}>
                <View style={{ position:'relative' }}>
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 100, height: 100, borderRadius: radius.full, borderWidth: 2, borderColor: theme.white }}
                    />
                  ) : (
                    <View style={{ width: 100, height: 100, borderRadius: radius.full, backgroundColor: theme.primary, alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ color: theme.white, fontSize: 34, fontWeight: '800' }}>{initials(displayName)}</Text>
                    </View>
                  )}
                  {uploadingAvatar ? (
                    <View style={{ position:'absolute', bottom:0, right:0, backgroundColor: theme.primary, borderRadius: radius.full, padding: 6 }}>
                      <ActivityIndicator color={theme.white} size={14} style={{ marginRight:2 }} />
                    </View>
                  ) : (
                    <View style={{ position:'absolute', bottom:0, right:0, backgroundColor: theme.white, borderRadius: radius.full, padding: 6, borderWidth: 1, borderColor: theme.border }}>
                      <Text style={{ fontSize: 10, fontWeight:'800', color: theme.navy }}>📷</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable onPress={pickAvatar} disabled={uploadingAvatar} hitSlop={8}>
                <Text style={{ color: theme.primary, fontWeight:'700', fontSize: 13 }}>
                  {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                </Text>
              </Pressable>
              <Text style={{ fontWeight:'800', fontSize: 20, color: theme.heading }}>{displayName}</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:4 }}>
                <View style={{ backgroundColor: theme.water100, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full }}>
                  <Text style={{ fontSize: 11, fontWeight:'700', color: theme.primary, textTransform:'uppercase' }}>
                    {(org?.role ?? 'staff').replace('_', ' ')}
                  </Text>
                </View>
                {!!org?.org?.name && (
                  <>
                    <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: theme.success }} />
                    <View style={{ backgroundColor: theme.lightBlue2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full }}>
                      <Text style={{ fontSize: 11, fontWeight:'700', color: theme.textMuted, textTransform:'uppercase' }}>
                        {org.org.name}
                      </Text>
                    </View>
                  </>
                )}
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>{org?.profile?.email ?? ''}</Text>
            </Card>
          </FadeIn>

          {/* Personal information */}
          <FadeIn delay={120} distance={14}>
            <Card style={{ gap: spacing.lg }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ width: 6, height: 18, backgroundColor: theme.primary, borderRadius: 3 }} />
                <Text style={{ fontWeight:'700', fontSize: 15, color: theme.heading }}>Personal Information</Text>
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>Update your public profile details.</Text>

              <Input label="Full Name *" value={fullName} onChangeText={setFullName} placeholder="e.g. Maya Sharma" />
              <Input label="Email" value={org?.profile?.email ?? ''} editable={false} />
              <Input label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="Compliance Analyst" />
              <Input label="Department" value={department} onChangeText={setDepartment} placeholder="Information Security" />
              <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 …" keyboardType="phone-pad" />
              <Button title="Save Profile" loading={saving} onPress={save} variant="primary" style={{ backgroundColor: theme.primary }} />
            </Card>
          </FadeIn>

          {/* Account */}
          <FadeIn delay={160} distance={14}>
            <Card style={{ gap: spacing.lg }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ width: 6, height: 18, backgroundColor: theme.navyLight, borderRadius: 3 }} />
                <Text style={{ fontWeight:'700', fontSize: 15, color: theme.heading }}>Account</Text>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: theme.success }} />
                <Text style={{ fontSize: 12, color: theme.textMuted }}>Signed in securely</Text>
              </View>
              <Text style={{ fontSize: 11, color: theme.textMuted, textAlign:'center' }}>
                Sign-in and password management are handled from the authentication screens.
              </Text>
            </Card>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
