import { Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/lib/responsive';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/design-tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugify = (s:string)=> (s||'my-org').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'org';

export default function Signup(){
  const [org,setOrg]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [errors,setErrors]=useState<{org?:string;email?:string;password?:string;confirm?:string}>({});
  const [loading,setLoading]=useState(false);
  const router=useRouter();
  const { topInset, bottomInset, hPad } = useResponsive();

  const validate=()=>{
    const e:{org?:string;email?:string;password?:string;confirm?:string}={};
    if(!org.trim()) e.org='Organization / company name is required';
    if(!EMAIL_RE.test(email.trim())) e.email='Enter a valid work email';
    if(password.length<8) e.password='At least 8 characters';
    if(confirm!==password) e.confirm='Passwords do not match';
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const signup = async()=>{
    if(!validate()) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { organization_name: org.trim() } },
    });

    if(error){
      setLoading(false);
      const already = (error as any).code==='user_already_exists' || /already (registered|exists)/i.test(error.message);
      if(already){
        Alert.alert('Account already exists', 'An account with this email already exists. Log in instead?', [
          { text:'Log in', onPress:()=> router.replace('/(auth)/login') },
          { text:'Cancel', style:'cancel' },
        ]);
      } else {
        Alert.alert('Sign up failed', error.message);
      }
      return;
    }

    // Email confirmation required -> no session yet -> send user to verify screen
    if(!data.session){
      setLoading(false);
      router.replace({ pathname:'/(auth)/verify', params:{ email: email.trim() } });
      return;
    }

    // Confirmed instantly: create the workspace records (never block the user on these)
    const user = data.user;
    if(user){
      const { error: pErr } = await supabase.from('profiles')
        .upsert({ id:user.id, email:email.trim(), full_name: org.trim() });
      if(pErr) console.warn('[AEGIS] profile create failed:', pErr.message);

      const { data: orgData, error: oErr } = await supabase.from('organizations')
        .insert({ name: org.trim(), slug: `${slugify(org.trim())}-${Date.now().toString().slice(-4)}`, created_by: user.id })
        .select().single();
      if(oErr) console.warn('[AEGIS] organization create failed:', oErr.message);
      else if(orgData){
        const { error: mErr } = await supabase.from('organization_memberships')
          .insert({ organization_id: orgData.id, user_id: user.id, role:'org_admin' });
        if(mErr) console.warn('[AEGIS] membership create failed:', mErr.message);
      }
    }

    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: colors.bg }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={{
        flexGrow:1,
        justifyContent:'center',
        paddingTop: topInset + spacing.xl,
        paddingBottom: bottomInset + spacing.xl,
        paddingHorizontal: hPad,
        gap:16,
        width:'100%',
        maxWidth: 480,
        alignSelf:'center',
      }}>
        <Text style={{ fontSize:28, fontWeight:'800', color: colors.navy }}>Create workspace</Text>
        <Text style={{ fontSize:14, color: colors.textMuted, marginTop:-8 }}>Start with your organization — invite your team after signup.</Text>
        <Input label="Organization / Company Name" value={org} onChangeText={setOrg} error={errors.org} placeholder="Acme Security Pvt Ltd" />
        <Input label="Work Email" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@company.com" />
        <Input label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoComplete="new-password" placeholder="Minimum 8 characters" />
        <Input label="Confirm Password" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoComplete="new-password" placeholder="Re-enter your password" />
        <Button title="Create Account" onPress={signup} loading={loading} />
        <Text onPress={()=> router.replace('/(auth)/login')} style={{ color: colors.textMuted, textAlign:'center' }}>Already have an account? Log in</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
