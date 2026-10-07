import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../src/api';
import { SlotPicker } from '../../src/components/SlotPicker';
import { useAction } from '../../src/data';
import { sentence } from '../../src/contracts';
import { formatDateTime } from '../../src/dates';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorText, Notice, Screen } from '../../src/ui';

/** Elegir otro día y hora libres del mismo médico (como «Reprogramar» en la web). */
export default function RescheduleScreen() {
  const { id, professionalId, name, startsAt } = useLocalSearchParams<{
    id: string;
    professionalId: string;
    name: string;
    startsAt: string;
  }>();
  const { online } = useSession();
  const [slot, setSlot] = useState<string | null>(null);
  const action = useAction();
  const loadSlots = useCallback(
    (from: string, to: string) =>
      request<string[]>(
        `/appointments/availability?professionalId=${encodeURIComponent(professionalId)}&from=${from}&to=${to}`,
      ),
    [professionalId],
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Reprogramar la cita' }} />
      <Card>
        <Body>{sentence(`Con Dr(a). ${name}. Hoy está para el ${formatDateTime(startsAt, 'full')}`)}</Body>
        <SlotPicker loadSlots={loadSlots} selectedSlot={slot} onSelectSlot={setSlot} professionalId={professionalId} />
        {!online && <Notice tone="warning">Sin conexión: para reprogramar necesitas internet.</Notice>}
        <ErrorText message={action.error} />
        <Button
          title="Cambiar a este horario"
          loading={action.busy}
          disabled={!slot || !online}
          onPress={() =>
            void action.run(async () => {
              await request(`/appointments/${id}/reschedule`, 'PATCH', { startsAt: slot });
              changedLocally('appointments');
              Alert.alert(
                'Cita reprogramada',
                `${sentence(`Quedó para el ${formatDateTime(slot!, 'full')}`)} Le avisamos al médico.`,
              );
              router.back();
            })
          }
        />
        <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
