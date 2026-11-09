import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Aurora } from '@/components/motion/Aurora';
import { SkeletonList } from '@/components/motion/Pulse';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchAudits, type AuditRow } from '@/services/api';
import { fmtDate } from '@/lib/format';
import { colors, spacing, radius } from '@/lib/design-tokens';

type Filter = 'all' | AuditRow['status'];

const STATUS_LABEL: Record<AuditRow['status'], string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function statusTone(s: string): 'success' | 'warning' | 'critical' | 'info' | 'default' {
  return s === 'completed' ? 'success' : s === 'in_progress' ? 'warning' : s === 'cancelled' ? 'critical' : 'info';
}

const isOpenFinding = (f: { status?: string | null }) =>
  !['closed', 'resolved', 'done'].includes(String(f.status ?? '').toLowerCase());

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginTop: 2 }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          borderRadius: 3,
          backgroundColor: pct >= 80 ? colors.teal : pct >= 40 ? colors.amber : colors.navy,
        }}
      />
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingVertical: 10,
        paddingHorizontal: 10,
        gap: 2,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontSize: 21, fontWeight: '800', color: accent ?? colors.navy }}>{value}</Text>
    </View>
  );
}

export default function Audits() {
  const r = useRouter();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: audits, isLoading, isRefetching, refetch } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['audits', org?.orgId],
    queryFn: () => fetchAudits(org!.orgId),
  });

  const all = audits ?? [];
  const planned = all.filter((a) => a.status === 'planned').length;
  const active = all.filter((a) => a.status === 'in_progress').length;
  const openFindings = all.reduce((sum, a) => sum + (a.findings ?? []).filter(isOpenFinding).length, 0);

  const visible = filter === 'all' ? all : all.filter((a) => a.status === filter);
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? 'All';

  const countFor = (key: Filter) => (key === 'all' ? all.length : all.filter((a) => a.status === key).length);

  return (
    <Screen loading={isLoading} aurora>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.teal} />
        }
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingBottom: bottomInset + spacing.xl,
          paddingHorizontal: hPad,
          gap: spacing.md,
          width: '100%',
          maxWidth: maxContent,
          alignSelf: 'center',
          backgroundColor: 'transparent',
        }}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Pressable onPress={() => r.back()} hitSlop={10}>
                <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 13 }}>‹ Back</Text>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }} />
              <Button title="+ New Audit" onPress={() => r.push('/audits/new')} />
            </View>

            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy }}>Audits</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
              Plan internal and external audits, track progress, and capture findings.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label="TOTAL" value={all.length} />
              <Stat label="PLANNED" value={planned} accent={colors.navy} />
              <Stat label="ACTIVE" value={active} accent={colors.amber} />
              <Stat label="FINDINGS" value={openFindings} accent={openFindings ? colors.red : colors.textMuted} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {FILTERS.map((f) => {
                const activeChip = filter === f.key;
                const count = countFor(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: activeChip ? colors.navy : colors.border,
                      backgroundColor: activeChip ? colors.navy : colors.white,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: activeChip ? 'white' : colors.textMuted }}>
                      {f.label} {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList rows={4} />
          ) : all.length === 0 ? (
            <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>No audits yet</Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 19 }}>
                Create an audit to define scope, track progress, and record findings with corrective actions.
              </Text>
              <Button title="New Audit" onPress={() => r.push('/audits/new')} />
            </Card>
          ) : (
            <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
              <Text style={{ fontWeight: '700' }}>No {filterLabel.toLowerCase()} audits</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                Try another status filter.
              </Text>
              <Button title="Show all" variant="secondary" onPress={() => setFilter('all')} />
            </Card>
          )
        }
        renderItem={({ item }) => {
          const findings = item.findings ?? [];
          const open = findings.filter(isOpenFinding).length;
          const pct = Math.max(0, Math.min(100, item.progress_pct ?? 0));
          const schedule =
            item.scheduled_start || item.scheduled_end
              ? `${fmtDate(item.scheduled_start)} → ${fmtDate(item.scheduled_end)}`
              : 'No schedule';

          return (
            <Pressable onPress={() => r.push(`/audits/${item.id}`)}>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={{ flex: 1, fontWeight: '700', fontSize: 15, color: colors.text }}>{item.title}</Text>
                  <Badge label={STATUS_LABEL[item.status] ?? 'Unknown'} tone={statusTone(item.status)} />
                </View>

                {item.scope ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17 }} numberOfLines={2}>
                    {item.scope}
                  </Text>
                ) : null}

                <ProgressBar pct={pct} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{pct}% complete</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, flexShrink: 1, textAlign: 'right' }}>
                    {schedule}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    📋 {findings.length} finding{findings.length === 1 ? '' : 's'}
                  </Text>
                  {open > 0 ? (
                    <Text style={{ fontSize: 11, color: colors.red, fontWeight: '700' }}>· {open} open</Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}