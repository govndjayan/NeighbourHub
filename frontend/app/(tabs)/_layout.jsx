import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';
import { useBadges } from '../../context/BadgeContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { counts, markSeen } = useBadges();

  // Cap the visible number so a huge count doesn't distort the badge
  const badge = (n) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.light,
        tabBarStyle: {
          backgroundColor: 'rgba(6,26,23,0.95)',
          borderTopColor: 'rgba(255,255,255,0.06)',
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#6c63ff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarBadgeStyle: {
          backgroundColor: '#ff4757',
          fontSize: 10,
          fontWeight: '700',
          minWidth: 18,
          height: 18,
          lineHeight: 14,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
          tabBarBadge: badge(counts.food),
        }}
        listeners={{ focus: () => markSeen('food') }}
      />
      <Tabs.Screen
        name="experts"
        options={{
          title: 'Experts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size} color={color} />
          ),
          tabBarBadge: badge(counts.experts),
        }}
        listeners={{ focus: () => markSeen('experts') }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'Complaints',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" size={size} color={color} />
          ),
          tabBarBadge: badge(counts.complaints),
        }}
        listeners={{ focus: () => markSeen('complaints') }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: 'Directory',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
