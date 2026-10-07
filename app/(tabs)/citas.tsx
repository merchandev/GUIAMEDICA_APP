import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useApi, useAction } from '../../src/data';
import { capitalizeFirst, formatDateTime } from '../../src/dates';
import { useFeatures } from '../../src/features';
import { openDoctor } from '../../src/nav';
import { effectiveStatus, perform } from '../../src/offline';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  colors,
  Empty,
  ErrorText,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  s as ui,
} from '../../src/ui';

type Status = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

interface PatientAppointment {
  id: string;
  startsAt: string;
  status: Status;
  reason: string | null;
  professional: { id: string; firstName: string; lastName: string; slug: string };
  location: { name: string; address: string } | null;
}

const PATIENT_STATUS: Record<Status, { label: string; tone: 'warning' | 'success' | 'neutral' | 'danger' }> = {
  PENDING: { label: 'Pendiente de confirmación', tone: 'warning' },
  CONFIRMED: { label: 'Confirmada', tone: 'success' },
  COMPLETED: { label: 'Realizada', tone: 'neutral' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
  NO_SHOW: { label: 'No asistida', tone: 'neutral' },
};

/** Citas del paciente: las mismas de la web, guardadas para verlas sin conexión. */
export default function PatientAppointmentsScreen() {
  const { user, myOps } = useSession();
  const { reviews } = useFeatures();
  const list = useApi<PatientAppointment[]>(user ? '/appointments/me' : null, {
    cacheKey: 'me:appointments',
    topics: ['appointments', 'reviews'],
    // El motivo de consulta (dato de salud) no se guarda en el teléfono: se ve con conexión.
    cacheAs: (items) => items.map((a) => ({ ...a, reason: null })),
  });
  const action = useAction();
  if (!user) return <Redirect href="/cuenta" />;

  const cancel = (a: PatientAppointment) => {
    const name = `Dr(a). ${a.professional.firstName} ${a.professional.lastName}`;
    Alert.alert('Cancelar cita', `¿Cancelar la cita del ${formatDateTime(a.startsAt, 'long')} con ${name}?`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar cita',
        style: 'destructive',
        onPress: () =>
          void action.run(async () => {
            const result = await perform(user.id, {
              kind: 'appointment-cancel',
              method: 'PATCH',
              path: `/appointments/${a.id}/cancel`,
              body: { cancellationReason: 'Cancelada por el paciente desde la app' },
              targetId: a.id,
              label: `Cancelar la cita del ${formatDateTime(a.startsAt, 'medium')} con ${name}`,
              checkPath: '/appointments/me',
            });
            if (result === 'queued')
              Alert.alert(
                'Guardado sin conexión',
                'La cancelación se enviará sola cuando vuelva la conexión. Hasta entonces, el consultorio no la recibe.',
              );
            else await list.reload();
          }),
      },
    ]);
  };

  const items = list.data ?? [];
  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh} savedAt={list.savedAt}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Muted>{items.length ? `${items.length} ${items.length === 1 ? 'cita' : 'citas'}` : ''}</Muted>
        <Button title="Buscar médico" variant="secondary" small onPress={() => router.navigate('/')} />
      </Row>
      <ErrorText message={list.error ?? action.error} />
      {list.loading && !list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="Todavía no tienes citas" description="Busca un médico verificado y agenda desde su ficha.">
          <Button title="Buscar médico" onPress={() => router.navigate('/')} />
        </Empty>
      ) : (
        items.map((a) => {
          const status = effectiveStatus(a.status, myOps, user.id, a.id) as Status;
          const shown = PATIENT_STATUS[status] ?? PATIENT_STATUS.PENDING;
          const waiting = myOps.filter((op) => op.targetId === a.id && !op.error);
          const upcoming = new Date(a.startsAt) > new Date() && (status === 'PENDING' || status === 'CONFIRMED');
          return (
            <Card key={a.id}>
              <Pressable accessibilityRole="link" onPress={() => openDoctor(a.professional.slug)} hitSlop={6}>
                <Text style={[ui.itemTitle, { color: colors.primary }]}>
                  Dr(a). {a.professional.firstName} {a.professional.lastName}
                </Text>
              </Pressable>
              <Badge label={shown.label} tone={shown.tone} />
              <Body>{capitalizeFirst(formatDateTime(a.startsAt, 'full'))}</Body>
              {a.location && (
                <Muted>
                  {a.location.name} · {a.location.address}
                </Muted>
              )}
              {!!a.reason && <Muted>Motivo: {a.reason}</Muted>}
              {waiting.map((op) => (
                <Notice key={op.id} tone="warning">{`En espera de conexión: ${op.label}`}</Notice>
              ))}
              {reviews && status === 'COMPLETED' && (
                <Button
                  title="Valorar la atención"
                  variant="secondary"
                  small
                  onPress={() =>
                    router.push({ pathname: '/paciente/valoraciones', params: { medico: a.professional.slug } })
                  }
                />
              )}
              {upcoming && !waiting.length && (
                <Row>
                  <Button
                    title="Reprogramar"
                    variant="secondary"
                    small
                    onPress={() =>
                      router.push({
                        pathname: '/paciente/reprogramar',
                        params: {
                          id: a.id,
                          professionalId: a.professional.id,
                          name: `${a.professional.firstName} ${a.professional.lastName}`,
                          startsAt: a.startsAt,
                        },
                      })
                    }
                  />
                  <Button title="Cancelar" variant="ghost" small disabled={action.busy} onPress={() => cancel(a)} />
                </Row>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
