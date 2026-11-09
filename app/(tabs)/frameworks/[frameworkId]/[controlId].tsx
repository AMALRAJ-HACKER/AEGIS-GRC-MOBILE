import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchControls, setAssessmentStatus, setAssessmentOwner, fetchMembers, fetchControlActivity } from '@/services/api';
import { evidenceHealth, healthTone, controlLabel, controlTone, taskLabel, taskTone, fmtDate, logActivity, timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';

const STATUSES = ['not_started', 'in_progress', 'implemented', 'needs_review', 'non_compliant', 'not_applicable'] as const;

export default function ControlDetail(){
  const { frameworkId, controlId } = useLocalSearchParams<{ frameworkId: string; controlId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org, refetch: refetchOrg } = useCurrentOrg();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  const { data } = useQuery({
    enabled: !!org?.orgId && !!frameworkId,
    queryKey: ['controls', org?.orgId, frameworkId],
    queryFn: () => fetchControls(org!.orgId, frameworkId!),
  });
  const control = data?.controls.find(c => c.controlId === controlId);

  const { data: history } = useQuery({
    enabled: !!control?.assessmentId,
    queryKey: ['controlHistory', control?.assessmentId],
    queryFn: () => fetchControlActivity(control!.assessmentId!),
  });

  const { data: linked } = useQuery({
    enabled: !!control?.assessmentId,
    queryKey: ['controlLinked', control?.assessmentId],
    queryFn: async () => {
      const [{ data: links }, { data: tasks }] = await Promise.all([
        supabase.from('evidence_control_links').select('evidence_id, evidence:evidence(id, title, expiry_date, type)').eq('control_assessment_id', control!.assessmentId),
        supabase.from('tasks').select('id, title, status, due_date').eq('linked_control_id', control!.assessmentId).order('created_at', { ascending: false }),
      ]);
      return { evidence: (links ?? []).map((l: any) => l.evidence).filter(Boolean), tasks: tasks ?? [] };
    },
  });

  const { data: linkedRisks } = useQuery({
    enabled: !!control?.assessmentId,
    queryKey: ['controlRisks', control?.assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('risk_control_links')
        .select('risk_id, risk:risks(id, title, severity, status)')
        .eq('control_assessment_id', control!.assessmentId);
      if (error) throw error;
      return (data ?? []).map((x: any) => x.risk).filter(Boolean);
    },
  });

  const { data: members } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['members', org?.orgId],
    queryFn: () => fetchMembers(org!.orgId),
  });

  const changeStatus = async (status: string) => {
    if (!control?.assessmentId) return;
    setSaving(true);
    try {
      await setAssessmentStatus(control.assessmentId, status);
      await logActivity(org!.orgId, 'status_changed', 'control', control.assessmentId, { from: control.status, to: status, control: control.controlCode });
      qc.invalidateQueries({ queryKey: ['controls'] });
      qc.invalidateQueries({ queryKey: ['fwStats'] });
    } catch (e: any) { Alert.alert('Update failed', e?.message ?? 'Try again.'); }
    finally { setSaving(false); }
  };

  const assignToMe = async () => {
    if (!control?.assessmentId || !org) return;
    await supabase.from('compliance_assessments').update({ owner_id: org.userId }).eq('id', control.assessmentId);
    qc.invalidateQueries({ queryKey: ['controls'] });
  };

  if (!control) return <Screen style={{ paddingTop: spacing.xl }}><Text style={{ color: colors.textMuted }}>Loading control…</Text></Screen>;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: spacing.md, gap: spacing.md, maxWidth: 760, width:'100%', alignSelf:'center' }}
      style={{ flex:1, backgroundColor: colors.bg }}>
      <Pressable onPress={()=> r.back()}><Text style={{ color: colors.navy, fontWeight:'600' }}>‹ Back to controls</Text></Pressable>

      <View style={{ gap:4 }}>
        <Text style={{ color: colors.navy, fontWeight:'800' }}>{control.controlCode}</Text>
        <Text style={{ fontSize:20, fontWeight:'800', color: colors.navy }}>{control.title}</Text>
      </View>

      <View>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>Status</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
          {STATUSES.map(s => (
            <Pressable key={s} disabled={saving} onPress={()=> changeStatus(s)}
              style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor: control.status===s? colors.navy: colors.border, backgroundColor: control.status===s? colors.navy: colors.white }}>
              <Text style={{ fontSize:12, fontWeight:'600', color: control.status===s? 'white': colors.textMuted }}>{controlLabel(s)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Card>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>Description</Text>
        <Text style={{ color: colors.text, lineHeight:21 }}>{control.description || 'No description provided.'}</Text>
      </Card>

      <Card>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>Implementation Guidance</Text>
        <Text style={{ color: colors.textMuted, lineHeight:21 }}>{control.guidance || 'No guidance provided.'}</Text>
      </Card>

      <Card style={{ gap:8 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight:'700' }}>Linked Evidence ({linked?.evidence.length ?? 0})</Text>
          <Button title="+ Upload" variant="secondary" style={{ paddingVertical:8 }} onPress={()=> r.push({ pathname:'/evidence/upload', params:{ assessmentId: control.assessmentId } })} />
        </View>
        {linked?.evidence.length ? linked.evidence.map((e: any) => {
          const h = evidenceHealth(e.expiry_date);
          return (
            <Pressable key={e.id} onPress={()=> r.push(`/evidence/${e.id}`)} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <Text style={{ flex:1, fontSize:13 }}>📄 {e.title}</Text>
              <Badge label={h === 'none' ? 'No expiry' : h === 'valid' ? 'Valid' : h === 'expiring' ? 'Expiring' : 'Expired'} tone={healthTone(h)} />
            </Pressable>
          );
        }) : <Text style={{ color: colors.textMuted, fontSize:13 }}>No evidence linked yet.</Text>}
      </Card>

      <Card style={{ gap:8 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight:'700' }}>Linked Tasks ({linked?.tasks.length ?? 0})</Text>
          <Button title="+ Task" variant="secondary" style={{ paddingVertical:8 }} onPress={()=> r.push({ pathname:'/(tabs)/tasks/new', params:{ assessmentId: control.assessmentId } })} />
        </View>
        {linked?.tasks.length ? linked.tasks.map((t: any) => (
          <Pressable key={t.id} onPress={()=> r.push(`/(tabs)/tasks/${t.id}`)} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ flex:1, fontSize:13 }}>{t.title}</Text>
            <Text style={{ fontSize:11, color: colors.textMuted }}>{t.due_date ? fmtDate(t.due_date) : ''}</Text>
            <Badge label={taskLabel(t.status)} tone={taskTone(t.status)} />
          </Pressable>
        )) : <Text style={{ color: colors.textMuted, fontSize:13 }}>No tasks linked yet.</Text>}
      </Card>

      <Card style={{ gap:8 }}>
        <Text style={{ fontWeight:'700' }}>Linked Risks ({linkedRisks?.length ?? 0})</Text>
        {linkedRisks?.length ? linkedRisks.map((r: any) => (
          <Pressable key={r.id} onPress={()=> r.push(`/(tabs)/risks/${r.id}`)} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ flex:1, fontSize:13, color: colors.navy }}>{r.title}</Text>
            <Badge label={r.severity} tone={r.severity==='critical'?'critical': r.severity==='high'?'warning': r.severity==='medium'?'info':'default'} />
          </Pressable>
        )) : <Text style={{ color: colors.textMuted, fontSize:13 }}>No risks linked to this control yet.</Text>}
      </Card>

      <Card style={{ gap:8 }}>
        <Text style={{ fontWeight:'700' }}>Notes & History</Text>
{(history ?? []).length > 0 ? history?.map((h: any) => (
          <Text key={h.id} style={{ fontSize:12, color: colors.textMuted, marginBottom:4 }}>
            {h.actor?.full_name ?? 'Someone'} {h.action.replace(/_/g, ' ')} {h.resource_type ? `· ${h.resource_type}` : ''} · {timeAgo(h.created_at)}
          </Text>
        )) : <Text style={{ color: colors.textMuted, fontSize:13 }}>No activity recorded.</Text>}

        <View style={{ gap:6, marginTop:6 }}>
          <Text style={{ fontSize:13, fontWeight:'600', color: colors.text }}>Notes</Text>
          <Text style={{ color: colors.textMuted, fontSize:12, lineHeight:19, maxHeight:72, overflow:'hidden' }}>
            {control.notes ?? 'No notes set.'}
          </Text>
        </View>

        {!control.notes ? (
          <View style={{ gap:6 }}>
            <Text style={{ fontSize:12, fontWeight:'600', color: colors.text }}>Add note</Text>
            <TextInput value={notes ?? ''} onChangeText={(v: string) => setNotes(v)} placeholder="Add internal notes…" />
            <Button title="Save note" onPress={() => setAssessmentOwner(control.assessmentId!, null)} variant="secondary" />
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}
