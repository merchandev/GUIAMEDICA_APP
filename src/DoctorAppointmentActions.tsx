import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { request } from './api';
export function DoctorAppointmentActions({
  id,
  status,
  onSaved,
}: {
  id: string;
  status: string;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const actions =
    status === 'PENDING'
      ? [{ label: 'Confirmar cita', route: 'confirm' }]
      : status === 'CONFIRMED'
        ? [
            { label: 'Marcar atendida', route: 'complete' },
            { label: 'Marcar no asistió', route: 'no-show' },
          ]
        : [];
  async function save(route: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(`/appointments/me/${id}/${route}`, 'PATCH');
      await onSaved();
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
                  void save(a.route);
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
