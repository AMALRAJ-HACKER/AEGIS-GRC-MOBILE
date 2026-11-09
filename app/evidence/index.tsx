import { useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchEvidence } from '@/services/api';
import { evidenceHealth, healthTone, fmtDate } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';
import { Aurora } from '@/components/motion/Aurora';

const FILTERS = ['all', 'valid', 'expiring', 'expired', 'pending', 'approved', 'rejected'] as const;

const fmtSize = (bytes?: number | null) =>
  !bytes ? '' : bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function EvidenceLibrary(){
  const r = useRouter();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [search, setSearch] = useState('');

  const { data: evidence } = useQuery({
    enabled: !!org?.orgId, queryKey: ['evidence', org?.orgId], queryFn: () => fetchEvidence(org!.orgId),
  });

  const all = evidence ?? [];
  const shown = all.filter((e: any) => {
    const h = evidenceHealth(e.expiry_date);
    const matches =
      filter === 'all' ? true :
      ['valid', 'expiring', 'expired'].includes(filter) ? h === filter :
      e.status === filter;
    const q = search.trim().toLowerCase();
    return matches && (!q || e.title.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q));
  });

  const counts = {
    valid: all.filter((e: any) => evidenceHealth(e.expiry_date) === 'valid').length,
    expiring: all.filter((e: any) => evidenceHealth(e.expiry_date) === 'expiring').length,
    expired: all.filter((e: any) => evidenceHealth(e.expiry_date) === 'expired').length,
  };

  return (
    <View style={{ flex:1, backgroundColor: colors.bg }}>
      <Aurora />
      <FlatList
      data={shown}
      keyExtractor={(item: any) => item.id}
      contentContainerStyle={{
        paddingTop: topInset + spacing.sm, paddingBottom: bottomInset + spacing.xl,
        paddingHorizontal: hPad, gap: spacing.md, width:'100%', maxWidth: maxContent, alignSelf:'center', backgroundColor: 'transparent',
      }}
      ListHeaderComponent={
        <View style={{ gap:10, paddingBottom:4 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <Text style={{ fontSize:24, fontWeight:'800', color: colors.navy, flex:1 }}>Evidence Library</Text>
            <Button title="+ Upload" onPress={()=> r.push('/evidence/upload')} />
          </View>
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="🔍  Search evidence…" placeholderTextColor={colors.textMuted}
            style={{ borderWidth:1, borderColor: colors.border, borderRadius:12, backgroundColor:'white', paddingHorizontal:12, paddingVertical:10, fontSize:14, color: colors.text }}
          />
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {FILTERS.map(f => (
              <Pressable key={f} onPress={()=> setFilter(f)}
                style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor: filter===f? colors.navy: colors.border, backgroundColor: filter===f? colors.navy: colors.white }}>
                <Text style={{ fontSize:11, fontWeight:'600', color: filter===f? 'white': colors.textMuted }}>
                  {f==='all'? `All (${all.length})` : f[0].toUpperCase()+f.slice(1) + (['valid','expiring','expired'].includes(f) ? ` (${counts[f as keyof typeof counts]})` : '')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ alignItems:'center', paddingVertical:28, gap:8 }}>
          <Text style={{ fontSize:30 }}>🗃️</Text>
          <Text style={{ fontWeight:'700' }}>No evidence found</Text>
          <Text style={{ color: colors.textMuted, textAlign:'center', fontSize:13 }}>Upload policy documents, screenshots, certificates and reports. Linked evidence auto-feeds control assessments.</Text>
        </Card>
      }
      renderItem={({ item }: any) => {
        const h = evidenceHealth(item.expiry_date);
        return (
          <Pressable onPress={()=> r.push(`/evidence/${item.id}`)}>
            <Card style={{ gap:6 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ fontSize:18 }}>📄</Text>
                <Text style={{ fontWeight:'700', flex:1 }} numberOfLines={2}>{item.title}</Text>
                <Badge label={h === 'none' ? 'No expiry' : h === 'valid' ? 'Valid' : h === 'expiring' ? 'Expiring' : 'Expired'} tone={healthTone(h)} />
              </View>
              {item.description ? <Text style={{ fontSize:12, color: colors.textMuted }} numberOfLines={2}>{item.description}</Text> : null}
              <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
                {item.type ? <Text style={{ fontSize:11, color: colors.textMuted }}>{String(item.type).toUpperCase()}{fmtSize(item.file_size) ? ` · ${fmtSize(item.file_size)}` : ''}</Text> : null}
                {item.expiry_date ? <Text style={{ fontSize:11, color: h === 'expired' ? colors.red : colors.textMuted }}>Expires {fmtDate(item.expiry_date)}</Text> : null}
                <Text style={{ fontSize:11, color: colors.textMuted }}>Added {fmtDate(item.created_at)}</Text>
              </View>
            </Card>
          </Pressable>
        );
      }}
      />
    </View>
  );
}
