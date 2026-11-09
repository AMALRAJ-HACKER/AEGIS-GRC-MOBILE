import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/design-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function Splash(){
  const router = useRouter();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if (reduced) { enter.setValue(1); return; }
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enter, pulse, reduced]);

  useEffect(()=>{
    let done = false;
    const go = (loggedIn:boolean)=>{
      if(done) return;
      done = true;
      setTimeout(()=> loggedIn ? router.replace('/(tabs)') : router.replace('/welcome'), 900);
    };
    supabase.auth.getSession()
      .then(({data})=> go(!!data.session))
      .catch(()=> go(false));
  },[]);

  const ringOpacity = reduced ? 0.3 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.45] });
  const ringScale = reduced ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });

  return (
    <View style={{ flex:1, backgroundColor: colors.navy }}>
      {/* Centred circle with AEGIS-GRC text inside */}
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:24 }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 100, // perfect circle
              borderWidth: 2.5,
              borderColor: colors.teal,
              backgroundColor: 'rgba(15, 163, 177, 0.08)',
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            }}
          />
          <Animated.View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 24,
                fontWeight: '900',
                letterSpacing: 2,
                textAlign: 'center',
              }}
            >
              AEGIS-GRC
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
