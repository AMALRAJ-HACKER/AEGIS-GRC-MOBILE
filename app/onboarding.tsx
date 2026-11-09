import { useState } from 'react';
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useCurrentOrg } from '@/hooks/useOrg';
import { acceptInvitation } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';

/**
 * First-run organization setup.
 * Shown by AuthGate to signed-in users who don't belong to an organization
 * yet (fresh sign-ups). Creates the org + an 'org_admin' membership for the
 * current user using the existing RLS policies, then enters the workspace.
 * Sign-in / sign-up screens are not involved.
 */
export default function Onboarding(){
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();

  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteToken, setInviteToken] = useState('');
  const [joining, setJoining] = useState(false);

  const join = async () => {
    const token = inviteToken.trim();
    if (!token) { Alert.alert('Token required', 'Paste the invitation token you received.'); return; }
    setJoining(true);
    try {
      await acceptInvitation(token);
      await qc.invalidateQueries({ queryKey: ['currentOrg'] });
      r.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Could not join organization', e?.message ?? 'Please try again.');
    } finally { setJoining(false); }
  };

  const create = async () => {
    if (!org?.userId) return;
    if (!orgName.trim()) { Alert.alert('Name required', 'Please enter your organization’s name.'); return; }
    setCreating(true);
    try {
      const { data: created, error } = await supabase
        .from('organizations')
        .insert({ name: orgName.trim(), industry: industry.trim() || null, created_by: org.userId })
        .select('id')
        .single();
      if (error) throw error;

      const { error: mErr } = await supabase
        .from('organization_memberships')
        .insert({ organization_id: created.id, user_id: org.userId, role: 'org_admin', status: 'active' });
      if (mErr) throw mErr;

      await qc.invalidateQueries({ queryKey: ['currentOrg'] });
      r.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Could not create organization', e?.message ?? 'Please try again.');
    } finally { setCreating(false); }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* continue to login */ }
    r.replace('/(auth)/login');
  };

  return (
    <Screen maxWidth={560}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
          <View style={{ alignItems:'center', gap:6, marginBottom: spacing.sm }}>
            <Text style={{ fontSize:28, fontWeight:'800', color: colors.navy, textAlign:'center' }}>Welcome to AEGIS GRC</Text>
            <Text style={{ color: colors.textMuted, fontSize:14, textAlign:'center', lineHeight:20 }}>
              Set up your organization to start managing frameworks, risks, tasks, and evidence.
            </Text>
            {!!org?.profile?.email && (
              <Text style={{ color: colors.textMuted, fontSize:12, marginTop:4 }}>Signed in as {org.profile.email}</Text>
            )}
          </View>

          <Card style={{ gap: spacing.md }}>
            <Input label="Organization name" value={orgName} onChangeText={setOrgName} placeholder="Acme Corporation" />
            <Input label="Industry (optional)" value={industry} onChangeText={setIndustry} placeholder="Financial Services" />
            <Button title="Create organization" loading={creating} onPress={create} />
            <Text style={{ fontSize:11, color: colors.textMuted, textAlign:'center' }}>
              You’ll be the organization administrator. You can invite your team from Settings → Team later.
            </Text>
          </Card>

          <Card style={{ gap: spacing.md }}>
            <Text style={{ fontWeight:'700', fontSize:15, color: colors.navy }}>Have an invitation?</Text>
            <Text style={{ color: colors.textMuted, fontSize:12, lineHeight:17 }}>
              Joining a colleague’s organization? Paste the invite token your administrator shared with you.
            </Text>
            <Input label="Invitation token" value={inviteToken} onChangeText={setInviteToken} placeholder="e.g. 3f9a2b10-…" />
            <Button title="Join organization" variant="secondary" loading={joining} onPress={join} />
          </Card>

          <Pressable onPress={signOut} style={{ alignSelf:'center', padding:8 }}>
            <Text style={{ color: colors.navy, fontWeight:'600', fontSize:13 }}>Not you? Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
