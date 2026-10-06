import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { type Appointment, dateLabel } from './contracts';
import { perform } from './offline';
import type { OpKind } from './offline/outbox';
export function DoctorAppointmentActions({
  userId,
  appointment,
  status,
  onSaved,
}: {
  userId: string;
  appointment: Appointment;
  /** Estado con los cambios en espera ya aplicados (sin conexión se pueden encadenar). */
  status: string;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const actions: { label: string; route: string; kind: OpKind; verb: string }[] =
    status === 'PENDING'
      ? [{ label: 'Confirmar cita', route: 'confirm', kind: 'appointment-confirm', verb: 'Confirmar' }]
      : status === 'CONFIRMED'
        ? [
            { label: 'Marcar atendida', route: 'complete', kind: 'appointment-complete', verb: 'Marcar como atendida' },
            {
              label: 'Marcar no asistió',
              route: 'no-show',
              kind: 'appointment-no-show',
              verb: 'Marcar como no asistida',
            },
          ]
        : [];
  async function save(action: (typeof actions)[number]) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await perform(userId, {
        kind: action.kind,
        method: 'PATCH',
        path: `/appointments/me/${appointment.id}/${action.route}`,
        targetId: appointment.id,
        label: `${action.verb} la cita del ${dateLabel(appointment.startsAt)}`,
        checkPath: `/appointments/me/${appointment.id}`,
      });
      if (result === 'queued')
        Alert.alert('Guardado sin conexión', 'El cambio se enviará solo cuando vuelva la conexión.');
      else await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      {actions.map((a) => (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          key={a.route}
          onPress={() =>
            Alert.alert(a.label, '¿Confirmas este cambio en la plataforma?', [
              { text: 'Volver', style: 'cancel' },
              {
                text: 'Confirmar',
                onPress: () => {
                  void save(a);
                },
              },
            ])
          }
          style={{
            minHeight: 48,
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#e7eee7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#125545', fontWeight: '600' }}>{a.label}</Text>
        </Pressable>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: '#9b2929' }}>
          {error}
        </Text>
      )}
    </View>
  );
}
