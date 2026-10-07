import React, { useEffect } from 'react';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { clearDownloads } from '../src/media';
import { SessionProvider, useSession } from '../src/session';
import { colors, Loading } from '../src/ui';

/**
 * Raíz de la app: la sesión para todas las pantallas y la pila de navegación
 * (las pestañas y, encima, cada pantalla que se abre desde ellas, con «Atrás»).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Navigation />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { booted, user } = useSession();
  const segments = useSegments();
  const ready = !!useRootNavigationState()?.key;
  const top = segments[0] as string | undefined;
  // Con textos legales nuevos sin aceptar, la cuenta no sigue (como en la web): solo se pueden leer.
  const mustAccept = !!user?.needsLegalAcceptance;
  useEffect(() => {
    if (ready && booted && mustAccept && top !== 'aceptar-legal' && top !== 'legal') router.push('/aceptar-legal');
  }, [ready, booted, mustAccept, top]);
  // Al abrir la app y al cambiar de cuenta no quedan archivos descargados (récipes, copias de datos).
  const userId = user?.id;
  useEffect(() => {
    clearDownloads();
  }, [userId]);

  // Unos milisegundos, mientras se lee la copia guardada (cifrada) del teléfono.
  if (!booted) return <Loading label="Abriendo…" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
