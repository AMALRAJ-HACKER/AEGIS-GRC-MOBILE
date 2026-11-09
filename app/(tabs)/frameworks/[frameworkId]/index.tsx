import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchControls, type ControlRow } from '@/services/api';
import { controlLabel, controlTone } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';

const STATUSES = ['all', 'not_started', 'in_progress', 'implemented', 'needs_review', 'non_compliant', 'not_applicable'] as const;

const STATUS_COLORS: Record<string, string> = {
  implemented: colors.teal,
  in_progress: colors.amber,
  needs_review: colors.lightBlue,
  non_compliant: colors.red,
  not_applicable: '#64748B',
  not_started: '#9CA3AF',
};

export default function FrameworkControls(){
  const { frameworkId } = useLocalSearchParams<{ frameworkId: string }>();
  const r = useRouter();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data } = useQuery({
    enabled: !!org?.orgId && !!frameworkId,
    queryKey: ['controls', org?.orgId, frameworkId],
    queryFn: () => fetchControls(org!.orgId, frameworkId!),
  });

  const all = data?.controls ?? [];
  const applicable = all.filter(c => c.status !== 'not_applicable');
  const score = applicable.length
    ? Math.round((applicable.filter(c => c.status === 'implemented').length / applicable.length) * 100)
    : 0;

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: all.length };
    STATUSES.slice(1).forEach(s => { map[s] = all.filter(c => c.status === s).length; });
    return map;
  }, [all]);

  const q = search.trim().toLowerCase();
  const shown = all.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (!q) return true;
    return [c.controlCode, c.title, c.category, c.ownerName, c.description]
      .some(v => String(v ?? '').toLowerCase().includes(q));
  });

  // group by category (PRD: grouped, collapsible)
  const groups: { category: string; items: ControlRow[] }[] = [];
  shown.forEach(c => {
    const g = groups.find(x => x.category === c.category);
    if (g) g.items.push(c); else groups.push({ category: c.category, items: [c] });
  });
  const flat = groups.flatMap(g => [
    { header: g.category, count: g.items.length },
    ...(collapsed[g.category] ? [] : g.items.map(item => ({ item }))),
  ]) as any[];

  const toggleGroup = (category: string) => {
    setCollapsed(prev => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <FlatList
      data={flat}
      keyExtractor={(x, i) => x.header ? `h-${x.header}` : `c-${x.item.controlId}-${i}`}
      contentContainerStyle={{
        paddingTop: topInset + spacing.sm, paddingBottom: bottomInset + 90,
        paddingHorizontal: hPad, gap: 10, width:'100%', maxWidth: maxContent, alignSelf:'center', backgroundColor: colors.bg,
      }}
      ListHeaderComponent={
        <View style={{ gap:10, paddingBottom:4 }}>
          <Pressable onPress={()=> r.back()} hitSlop={8}><Text style={{ color: colors.navy, fontWeight:'600' }}>‹ Back to frameworks</Text></Pressable>
          <Text style={{ fontSize:22, fontWeight:'800', color: colors.navy }} numberOfLines={2}>{data?.framework?.name ?? 'Framework'}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <View style={{ flex:1, height:8, borderRadius:4, backgroundColor:'#E2E8F0', overflow:'hidden', flexDirection:'row' }}>
              {STATUSES.slice(1).map(s => {
                const n = counts[s] ?? 0;
                if (!n) return null;
                return <View key={s} style={{ width: `${(n / Math.max(1, all.length)) * 100}%`, height:'100%', backgroundColor: STATUS_COLORS[s] }} />;
              })}
            </View>
            <Text style={{ fontWeight:'800', color: colors.navy }}>{score}%</Text>
          </View>
          <Text style={{ fontSize:11, color: colors.textMuted }}>{applicable.length} applicable controls · {counts.not_applicable ?? 0} not applicable</Text>

          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="🔍  Search controls, control ID or owner…" placeholderTextColor={colors.textMuted}
            style={{ borderWidth:1, borderColor: colors.border, borderRadius:12, backgroundColor:'white', paddingHorizontal:12, paddingVertical:10, fontSize:14, color: colors.text }}
          />

          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {STATUSES.map(s => (
              <Pressable key={s} onPress={()=> setFilter(s)}
                style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor: filter===s? colors.navy: colors.border, backgroundColor: filter===s? colors.navy: colors.white }}>
                <Text style={{ fontSize:11, fontWeight:'600', color: filter===s? 'white': colors.textMuted }}>
                  {s==='all' ? `All (${counts.all ?? 0})` : `${controlLabel(s)} (${counts[s] ?? 0})`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item: row }: any) => row.header ? (
        <Pressable onPress={()=> toggleGroup(row.header)} style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:6 }}>
          <Text style={{ fontWeight:'800', color: colors.textMuted, fontSize:12, letterSpacing:1, flex:1 }}>{row.header.toUpperCase()} ({row.count})</Text>
          <Text style={{ color: colors.textMuted, fontSize:12 }}>{collapsed[row.header] ? '▸' : '▾'}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={()=> r.push(`/(tabs)/frameworks/${frameworkId}/${row.item.controlId}`)}>
          <View style={{ backgroundColor:'white', borderRadius:12, borderWidth:1, borderColor: colors.border, padding:12, flexDirection:'row', alignItems:'center', gap:10 }}>
            <View style={{ flex:1, gap:2 }}>
              <Text style={{ fontWeight:'700', color: colors.navy, fontSize:12 }}>{row.item.controlCode}</Text>
              <Text style={{ fontWeight:'600', fontSize:14, color: colors.text }}>{row.item.title}</Text>
              <Text style={{ fontSize:10, color: colors.textMuted }} numberOfLines={1}>
                {row.item.ownerName ? `Owner: ${row.item.ownerName}` : 'Unassigned'}
                {row.item.evidenceCount ? ` · ${row.item.evidenceCount} evidence` : ''}
              </Text>
            </View>
            <Badge label={controlLabel(row.item.status)} tone={controlTone(row.item.status)} />
            <Text style={{ color: colors.textMuted }}>›</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={{ alignItems:'center', paddingVertical:24, gap:6 }}>
          <Text style={{ fontSize:26 }}>🛡️</Text>
          <Text style={{ fontWeight:'700' }}>{all.length ? 'No controls match these filters' : 'No controls loaded'}</Text>
          <Text style={{ color: colors.textMuted, fontSize:12, textAlign:'center' }}>
            {all.length ? 'Clear the search or status filter.' : 'Activate this framework to seed its controls.'}
          </Text>
        </View>
      }
      ListFooterComponent={
        <Pressable onPress={()=> org?.orgId && r.push({ pathname:'/(tabs)/ai', params:{ context: `${data?.framework?.name ?? 'framework'} compliance` } })}
          style={{ marginTop:16, backgroundColor: colors.navy, borderRadius:999, paddingVertical:12, alignItems:'center' }}>
          <Text style={{ color:'white', fontWeight:'700' }}>✨ Ask AI about this framework</Text>
        </Pressable>
      }
    />
  );
}
