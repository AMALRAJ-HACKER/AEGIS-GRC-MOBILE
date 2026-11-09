import { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchTasks } from '@/services/api';
import { fmtDate, taskLabel, taskTone, priorityTone } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Aurora } from '@/components/motion/Aurora';
import { SearchIcon, XIcon, ChevronRightIcon } from '@/components/icons/ActionIcons';

const isOverdue = (t: any) =>
  t.due_date &&
  !['done', 'approved'].includes(t.status) &&
  new Date(t.due_date).getTime() < Date.now();

export default function Tasks() {
  const r = useRouter();
  const { colors, isDark } = useTheme();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [tab, setTab] = useState<'my' | 'all' | 'overdue' | 'review'>('my');
  const [search, setSearch] = useState('');

  const handleAddTask = () => {
    try {
      r.navigate('/(tabs)/tasks/new' as any);
    } catch {
      try {
        r.push('/(tabs)/tasks/new' as any);
      } catch {
        r.push('/tasks/new' as any);
      }
    }
  };

  const { data: tasks } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['tasks', org?.orgId],
    queryFn: () => fetchTasks(org!.orgId),
  });

  const canSeeAll = ['super_admin', 'org_admin', 'grc_analyst'].includes(org?.role ?? '');
  const all = tasks ?? [];

  const myCount = all.filter(
    (t: any) => t.assigned_to === org?.userId && !['done', 'approved'].includes(t.status),
  ).length;
  const overdueCount = all.filter(isOverdue).length;
  const reviewCount = all.filter((t: any) => t.status === 'pending_review').length;

  const tabOptions = useMemo(() => {
    const list: Array<{ id: 'my' | 'all' | 'overdue' | 'review'; label: string; count: number }> = [
      { id: 'my', label: 'My Tasks', count: myCount },
    ];
    if (canSeeAll) {
      list.push(
        { id: 'all', label: 'All Tasks', count: all.length },
        { id: 'overdue', label: 'Overdue', count: overdueCount },
        { id: 'review', label: 'In Review', count: reviewCount },
      );
    }
    return list;
  }, [canSeeAll, myCount, all.length, overdueCount, reviewCount]);

  const filtered = useMemo(() => {
    let list =
      tab === 'my'
        ? all.filter(
            (t: any) => t.assigned_to === org?.userId && !['done', 'approved'].includes(t.status),
          )
        : tab === 'overdue'
        ? all.filter(isOverdue)
        : tab === 'review'
        ? all.filter((t: any) => t.status === 'pending_review')
        : all;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t: any) => {
        const titleMatch = t.title?.toLowerCase().includes(q);
        const descMatch = t.description?.toLowerCase().includes(q);
        const nameMatch = t.assignee?.full_name?.toLowerCase().includes(q);
        const ctrlMatch = t.assessment?.framework_controls?.control_id?.toLowerCase().includes(q);
        const riskMatch = t.risk?.title?.toLowerCase().includes(q);
        return titleMatch || descMatch || nameMatch || ctrlMatch || riskMatch;
      });
    }

    return list;
  }, [all, tab, search, org?.userId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora />
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topInset + spacing.sm,
          paddingBottom: Math.max(bottomInset + 120, 160),
          paddingHorizontal: hPad,
          gap: 12,
          width: '100%',
          maxWidth: maxContent,
          alignSelf: 'center',
          backgroundColor: 'transparent',
        }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 6 }}>
            {/* Toolbar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading }}>
                  Tasks
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                  {all.filter((t: any) => t.assigned_to === org?.userId).length} assigned to you · {all.length} total
                </Text>
              </View>
              <Button title="+ Add Task" onPress={handleAddTask} />
            </View>

            {/* Status Tabs */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tabOptions.map((t) => {
                const isSelected = tab === t.id;
                const activeBg = isDark ? colors.primary : '#0F172A';
                const activeFg = isDark ? colors.onPrimary : '#FFFFFF';

                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setTab(t.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isSelected ? activeBg : colors.border,
                      backgroundColor: isSelected ? activeBg : colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isSelected ? activeFg : colors.textMuted,
                      }}
                    >
                      {t.label}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 999,
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(0,0,0,0.15)'
                            : 'rgba(255,255,255,0.2)'
                          : colors.surfaceAlt,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isSelected ? activeFg : colors.textMuted,
                        }}
                      >
                        {t.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Search Input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                gap: 8,
              }}
            >
              <SearchIcon color={colors.textMuted} size={16} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search tasks, assignee or control…"
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, paddingVertical: 10, fontSize: 13.5, color: colors.text }}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <XIcon color={colors.textMuted} size={16} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <Text style={{ fontSize: 32 }}>✅</Text>
            <Text style={{ fontWeight: '700', fontSize: 16, color: colors.heading }}>Nothing here</Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                textAlign: 'center',
                maxWidth: 280,
                lineHeight: 18,
              }}
            >
              {search
                ? `No tasks match "${search}". Try clearing your search.`
                : tab === 'my'
                ? 'You have no open tasks assigned.'
                : tab === 'overdue'
                ? 'No overdue tasks — nice work.'
                : tab === 'review'
                ? 'No tasks waiting for review.'
                : 'No tasks yet. Create one to assign remediation work.'}
            </Text>
            <Button title="+ Add Task" variant="secondary" onPress={handleAddTask} />
          </Card>
        }
        renderItem={({ item }: any) => {
          const isTaskOverdue = isOverdue(item);
          const leftBorderColor = isTaskOverdue
            ? colors.red
            : item.status === 'pending_review'
            ? colors.amber
            : item.status === 'done' || item.status === 'approved'
            ? colors.teal
            : colors.primary;

          return (
            <Pressable
              key={item.id}
              onPress={() => r.push(`/(tabs)/tasks/${item.id}` as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
              <Card
                style={{
                  gap: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: leftBorderColor,
                  backgroundColor: colors.surface,
                }}
              >
                {/* Header Row: Title, Badges, Chevron */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={taskLabel(item.status)} tone={taskTone(item.status)} />
                      {isTaskOverdue ? <Badge label="Overdue" tone="critical" /> : null}
                      <Badge label={item.priority} tone={priorityTone(item.priority)} />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.heading, marginTop: 2 }}>
                      {item.title}
                    </Text>
                  </View>
                  <ChevronRightIcon color={colors.textMuted} size={18} />
                </View>

                {item.description ? (
                  <Text numberOfLines={2} style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 17 }}>
                    {item.description}
                  </Text>
                ) : null}

                {/* Footer Metadata */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                    paddingTop: 6,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
                    👤 {item.assignee?.full_name ?? 'Unassigned'}
                    {item.assessment?.framework_controls
                      ? ` · 🛡️ ${item.assessment.framework_controls.control_id}`
                      : ''}
                    {item.risk ? ` · ⚠️ ${item.risk.title}` : ''}
                  </Text>
                  {item.due_date ? (
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '600',
                        color: isTaskOverdue ? colors.red : colors.textMuted,
                      }}
                    >
                      Due {fmtDate(item.due_date)}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
