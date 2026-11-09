import { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { canAddRisk } from '@/lib/permissions';
import { fetchRisks } from '@/services/api';
import { fmtDate, riskStatusLabel } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Aurora } from '@/components/motion/Aurora';
import { RiskMatrix } from '@/components/risks/RiskMatrix';
import { ChevronRightIcon } from '@/components/icons/ActionIcons';

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'] as const;
const STATUSES = ['all', 'open', 'mitigating', 'accepted', 'closed'] as const;

const riskCode = (id: string) => `RSK-${String(id).slice(0, 8).toUpperCase()}`;

export default function Risks() {
  const r = useRouter();
  const { colors, isDark } = useTheme();
  const { data: org } = useCurrentOrg();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('all');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: risks } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['risks', org?.orgId],
    queryFn: () => fetchRisks(org!.orgId),
  });

  const all = risks ?? [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  all.forEach((k: any) => {
    if (k.status !== 'closed' && counts[k.severity as keyof typeof counts] !== undefined) {
      counts[k.severity as keyof typeof counts]++;
    }
  });

  const categories = useMemo(
    () => Array.from(new Set(all.map((k: any) => k.category).filter(Boolean))).sort(),
    [all],
  );

  const q = search.trim().toLowerCase();
  const shown = all.filter((k: any) => {
    if (severity !== 'all' && k.severity !== severity) return false;
    if (status !== 'all' && k.status !== status) return false;
    if (category !== 'all' && k.category !== category) return false;
    if (!q) return true;
    return [k.title, k.description, k.category, k.owner?.full_name, riskCode(k.id)]
      .some((v: any) => String(v ?? '').toLowerCase().includes(q));
  });

  const exportCsv = async () => {
    setBusy(true);
    try {
      const header = 'risk_id,title,category,owner,status,inherent_score,likelihood,impact,residual_score,severity,target_date\n';
      const rows = shown
        .map((k: any) =>
          [
            riskCode(k.id),
            k.title,
            k.category ?? '',
            k.owner?.full_name ?? '',
            riskStatusLabel(k.status),
            k.inherent_score,
            k.likelihood,
            k.impact,
            k.residual_score ?? '',
            k.severity,
            k.target_date ?? '',
          ]
            .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n');
      const uri = `${FileSystem.cacheDirectory}aegis-risk-register.csv`;
      await FileSystem.writeAsStringAsync(uri, header + rows, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'AEGIS risk register' });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddRisk = () => {
    try {
      r.navigate('/(tabs)/risks/new' as any);
    } catch {
      r.push('/(tabs)/risks/new' as any);
    }
  };

  const activeChipBg = isDark ? colors.primary : '#0F172A';
  const activeChipFg = isDark ? colors.onPrimary : '#FFFFFF';

  // Header Component
  const renderHeader = () => (
    <View style={{ gap: 10, paddingBottom: 6 }}>
      {/* Top action row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading }}>Risk Register</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            Score likelihood × impact to determine severity and prioritize mitigation.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Button title="Export" variant="secondary" size="sm" loading={busy} onPress={exportCsv} />
          {canAddRisk(org?.role) ? (
            <Button title="+ Add Risk" size="sm" onPress={handleAddRisk} />
          ) : null}
        </View>
      </View>

      {/* View Switcher: List View vs Heatmap Matrix */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceAlt,
          borderRadius: 12,
          padding: 3,
          borderWidth: 1,
          borderColor: colors.border,
          marginTop: 2,
        }}
      >
        <Pressable
          onPress={() => setView('list')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 9,
            borderRadius: 9,
            backgroundColor: view === 'list' ? (isDark ? colors.surface : colors.white) : 'transparent',
            shadowColor: '#000',
            shadowOpacity: view === 'list' ? 0.08 : 0,
            shadowRadius: 2,
            elevation: view === 'list' ? 1 : 0,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: view === 'list' ? colors.heading : colors.textMuted }}>
            📋 List View ({shown.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setView('matrix')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 9,
            borderRadius: 9,
            backgroundColor: view === 'matrix' ? (isDark ? colors.surface : colors.white) : 'transparent',
            shadowColor: '#000',
            shadowOpacity: view === 'matrix' ? 0.08 : 0,
            shadowRadius: 2,
            elevation: view === 'matrix' ? 1 : 0,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: view === 'matrix' ? colors.heading : colors.textMuted }}>
            🗺️ 5×5 Matrix ({all.filter((k: any) => k.status !== 'closed').length})
          </Text>
        </Pressable>
      </View>

      {/* In Matrix view, we keep the header clean so 5x5 matrix is directly above the fold. In List view, show full filters */}
      {view === 'list' ? (
        <>
          {/* Search Input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="🔍  Search risks, owners or risk ID…"
              placeholderTextColor={colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.text,
                flex: 1,
              }}
            />
            {search.length > 0 ? (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={8}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>Clear ✕</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Severity Filter Chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SEVERITIES.map((s) => {
              const isSelected = severity === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSeverity(s)}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isSelected ? activeChipBg : colors.border,
                    backgroundColor: isSelected ? activeChipBg : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? activeChipFg : colors.textMuted }}>
                    {s === 'all' ? `All (${all.length})` : `${s[0].toUpperCase() + s.slice(1)} (${counts[s as keyof typeof counts]})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Status Filter Chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STATUSES.map((s) => {
              const isSelected = status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStatus(s)}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isSelected ? activeChipBg : colors.border,
                    backgroundColor: isSelected ? activeChipBg : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? activeChipFg : colors.textMuted }}>
                    {s === 'all' ? 'Any status' : riskStatusLabel(s)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Category Chips */}
          {categories.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['all', ...categories].map((c) => {
                const isSelected = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1.5,
                      borderColor: isSelected ? activeChipBg : colors.border,
                      backgroundColor: isSelected ? activeChipBg : colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: isSelected ? '800' : '600',
                        color: isSelected ? activeChipFg : colors.text,
                      }}
                    >
                      {c === 'all' ? 'All categories' : c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const contentContainerStyle = {
    paddingTop: topInset + spacing.sm,
    paddingBottom: Math.max(bottomInset + 120, 160),
    paddingHorizontal: hPad,
    gap: spacing.md,
    width: '100%' as const,
    maxWidth: maxContent,
    alignSelf: 'center' as const,
    backgroundColor: 'transparent',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora />

      {view === 'matrix' ? (
        /* Matrix View Mode: Smooth ScrollView wrapping Header + RiskMatrix */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
        >
          {renderHeader()}
          <RiskMatrix
            risks={shown}
            allRisksCount={all.length}
            onAddRisk={handleAddRisk}
            canAdd={canAddRisk(org?.role)}
          />
        </ScrollView>
      ) : (
        /* List View Mode: FlatList with search & list items */
        <FlatList
          data={shown}
          keyExtractor={(item: any) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
              <Text style={{ fontSize: 30 }}>⚠️</Text>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.heading }}>
                {all.length ? 'No risks match these filters' : 'No risks recorded'}
              </Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13, maxWidth: 300, lineHeight: 18 }}>
                {all.length
                  ? 'Clear the search or filters to see the full register.'
                  : 'Tap “+ Add Risk” to build your register. Scores auto-calculate (Likelihood × Impact).'}
              </Text>
            </Card>
          }
          renderItem={({ item }: any) => {
            const sevColor =
              item.severity === 'critical'
                ? colors.red
                : item.severity === 'high'
                ? '#F97316'
                : item.severity === 'medium'
                ? colors.amber
                : colors.teal;

            return (
              <Pressable
                onPress={() => r.push(`/(tabs)/risks/${item.id}` as any)}
                hitSlop={8}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <Card
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: sevColor,
                    backgroundColor: colors.surface,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>
                        {riskCode(item.id)}
                      </Text>
                      <Badge
                        label={item.severity}
                        tone={
                          item.severity === 'critical'
                            ? 'critical'
                            : item.severity === 'high'
                            ? 'warning'
                            : item.severity === 'medium'
                            ? 'info'
                            : 'default'
                        }
                      />
                      <Badge
                        label={riskStatusLabel(item.status)}
                        tone={
                          item.status === 'open'
                            ? 'critical'
                            : item.status === 'mitigating'
                            ? 'warning'
                            : item.status === 'accepted'
                            ? 'info'
                            : 'success'
                        }
                      />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.heading, marginTop: 2 }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {item.category ?? 'Uncategorised'} · Owner: {item.owner?.full_name ?? 'Unassigned'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Inherent score <Text style={{ fontWeight: '700', color: colors.text }}>{item.inherent_score}</Text> ({item.likelihood}×{item.impact})
                      {item.residual_score ? ` → Residual ${item.residual_score}` : ''}
                      {item.target_date ? ` · Target ${fmtDate(item.target_date)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
                    <ChevronRightIcon color={colors.textMuted} size={18} />
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
