import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/lib/design-tokens';
import { useResponsive } from '@/lib/responsive';

export default function Onboarding(){
  const r = useRouter();
  const { topInset, bottomInset, hPad } = useResponsive();
  return (
    <ScrollView contentContainerStyle={{
      flexGrow:1,
      justifyContent:'center',
      paddingTop: topInset + spacing.xl,
      paddingBottom: bottomInset + spacing.xl,
      paddingHorizontal: hPad,
      gap:24,
      width:'100%',
      maxWidth: 640,
      alignSelf:'center',
      backgroundColor: colors.bg,
    }}>
      <Text style={{ fontSize:34, fontWeight:'800', color: colors.navy }}>Governance, Risk & Compliance — reimagined with AI.</Text>
      <Text style={{ fontSize:16, color: colors.textMuted, lineHeight:24 }}>AEGIS GRC helps teams meet ISO 27001, NIST, SOC 2, DPDP Act 2023, CERT-In, RBI and UGC requirements. COMP AI inspired UX.</Text>
      <View style={{ gap:12 }}>
        <Button title="Get Started" onPress={()=> r.push('/(auth)/signup')} />
        <Button title="I already have an account" variant="secondary" onPress={()=> r.push('/(auth)/login')} />
      </View>
    </ScrollView>
  );
}
