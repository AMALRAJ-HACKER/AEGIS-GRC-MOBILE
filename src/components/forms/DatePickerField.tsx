import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { radius, spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { CalendarIcon } from '@/components/icons/ActionIcons';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  error,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  const { colors } = useTheme();
  const selected = parseYmd(value);
  const [visible, setVisible] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(selected ?? new Date()));

  const open = () => {
    setCursor(startOfMonth(selected ?? new Date()));
    setVisible(true);
  };

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const leading = first.getDay();
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let day = 1; day <= count; day++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const today = new Date();

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text> : null}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value || placeholder}` : placeholder}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: error ? colors.red : colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <CalendarIcon color={colors.textMuted} size={18} />
        <Text style={{ flex: 1, fontSize: 15, color: value ? colors.text : colors.textMuted }}>
          {value || placeholder}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.teal }}>CHANGE</Text>
      </Pressable>
      {error ? <Text style={{ color: colors.red, fontSize: 12 }}>{error}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable
          onPress={() => setVisible(false)}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.md }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: spacing.sm,
              width: '100%',
              maxWidth: 420,
              alignSelf: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.heading }}>
                {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </Text>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={navButton(colors.border)}>
                <Text style={{ color: colors.heading, fontWeight: '800', fontSize: 16 }}>‹</Text>
              </Pressable>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={navButton(colors.border)}>
                <Text style={{ color: colors.heading, fontWeight: '800', fontSize: 16 }}>›</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((d, i) => (
                <Text
                  key={`${d}-${i}`}
                  style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textMuted, paddingVertical: 4 }}
                >
                  {d}
                </Text>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {days.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, height: 38 }} />;
                const isSelected = !!selected && toYmd(day) === toYmd(selected);
                const isToday = toYmd(day) === toYmd(today);
                return (
                  <View key={toYmd(day)} style={{ width: `${100 / 7}%`, height: 38, padding: 2 }}>
                    <Pressable
                      onPress={() => {
                        onChange(toYmd(day));
                        setVisible(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={toYmd(day)}
                      style={{
                        flex: 1,
                        borderRadius: radius.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? colors.primary : isToday ? colors.surfaceAlt : 'transparent',
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: colors.teal,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected || isToday ? '800' : '500',
                          color: isSelected ? colors.onPrimary : colors.text,
                        }}
                      >
                        {day.getDate()}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={() => {
                  onChange(toYmd(today));
                  setVisible(false);
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.heading }}>Today</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              {value ? (
                <Pressable
                  onPress={() => {
                    onChange('');
                    setVisible(false);
                  }}
                  style={{ paddingVertical: 10, paddingHorizontal: 12 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red }}>Clear</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setVisible(false)}
                style={{ paddingVertical: 10, paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function navButton(borderColor: string) {
  return {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}
