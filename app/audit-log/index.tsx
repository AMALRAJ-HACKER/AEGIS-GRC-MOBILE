import { useState } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchActivity } from '@/services/api';
import { timeAgo } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';
import { Aurora } from '@/components/motion/Aurora';

const TYPES = ['all', 'control', 'risk', 'evidence', 'task', 'framework', 'system'] as const;

export default function AuditLog(){
  const r = useRouter();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [type, setType] = useState<(typeof TYPES)[number]>('all');

  const { data: logs } = useQuery({
    enabled: !!org?.orgId, queryKey: ['activity', org?.orgId], queryFn: () => fetchActivity(org!.orgId),
  });

  const all = logs ?? [];
  const shown = type === 'all' ? all : all.filter((l: any) => l.resource_type === type);

  const exportCsv = async () => {
    try {
      const header = 'timestamp,actor,action,resource_type,resource_id,details\n';
      const rows = shown.map((l: any) =>
        [l.created_at, (l.actor?.full_name ?? 'system').replace(/,/g, ' '), l.action, l.resource_type ?? '', l.resource_id ?? '',
         JSON.stringify(l.metadata ?? {}).replace(/,/g, ';')].join(','),
      ).join('\n');
      const uri = `${FileSystem.cacheDirectory}aegis-audit-log.csv`;
      await FileSystem.writeAsStringAsync(uri, header + rows, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'AEGIS audit log' });
    } catch (e: any) { Alert.alert('Export failed', e?.message ?? 'Try again.'); }
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
        <View style={{ gap:8, paddingBottom:4 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <Pressable onPress={()=> r.back()} hitSlop={10}>
              <Text style={{ color: colors.navy, fontWeight:'700', fontSize:13 }}>‹ Back</Text>
            </Pressable>
            <View style={{ flex:1, minWidth:0 }} />
            <Button title="Export CSV" variant="secondary" onPress={exportCsv} />
          </View>
          <Text style={{ fontSize:22, fontWeight:'800', color: colors.navy }}>Audit Log</Text>
          <Text style={{ color: colors.textMuted, fontSize:12 }}>Append-only trail: who changed what, and when.</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {TYPES.map(t => (
              <Pressable key={t} onPress={()=> setType(t)}
                style={{ paddingHorizontal:11, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor: type===t? colors.navy: colors.border, backgroundColor: type===t? colors.navy: colors.white }}>
                <Text style={{ fontSize:11, fontWeight:'600', color: type===t? 'white': colors.textMuted }}>{t === 'all' ? `All (${all.length})` : t[0].toUpperCase()+t.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ alignItems:'center', paddingVertical:28, gap:8 }}>
          <Text style={{ fontSize:30 }}>📜</Text>
          <Text style={{ fontWeight:'700' }}>No entries yet</Text>
          <Text style={{ color: colors.textMuted, fontSize:13, textAlign:'center' }}>Status changes, uploads and approvals are recorded here automatically.</Text>
        </Card>
      }
      renderItem={({ item }: any) => (
        <Card style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <View style={{ flex:1, gap:2 }}>
            <Text style={{ fontSize:13, fontWeight:'600' }}>{item.action.replace(/_/g, ' ')}</Text>
            <Text style={{ fontSize:12, color: colors.textMuted }}>
              {item.actor?.full_name ?? 'System'} · {item.resource_type ?? 'general'}
              {item.metadata?.title ? ` · ${item.metadata.title}` : ''}
            </Text>
          </View>
          <View style={{ alignItems:'flex-end', gap:4 }}>
            <Text style={{ fontSize:11, color: colors.textMuted }}>{timeAgo(item.created_at)}</Text>
            <Badge label={item.resource_type ?? 'log'} tone="default" />
          </View>
        </Card>
      )}
      />
    </View>
  );
}
