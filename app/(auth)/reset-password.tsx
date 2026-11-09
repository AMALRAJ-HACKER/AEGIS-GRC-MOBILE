import { Text, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Reset(){
  const [email,setEmail]=useState('');
  const [error,setError]=useState<string|undefined>();
  const [loading,setLoading]=useState(false);
  const router = useRouter();

  const send = async()=>{
    if(!EMAIL_RE.test(email.trim())){ setError('Enter a valid email address'); return; }
    setError(undefined);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if(err) Alert.alert('Could not send reset link', err.message);
    else Alert.alert('Check your email', 'We sent you a password reset link.', [{ text:'Back to login', onPress:()=> router.replace('/(auth)/login') }]);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: colors.bg }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Screen maxWidth={480} safeTop={0} style={{ justifyContent:'center', gap:16 }}>
        <Text style={{ fontSize:24, fontWeight:'700', color: colors.navy }}>Reset password</Text>
        <Input label="Work Email" value={email} onChangeText={setEmail} error={error} autoCapitalize="none" keyboardType="email-address" placeholder="you@company.com" />
        <Button title="Send reset link" loading={loading} onPress={send} />
        <Text onPress={()=> router.replace('/(auth)/login')} style={{ color: colors.navy, textAlign:'center' }}>Back to login</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
