import React from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApi } from '../../src/data';
import { useSession } from '../../src/session';
import { colors } from '../../src/ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

/**
 * Pestañas según quién entra:
 * - visitante: Médicos y Acceder;
 * - paciente: Médicos, Citas, Avisos y Cuenta;
 * - médico: Inicio, Agenda, Pacientes, Avisos y Cuenta.
 */
export default function TabsLayout() {
  const { user } = useSession();
  const doctor = user?.role === 'PROFESSIONAL';
  const patient = user?.role === 'USER';
  const unread = useApi<{ count: number }>(user ? '/notifications/unread-count' : null, {
    topics: ['notifications'],
  }).data?.count;
  const show = (visible: boolean) => (visible ? undefined : null);
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#6a7b73',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Médicos',
          headerTitle: 'Guía Médica Monagas',
          href: show(!doctor),
          tabBarIcon: icon('search'),
        }}
      />
      <Tabs.Screen name="inicio" options={{ title: 'Inicio', href: show(doctor), tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="citas"
        options={{ title: 'Citas', headerTitle: 'Mis citas', href: show(patient), tabBarIcon: icon('calendar') }}
      />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', href: show(doctor), tabBarIcon: icon('calendar') }} />
      <Tabs.Screen
        name="pacientes"
        options={{ title: 'Pacientes', headerTitle: 'Mis pacientes', href: show(doctor), tabBarIcon: icon('people') }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          headerTitle: 'Mis avisos',
          href: show(!!user),
          tabBarIcon: icon('notifications'),
          tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{
          title: user ? 'Cuenta' : 'Acceder',
          headerTitle: user ? 'Mi cuenta' : 'Acceder',
          tabBarIcon: icon(user ? 'person-circle' : 'log-in'),
        }}
      />
    </Tabs>
  );
}
