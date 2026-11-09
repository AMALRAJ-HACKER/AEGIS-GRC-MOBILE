import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { FadeIn } from '@/components/motion/FadeIn';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { useCurrentOrg } from '@/hooks/useOrg';
import { useResponsive } from '@/lib/responsive';
import { useTheme } from '@/theme/ThemeProvider';
import { canActivateFramework, canCreateFramework } from '@/lib/permissions';
import {
  fetchFrameworkCatalog,
  fetchFrameworkStats,
  activateFramework,
  createFramework,
  cloneFramework,
  addFrameworkControls,
} from '@/services/api';
import { logActivity } from '@/lib/format';
import { radius, spacing } from '@/lib/design-tokens';
import { isStandardFramework, CATEGORIES } from '@/lib/frameworkUtils';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from '@/components/icons/ActionIcons';

type CatalogItem = {
  id: string;
  name: string;
  slug?: string;
  version?: string;
  description?: string;
  category?: string;
  controlCount?: number;
};

type FilterTab = 'all' | 'standard' | 'custom' | 'active' | 'draft';

const cleanVersion = (version?: string) => String(version ?? '').replace(/^v/i, '');

export default function AddFramework() {
  const r = useRouter();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const accent = isDark ? colors.teal : '#066A84';
  const { data: org, isLoading: orgLoading } = useCurrentOrg();
  const { width, isTablet, maxContent, hPad } = useResponsive();

  const orgId = org?.orgId ?? '';
  const role = org?.role ?? 'staff';
  const canActivate = orgLoading ? false : canActivateFramework(role);
  const canCreate = orgLoading ? false : canCreateFramework(role);

  const numColumns = isTablet ? 2 : 1;
  const gap = spacing.md;
  const contentWidth = Math.min(width, maxContent ?? width) - hPad * 2;
  const cardWidth = Math.max(
    150,
    numColumns > 1 ? Math.floor((contentWidth - gap) / 2) : contentWidth,
  );

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Activation states
  const [pending, setPending] = useState<CatalogItem | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [result, setResult] = useState<{ item: CatalogItem; count: number } | null>(null);

  // Clone states
  const [cloneTarget, setCloneTarget] = useState<CatalogItem | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // View Details modal state
  const [viewDetail, setViewDetail] = useState<CatalogItem | null>(null);

  // Custom Framework Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({
    name: '',
    code: '',
    category: 'Custom',
    version: '1.0',
    description: '',
    initialControlId: 'CTRL-01',
    initialControlTitle: 'Access Control Policy',
    initialControlGuidance: 'Document, approve, publish and periodically review security access controls.',
  });

  const catalog = useQuery({
    queryKey: ['frameworkCatalog'],
    queryFn: fetchFrameworkCatalog,
  });

  const stats = useQuery({
    queryKey: ['fwStats', orgId],
    queryFn: () => fetchFrameworkStats(orgId),
    enabled: !!orgId,
  });

  const activeIds = useMemo(
    () => new Set((stats.data ?? []).filter((f) => f.activated).map((f) => f.id)),
    [stats.data],
  );

  const total = catalog.data?.length ?? 0;

  // Filtered & searched framework list
  const list = useMemo<CatalogItem[]>(() => {
    const items = (catalog.data ?? []) as CatalogItem[];
    const term = q.trim().toLowerCase();

    return items.filter((f) => {
      const isAct = activeIds.has(f.id);
      const isStd = isStandardFramework(f.name);

      if (filter === 'standard' && !isStd) return false;
      if (filter === 'custom' && isStd) return false;
      if (filter === 'active' && !isAct) return false;
      if (filter === 'draft' && isAct) return false;

      if (!term) return true;
      return [f.name, f.category, f.description, f.version, f.slug]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(term));
    });
  }, [catalog.data, activeIds, filter, q]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([catalog.refetch(), orgId ? stats.refetch() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  };

  const closePending = () => {
    if (activating) return;
    setPending(null);
    setActivationError(null);
  };

  const openConfirm = (item: CatalogItem) => {
    if (!canActivate || (item.controlCount ?? 0) === 0) return;
    setActivationError(null);
    setPending(item);
  };

  const runActivate = async () => {
    if (!pending) return;
    if (!orgId) {
      setActivationError('Your workspace is still loading. Try again in a moment.');
      return;
    }

    setActivating(true);
    setActivationError(null);
    try {
      const count = await activateFramework(orgId, pending.id);
      await logActivity(orgId, 'framework_activated', 'framework', pending.id, {
        name: pending.name,
        controlCount: count,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fwStats', orgId] }),
        qc.invalidateQueries({ queryKey: ['frameworkCatalog'] }),
      ]);
      setPending(null);
      setResult({ item: pending, count });
    } catch (e: any) {
      setActivationError(e?.message ?? 'Could not activate this framework. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const openClone = (item: CatalogItem) => {
    if (!canCreate) return;
    setCloneTarget(item);
    setCloneName(`${item.name} (Copy)`);
    setCloneError(null);
  };

  const runClone = async () => {
    if (!cloneTarget || !cloneName.trim() || !orgId) return;
    setCloning(true);
    setCloneError(null);
    try {
      const cloned = await cloneFramework(orgId, cloneTarget.id, cloneName.trim());
      await logActivity(orgId, 'framework_cloned', 'framework', cloned?.id ?? cloneTarget.id, {
        from: cloneTarget.name,
        newName: cloneName.trim(),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fwStats', orgId] }),
        qc.invalidateQueries({ queryKey: ['frameworkCatalog'] }),
      ]);
      setCloneTarget(null);
    } catch (e: any) {
      setCloneError(e?.message ?? 'Failed to clone framework.');
    } finally {
      setCloning(false);
    }
  };

  const runCreateCustom = async () => {
    if (!customForm.name.trim() || !orgId) {
      setCreateError('Framework name is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createFramework(orgId, {
        name: customForm.name.trim(),
        category: customForm.category,
        version: customForm.version.trim() || '1.0',
        description: customForm.description.trim(),
        code: customForm.code.trim() || undefined,
      });

      // Add initial control if specified
      if (created?.id && customForm.initialControlId.trim() && customForm.initialControlTitle.trim()) {
        try {
          await addFrameworkControls(created.id, [
            {
              control_id: customForm.initialControlId.trim(),
              title: customForm.initialControlTitle.trim(),
              category: customForm.category,
              implementation_guidance: customForm.initialControlGuidance.trim() || undefined,
            },
          ]);
          await activateFramework(orgId, created.id);
        } catch {
          /* best effort */
        }
      }

      await logActivity(orgId, 'framework_created', 'framework', created?.id ?? 'custom', {
        name: customForm.name.trim(),
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fwStats', orgId] }),
        qc.invalidateQueries({ queryKey: ['frameworkCatalog'] }),
      ]);

      setShowCreateModal(false);
      setCustomForm({
        name: '',
        code: '',
        category: 'Custom',
        version: '1.0',
        description: '',
        initialControlId: 'CTRL-01',
        initialControlTitle: 'Access Control Policy',
        initialControlGuidance: 'Document, approve, publish and periodically review security access controls.',
      });
    } catch (e: any) {
      setCreateError(e?.message ?? 'Failed to create framework.');
    } finally {
      setCreating(false);
    }
  };

  const goToControls = () => {
    if (!result) return;
    const id = result.item.id;
    setResult(null);
    try {
      r.navigate(`/(tabs)/frameworks/${id}` as any);
    } catch {
      r.push(`/(tabs)/frameworks/${id}` as any);
    }
  };

  const goBackToFrameworks = () => {
    setResult(null);
    try {
      r.replace('/(tabs)/frameworks' as any);
    } catch {
      try {
        r.navigate('/(tabs)/frameworks' as any);
      } catch {
        r.push('/(tabs)/frameworks' as any);
      }
    }
  };

  return (
    <Screen>
      <SwipeBackContainer onBack={goBackToFrameworks}>
        <View style={{ flex: 1 }}>
        {/* ---------- Header ---------- */}
        <View style={{ paddingTop: 4, paddingBottom: spacing.sm, gap: 10 }}>
          <Pressable
            onPress={goBackToFrameworks}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to frameworks"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}
          >
            <ChevronLeftIcon color={colors.textMuted} size={20} />
            <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>Frameworks</Text>
          </Pressable>

          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: accent }}>
              FRAMEWORK LIBRARY
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading, lineHeight: 30 }}>
              Select a Compliance Framework
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textMuted }}>
              {total} frameworks · {activeIds.size} active — create, clone or activate.
            </Text>
          </View>

          {/* Quick Action Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <Button
              title="+ Create Custom Framework"
              size="sm"
              disabled={!canCreate}
              onPress={() => setShowCreateModal(true)}
            />
            <Button
              title="Browse Standards"
              size="sm"
              variant="secondary"
              onPress={() => setFilter('standard')}
            />
          </View>

          {/* Search input */}
          <View style={{ marginTop: 2, position: 'relative', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', left: 14, zIndex: 2 }}>
              <SearchIcon color={colors.textMuted} size={16} />
            </View>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search by name, code, category or version…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                paddingLeft: 40,
                paddingRight: q ? 40 : 14,
                paddingVertical: 10,
                fontSize: 13.5,
                color: colors.text,
              }}
            />
            {q ? (
              <Pressable
                onPress={() => setQ('')}
                hitSlop={8}
                style={{ position: 'absolute', right: 12, zIndex: 2 }}
              >
                <XIcon color={colors.textMuted} size={16} />
              </Pressable>
            ) : null}
          </View>

          {/* Filter Tabs (matching web Framework Library) */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {[
              { id: 'all' as FilterTab, label: 'All', badge: total },
              { id: 'standard' as FilterTab, label: 'Standard', badge: undefined },
              { id: 'custom' as FilterTab, label: 'Custom', badge: undefined },
              { id: 'active' as FilterTab, label: 'Active', badge: activeIds.size },
              { id: 'draft' as FilterTab, label: 'Draft', badge: undefined },
            ].map((t) => {
              const isSelected = filter === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setFilter(t.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.navy : colors.border,
                    backgroundColor: isSelected ? colors.navy : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: isSelected ? 'white' : colors.textMuted,
                    }}
                  >
                    {t.label}
                  </Text>
                  {typeof t.badge === 'number' ? (
                    <View
                      style={{
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 999,
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: isSelected ? 'white' : colors.textMuted,
                        }}
                      >
                        {t.badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Role disclaimer if non-admin */}
          {!orgLoading && !canActivate ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.warningBg,
                borderRadius: radius.md,
                paddingHorizontal: 12,
                paddingVertical: 9,
                marginTop: 2,
              }}
            >
              <AlertTriangleIcon color={colors.amber} size={16} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 }}>
                Only organization admins can activate or create frameworks. You can still browse the catalogue.
              </Text>
            </View>
          ) : null}
        </View>

        {/* ---------- Catalogue Grid ---------- */}
        {catalog.isLoading ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              paddingVertical: 48,
            }}
          >
            <ActivityIndicator color={accent} />
            <Text style={{ color: colors.textMuted }}>Loading framework catalogue…</Text>
          </View>
        ) : catalog.isError ? (
          <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
            <AlertTriangleIcon color={colors.amber} size={28} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.heading }}>
              Couldn’t load the catalogue
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
              Check your connection and try again.
            </Text>
            <Button title="Retry" variant="secondary" onPress={() => void catalog.refetch()} />
          </Card>
        ) : (
          <FlatList
            key={`framework-grid-${numColumns}`}
            style={{ flex: 1 }}
            data={list}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? { gap } : undefined}
            contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={accent}
                colors={[accent]}
              />
            }
            renderItem={({ item, index }) => {
              const active = activeIds.has(item.id);
              const hasControls = (item.controlCount ?? 0) > 0;
              const standard = isStandardFramework(item.name);

              return (
                <FadeIn delay={Math.min(index, 8) * 30} style={{ width: cardWidth, marginBottom: gap }}>
                  <Card style={{ flex: 1, gap: 10, borderRadius: radius.lg }}>
                    {/* Top Row: Icon, Title, Badges */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: active ? colors.successBg : colors.tealLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ShieldCheckIcon color={accent} size={20} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.heading }}>
                          {item.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: accent,
                            letterSpacing: 0.2,
                          }}
                        >
                          {item.category ?? 'Framework'}
                          {cleanVersion(item.version) ? ` · v${cleanVersion(item.version)}` : ''} · {standard ? 'Standard' : 'Custom'}
                        </Text>
                      </View>
                      {active ? <Badge label="Active" tone="success" /> : null}
                    </View>

                    {/* Description */}
                    <Text
                      style={{ fontSize: 12.5, lineHeight: 18, color: colors.textMuted }}
                      numberOfLines={3}
                    >
                      {item.description || 'No description provided for this framework.'}
                    </Text>

                    {/* Controls count */}
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.textMuted }}>
                      {item.controlCount ?? 0} controls
                    </Text>

                    <View style={{ height: 1, backgroundColor: colors.border }} />

                    {/* Action buttons (View, Clone, Activate) matching web app */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Button
                        title="View"
                        size="sm"
                        variant="secondary"
                        onPress={() => setViewDetail(item)}
                      />
                      <Button
                        title="Clone"
                        size="sm"
                        variant="ghost"
                        disabled={!canCreate}
                        onPress={() => openClone(item)}
                      />
                      <View style={{ flex: 1 }} />
                      {active ? (
                        <Button
                          title="Activated"
                          size="sm"
                          variant="secondary"
                          disabled
                        />
                      ) : (
                        <Button
                          title={!canActivate ? 'Admin only' : 'Activate'}
                          size="sm"
                          variant={canActivate ? 'primary' : 'secondary'}
                          disabled={!canActivate || !hasControls}
                          onPress={() => openConfirm(item)}
                        />
                      )}
                    </View>
                  </Card>
                </FadeIn>
              );
            }}
            ListEmptyComponent={
              <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32, marginTop: spacing.sm }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: colors.tealLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SearchIcon color={accent} size={24} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.heading }}>
                  No matching frameworks
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    textAlign: 'center',
                    maxWidth: 320,
                  }}
                >
                  Try a different filter or search term.
                </Text>
                {q ? (
                  <Button title="Clear search" variant="secondary" onPress={() => setQ('')} />
                ) : null}
              </Card>
            }
          />
        )}
      </View>

      {/* ---------- Confirm Activation Modal ---------- */}
      {pending ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={closePending}>
          <Pressable
            onPress={closePending}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
              <FadeIn distance={12}>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: colors.border,
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
                        backgroundColor: colors.tealLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldCheckIcon color={accent} size={24} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.heading }}>
                        Confirm activation
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        This adds controls to your register.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.heading }}>
                      {pending.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {pending.category ?? 'Framework'}
                      {cleanVersion(pending.version) ? ` · v${cleanVersion(pending.version)}` : ''}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {pending.controlCount ?? 0} controls will be seeded with status “Not Started”.
                    </Text>
                  </View>

                  {activationError ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 8,
                        alignItems: 'center',
                        backgroundColor: colors.criticalBg,
                        borderRadius: radius.md,
                        padding: 10,
                      }}
                    >
                      <AlertTriangleIcon color={colors.red} size={16} />
                      <Text style={{ flex: 1, fontSize: 12, color: colors.text }}>
                        {activationError}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      disabled={activating}
                      onPress={closePending}
                    />
                    <Button
                      title="Activate"
                      loading={activating}
                      onPress={() => void runActivate()}
                    />
                  </View>
                </View>
              </FadeIn>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* ---------- Clone Framework Modal ---------- */}
      {cloneTarget ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCloneTarget(null)}>
          <Pressable
            onPress={() => (cloning ? null : setCloneTarget(null))}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  gap: spacing.md,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.heading }}>
                  Clone {cloneTarget.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17 }}>
                  Creates an independent copy along with all controls — the original framework remains unchanged.
                </Text>

                <Input
                  label="New Framework Name"
                  value={cloneName}
                  onChangeText={setCloneName}
                  placeholder="e.g. ISO 27001 (Custom Copy)"
                />

                {cloneError ? (
                  <Text style={{ color: colors.red, fontSize: 12 }}>{cloneError}</Text>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    disabled={cloning}
                    onPress={() => setCloneTarget(null)}
                  />
                  <Button
                    title="Clone Framework"
                    loading={cloning}
                    disabled={!cloneName.trim()}
                    onPress={runClone}
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* ---------- View Details Modal ---------- */}
      {viewDetail ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewDetail(null)}>
          <Pressable
            onPress={() => setViewDetail(null)}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  gap: 12,
                  maxHeight: '85%',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.heading }}>
                      {viewDetail.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: accent, fontWeight: '700' }}>
                      {viewDetail.category ?? 'Framework'} · v{cleanVersion(viewDetail.version) || '1.0'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setViewDetail(null)} hitSlop={10}>
                    <XIcon color={colors.textMuted} size={20} />
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  <View style={{ gap: 12 }}>
                    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>DESCRIPTION</Text>
                      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text }}>
                        {viewDetail.description || 'No description provided.'}
                      </Text>
                    </View>

                    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>CONTROLS</Text>
                      <Text style={{ fontSize: 13, color: colors.text }}>
                        {viewDetail.controlCount ?? 0} controls ready for compliance tracking.
                      </Text>
                    </View>

                    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>TYPE</Text>
                      <Text style={{ fontSize: 13, color: colors.text }}>
                        {isStandardFramework(viewDetail.name) ? 'Industry Standard Framework' : 'Custom Organization Framework'}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <Button
                    title="Close"
                    variant="secondary"
                    onPress={() => setViewDetail(null)}
                  />
                  {!activeIds.has(viewDetail.id) && canActivate ? (
                    <Button
                      title="Activate"
                      onPress={() => {
                        const target = viewDetail;
                        setViewDetail(null);
                        openConfirm(target);
                      }}
                    />
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* ---------- Create Custom Framework Modal ---------- */}
      {showCreateModal ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowCreateModal(false)}>
          <Pressable
            onPress={() => (creating ? null : setShowCreateModal(false))}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              padding: spacing.md,
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  gap: 12,
                  maxHeight: '90%',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.heading }}>
                    Create Custom Framework
                  </Text>
                  <Pressable onPress={() => setShowCreateModal(false)} hitSlop={10}>
                    <XIcon color={colors.textMuted} size={20} />
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  <View style={{ gap: 12 }}>
                    <Input
                      label="Framework Name *"
                      value={customForm.name}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, name: v }))}
                      placeholder="e.g. Internal Security Policy"
                    />

                    <Input
                      label="Framework Code / Slug"
                      value={customForm.code}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, code: v }))}
                      placeholder="e.g. internal-sec-2026"
                      autoCapitalize="none"
                    />

                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Category</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {CATEGORIES.map((c) => {
                          const active = customForm.category === c;
                          return (
                            <Pressable
                              key={c}
                              onPress={() => setCustomForm((prev) => ({ ...prev, category: c }))}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: active ? colors.navy : colors.border,
                                backgroundColor: active ? colors.navy : colors.surface,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '600', color: active ? 'white' : colors.textMuted }}>
                                {c}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <Input
                      label="Version"
                      value={customForm.version}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, version: v }))}
                      placeholder="1.0"
                    />

                    <Input
                      label="Description"
                      value={customForm.description}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, description: v }))}
                      placeholder="Purpose, scope and key objectives…"
                      multiline
                      numberOfLines={3}
                    />

                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.heading }}>
                      Initial Control (Optional)
                    </Text>

                    <Input
                      label="Control ID"
                      value={customForm.initialControlId}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, initialControlId: v }))}
                      placeholder="CTRL-01"
                    />

                    <Input
                      label="Control Title"
                      value={customForm.initialControlTitle}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, initialControlTitle: v }))}
                      placeholder="Access Control Policy"
                    />

                    <Input
                      label="Implementation Guidance"
                      value={customForm.initialControlGuidance}
                      onChangeText={(v: string) => setCustomForm((prev) => ({ ...prev, initialControlGuidance: v }))}
                      placeholder="Guidance details…"
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                </ScrollView>

                {createError ? (
                  <Text style={{ color: colors.red, fontSize: 12 }}>{createError}</Text>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    disabled={creating}
                    onPress={() => setShowCreateModal(false)}
                  />
                  <Button
                    title="Create Framework"
                    loading={creating}
                    disabled={!customForm.name.trim()}
                    onPress={runCreateCustom}
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* ---------- Activation Success Modal ---------- */}
      {result ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={goBackToFrameworks}
        >
          <Pressable
            onPress={goBackToFrameworks}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
              <FadeIn distance={12}>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.md,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: colors.successBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckIcon color={accent} size={28} />
                  </View>
                  <Text
                    style={{
                      fontSize: 19,
                      fontWeight: '800',
                      color: colors.heading,
                      textAlign: 'center',
                    }}
                  >
                    Framework activated
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      textAlign: 'center',
                      lineHeight: 19,
                    }}
                  >
                    {result.item.name} added {result.count} controls to your compliance register, all
                    set to “Not Started”.
                  </Text>
                  <View style={{ width: '100%', gap: 10, marginTop: 4 }}>
                    <Button title="View controls" onPress={goToControls} style={{ width: '100%' }} />
                    <Button
                      title="Back to frameworks"
                      variant="secondary"
                      onPress={goBackToFrameworks}
                      style={{ width: '100%' }}
                    />
                  </View>
                </View>
              </FadeIn>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      </SwipeBackContainer>
    </Screen>
  );
}
