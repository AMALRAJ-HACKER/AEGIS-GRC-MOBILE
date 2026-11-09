import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useResponsive } from '@/lib/responsive';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Aurora } from '@/components/motion/Aurora';
import { SkeletonList } from '@/components/motion/Pulse';
import { FadeIn } from '@/components/motion/FadeIn';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchFrameworkStats, fetchFrameworkCatalog, activateFramework, type FrameworkStat } from '@/services/api';
import { canActivateFramework } from '@/lib/permissions';
import { fmtDate, logActivity } from '@/lib/format';
import { radius, spacing } from '@/lib/design-tokens';
import { ShieldCheckIcon, SearchIcon, XIcon, CheckIcon, AlertTriangleIcon, ChevronRightIcon } from '@/components/icons/ActionIcons';

function ProgressBar({ pct, track, fill }: { pct: number; track: string; fill: string }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, height: '100%', backgroundColor: fill, borderRadius: 3 }} />
    </View>
  );
}

type TabMode = 'all' | 'active';
type SortMode = 'name' | 'score' | 'updated';

export default function Frameworks() {
  const r = useRouter();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { data: org, isLoading: orgLoading } = useCurrentOrg();
  const orgId = org?.orgId ?? '';
  const role = org?.role ?? 'staff';
  const canActivate = canActivateFramework(role);

  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const { colors: themeColors, isDark } = useTheme();
  const accent = isDark ? themeColors.teal : '#066A84';
  const activeTabBg = isDark ? themeColors.primary : '#0F172A';
  const activeTabFg = isDark ? themeColors.onPrimary : '#FFFFFF';

  const [tab, setTab] = useState<TabMode>('all');
  const [sort, setSort] = useState<SortMode>('name');
  const [search, setSearch] = useState('');
  const [pendingFw, setPendingFw] = useState<any | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const handleAddFramework = () => {
    try {
      r.navigate('/(tabs)/frameworks/add' as any);
    } catch {
      setTab('all');
    }
  };

  // 1. Fetch Framework Catalog
  const catalog = useQuery({
    queryKey: ['frameworkCatalog'],
    queryFn: fetchFrameworkCatalog,
  });

  // 2. Fetch Organization Framework Stats
  const stats = useQuery({
    enabled: !!orgId,
    queryKey: ['fwStats', orgId],
    queryFn: () => fetchFrameworkStats(orgId),
  });

  const statById = useMemo(() => {
    const map = new Map<string, FrameworkStat>();
    (stats.data ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [stats.data]);

  const activeCount = useMemo(
    () => (stats.data ?? []).filter((s) => s.activated).length,
    [stats.data],
  );

  const catalogItems = (catalog.data ?? []) as any[];

  // Merge catalog with stats
  const mergedList = useMemo(() => {
    let list = catalogItems.map((c) => {
      const s = statById.get(c.id);
      return {
        ...c,
        isActivated: !!s?.activated,
        score: s?.score ?? 0,
        implemented: s?.implemented ?? 0,
        applicable: s?.applicable ?? (c.controlCount ?? 0),
        notApplicable: s?.notApplicable ?? 0,
        lastAssessed: s?.lastAssessed ?? null,
      };
    });

    // Tab filter
    if (tab === 'active') {
      list = list.filter((item) => item.isActivated);
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((item) =>
        `${item.name} ${item.category ?? ''} ${item.version ?? ''} ${item.description ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }

    // Sort
    return list.slice().sort((a, b) => {
      if (sort === 'score') return b.score - a.score;
      if (sort === 'updated') {
        const da = a.lastAssessed ? new Date(a.lastAssessed).getTime() : 0;
        const db = b.lastAssessed ? new Date(b.lastAssessed).getTime() : 0;
        return db - da;
      }
      return a.name.localeCompare(b.name);
    });
  }, [catalogItems, statById, tab, search, sort]);

  const handleActivateConfirm = async () => {
    if (!pendingFw || !orgId) return;
    setActivating(true);
    setActivateError(null);
    try {
      const count = await activateFramework(orgId, pendingFw.id);
      await logActivity(orgId, 'framework_activated', 'framework', pendingFw.id, {
        name: pendingFw.name,
        controls: count,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fwStats', orgId] }),
        qc.invalidateQueries({ queryKey: ['frameworkCatalog'] }),
      ]);
      setPendingFw(null);
    } catch (e: any) {
      setActivateError(e?.message ?? 'Could not activate framework. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const isLoading = catalog.isLoading || stats.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <Aurora />
      <FlatList
        data={mergedList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topInset + spacing.sm,
          paddingBottom: Math.max(bottomInset + 120, 160),
          paddingHorizontal: hPad,
          gap: spacing.md,
          width: '100%',
          maxWidth: maxContent,
          alignSelf: 'center',
          backgroundColor: 'transparent',
        }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 4 }}>
            {/* Title & Add Framework button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: themeColors.heading }}>
                  Compliance Frameworks
                </Text>
                <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                  {activeCount} activated · {catalogItems.length} available in the catalog
                </Text>
              </View>
              <Button
                title="+ Add Framework"
                onPress={handleAddFramework}
              />
            </View>

            {/* Non-admin info notice if applicable */}
            {!orgLoading && !canActivate ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: themeColors.warningBg,
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <AlertTriangleIcon color={themeColors.amber} size={16} />
                <Text style={{ flex: 1, fontSize: 12, color: themeColors.text, lineHeight: 17 }}>
                  Your role ({role}) has view access. Organization admins can activate or create frameworks.
                </Text>
              </View>
            ) : null}

            {/* Search Input */}
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: 14, zIndex: 2 }}>
                <SearchIcon color={themeColors.textMuted} size={16} />
              </View>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search frameworks by name, category or version…"
                placeholderTextColor={themeColors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  borderWidth: 1,
                  borderColor: themeColors.border,
                  borderRadius: radius.md,
                  backgroundColor: themeColors.surface,
                  paddingLeft: 40,
                  paddingRight: search ? 38 : 14,
                  paddingVertical: 10,
                  fontSize: 13.5,
                  color: themeColors.text,
                }}
              />
              {search ? (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={8}
                  style={{ position: 'absolute', right: 12, zIndex: 2 }}
                >
                  <XIcon color={themeColors.textMuted} size={16} />
                </Pressable>
              ) : null}
            </View>

            {/* Tabs & Sorting */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {/* Filter Tabs: All vs Activated */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => setTab('all')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: tab === 'all' ? activeTabBg : themeColors.border,
                    backgroundColor: tab === 'all' ? activeTabBg : themeColors.surface,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tab === 'all' ? activeTabFg : themeColors.textMuted }}>
                    All frameworks
                  </Text>
                  <View style={{
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: tab === 'all' ? (isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)') : themeColors.border,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tab === 'all' ? activeTabFg : themeColors.textMuted }}>
                      {catalogItems.length}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setTab('active')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: tab === 'active' ? activeTabBg : themeColors.border,
                    backgroundColor: tab === 'active' ? activeTabBg : themeColors.surface,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tab === 'active' ? activeTabFg : themeColors.textMuted }}>
                    Activated
                  </Text>
                  <View style={{
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: tab === 'active' ? (isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)') : themeColors.border,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tab === 'active' ? activeTabFg : themeColors.textMuted }}>
                      {activeCount}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Sort pills */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['name', 'score', 'updated'] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSort(s)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: sort === s ? themeColors.teal : themeColors.border,
                      backgroundColor: sort === s ? themeColors.tealLight : themeColors.surface,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: sort === s ? themeColors.teal : themeColors.textMuted }}>
                      {s === 'name' ? 'Name' : s === 'score' ? 'Score' : 'Updated'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: themeColors.tealLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheckIcon color={themeColors.teal} size={28} />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 16, color: themeColors.heading }}>
                {tab === 'active' ? 'No frameworks activated' : 'No frameworks found'}
              </Text>
              <Text style={{ color: themeColors.textMuted, textAlign: 'center', maxWidth: 320 }}>
                {tab === 'active'
                  ? 'Activate a standard framework from the catalog or add a custom framework.'
                  : 'Try a different search term or add a new framework.'}
              </Text>
              <Button
                title={tab === 'active' ? 'Browse Catalog' : '+ Add Framework'}
                onPress={() => (tab === 'active' ? setTab('all') : handleAddFramework())}
              />
            </Card>
          )
        }
        renderItem={({ item, index }) => {
          const isActivated = item.isActivated;
          const statusTone = item.score >= 70 ? 'success' : item.score >= 40 ? 'warning' : 'critical';
          const statusLabel = item.score >= 70 ? 'On track' : item.score >= 40 ? 'In progress' : 'At risk';
          const leftBorderColor = isActivated
            ? item.score >= 70
              ? themeColors.teal
              : item.score >= 40
              ? themeColors.amber
              : themeColors.water400
            : themeColors.border;

          return (
            <FadeIn delay={Math.min(index, 8) * 30}>
              <Pressable
                onPress={() => {
                  if (isActivated) {
                    r.push(`/(tabs)/frameworks/${item.id}`);
                  } else if (canActivate) {
                    setPendingFw(item);
                  }
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
              >
                <Card
                  style={{
                    gap: 10,
                    backgroundColor: themeColors.surface,
                    borderRadius: radius.lg,
                    borderLeftWidth: 4,
                    borderLeftColor: leftBorderColor,
                  }}
                >
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: isActivated ? themeColors.tealLight : themeColors.surfaceAlt,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldCheckIcon color={isActivated ? themeColors.teal : themeColors.textMuted} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: themeColors.heading }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {item.category ?? 'Framework'}{item.version ? ` · v${String(item.version).replace(/^v/i, '')}` : ''} · {item.controlCount ?? item.applicable ?? 0} controls
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isActivated ? (
                        <Badge label={`${item.score}%`} tone={item.score >= 80 ? 'success' : item.score >= 50 ? 'warning' : 'info'} />
                      ) : (
                        <Badge label="Available" tone="default" />
                      )}
                      {isActivated ? (
                        <ChevronRightIcon color={themeColors.textMuted} size={16} />
                      ) : null}
                    </View>
                  </View>

                  {/* Description snippet if available */}
                  {item.description ? (
                    <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 18, color: themeColors.textMuted }}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Status bar & progress if active */}
                  {isActivated ? (
                    <>
                      <ProgressBar
                        pct={item.score}
                        track={themeColors.border}
                        fill={item.score >= 80 ? themeColors.teal : item.score >= 50 ? themeColors.amber : themeColors.water400}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                          {item.implemented}/{item.applicable} implemented{item.notApplicable ? ` · ${item.notApplicable} N/A` : ''}
                        </Text>
                        <Badge label={statusLabel} tone={statusTone} />
                      </View>
                    </>
                  ) : null}

                  {/* Actions row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: themeColors.border, paddingTop: 10, marginTop: 2 }}>
                    {isActivated ? (
                      <>
                        <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                          {item.lastAssessed ? `Updated ${fmtDate(item.lastAssessed)}` : 'Ready for assessment'}
                        </Text>
                        <Button
                          title="Open controls"
                          size="sm"
                          onPress={() => r.push(`/(tabs)/frameworks/${item.id}`)}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 12, color: themeColors.textMuted, fontWeight: '600' }}>
                          {item.controlCount ?? 0} controls ready
                        </Text>
                        <Button
                          title={canActivate ? 'Activate' : 'Admin only'}
                          size="sm"
                          variant={canActivate ? 'primary' : 'secondary'}
                          disabled={!canActivate}
                          onPress={() => setPendingFw(item)}
                        />
                      </>
                    )}
                  </View>
                </Card>
              </Pressable>
            </FadeIn>
          );
        }}
      />

      {/* Confirmation Modal to Activate Framework */}
      {pendingFw ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPendingFw(null)}>
          <Pressable
            onPress={() => (activating ? null : setPendingFw(null))}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
              <View
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                  padding: spacing.lg,
                  gap: spacing.md,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: themeColors.tealLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldCheckIcon color={accent} size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: themeColors.heading }}>
                      Activate Framework
                    </Text>
                    <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                      Seed controls to start compliance tracking
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: themeColors.surfaceAlt,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: themeColors.heading }}>
                    {pendingFw.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                    {pendingFw.category ?? 'Framework'}{pendingFw.version ? ` · v${String(pendingFw.version).replace(/^v/i, '')}` : ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                    {pendingFw.controlCount ?? 0} controls will be added to your register as “Not Started”.
                  </Text>
                </View>

                {activateError ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'center',
                      backgroundColor: themeColors.criticalBg,
                      borderRadius: radius.md,
                      padding: 10,
                    }}
                  >
                    <AlertTriangleIcon color={themeColors.red} size={16} />
                    <Text style={{ flex: 1, fontSize: 12, color: themeColors.text }}>{activateError}</Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    disabled={activating}
                    onPress={() => setPendingFw(null)}
                  />
                  <Button
                    title="Activate"
                    loading={activating}
                    onPress={handleActivateConfirm}
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
