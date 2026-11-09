import { useEffect, useMemo } from 'react';
import { View, Text, Animated } from 'react-native';
import { colors } from '@/lib/design-tokens';

const RING_SIZE = 80;
const RING_WIDTH = 6;

const getRingColor = (score: number) => {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  if (score >= 30) return '#FBBF24';
  return '#EF4444';
};

export function ComplianceRing({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const finalWidth = (safeScore / 100) * (RING_SIZE - RING_WIDTH);
  const progressAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: finalWidth,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [progressAnim, finalWidth]);

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: RING_WIDTH, borderColor: '#1F2937', position: 'relative' }}>
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: progressAnim,
        height: RING_WIDTH,
        borderRadius: RING_WIDTH / 2,
        backgroundColor: getRingColor(safeScore),
      }}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F2937' }}>{safeScore}%</Text>
        <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>{'COMPLIANCE'}</Text>
      </View>
    </View>
  );
}
