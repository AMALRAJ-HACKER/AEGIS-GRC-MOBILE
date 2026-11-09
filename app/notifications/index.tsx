import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchNotifications, markAllRead } from '@/services/api';
import { timeAgo } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';
import { Aurora } from '@/components/motion/Aurora';

const TABS = ['all', 'tasks', 'risks', 'evidence', 'approvals', 'system'] as const;

const matchTab = (n: any, tab: string) => {
  if (tab === 'all') return true;
  const t = (n.type ?? '').toLowerCase();
  if (tab === 'tasks') return t.startsWith('task');
  if (tab === 'risks') return t.startsWith('risk');
  if (tab === 'evidence') return t.startsWith('evidence') || t.startsWith('file');
  if (tab === 'approvals') return t.startsWith('approval') || t.startsWith('review');
  return !t.startsWith('task') && !t.startsWith('risk') && !t.startsWith('evidence') && !t.startsWith('file') && !t.startsWith('approval') && !t.startsWith('review');
};

const ICON: Record<string, string> = { task: '✅', approval: '👍', risk: '⚠️', evidence: '📁', system: '🔔' };

export default function Notifications(){
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');

  const { data: notifications, refetch, isRefetching } = useQuery({
    enabled: !!org?.userId, queryKey: ['notifs', org?.userId], queryFn: () => fetchNotifications(org!.userId),
  });

  const all = notifications ?? [];
  const unread = all.filter((n: any) => !n.is_read).length;
  const shown = all.filter((n: any) => matchTab(n, tab));

  const markAll = async () => {
    if (!org?.userId) return;
    await markAllRead(org.userId);
    qc.invalidateQueries({ queryKey: ['notifs'] });
  };

  const open = async (n: any) => {
    if (!n.is_read && org?.userId) {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      qc.invalidateQueries({ queryKey: ['notifs'] });
    }
    if (!n.resource_type || !n.resource_id) return;
    if (n.resource_type === 'task') r.push(`/(tabs)/tasks/${n.resource_id}`);
    else if (n.resource_type === 'risk') r.push(`/(tabs)/risks/${n.resource_id}`);
    else if (n.resource_type === 'evidence') r.push(`/evidence/${n.resource_id}`);
  };

  return (
    <View style={{ flex:1, backgroundColor: colors.bg }}>
      <Aurora />
      <FlatList
      data={shown}
      keyExtractor={(item: any) => item.id}
      refreshControl={<RefreshControl refreshing={!!isRefetching} onRefresh={() => { void refetch(); }} tintColor={colors.navy} />}
      contentContainerStyle={{
        paddingTop: topInset + spacing.sm, paddingBottom: bottomInset + spacing.xl,
        paddingHorizontal: hPad, gap: spacing.md, width:'100%', maxWidth: maxContent, alignSelf:'center', backgroundColor: 'transparent',
      }}
      ListHeaderComponent={
        <View style={{ gap:10, paddingBottom:4 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <Text style={{ fontSize:24, fontWeight:'800', color: colors.navy, flex:1 }}>
              Notifications {unread ? <Text style={{ color: colors.red }}>({unread} new)</Text> : null}
            </Text>
            {unread > 0 ? <Button title="Mark all read" variant="secondary" onPress={markAll} /> : null}
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {TABS.map(t => (
              <Pressable key={t} onPress={()=> setTab(t)}
                style={{ paddingHorizontal:11, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor: tab===t? colors.navy: colors.border, backgroundColor: tab===t? colors.navy: colors.white }}>
                <Text style={{ fontSize:11, fontWeight:'600', color: tab===t? 'white': colors.textMuted }}>{t[0].toUpperCase()+t.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ alignItems:'center', paddingVertical:28, gap:8 }}>
          <Text style={{ fontSize:30 }}>🔕</Text>
          <Text style={{ fontWeight:'700' }}>No notifications</Text>
          <Text style={{ color: colors.textMuted, fontSize:13, textAlign:'center' }}>Assignments, approvals, deadlines and expired evidence will show up here.</Text>
        </Card>
      }
      renderItem={({ item }: any) => {
        const icon = ICON[(item.type ?? '').split(/[_-]/)[0]] ?? '🔔';
        return (
          <Pressable onPress={()=> open(item)}>
            <Card style={{ opacity: item.is_read ? 0.65 : 1, flexDirection:'row', alignItems:'flex-start', gap:10 }}>
              <Text style={{ fontSize:16 }}>{icon}</Text>
              <View style={{ flex:1, gap:2 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  {!item.is_read ? <View style={{ width:8, height:8, borderRadius:4, backgroundColor: colors.red }} /> : null}
                  <Text style={{ fontWeight:'700', flex:1 }}>{item.title}</Text>
                  <Text style={{ fontSize:10, color: colors.textMuted }}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.body ? <Text style={{ fontSize:13, color: colors.textMuted }} numberOfLines={2}>{item.body}</Text> : null}
                <View style={{ flexDirection:'row', gap:6, marginTop:2 }}>
                  <Badge label={item.type ?? 'info'} tone={item.is_read ? 'default' : 'info'} />
                  {item.resource_type ? <Badge label={item.resource_type} tone="default" /> : null}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      }}
      />
    </View>
  );
}
