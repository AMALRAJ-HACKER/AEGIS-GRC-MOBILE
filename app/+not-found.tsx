import { Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing } from '@/lib/design-tokens';

export default function NotFound(){
  const r = useRouter();
  return (
    <Screen maxWidth={480} style={{ justifyContent:'center', alignItems:'center', gap: spacing.md }}>
      <Text style={{ fontSize:64 }}>🧭</Text>
      <Text style={{ fontSize:28, fontWeight:'800', color: colors.navy }}>404 — Page Not Found</Text>
      <Text style={{ color: colors.textMuted, textAlign:'center' }}>The screen you are looking for does not exist or has been moved.</Text>
      <Button title="Go to Dashboard" onPress={()=> r.replace('/(tabs)')} />
      <Pressable onPress={()=> r.replace('/(tabs)')}><Text style={{ color: colors.navy, fontWeight:'600' }}>Back to safety</Text></Pressable>
    </Screen>
  );
}
