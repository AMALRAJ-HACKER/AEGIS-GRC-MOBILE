import { useState } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchFrameworkStats, fetchTasks, fetchRisks, fetchEvidence, updateOrg } from '@/services/api';
import { fmtDate, evidenceHealth } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';
import { Aurora } from '@/components/motion/Aurora';

type ReportType = 'control' | 'evidence' | 'risk' | 'task' | 'health';

const REPORTS: { key: ReportType; label: string; icon: string }[] = [
  { key: 'control', label: 'Control Status Summary', icon: '🛡️' },
  { key: 'evidence', label: 'Evidence Coverage', icon: '📁' },
  { key: 'risk', label: 'Risk Summary', icon: '⚠️' },
  { key: 'task', label: 'Task Progress', icon: '✅' },
  { key: 'health', label: 'Compliance Health', icon: '📊' },
];

const Row = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:4, borderBottomWidth:1, borderColor:colors.border, paddingTop:4 }}>
    <Text style={{ flex:1, fontSize:12, color: colors.navy }}>{label}</Text>
    <Text style={{ fontSize:12, fontWeight:'700', color: tone ?? colors.navy }}>{value}</Text>
  </View>
);

export default function Reports(){
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [type, setType] = useState<ReportType>('health');
  const [busy, setBusy] = useState(false);

  const orgId = org?.orgId;
  const { data: stats } = useQuery({ enabled: !!orgId, queryKey: ['fwStats', orgId], queryFn: () => fetchFrameworkStats(orgId!) });
  const { data: tasks } = useQuery({ enabled: !!orgId, queryKey: ['tasks', orgId], queryFn: () => fetchTasks(orgId!) });
  const { data: risks } = useQuery({ enabled: !!orgId, queryKey: ['risks', orgId], queryFn: () => fetchRisks(orgId!) });
  const { data: evidence } = useQuery({ enabled: !!orgId, queryKey: ['evidence', orgId], queryFn: () => fetchEvidence(orgId!) });

  const activated = (stats ?? []).filter(s => s.activated);
  const t = tasks ?? [];
  const k = risks ?? [];
  const e = evidence ?? [];

  const controlTotals = activated.reduce((a, s) => ({
    total: a.total + s.total, implemented: a.implemented + s.implemented, inProgress: a.inProgress + s.inProgress,
    notStarted: a.notStarted + s.notStarted, needsReview: a.needsReview + s.needsReview, nonCompliant: a.nonCompliant + s.nonCompliant,
  }), { total:0, implemented:0, inProgress:0, notStarted:0, needsReview:0, nonCompliant:0 });

  const evHealth = { valid:0, expiring:0, expired:0, none:0 };
  e.forEach((x: any) => { evHealth[evidenceHealth(x.expiry_date)]++; });

  const openRisks = k.filter((x: any) => x.status !== 'closed');
  const sevCounts = { critical:0, high:0, medium:0, low:0 };
  openRisks.forEach((x: any) => { sevCounts[x.severity as keyof typeof sevCounts]++; });

  const doneTasks = t.filter((x: any) => ['done', 'approved'].includes(x.status)).length;
  const overdueTasks = t.filter((x: any) => x.due_date && !['done','approved'].includes(x.status) && new Date(x.due_date).getTime() < Date.now()).length;
  const taskStatusCounts = (['todo','in_progress','pending_review','approved','done','blocked'] as const)
    .map(s => ({ s, n: t.filter((x: any) => x.status === s).length }));

  // Build { title, rows } for preview + export
  const report = ((): { title: string; rows: { label: string; value: string | number; tone?: string }[] } => {
    if (type === 'control') return {
      title: 'Control Status Summary',
      rows: [
        { label: 'Controls assessed', value: controlTotals.total },
        { label: 'Implemented', value: controlTotals.implemented },
        { label: 'In progress', value: controlTotals.inProgress },
        { label: 'Not started', value: controlTotals.notStarted },
        { label: 'Under review', value: controlTotals.needsReview },
        { label: 'Non-compliant', value: controlTotals.nonCompliant, tone: colors.red },
        { label: 'Implementation rate', value: `${controlTotals.total ? Math.round(controlTotals.implemented / controlTotals.total * 100) : 0}%` },
      ],
    };
    if (type === 'evidence') return {
      title: 'Evidence Coverage',
      rows: [
        { label: 'Evidence items', value: e.length },
        { label: 'Valid', value: evHealth.valid },
        { label: 'Expiring within 30 days', value: evHealth.expiring, tone: colors.amber },
        { label: 'Expired', value: evHealth.expired, tone: colors.red },
        { label: 'No expiry date', value: evHealth.none },
        { label: 'Linked to controls', value: e.filter((x: any) => (x.links?.length ?? 0) > 0).length },
        { label: 'Pending review', value: e.filter((x: any) => x.status === 'pending').length },
      ],
    };
    if (type === 'risk') return {
      title: 'Risk Summary',
      rows: [
        { label: 'Open risks', value: openRisks.length },
        { label: 'Critical', value: sevCounts.critical, tone: colors.red },
        { label: 'High', value: sevCounts.high, tone: '#F97316' },
        { label: 'Medium', value: sevCounts.medium, tone: colors.amber },
        { label: 'Low', value: sevCounts.low, tone: colors.teal },
        { label: 'Average inherent score', value: openRisks.length ? (openRisks.reduce((a: number, x: any) => a + x.inherent_score, 0) / openRisks.length).toFixed(1) : '0' },
        { label: 'Mitigation plans recorded', value: openRisks.filter((x: any) => x.mitigation_plan).length },
      ],
    };
    if (type === 'task') return {
      title: 'Task Progress',
      rows: [
        { label: 'Total tasks', value: t.length },
        { label: 'Completion rate', value: `${t.length ? Math.round(doneTasks / t.length * 100) : 0}%` },
        ...taskStatusCounts.map(x => ({ label: x.s.replace('_',' '), value: x.n })),
        { label: 'Overdue', value: overdueTasks, tone: overdueTasks ? colors.red : colors.teal },
      ],
    };
    return {
      title: 'Compliance Health (Audit Readiness)',
      rows: [
        ...activated.map(s => ({ label: s.name, value: `${s.score}%`, tone: s.score >= 80 ? colors.teal : s.score >= 50 ? colors.amber : colors.red })),
        { label: 'Frameworks activated', value: activated.length },
        { label: 'Risks open', value: openRisks.length },
        { label: 'Tasks overdue', value: overdueTasks, tone: overdueTasks ? colors.red : colors.teal },
      ],
    };
  })();

  const scope = `${org?.org?.name ?? 'Workspace'} · ${fmtDate(new Date().toISOString())}`;

  const csv = async () => {
    setBusy(true);
    try {
      const content = [`AEGIS GRC — ${report.title}`, `Scope,${scope}`, '', 'item,value',
        ...report.rows.map(x => `${x.label},${x.value}`)].join('\n');
      const uri = `${FileSystem.cacheDirectory}aegis-report.csv`;
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: report.title });
    } catch (err: any) { Alert.alert('Export failed', err?.message ?? 'Try again.'); }
    finally { setBusy(false); }
  };

  const pdf = async () => {
    setBusy(true);
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font-family:-apple-system,Roboto,sans-serif;padding:32px;color:#0F172A}
        h1{font-size:22px;margin:0 0 4px} .meta{color:#64748B;font-size:12px;margin-bottom:24px}
        h2{font-size:16px;margin-top:24px;border-bottom:2px solid ${colors.navy};padding-bottom:6px}
        table{width:100%;border-collapse:collapse} td{padding:8px 4px;border-bottom:1px solid #E2E8F0;font-size:14px}
        td:last-child{text-align:right;font-weight:700}.foot{margin-top:32px;font-size:11px;color:#94A3B8}
      </style></head><body>
        <h1>AEGIS GRC — ${report.title}</h1>
        <div class="meta">Scope: ${scope} · Generated by ${org?.profile?.full_name ?? 'AEGIS user'}</div>
        <h2>${report.title}</h2>
        <table>${report.rows.map(x => `<tr><td>${x.label}</td><td>${x.value}</td></tr>`).join('')}</table>
        <div class="foot">This report is generated from live workspace data. Verify findings with a qualified compliance professional before external submission.</div>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: report.title });
    } catch (err: any) { Alert.alert('Export failed', err?.message ?? 'Try again.'); }
    finally { setBusy(false); }
  };

  const setSchedule = async (frequency: 'off' | 'weekly' | 'monthly') => {
    if (!orgId) return;
    try {
      await updateOrg(orgId, { report_schedule: { frequency } });
      qc.invalidateQueries({ queryKey: ['currentOrg'] });
      Alert.alert('Schedule saved', frequency === 'off' ? 'Scheduled reports disabled.' : `Report summary will be prepared ${frequency}.`);
    } catch (err: any) { Alert.alert('Could not save', err?.message ?? 'Try again.'); }
  };

  const schedule = (org?.org?.report_schedule?.frequency ?? 'off') as string;

  return (
    <View style={{ flex:1, backgroundColor: colors.bg }}>
      <Aurora />
      <FlatList
      data={[report]}
      keyExtractor={(_, i) => `r-${i}`}
      contentContainerStyle={{
        paddingTop: topInset + spacing.sm, paddingBottom: bottomInset + spacing.xl,
        paddingHorizontal: hPad, gap: spacing.md, width:'100%', maxWidth: maxContent, alignSelf:'center', backgroundColor: 'transparent',
      }}
      ListHeaderComponent={
        <View style={{ gap:8, paddingBottom:4 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <Pressable onPress={()=> r.back()} hitSlop={10}>
              <Text style={{ color: colors.navy, fontWeight:'700', fontSize:13 }}>‹ Back</Text>
            </Pressable>
            <View style={{ flex:1, minWidth:0 }} />
            <View style={{ flexDirection:'row', gap:6 }}>
              <Button title="📜 Audit Log" variant="secondary" onPress={()=> r.push('/audit-log')} />
              <Button title="📅 Audits" variant="secondary" onPress={()=> r.push('/audits')} />
            </View>
          </View>
          <Text style={{ fontSize:22, fontWeight:'800', color: colors.navy }}>Reports & Analytics</Text>
          <Text style={{ color: colors.textMuted, fontSize:12 }}>Generate compliance reports from live workspace data.</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:6 }}>
            {REPORTS.map(x => (
              <Pressable key={x.key} onPress={()=> setType(x.key)}
                style={{ paddingHorizontal:11, paddingVertical:7, borderRadius:999, borderWidth:1, borderColor: type===x.key? colors.navy: colors.border, backgroundColor: type===x.key? colors.navy: colors.white }}>
                <Text style={{ fontSize:11, fontWeight:'600', color: type===x.key? 'white': colors.textMuted }}>{x.icon} {x.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ alignItems:'center', paddingVertical:28, gap:8 }}>
          <Text style={{ fontSize:30 }}>📊</Text>
          <Text style={{ fontWeight:'700' }}>No data available</Text>
          <Text style={{ color: colors.textMuted, fontSize:13, textAlign:'center' }}>Activate a framework and add controls to generate reports.</Text>
        </Card>
      }
      renderItem={({ item }: any) => (
        <Card style={{ gap:6 }}>
          <Text style={{ fontWeight:'800', fontSize:15 }}>{item.title}</Text>
          <Text style={{ fontSize:10, color: colors.textMuted }}>Scope: {scope}</Text>
          <View style={{ marginTop:6 }}>
            {item.rows.map((x: any, i: number) => <Row key={i} label={x.label} value={x.value} tone={x.tone} />)}
          </View>
        </Card>
      )}
      />
      {/* Export and schedule actions pinned below the list content */}
      <View style={{ paddingHorizontal: hPad, paddingVertical: spacing.lg, width:'100%', maxWidth: maxContent, alignSelf:'center', gap: spacing.md }}>
        <View style={{ flexDirection:'row', gap:10 }}>
          <View style={{ flex:1 }}><Button title={busy ? 'Working…' : '⬇ Export CSV'} loading={busy} onPress={csv} /></View>
          <View style={{ flex:1 }}><Button title={busy ? 'Working…' : '⬇ Export PDF'} variant="secondary" loading={busy} onPress={pdf} /></View>
        </View>
        <Card style={{ gap:8 }}>
          <Text style={{ fontWeight:'700', fontSize:13 }}>Scheduled Report</Text>
          <Text style={{ fontSize:11, color: colors.textMuted }}>Currently: {schedule === 'off' ? 'Off' : schedule}</Text>
          <View style={{ flexDirection:'row', gap:8 }}>
            {(['off','weekly','monthly'] as const).map(f => (
              <Pressable key={f} onPress={()=> setSchedule(f)}
                style={{ flex:1, paddingVertical:9, borderRadius:8, alignItems:'center', borderWidth:1, borderColor: schedule===f? colors.navy: colors.border, backgroundColor: schedule===f? colors.navy: colors.white }}>
                <Text style={{ fontSize:12, fontWeight:'700', color: schedule===f? 'white': colors.textMuted }}>{f[0].toUpperCase()+f.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>
    </View>
  );
}
