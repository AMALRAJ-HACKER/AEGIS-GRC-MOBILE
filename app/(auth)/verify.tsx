import { Text, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';

export default function Verify(){
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const router = useRouter();

  const resend = async()=>{
    if(!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({ type:'signup', email });
    setSending(false);
    if(error) Alert.alert('Could not resend', error.message);
    else setSent(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: colors.bg }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Screen maxWidth={480} safeTop={0} style={{ justifyContent:'center', gap:16 }}>
        <Text style={{ fontSize:26, fontWeight:'800', color: colors.navy }}>Verify your email</Text>
        <Text style={{ fontSize:15, color: colors.textMuted, lineHeight:22 }}>We sent a confirmation link to</Text>
        <Text style={{ fontSize:15, fontWeight:'800', color: colors.navy, marginTop:-10 }}>{email ?? 'your inbox'}</Text>
        <Text style={{ fontSize:15, color: colors.textMuted, lineHeight:22 }}>
          Open the link on this device to activate your account, then come back and log in. Didn't get it? Check spam, or resend below.
        </Text>
        {sent ? (
          <Text style={{ color: colors.success, fontWeight:'700', fontSize:13 }}>Confirmation email sent again — check your inbox.</Text>
        ) : null}
        <Button title="Resend confirmation email" variant="secondary" loading={sending} onPress={resend} />
        <Button title="Back to login" variant="ghost" onPress={()=> router.replace('/(auth)/login')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
