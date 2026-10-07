import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { discard } from '../offline';
import { useRealtimeStatus } from '../realtime';
import { useSession } from '../session';
import { SyncBanner } from '../SyncBanner';
import { colors, MAX_WIDTH } from './theme';

/**
 * Contenedor de cada pantalla: desplazable, con «tirar para actualizar», el
 * estado de la conexión arriba (sin conexión, cambios en espera) y el
 * contenido centrado hasta 720 de ancho.
 */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  savedAt = null,
  banner = true,
  edges = ['left', 'right'],
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Fecha de la copia guardada que se está mostrando (sin conexión). */
  savedAt?: number | null;
  banner?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const { width } = useWindowDimensions();
  const { online, myOps, sending, sent } = useSession();
  const live = useRealtimeStatus() === 'live';
  const padding = width < 360 ? 12 : width >= 768 ? 32 : 18;
  return (
    <SafeAreaView style={s.root} edges={edges}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.root}
          contentContainerStyle={[s.content, { paddingHorizontal: padding }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {banner && (
            <SyncBanner
              online={online}
              savedAt={savedAt}
              ops={myOps}
              sending={sending}
              sent={sent}
              status={live ? 'En vivo con la plataforma' : 'Actualización automática'}
              onDiscard={(id) => void discard(id)}
            />
          )}
          <View style={s.inner}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 14, paddingBottom: 40, gap: 14 },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: 14 },
});
