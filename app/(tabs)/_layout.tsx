import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassTabBar } from '@/components/navigation/GlassTabBar';
import { AnimatedTabIcon } from '@/components/icons/TabIcon';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props: any) => <GlassTabBar {...props} />}
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderWidth: 0,
          elevation: 0,
        },
        headerShown: false,
        animation: 'shift',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' as const },
      }}
    >
      {/* THE menu — exactly five items, each once */}
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <AnimatedTabIcon name="home" focused={focused} /> }} />
      <Tabs.Screen name="frameworks" options={{ title: 'Frameworks', tabBarIcon: ({ focused }) => <AnimatedTabIcon name="frameworks" focused={focused} /> }} />
      <Tabs.Screen name="risks" options={{ title: 'Risks', tabBarIcon: ({ focused }) => <AnimatedTabIcon name="risks" focused={focused} /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: ({ focused }) => <AnimatedTabIcon name="tasks" focused={focused} /> }} />
      <Tabs.Screen name="ai" options={{ title: 'Assistant', tabBarIcon: ({ focused }) => <AnimatedTabIcon name="ai" focused={focused} /> }} />

      {/* Detail/create routes — navigable but never shown as menu items */}
      <Tabs.Screen name="frameworks/[frameworkId]" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="frameworks/[frameworkId]/[controlId]" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="frameworks/add" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="frameworks/new" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="risks/new" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="risks/[riskId]" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="risks/[riskId]/edit" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="tasks/new" options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="tasks/[taskId]" options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
