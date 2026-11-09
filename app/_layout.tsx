
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useCurrentOrg } from '@/hooks/useOrg';
import { CelebrationProvider } from '@/components/motion/Celebration';
import { GlobalLoadingPulse } from '@/components/motion/GlobalLoadingPulse';
import { WorkspaceMotionProvider } from '@/components/motion/WorkspaceMotion';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import type { Session } from '@supabase/supabase-js';

/**
 * WorkspaceSync — subscribes to DB changes while signed in and refreshes the
 * react-query cache, so open screens update live (teammates' changes,
 * notifications, status flips) without pull-to-refresh. Renders nothing.
 */
function WorkspaceSync({ enabled }: { enabled: boolean }){
  useRealtimeSync(enabled);
  return null;
}

/**
 * AuthGate — enforces "sign in to enter".
 * - No session  -> any protected route bounces to /(auth)/login
 * - Public areas: splash (index) and the whole (auth) group
 * - Reacts to sign-in/sign-out instantly (onAuthStateChange)
 */
function AuthGate({ children }: { children: ReactNode }){
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = still checking
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: orgCtx, isSuccess: orgLoaded } = useCurrentOrg();

  // Motion only runs inside the signed-in workspace — never on login,
  // onboarding, or the boot splash.
  const first = segments[0] as string | undefined;
  const inAuthArea =
    first === undefined ||
    first === 'index' ||
    first === 'welcome' ||
    first === '(auth)' ||
    first === 'onboarding';
  const workspaceMotion = !!session && !inAuthArea;

  const { colors, isDark } = useTheme();

  useEffect(()=>{
    let mounted = true;
    supabase.auth.getSession()
      .then(({ data })=>{ if(mounted) setSession(data.session); })
      .catch(()=>{ if(mounted) setSession(null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s)=>{
      if(mounted) setSession(s);
    });
    return ()=>{ mounted = false; sub.subscription.unsubscribe(); };
  },[]);

  // Drop cached workspace data the moment we're signed out, so a different
  // account signing in on the same device never sees the previous user's data.
  useEffect(()=>{ if(session === null) queryClient.clear(); },[session, queryClient]);

  useEffect(()=>{
    if(session === undefined) return; // wait until we know
    const isPublic = first === undefined || first === 'index' || first === 'welcome' || first === '(auth)';
    if(!session){
      if(!isPublic && first !== 'onboarding') router.replace('/(auth)/login');
      return;
    }
    // Signed-in users must never land on the public marketing page — bounce them to the workspace.
    if (isPublic && first === 'welcome') {
      router.replace('/(tabs)');
      return;
    }
    // Signed in: route org-less users to first-run setup, and push
    // newly-onboarded users into the workspace.
    if(orgLoaded){
      const onboarded = !!orgCtx?.orgId;
      if(!onboarded && first !== 'onboarding') router.replace('/onboarding');
      else if(onboarded && first === 'onboarding') router.replace('/(tabs)');
    }
  },[session, segments, orgLoaded, orgCtx]);

  return (
    <WorkspaceMotionProvider enabled={workspaceMotion}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {children}
        <WorkspaceSync enabled={!!session} />
        <GlobalLoadingPulse enabled={workspaceMotion} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    </WorkspaceMotionProvider>
  );
}

export default function RootLayout(){
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CelebrationProvider>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="welcome" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="evidence" />
                <Stack.Screen name="audits" />
                <Stack.Screen name="reports" />
                <Stack.Screen name="audit-log" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="+not-found" />
              </Stack>
            </AuthGate>
          </CelebrationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
