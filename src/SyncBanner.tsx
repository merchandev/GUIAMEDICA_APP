import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { dateLabel, sentence } from './contracts';
import type { PendingOp } from './offline';

/**
 * Estado de la conexión arriba de cada pantalla: sin conexión (y de cuándo
 * son los datos que se ven), cambios en espera, enviados al volver la señal o
 * rechazados por la plataforma.
 */
export function SyncBanner({
  online,
  savedAt,
  ops,
  sending,
  sent,
  status,
  onDiscard,
}: {
  online: boolean;
  /** Fecha de la copia guardada que se está mostrando (sin conexión). */
  savedAt: number | null;
  /** Cambios de esta cuenta: en espera y rechazados. */
  ops: readonly PendingOp[];
  sending: boolean;
  /** Cuántos cambios se acaban de enviar al volver la conexión. */
  sent: number;
  /** Línea de estado con conexión («Actualizado… · En vivo…»). */
  status: string;
  onDiscard: (id: string) => void;
}) {
  const waiting = ops.filter((op) => !op.error);
  const failed = ops.filter((op) => op.error);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <View style={s.stack}>
      {online ? (
        <Text style={s.status}>{status}</Text>
      ) : (
        <View accessibilityRole="alert" style={s.offline}>
          <Text style={s.offlineTitle}>Sin conexión</Text>
          <Text style={s.offlineText}>
            {savedAt
              ? sentence(`Estás viendo lo guardado en este teléfono el ${dateLabel(new Date(savedAt).toISOString())}`)
              : 'Estás viendo lo guardado en este teléfono.'}{' '}
            Cuando vuelva la señal, la app se pone al día sola.
          </Text>
        </View>
      )}
      {!!sent && (
        <Text accessibilityRole="alert" style={s.sent}>
          Conexión recuperada: se {sent === 1 ? 'envió' : 'enviaron'} {plural(sent, 'cambio', 'cambios')} que hiciste
          sin conexión.
        </Text>
      )}
      {!!waiting.length && (
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {online && sending
              ? `Enviando ${plural(waiting.length, 'cambio', 'cambios')}…`
              : online
                ? 'Cambios por enviar (se reintenta solo)'
                : 'Se enviará al volver la conexión'}
          </Text>
          {waiting.map((op) => (
            <View key={op.id} style={s.item}>
              <Text style={s.itemText}>{op.label}</Text>
              {!sending && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`No enviar: ${op.label}`}
                  onPress={() =>
                    Alert.alert('No enviar este cambio', `«${op.label}» no se enviará a la plataforma.`, [
                      { text: 'Volver', style: 'cancel' },
                      { text: 'No enviar', style: 'destructive', onPress: () => onDiscard(op.id) },
                    ])
                  }
                  style={s.link}
                >
                  <Text style={s.linkText}>No enviar</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      {failed.map((op) => (
        <View key={op.id} accessibilityRole="alert" style={s.failed}>
          <Text style={s.failedTitle}>No se pudo aplicar: {op.label}</Text>
          <Text style={s.failedText}>{op.error}</Text>
          <Pressable accessibilityRole="button" onPress={() => onDiscard(op.id)} style={s.link}>
            <Text style={s.linkText}>Entendido</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 8 },
  status: { fontSize: 11, color: '#677d74' },
  offline: {
    backgroundColor: '#fff6e0',
    borderColor: '#efd59b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    gap: 4,
  },
  offlineTitle: { color: '#5f4510', fontWeight: '700', fontSize: 15 },
  offlineText: { color: '#5f4510', lineHeight: 20 },
  sent: { color: '#1d5d40', backgroundColor: '#e6f4ec', padding: 12, borderRadius: 10, lineHeight: 20 },
  card: { backgroundColor: '#fff', borderColor: '#e0e8df', borderWidth: 1, borderRadius: 12, padding: 13, gap: 8 },
  cardTitle: { color: '#193e33', fontWeight: '600' },
  item: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemText: { flex: 1, minWidth: 160, color: '#293f37', lineHeight: 20 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  linkText: { color: '#125545', fontWeight: '600' },
  failed: { backgroundColor: '#ffeded', borderRadius: 10, padding: 13, gap: 4 },
  failedTitle: { color: '#7d1f1f', fontWeight: '600', lineHeight: 20 },
  failedText: { color: '#9b2929', lineHeight: 20 },
});
