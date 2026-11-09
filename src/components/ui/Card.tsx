
import { View, ViewStyle } from 'react-native';
import { radius, spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export function Card({ children, style }: { children: any; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
