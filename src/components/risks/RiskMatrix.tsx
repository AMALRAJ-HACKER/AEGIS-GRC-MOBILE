import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { useTheme } from '@/theme/ThemeProvider';
import { fmtDate, riskStatusLabel, severityFromScore } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { LIKELIHOOD_HINTS, IMPACT_HINTS } from '@/components/risks/RiskForm';
import { ChevronRightIcon } from '@/components/icons/ActionIcons';

export type RiskItem = {
  id: string;
  title: string;
  category?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_score?: number;
  status: string;
  owner?: { full_name?: string } | null;
  target_date?: string | null;
  description?: string | null;
};

const zoneColor = (score: number) => {
  if (score >= 17) return '#EF4444'; // Critical
  if (score >= 10) return '#F97316'; // High
  if (score >= 5) return '#F59E0B';  // Medium
  return '#10B981';                  // Low
};

const riskCode = (id: string) => `RSK-${String(id).slice(0, 8).toUpperCase()}`;

export function RiskMatrix({
  risks,
  allRisksCount,
  onAddRisk,
  canAdd,
}: {
  risks: RiskItem[];
  allRisksCount?: number;
  onAddRisk?: () => void;
  canAdd?: boolean;
}) {
  const r = useRouter();
  const { colors, isDark } = useTheme();
  const { width, maxContent, hPad } = useResponsive();

  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);

  // Active open risks
  const openRisks = risks.filter((k) => k.status !== 'closed');

  // Severity counts
  const counts = {
    critical: openRisks.filter((k) => k.severity === 'critical').length,
    high: openRisks.filter((k) => k.severity === 'high').length,
    medium: openRisks.filter((k) => k.severity === 'medium').length,
    low: openRisks.filter((k) => k.severity === 'low').length,
  };

  // Cell risks getter
  const getCellRisks = (lik: number, imp: number) => {
    return openRisks.filter((k) => k.likelihood === lik && k.impact === imp);
  };

  // Mathematically responsive sizing
  const availableWidth = Math.min(width, maxContent ?? width) - hPad * 2 - 24;
  const labelWidth = 24;
  const gridGap = 4;
  const cellSize = Math.max(38, Math.min(62, Math.floor((availableWidth - labelWidth - gridGap * 4) / 5)));

  const selectedCellRisks = selectedCell
    ? getCellRisks(selectedCell.likelihood, selectedCell.impact)
    : [];

  const selectedScore = selectedCell ? selectedCell.likelihood * selectedCell.impact : 0;
  const selectedSeverity = selectedScore ? severityFromScore(selectedScore) : 'low';

  const topOpenRisks = [...openRisks]
    .sort((a, b) => (b.inherent_score ?? 0) - (a.inherent_score ?? 0))
    .slice(0, 5);

  return (
    <View style={{ gap: spacing.md }}>
      {/* 5x5 Heatmap Matrix Card */}
      <Card style={{ padding: 12, gap: 12 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading }}>
              5×5 Risk Heatmap Matrix
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
              Inherent Risk = Likelihood (1–5) × Impact (1–5)
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : '#E0F2FE',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#38BDF8' : '#0284C7' }}>
              {openRisks.length} Open
            </Text>
          </View>
        </View>

        {/* 4 Severity Badges Row */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[
            { label: 'Critical', range: '17–25', count: counts.critical, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
            { label: 'High', range: '10–16', count: counts.high, color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
            { label: 'Medium', range: '5–9', count: counts.medium, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
            { label: 'Low', range: '1–4', count: counts.low, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
          ].map((item) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 4,
                borderRadius: 8,
                backgroundColor: item.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '900', color: item.color }}>{item.count}</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: item.color }}>{item.label}</Text>
              <Text style={{ fontSize: 8, color: colors.textMuted }}>{item.range}</Text>
            </View>
          ))}
        </View>

        {/* 5x5 Heatmap Grid */}
        <View style={{ alignSelf: 'center', marginTop: 4 }}>
          {/* Top axis banner: Likelihood */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: labelWidth }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted }}>
                LIKELIHOOD ▶
              </Text>
            </View>
          </View>

          {/* Impact Rows (5 down to 1) */}
          {[5, 4, 3, 2, 1].map((imp) => {
            return (
              <View key={imp} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: gridGap }}>
                {/* Y-axis Label */}
                <View style={{ width: labelWidth, paddingRight: 4, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted }}>{imp}</Text>
                </View>

                {/* 5 Likelihood Columns for this Impact */}
                <View style={{ flexDirection: 'row', gap: gridGap }}>
                  {[1, 2, 3, 4, 5].map((lik) => {
                    const score = lik * imp;
                    const cellRisks = getCellRisks(lik, imp);
                    const hasRisks = cellRisks.length > 0;
                    const isSelected =
                      selectedCell?.likelihood === lik && selectedCell?.impact === imp;
                    const baseColor = zoneColor(score);

                    return (
                      <Pressable
                        key={lik}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedCell(null);
                          } else {
                            setSelectedCell({ likelihood: lik, impact: imp });
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Likelihood ${lik}, Impact ${imp}, score ${score}, ${cellRisks.length} risks`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 8,
                          backgroundColor: hasRisks
                            ? baseColor
                            : isDark
                            ? `${baseColor}22`
                            : `${baseColor}18`,
                          borderWidth: isSelected ? 2.5 : 1,
                          borderColor: isSelected
                            ? isDark
                              ? '#38BDF8'
                              : '#0284C7'
                            : hasRisks
                            ? baseColor
                            : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.05)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: isSelected ? baseColor : 'transparent',
                          shadowOpacity: isSelected ? 0.45 : 0,
                          shadowRadius: 4,
                          elevation: isSelected ? 4 : 0,
                        }}
                      >
                        {hasRisks ? (
                          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '900',
                                color: '#FFFFFF',
                                textShadowColor: 'rgba(0,0,0,0.4)',
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 2,
                              }}
                            >
                              {cellRisks.length}
                            </Text>
                            <Text
                              style={{
                                fontSize: 8,
                                fontWeight: '700',
                                color: 'rgba(255,255,255,0.9)',
                              }}
                            >
                              sc:{score}
                            </Text>
                          </View>
                        ) : (
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '600',
                              color: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.26)',
                            }}
                          >
                            {score}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* X-axis Column numbers (1 to 5) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View style={{ width: labelWidth, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textMuted }}>▲</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: gridGap }}>
              {[1, 2, 3, 4, 5].map((lik) => (
                <View key={lik} style={{ width: cellSize, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted }}>{lik}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Axis Helper Legend */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.surfaceAlt,
            borderRadius: 8,
            padding: 8,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>
            ▲ Y-Axis (Impact): 1 Negligible · 2 Minor · 3 Moderate · 4 Major · 5 Catastrophic
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>
            ▶ X-Axis (Likelihood): 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Certain
          </Text>
        </View>

        {/* Selected cell notice */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: selectedCell ? (isDark ? 'rgba(56,189,248,0.1)' : '#F0F9FF') : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: selectedCell ? (isDark ? 'rgba(56,189,248,0.3)' : '#BAE6FD') : colors.border,
          }}
        >
          {selectedCell ? (
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#38BDF8' : '#0369A1' }}>
                CELL: L{selectedCell.likelihood} ({LIKELIHOOD_HINTS[selectedCell.likelihood - 1]}) × I{selectedCell.impact} ({IMPACT_HINTS[selectedCell.impact - 1]})
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                Score: {selectedScore} ({selectedSeverity.toUpperCase()}) · {selectedCellRisks.length} {selectedCellRisks.length === 1 ? 'risk' : 'risks'}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 11, color: colors.textMuted }}>
              💡 Tap any cell in the heatmap to view its risks.
            </Text>
          )}

          {selectedCell ? (
            <Pressable
              onPress={() => setSelectedCell(null)}
              hitSlop={8}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>Clear ✕</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {/* Drill-down Risks List */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.heading }}>
            {selectedCell
              ? `Risks in Cell (L${selectedCell.likelihood} × I${selectedCell.impact})`
              : 'Top Inherent Risks'}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
            {selectedCell ? `${selectedCellRisks.length} found` : `${topOpenRisks.length} of ${openRisks.length} open`}
          </Text>
        </View>

        {selectedCell && selectedCellRisks.length === 0 ? (
          <Card style={{ padding: 20, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 24 }}>🛡️</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.heading }}>
              No Risks in this Cell
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
              No active risks have Likelihood {selectedCell.likelihood} ({LIKELIHOOD_HINTS[selectedCell.likelihood - 1]}) and Impact {selectedCell.impact} ({IMPACT_HINTS[selectedCell.impact - 1]}).
            </Text>
            {canAdd && onAddRisk ? (
              <Button
                title="+ Add Risk"
                size="sm"
                variant="secondary"
                style={{ marginTop: 6 }}
                onPress={onAddRisk}
              />
            ) : null}
          </Card>
        ) : (
          (selectedCell ? selectedCellRisks : topOpenRisks).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => r.push(`/(tabs)/risks/${item.id}` as any)}
              hitSlop={8}
            >
              <Card
                style={{
                  padding: 12,
                  gap: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: zoneColor(item.inherent_score),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.navy, letterSpacing: 0.6 }}>
                      {riskCode(item.id)}
                    </Text>
                    <Badge
                      label={item.severity.toUpperCase()}
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
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      · {riskStatusLabel(item.status)}
                    </Text>
                  </View>

                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: zoneColor(item.inherent_score) }}>
                      Score {item.inherent_score}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, paddingRight: 6 }}>
                    {item.title}
                  </Text>
                  <ChevronRightIcon color={colors.textMuted} size={16} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {item.category ?? 'Uncategorised'} · Owner: {item.owner?.full_name ?? 'Unassigned'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    L{item.likelihood} × I{item.impact}
                    {item.residual_score ? ` → Residual ${item.residual_score}` : ''}
                    {item.target_date ? ` · Due ${fmtDate(item.target_date)}` : ''}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}
