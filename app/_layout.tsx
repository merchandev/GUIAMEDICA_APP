import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { clearDownloads } from '../src/media';
import { registerPushToken } from '../src/push';
import { routeForPushData } from '../src/push-routing';
import { SessionProvider, useSession } from '../src/session';
import { colors, Loading } from '../src/ui';
import { StartupSplash } from '../src/ui/StartupSplash';

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
  const [introElapsed, setIntroElapsed] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const segments = useSegments();
  const ready = !!useRootNavigationState()?.key;
  const top = segments[0] as string | undefined;
  // Con textos legales nuevos sin aceptar, la cuenta no sigue (como en la web): solo se pueden leer.
  const mustAccept = !!user?.needsLegalAcceptance;
  useEffect(() => {
    const timer = setTimeout(() => setIntroElapsed(true), 1750);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready && booted && mustAccept && top !== 'aceptar-legal' && top !== 'legal') router.push('/aceptar-legal');
  }, [ready, booted, mustAccept, top]);
  // Al abrir la app y al cambiar de cuenta no quedan archivos descargados (récipes, copias de datos).
  const userId = user?.id;
  useEffect(() => {
    clearDownloads();
  }, [userId]);

  // Con sesión activa, registramos el token de notificaciones push de este
  // teléfono (pide permiso la primera vez). Al cerrar sesión se borra en signOut.
  useEffect(() => {
    if (userId) void registerPushToken();
  }, [userId]);

  // Al tocar una notificación, abrimos la pantalla interna que indique su
  // enlace (nunca la web). Cubre también abrir la app desde el aviso (arranque en frío).
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !user || !lastResponse) return;
    const request = lastResponse.notification.request;
    const marker = `${request.identifier}:${lastResponse.actionIdentifier}`;
    if (handledResponse.current === marker) return;
    handledResponse.current = marker;
    const route = routeForPushData(request.content.data);
    if (route) router.push(route);
  }, [ready, user, lastResponse]);

  return (
    <View style={{ flex: 1 }}>
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
      {!splashDismissed && (
        <StartupSplash
          exiting={introElapsed}
          onExited={() => setSplashDismissed(true)}
        />
      )}
      {splashDismissed && !booted && (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000 }}>
          <Loading label="Cargando tu cuenta…" />
        </View>
      )}
    </View>
  );
}
