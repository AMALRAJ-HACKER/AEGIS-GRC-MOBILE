import { useState } from 'react';
import { ScrollView, View, Text, RefreshControl, Pressable } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Aurora } from '@/components/motion/Aurora';
import { ComplianceRing } from '@/components/charts/ComplianceRing';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchFrameworkStats, fetchRisks, fetchTasks, fetchActivity, fetchNotifications } from '@/services/api';
import { fmtDate, timeAgo, taskLabel, taskTone, priorityTone } from '@/lib/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const QuickAction = ({ icon, label, onPress }: any) => (
  <Pressable onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor:'white', borderWidth:1, borderColor: colors.border, borderRadius:14, padding:12, alignItems:'center', gap:4 }}>
    <Text style={{ fontSize:20 }}>{icon}</Text>
    <Text style={{ fontSize:12, fontWeight:'600', color: colors.navy, textAlign:'center' }}>{label}</Text>
  </Pressable>
);

export default function HomeDashboard(){
  const r = useRouter();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const [refreshing, setRefreshing] = useState(false);
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const orgId = org?.orgId;

  const { data: stats } = useQuery({ enabled: !!orgId, queryKey: ['fwStats', orgId], queryFn: () => fetchFrameworkStats(orgId!) });
  const { data: risks } = useQuery({ enabled: !!orgId, queryKey: ['risks', orgId], queryFn: () => fetchRisks(orgId!) });
  const { data: tasks } = useQuery({ enabled: !!orgId, queryKey: ['tasks', orgId], queryFn: () => fetchTasks(orgId!) });
  const { data: activity } = useQuery({ enabled: !!orgId, queryKey: ['activity', orgId], queryFn: () => fetchActivity(orgId!) });
  const { data: notifications } = useQuery({ enabled: !!org?.userId, queryKey: ['notifs', org?.userId], queryFn: () => fetchNotifications(org!.userId) });

  const unread = (notifications ?? []).filter((n: any) => !n.is_read).length;
  const activated = (stats ?? []).filter(s => s.activated);

  // control status totals across frameworks
  const totals = activated.reduce((a, s) => ({
    implemented: a.implemented + s.implemented, inProgress: a.inProgress + s.inProgress,
    notStarted: a.notStarted + s.notStarted, needsReview: a.needsReview + s.needsReview,
    nonCompliant: a.nonCompliant + s.nonCompliant, notApplicable: a.notApplicable + s.notApplicable,
    total: a.total + s.total, applicable: a.applicable + s.applicable,
  }), { implemented:0, inProgress:0, notStarted:0, needsReview:0, nonCompliant:0, notApplicable:0, total:0, applicable:0 });

  const severityCounts = { critical:0, high:0, medium:0, low:0 };
  (risks ?? []).forEach((k: any) => { if (k.status !== 'closed') severityCounts[k.severity as keyof typeof severityCounts]++; });

  const myTasks = (tasks ?? []).filter((t: any) => t.assigned_to === org?.userId && !['done','approved'].includes(t.status));
  const overdue = myTasks.filter((t: any) => t.due_date && new Date(t.due_date).getTime() < Date.now());
  const upcoming = myTasks.filter((t: any) => t.due_date && new Date(t.due_date).getTime() >= Date.now()).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date)).slice(0, 4);

  const deadlines = (tasks ?? [])
    .filter((t: any) => {
      if (!t.due_date || ['done','approved'].includes(t.status)) return false;
      const due = new Date(t.due_date).getTime();
      return due <= Date.now() + 14 * 86400000;
    })
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date)).slice(0, 6);

  const onRefresh = async () => { setRefreshing(true); await qc.invalidateQueries(); setRefreshing(false); };

  const segments = [
    { key:'Implemented', count: totals.implemented, color: colors.teal },
    { key:'In Progress', count: totals.inProgress, color: colors.amber },
    { key:'Under Review', count: totals.needsReview, color: colors.lightBlue },
    { key:'Non-Compliant', count: totals.nonCompliant, color: colors.red },
    { key:'Not Applicable', count: totals.notApplicable, color: '#64748B' },
    { key:'Not Started', count: totals.notStarted, color: '#9CA3AF' },
  ];

  return (
    <View style={{ flex:1, backgroundColor: colors.bg }}>
      <Aurora />
      <ScrollView
      style={{ flex:1, backgroundColor: 'transparent' }}
      contentContainerStyle={{
        paddingTop: topInset + spacing.sm,
        paddingBottom: Math.max(bottomInset + 120, 140),
        paddingHorizontal: hPad,
        gap: spacing.md,
        width:'100%',
        maxWidth: maxContent,
        alignSelf:'center',
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header: greeting + org left | bell + settings right */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingBottom: spacing.md, borderBottomWidth:1, borderBottomColor: colors.border, marginBottom: spacing.sm }}>
        <View style={{ flex:1 }}>
          <Text style={{ fontSize:26, fontWeight:'800', color: colors.navy }} numberOfLines={1}>{greeting()},</Text>
          <Text style={{ fontSize:14, color: colors.textMuted, marginTop:4 }}>{org?.profile?.full_name ?? org?.org?.name ?? 'Analyst'}{org?.org?.name ? ` · ${org.org.name}` : ''}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <Pressable onPress={()=> r.push('/notifications')} accessibilityLabel="Notifications"
            style={{ padding:8, borderRadius:12, backgroundColor:'white', borderWidth:1, borderColor: colors.border }}>
            <Text style={{ fontSize:16 }}>🔔</Text>
            {unread > 0 ? (
              <View style={{ position:'absolute', top:2, right:2, backgroundColor: colors.red, borderRadius:9, minWidth:16, height:16, alignItems:'center', justifyContent:'center', paddingHorizontal:3 }}>
                <Text style={{ color:'white', fontSize:9, fontWeight:'800' }}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={()=> r.push('/settings')} accessibilityLabel="Settings"
            style={{ padding:8, borderRadius:12, backgroundColor:'white', borderWidth:1, borderColor: colors.border }}>
            <Text style={{ fontSize:16 }}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      {/* Compliance health per framework (PRD 2.2) */}
      <Card style={{ gap:10, padding: spacing.md }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', fontSize:16, color: colors.navy }}>Compliance Health</Text>
          <Pressable onPress={()=> r.push(`/(tabs)/frameworks`)} style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:999, backgroundColor: colors.navy, }}>
            <Text style={{ color:'white', fontSize:11, fontWeight:'600' }}>View all</Text>
          </Pressable>
        </View>
        {activated.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={180}
            decelerationRate="fast"
            contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: spacing.md, gap: 12 }}
          >
            {activated.map((s) => {
              const score = Math.max(0, Math.min(100, s.score ?? 0));
              const gaps = Math.max(0, (s.applicable ?? 0) - (s.implemented ?? 0));
              let statusBadge = 'Not Started';
              if (score === 100) statusBadge = 'Compliant';
              else if (score >= 50) statusBadge = 'Near Compliance';
              else if (score > 0) statusBadge = 'In Progress';
              let scoreColor = '#EF4444';
              if (score >= 76) scoreColor = '#10B981';
              else if (score >= 51) scoreColor = '#3B82F6';
              else if (score >= 26) scoreColor = '#F59E0B';
              return (
                <Pressable key={s.id} onPress={()=> r.push(`/(tabs)/frameworks/${s.id}`)}
                  style={{ width: 180, borderRadius: 14, padding: 16, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text numberOfLines={2} style={{ fontWeight: '700', fontSize: 13, color: '#1F2937', textAlign: 'center', lineHeight: 18, marginBottom: 8 }}>{s.name}</Text>
                  <Text style={{ fontWeight: '700', fontSize: 24, color: scoreColor, textAlign: 'center', marginBottom: 6 }}>{score}%</Text>
                  <View style={{ width: '100%', height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', marginBottom: 6, overflow: 'hidden' }}>
                    <View style={{ width: `${score}%`, height: 8, backgroundColor: scoreColor }} />
                  </View>
                  <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Controls:</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1F2937' }}>{s.implemented ?? 0}/{s.applicable ?? 0}</Text>
                  </View>
                  <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Gaps:</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1F2937' }}>{gaps}</Text>
                  </View>
                  <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: score >= 100 ? '#D1FAE5' : score >= 50 ? '#FEF3C7' : '#FEE2E2', borderWidth: 1, borderColor: score >= 100 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: score >= 100 ? '#065F46' : score >= 50 ? '#92400E' : '#991B1B' }}>{statusBadge}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ gap: 8, paddingVertical: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>👋 Start by activating a framework to track compliance.</Text>
            <Pressable
              onPress={() => {
                try {
                  r.navigate('/(tabs)/frameworks/add' as any);
                } catch {
                  r.push('/(tabs)/frameworks/add' as any);
                }
              }}
              style={{ backgroundColor: colors.navy, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8, width: 140 }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Add Framework</Text>
            </Pressable>
          </View>
        )}
      </Card>

      {/* Control status summary */}
      {totals.total > 0 ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal: spacing.md }}>
            <Text style={{ fontWeight:'700', color: colors.navy, fontSize: 15 }}>Control Status Summary</Text>
            <Pressable onPress={()=> r.push('/(tabs)/frameworks')} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight:'700', color: colors.navy }}>View all frameworks ›</Text>
            </Pressable>
          </View>

          {/* Stacked distribution bar */}
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden', width: '100%' }}>
              {segments.map((s, i) => s.count > 0 ? (
                <View key={s.key} style={{ width: `${(s.count / totals.total) * 100}%`, height: 10, backgroundColor: s.color }} />
              ) : null)}
            </View>
          </View>

          {/* Legend with labels and counts */}
          <View style={{ paddingHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {segments.map(s => (
              s.count > 0 ? (
                <Pressable key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>{s.key}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>({s.count})</Text>
                </Pressable>
              ) : null
            ))}
          </View>
        </Card>
      ) : null}

      {/* Risk overview */}
      <Card style={{ gap:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', flex:1 }}>Open Risks</Text>
          <Pressable onPress={()=> r.push('/(tabs)/risks')}><Text style={{ color: colors.navy, fontSize:12, fontWeight:'600' }}>View register ›</Text></Pressable>
        </View>
        <View style={{ flexDirection:'row', gap:8 }}>
          {([['Critical', severityCounts.critical, colors.red], ['High', severityCounts.high, '#F97316'], ['Medium', severityCounts.medium, colors.amber], ['Low', severityCounts.low, colors.teal]] as const).map(([l, c, col]) => (
            <View key={l} style={{ flex:1, alignItems:'center', borderWidth:1, borderColor: colors.border, borderRadius:10, paddingVertical:10, gap:2 }}>
              <Text style={{ fontSize:20, fontWeight:'800', color: col }}>{c}</Text>
              <Text style={{ fontSize:10, color: colors.textMuted }}>{l}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* My tasks */}
      <Card style={{ gap:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', flex:1 }}>My Tasks {overdue.length ? <Text style={{ color: colors.red }}>({overdue.length} overdue)</Text> : null}</Text>
          <Pressable onPress={()=> r.push('/(tabs)/tasks')}><Text style={{ color: colors.navy, fontSize:12, fontWeight:'600' }}>All tasks ›</Text></Pressable>
        </View>
        {[...overdue, ...upcoming].slice(0, 5).map((t: any) => (
          <Pressable key={t.id} onPress={()=> r.push(`/(tabs)/tasks/${t.id}`)} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ flex:1, fontSize:13 }} numberOfLines={1}>{t.title}</Text>
            <Badge label={t.priority} tone={priorityTone(t.priority)} />
            <Badge label={taskLabel(t.status)} tone={taskTone(t.status)} />
            {t.due_date ? <Text style={{ fontSize:11, color: new Date(t.due_date).getTime() < Date.now() ? colors.red : colors.textMuted }}>{fmtDate(t.due_date)}</Text> : null}
          </Pressable>
        ))}
        {!myTasks.length ? <Text style={{ color: colors.textMuted, fontSize:13 }}>No open tasks assigned to you. 🎉</Text> : null}
      </Card>

      {/* Quick actions (PRD 2.2) */}
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
        <QuickAction icon="⚠️" label="Add Risk" onPress={()=> r.push('/(tabs)/risks/new')} />
        <QuickAction icon="📁" label="Upload Evidence" onPress={()=> r.push('/evidence/upload')} />
        <QuickAction icon="✅" label="Assign Task" onPress={()=> r.push('/(tabs)/tasks/new')} />
        <QuickAction icon="📊" label="Framework Overview" onPress={()=> r.push('/(tabs)/frameworks')} />
      </View>

      {/* Upcoming deadlines */}
      {deadlines.length ? (
        <Card style={{ gap:8 }}>
          <Text style={{ fontWeight:'700' }}>Upcoming Deadlines (14 days)</Text>
          {deadlines.map((t: any) => {
            const days = Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000);
            const isOverdue = days < 0;
            return (
              <Pressable key={t.id} onPress={()=> r.push(`/(tabs)/tasks/${t.id}`)} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ fontSize:16 }}>{isOverdue ? '🔴' : days <= 7 ? '🟡' : '🟢'}</Text>
                <Text style={{ flex:1, fontSize:13 }} numberOfLines={1}>{t.title}</Text>
                <Text style={{ fontSize:11, color: isOverdue ? colors.red : colors.textMuted }}>{isOverdue ? `${Math.abs(days)}d overdue` : `${days}d`}</Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* Recent activity */}
      <Card style={{ gap:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', flex:1 }}>Recent Activity</Text>
          <Pressable onPress={()=> r.push('/audit-log')}><Text style={{ color: colors.navy, fontSize:12, fontWeight:'600' }}>Audit log ›</Text></Pressable>
        </View>
        {(activity ?? []).slice(0, 6).map((a: any) => (
          <Text key={a.id} style={{ fontSize:12, color: colors.navy }}>
            {a.actor?.full_name ?? 'Someone'} {a.action.replace(/_/g, ' ')} {a.metadata?.title ? `“${a.metadata.title}”` : a.resource_type} · {timeAgo(a.created_at)}
          </Text>
        ))}
        {!activity?.length ? <Text style={{ color: colors.textMuted, fontSize:13 }}>Activity will appear as your team works.</Text> : null}
      </Card>

      {/* Workspace Quick Tools (PRD 6.1 Secondary Navigation) */}
      <Card style={{ gap: 12, padding: spacing.md }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: colors.navy }}>Quick Tools</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {([
            { label: 'Evidence', icon: '🗃️', path: '/evidence', desc: 'Documents & proof' },
            { label: 'Audits', icon: '📅', path: '/audits', desc: 'Schedules & findings' },
            { label: 'Reports', icon: '📊', path: '/reports', desc: 'Audit readiness' },
            { label: 'Profile', icon: '👤', path: '/profile', desc: 'Account & role' },
          ] as const).map(l => (
            <Pressable
              key={l.path}
              onPress={() => r.push(l.path as never)}
              style={({ pressed }) => ({
                flexBasis: '47%',
                flexGrow: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: pressed ? colors.lightBlue2 : '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 14,
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lightBlue, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{l.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: colors.navy, fontSize: 13 }} numberOfLines={1}>{l.label}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{l.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>
    </ScrollView>
    </View>
  );
}
