import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { radius } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export function Input({ label, error, secureTextEntry, style, ...props }: any) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text> : null}
      <View style={{ position: 'relative' }}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry ? hidden : false}
          style={[
            {
              borderWidth: 1,
              borderColor: error ? colors.red : colors.border,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: colors.text,
              backgroundColor: colors.inputBg,
              paddingRight: secureTextEntry ? 64 : 14,
            },
            style,
          ]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={{ position: 'absolute', right: 12, top: 11 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.heading, letterSpacing: 0.5 }}>
              {hidden ? 'SHOW' : 'HIDE'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: colors.red, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
