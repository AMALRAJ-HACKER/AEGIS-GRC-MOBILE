import { Text, Alert, KeyboardAvoidingView, Platform, Image, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';
import logo from '../../assets/logo.svg';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [errors,setErrors]=useState<{email?:string; password?:string}>({});
  const [loading,setLoading]=useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const router = useRouter();

  const handleLogoPress = () => {
    router.replace('/welcome');
  };

  const login = async()=>{
    const e:{email?:string;password?:string} = {};
    if(!EMAIL_RE.test(email.trim())) e.email='Enter a valid email address';
    if(!password) e.password='Enter your password';
    setErrors(e);
    if(Object.keys(e).length) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if(!error){ router.replace('/(tabs)'); return; }

    const notConfirmed = (error as any).code==='email_not_confirmed' || /not confirmed/i.test(error.message);
    if(notConfirmed){
      Alert.alert('Email not confirmed', 'Check your inbox for the confirmation link, or resend it now.', [
        { text:'Resend email', onPress: async()=>{
            const { error: resendErr } = await supabase.auth.resend({ type:'signup', email: email.trim() });
            Alert.alert(resendErr ? 'Could not resend' : 'Sent', resendErr ? resendErr.message : 'Confirmation email sent again.');
          } },
        { text:'Cancel', style:'cancel' },
      ]);
      return;
    }
    if(/invalid login credentials/i.test(error.message)){
      Alert.alert('Sign in failed', 'Incorrect email or password. Please try again.');
      return;
    }
    Alert.alert('Sign in failed', error.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: colors.bg }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Screen maxWidth={480} safeTop={0} style={{ justifyContent:'center', gap:16 }}>
        {isInputFocused ? null : (
          <Pressable onPress={handleLogoPress} style={{ position: 'absolute', left: spacing.md, top: spacing.md, zIndex: 10 }}>
            <Image source={logo} style={{ width: 64, height: 64 }} alt="AEGIS GRC Logo" />
            <Text style={{ fontSize:22, fontWeight:'800', color: colors.navy, marginTop: spacing.xs }}>AEGIS GRC</Text>
          </Pressable>
        )}
        <Text style={{ fontSize:28, fontWeight:'800', color: colors.navy }}>Welcome back</Text>
        <Input
          label="Work Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@company.com"
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
        />
        <Input label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoComplete="password" placeholder="Your password"
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
        />
        <Button title="Login" onPress={login} loading={loading} />
        <Text onPress={()=> router.push('/(auth)/reset-password')} style={{ color: colors.navy, textAlign:'center' }}>Forgot password?</Text>
        <Text onPress={()=> router.replace('/(auth)/signup')} style={{ color: colors.textMuted, textAlign:'center' }}>New here? Create an account</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
