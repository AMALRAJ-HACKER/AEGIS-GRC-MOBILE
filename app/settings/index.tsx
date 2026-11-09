import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchMembers, createInvitation, updateOrg, updateProfile } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';

type Tab = 'general' | 'team' | 'notifications' | 'integrations';
const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' }, { key: 'team', label: 'Team' },
  { key: 'notifications', label: 'Notifications' }, { key: 'integrations', label: 'Integrations' },
];
const ROLES = ['org_admin', 'grc_analyst', 'it_security', 'auditor', 'management', 'staff'] as const;
const PREF_KEYS = [
  { key: 'task_assigned', label: 'Task assigned to me' },
  { key: 'task_due_soon', label: 'Task due soon / overdue' },
  { key: 'evidence_expiring', label: 'Evidence expiring soon' },
  { key: 'approval_requests', label: 'Approvals awaiting review' },
  { key: 'risk_changes', label: 'High / critical risk changes' },
];

export default function Settings(){
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const [tab, setTab] = useState<Tab>('general');

  const isAdmin = ['super_admin', 'org_admin'].includes(org?.role ?? '');

  // Dark‑mode theme (persisted across launches)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('themeMode');
      if (stored && (stored === 'dark' || stored === 'light')) setThemeMode(stored as 'light' | 'dark');
    })();
  }, []);

  // General form
  const [gName, setGName] = useState(''); const [gIndustry, setGIndustry] = useState('');
  const [gCountry, setGCountry] = useState(''); const [gTz, setGTz] = useState('');
  const [seeded, setSeeded] = useState(false);
  if (!seeded && org?.org) { setSeeded(true); setGName(org.org.name ?? ''); setGIndustry(org.org.industry ?? ''); setGCountry(org.org.country ?? ''); setGTz(org.org.timezone ?? ''); }

  // Invite form
  const [inviteEmail, setInviteEmail] = useState(''); const [inviteRole, setInviteRole] = useState<string>('staff');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const prefs = (org?.profile?.notification_prefs ?? {}) as Record<string, boolean>;
  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean> | null>(null);
  const P = localPrefs ?? { ...Object.fromEntries(PREF_KEYS.map(p => [p.key, true])), ...prefs };

  const { data: members } = useQuery({
    enabled: !!org?.orgId, queryKey: ['members', org?.orgId], queryFn: () => fetchMembers(org!.orgId),
  });

  const logout = async () => {
    try { await supabase.auth.signOut(); } catch (e:any) { console.warn('[AEGIS] signOut error (continuing to login):', e?.message); }
    r.replace('/(auth)/login');
  };

  const saveGeneral = async () => {
    if (!org?.orgId || !isAdmin) return;
    if (!gName.trim()) { Alert.alert('Name required', 'Organization name cannot be empty.'); return; }
    setSaving(true);
    try {
      await updateOrg(org.orgId, { name: gName.trim(), industry: gIndustry || null, country: gCountry || null, timezone: gTz || null });
      qc.invalidateQueries({ queryKey: ['currentOrg'] });
      Alert.alert('Saved', 'Organization settings updated.');
    } catch (e: any) { Alert.alert('Save failed', e?.message ?? 'Try again.'); }
    finally { setSaving(false); }
  };

  const invite = async () => {
    if (!org?.orgId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Alert.alert('Invalid email', 'Enter a valid business email address.'); return; }
    setSaving(true);
    try {
      const inv = await createInvitation(org.orgId, email, inviteRole, org.userId);
      setInviteToken(inv.token); setInviteEmail('');
      await Clipboard.setStringAsync(String(inv.token));
      Alert.alert('Invitation created', `Invite token copied. Share it with ${email} so they can sign up and join as ${inviteRole.replace('_',' ')}.`);
    } catch (e: any) { Alert.alert('Invite failed', e?.message ?? 'Try again.'); }
    finally { setSaving(false); }
  };

  const savePrefs = async () => {
    if (!org?.userId) return;
    setSaving(true);
    try {
      await updateProfile(org.userId, { notification_prefs: P });
      setLocalPrefs(P);
      qc.invalidateQueries({ queryKey: ['currentOrg'] });
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (e: any) { Alert.alert('Save failed', e?.message ?? 'Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <Screen maxWidth={760}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <Pressable onPress={()=> r.back()}><Text style={{ color: colors.navy, fontWeight:'600' }}>‹ Back</Text></Pressable>
            <Text style={{ fontSize:24, fontWeight:'800', color: colors.navy, flex:1 }}>Settings</Text>
            <Button title="My Profile" variant="secondary" onPress={()=> r.push('/profile')} />
          </View>

          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {TABS.map(x => (
              <Pressable key={x.key} onPress={()=> setTab(x.key)}
                style={{ paddingHorizontal:13, paddingVertical:7, borderRadius:999, borderWidth:1, borderColor: tab===x.key? colors.navy: colors.border, backgroundColor: tab===x.key? colors.navy: colors.white }}>
                <Text style={{ fontSize:12, fontWeight:'600', color: tab===x.key? 'white': colors.textMuted }}>{x.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* ---------------- General ---------------- */}
          {tab === 'general' && (
            <Card style={{ gap: spacing.md }}>
              {!isAdmin ? <Badge label="View only — org admins can edit" tone="warning" /> : null}
              <Input label="Organization Name" value={gName} onChangeText={setGName} editable={isAdmin} />
              <Input label="Industry" value={gIndustry} onChangeText={setGIndustry} editable={isAdmin} placeholder="Banking, SaaS, Healthcare…" />
              <Input label="Country" value={gCountry} onChangeText={setGCountry} editable={isAdmin} placeholder="India" />
              <Input label="Timezone" value={gTz} onChangeText={setGTz} editable={isAdmin} placeholder="Asia/Kolkata" />
              {isAdmin ? <Button title="Save Organization" loading={saving} onPress={saveGeneral} /> : null}
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:spacing.md }}>
                <Text style={{ fontSize:12, color: colors.textMuted }}>Dark mode</Text>
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={v => {
                    const mode = v ? 'dark' : 'light';
                    setThemeMode(mode);
                    AsyncStorage.setItem('themeMode', mode);
                  }}
                  trackColor={{ true: colors.navy, false: '#CBD5E1' }}
                />
              </View>
              </Card>
          )}

          {/* ---------------- Team ---------------- */}
          {tab === 'team' && (
            <View style={{ gap: spacing.md }}>
              <Card style={{ gap:10 }}>
                <Text style={{ fontWeight:'700' }}>Members ({members?.length ?? 0})</Text>
                {(members ?? []).map((m: any) => (
                  <View key={m.id} style={{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:6, borderBottomWidth:1, borderColor:'#F1F5F9' }}>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontWeight:'600', fontSize:14 }}>{m.profile?.full_name ?? m.profile?.email ?? 'Member'}</Text>
                      <Text style={{ fontSize:11, color: colors.textMuted }}>{m.profile?.email ?? ''}{m.profile?.job_title ? ` · ${m.profile.job_title}` : ''}</Text>
                    </View>
                    <Badge label={m.role.replace('_',' ')} tone={m.role.includes('admin') ? 'info' : 'default'} />
                    <Badge label={m.status} tone={m.status === 'active' ? 'success' : 'warning'} />
                  </View>
                ))}
                {!members?.length ? <Text style={{ color: colors.textMuted, fontSize:13 }}>No members loaded yet.</Text> : null}
              </Card>

              {isAdmin ? (
                <Card style={{ gap:10 }}>
                  <Text style={{ fontWeight:'700' }}>Invite Member</Text>
                  <Input label="Email" value={inviteEmail} onChangeText={setInviteEmail} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" />
                  <View style={{ gap:6 }}>
                    <Text style={{ fontSize:13, fontWeight:'600' }}>Role</Text>
                    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                      {ROLES.map(role => (
                        <Pressable key={role} onPress={()=> setInviteRole(role)}
                          style={{ paddingHorizontal:11, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor: inviteRole===role? colors.navy: colors.border, backgroundColor: inviteRole===role? colors.navy: colors.white }}>
                          <Text style={{ fontSize:11, fontWeight:'600', color: inviteRole===role? 'white': colors.textMuted }}>{role.replace('_',' ')}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <Button title="Create Invitation" loading={saving} onPress={invite} />
                  {inviteToken ? <Text style={{ fontSize:11, color: colors.textMuted }}>Token (copied): {inviteToken}</Text> : null}
                </Card>
              ) : null}
            </View>
          )}

          {/* ---------------- Notifications ---------------- */}
          {tab === 'notifications' && (
            <Card style={{ gap: 6 }}>
              <Text style={{ fontWeight:'700', marginBottom:6 }}>Notification Preferences</Text>
              {PREF_KEYS.map(p => (
                <View key={p.key} style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderBottomWidth:1, borderColor:'#F1F5F9' }}>
                  <Text style={{ flex:1, fontSize:14 }}>{p.label}</Text>
                  <Switch value={!!P[p.key]} onValueChange={v => setLocalPrefs({ ...P, [p.key]: v })}
                    trackColor={{ true: colors.navy, false: '#CBD5E1' }} />
                </View>
              ))}
              <Button title="Save Preferences" loading={saving} onPress={savePrefs} style={{ marginTop:10 }} />
            </Card>
          )}

          {/* ---------------- Integrations ---------------- */}
          {tab === 'integrations' && (
            <View style={{ gap:10 }}>
              {[
                { name:'Jira', desc:'Sync remediation tasks with Jira issues' },
                { name:'Slack', desc:'Alerts for approvals, deadlines and evidence' },
                { name:'GitHub', desc:'Link policies and controls to repositories' },
                { name:'ServiceNow', desc:'Import incidents and change records' },
              ].map(x => (
                <Card key={x.name} style={{ flexDirection:'row', alignItems:'center', gap:10, opacity:0.7 }}>
                  <Text style={{ fontSize:20 }}>🔌</Text>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontWeight:'700' }}>{x.name}</Text>
                    <Text style={{ fontSize:12, color: colors.textMuted }}>{x.desc}</Text>
                  </View>
                  <Badge label="Coming soon" tone="default" />
                </Card>
              ))}
            </View>
          )}

          <Card style={{ gap:10, marginTop:10 }}>
            <Text style={{ fontWeight:'700' }}>Session</Text>
            <Button title="Sign Out" variant="secondary" onPress={logout} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
