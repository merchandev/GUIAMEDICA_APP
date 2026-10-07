import React, { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../../src/api';
import {
  eventText,
  isActive,
  patientDisplay,
  SOURCE_LABELS,
  STATUS_INFO,
  type AppointmentDetail,
  type CalendarData,
} from '../../../src/agenda';
import { SlotPicker } from '../../../src/components/SlotPicker';
import { useApi, useAction } from '../../../src/data';
import { capitalizeFirst, caracasDateKey, caracasInstant, formatDateTime, formatTime } from '../../../src/dates';
import { effectiveStatus, perform, store } from '../../../src/offline';
import type { OpKind } from '../../../src/offline/outbox';
import { changedLocally } from '../../../src/realtime';
import { useSession } from '../../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Check,
  colors,
  DateField,
  ErrorText,
  Field,
  Heading,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
} from '../../../src/ui';

const whatsappUrl = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('58') ? digits : `58${digits.replace(/^0/, '')}`}`;
};

/** La cita guardada en alguna semana de la agenda del teléfono (sin conexión, sin el motivo). */
function savedAppointment(id: string): AppointmentDetail | null {
  for (const [, entry] of store.list('me:calendar:')) {
    const found = (entry.data as CalendarData).appointments.find((a) => a.id === id);
    if (found) return { ...found, events: [] };
  }
  return null;
}

type Mode = 'view' | 'move' | 'cancel';

/**
 * Detalle de una cita del médico (como en la web): el paciente según lo que
 * autorizó, el motivo, las acciones y el historial. Confirmar, marcar
 * atendida o «no asistió» y cancelar funcionan también sin conexión.
 */
export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, online, myOps } = useSession();
  const detail = useApi<AppointmentDetail>(
    user?.role === 'PROFESSIONAL' ? `/appointments/me/${encodeURIComponent(id)}` : null,
    {
      topics: ['appointments'],
      fallback: () => savedAppointment(id),
    },
  );
  const [mode, setMode] = useState<Mode>('view');
  const [slot, setSlot] = useState<string | null>(null);
  const [outside, setOutside] = useState({ enabled: false, date: '', time: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [accessRequested, setAccessRequested] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const action = useAction();
  const loadSlots = useCallback(
    (from: string, to: string) =>
      request<string[]>(`/appointments/me/slots?from=${from}&to=${to}&excludeId=${encodeURIComponent(id)}`),
    [id],
  );
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const d = detail.data;
  if (!d)
    return (
      <Screen refreshing={detail.refreshing} onRefresh={detail.refresh}>
        <Stack.Screen options={{ title: 'Cita' }} />
        {detail.loading ? <Loading /> : <ErrorText message={detail.error} />}
      </Screen>
    );

  const status = effectiveStatus(d.status, myOps, user.id, d.id) as AppointmentDetail['status'];
  const info = STATUS_INFO[status];
  const waiting = myOps.filter((op) => op.targetId === d.id && !op.error);
  const upcoming = new Date(d.startsAt).getTime() > openedAt;
  const lastCancellation = d.events.filter((e) => e.type === 'CANCELLED').at(-1);

  const done = (text: string, result: 'sent' | 'queued') => {
    if (result === 'queued')
      Alert.alert('Guardado sin conexión', 'El cambio se enviará solo cuando vuelva la conexión.');
    else {
      changedLocally('appointments');
      Alert.alert(text);
      void detail.reload();
    }
    setMode('view');
  };

  const change = (kind: OpKind, route: 'confirm' | 'complete' | 'no-show', verb: string, text: string) =>
    Alert.alert(verb, '¿Confirmas este cambio?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: verb,
        onPress: () =>
          void action.run(async () => {
            const result = await perform(user.id, {
              kind,
              method: 'PATCH',
              path: `/appointments/me/${d.id}/${route}`,
              targetId: d.id,
              label: `${verb} la cita del ${formatDateTime(d.startsAt, 'medium')}`,
              checkPath: `/appointments/me/${d.id}`,
            });
            done(text, result);
          }),
      },
    ]);

  const cancel = () =>
    action.run(async () => {
      const result = await perform(user.id, {
        kind: 'appointment-cancel',
        method: 'PATCH',
        path: `/appointments/${d.id}/cancel`,
        body: { cancellationReason: cancelReason.trim() || undefined },
        targetId: d.id,
        label: `Cancelar la cita del ${formatDateTime(d.startsAt, 'medium')} con ${patientDisplay(d.patient)}`,
        checkPath: `/appointments/me/${d.id}`,
      });
      done('Cita cancelada', result);
    });

  const move = () =>
    action.run(async () => {
      if (outside.enabled) {
        if (!outside.date || !outside.time) throw new Error('Elige el día y la hora.');
        await request(`/appointments/${d.id}/reschedule`, 'PATCH', {
          startsAt: caracasInstant(outside.date, outside.time),
          outsideSchedule: true,
        });
      } else {
        if (!slot) throw new Error('Elige un día y una hora libres.');
        await request(`/appointments/${d.id}/reschedule`, 'PATCH', { startsAt: slot });
      }
      done('Cita movida. Le avisamos al paciente.', 'sent');
    });

  const requestAccess = () =>
    action.run(async () => {
      await request(`/appointments/me/patients/${d.patient.patientId}/access-request`, 'POST', {
        scopes: ['IDENTITY', 'CONTACT', 'HEALTH'],
      });
      setAccessRequested(true);
    });

  return (
    <Screen refreshing={detail.refreshing} onRefresh={detail.refresh}>
      <Stack.Screen options={{ title: `Cita con ${patientDisplay(d.patient)}` }} />
      {detail.fromFallback && (
        <Notice tone="warning">
          Sin conexión: se muestra lo guardado en la agenda (sin el motivo ni el historial de la cita).
        </Notice>
      )}
      <Card>
        <Row>
          <Badge label={info.label} tone={info.tone} />
          <Muted>{SOURCE_LABELS[d.source]}</Muted>
        </Row>
        <Heading>{capitalizeFirst(formatDateTime(d.startsAt, 'full'))}</Heading>
        <Muted>Hasta las {formatTime(d.endsAt)}</Muted>
        <KeyValue
          label="Paciente"
          value={d.patient.name ? `${d.patient.name} · ${d.patient.patientCode}` : d.patient.patientCode}
        />
        {d.patient.access === 'WALK_IN' && <Muted>Ficha que cargaste tú.</Muted>}
        {d.patient.phone ? (
          <>
            <KeyValue label="Contacto" value={d.patient.phone} />
            <Row>
              <Button
                title="Llamar"
                variant="secondary"
                small
                onPress={() => void Linking.openURL(`tel:${d.patient.phone!.replace(/[^\d+]/g, '')}`)}
              />
              <Button
                title="WhatsApp"
                variant="secondary"
                small
                onPress={() => void Linking.openURL(whatsappUrl(d.patient.phone!))}
              />
            </Row>
          </>
        ) : (
          <KeyValue label="Contacto" value="No autorizado" />
        )}
        {d.location && <KeyValue label="Sede" value={d.location.name} />}
        {!detail.fromFallback && <KeyValue label="Motivo de consulta" value={d.reason || 'Sin motivo escrito'} />}
      </Card>

      {d.patient.access === 'NONE' && d.patient.hasAccount && (
        <Notice tone="info">
          {accessRequested ? (
            <Body>Le pedimos al paciente que te autorice. Te avisaremos cuando responda.</Body>
          ) : (
            <>
              <Body>El paciente no te ha autorizado a ver su nombre ni su contacto.</Body>
              <Button
                title="Pedir acceso"
                variant="secondary"
                small
                loading={action.busy}
                disabled={!online}
                onPress={() => void requestAccess()}
              />
            </>
          )}
        </Notice>
      )}

      {waiting.map((op) => (
        <Notice key={op.id} tone="warning">{`En espera de conexión: ${op.label}`}</Notice>
      ))}
      <ErrorText message={action.error ?? (detail.fromFallback ? null : detail.error)} />

      {mode === 'view' && (
        <Card>
          <Row>
            {status === 'PENDING' && (
              <Button
                title="Confirmar"
                small
                disabled={action.busy}
                onPress={() => change('appointment-confirm', 'confirm', 'Confirmar', 'Cita confirmada')}
              />
            )}
            {status === 'CONFIRMED' && (
              <>
                <Button
                  title="Realizada"
                  small
                  disabled={action.busy}
                  onPress={() =>
                    change('appointment-complete', 'complete', 'Marcar como realizada', 'Cita marcada como realizada')
                  }
                />
                <Button
                  title="No asistió"
                  variant="secondary"
                  small
                  disabled={action.busy}
                  onPress={() =>
                    change('appointment-no-show', 'no-show', 'Marcar «no asistió»', 'Cita marcada como «no asistió»')
                  }
                />
              </>
            )}
            {isActive({ status }) && upcoming && (
              <Button title="Mover" variant="secondary" small disabled={!online} onPress={() => setMode('move')} />
            )}
            {isActive({ status }) && (
              <Button title="Cancelar cita" variant="ghost" small onPress={() => setMode('cancel')} />
            )}
          </Row>
          <Button
            title="Historial del paciente"
            variant="ghost"
            small
            onPress={() =>
              router.push({
                pathname: '/panel/historial',
                params: { paciente: d.patient.patientId, nombre: patientDisplay(d.patient) },
              })
            }
          />
        </Card>
      )}

      {mode === 'move' && (
        <Card>
          <Heading>Mover la cita</Heading>
          {!outside.enabled ? (
            <SlotPicker loadSlots={loadSlots} selectedSlot={slot} onSelectSlot={setSlot} />
          ) : (
            <>
              <DateField
                label="Día"
                value={outside.date}
                onChange={(v) => setOutside({ ...outside, date: v })}
                minimumDate={new Date(`${caracasDateKey(openedAt)}T12:00:00`)}
              />
              <DateField
                label="Hora"
                mode="time"
                value={outside.time}
                onChange={(v) => setOutside({ ...outside, time: v })}
              />
            </>
          )}
          <Check
            label="Ponerla fuera de mi horario de atención (nunca encima de otra cita)"
            value={outside.enabled}
            onValueChange={(v) => setOutside({ ...outside, enabled: v })}
          />
          <Muted>Le avisaremos al paciente del cambio.</Muted>
          <Row>
            <Button
              title="Guardar el cambio"
              small
              loading={action.busy}
              disabled={!online}
              onPress={() => void move()}
            />
            <Button title="Volver" variant="ghost" small onPress={() => setMode('view')} />
          </Row>
        </Card>
      )}

      {mode === 'cancel' && (
        <Card>
          <Heading>Cancelar la cita</Heading>
          <Field
            label="Motivo (opcional, lo verá el paciente)"
            value={cancelReason}
            onChangeText={setCancelReason}
            multiline
            maxLength={500}
          />
          <Row>
            <Button
              title="Cancelar la cita"
              variant="danger"
              small
              loading={action.busy}
              onPress={() => void cancel()}
            />
            <Button title="Volver" variant="ghost" small onPress={() => setMode('view')} />
          </Row>
        </Card>
      )}

      {d.events.length > 0 && (
        <Card>
          <Heading>Historial de la cita</Heading>
          {d.events.map((event, index) => (
            <View key={index} style={s.event}>
              <View style={s.dot} />
              <View style={{ flex: 1 }}>
                <Text style={s.eventText}>
                  {eventText(event)}
                  {event.type === 'RESCHEDULED' && event.previousStartsAt && event.newStartsAt
                    ? `: de ${formatDateTime(event.previousStartsAt, 'medium')} a ${formatDateTime(event.newStartsAt, 'medium')}`
                    : ''}
                  {event.outsideSchedule ? ' (fuera del horario de atención)' : ''}
                  {event === lastCancellation && d.cancellationReason ? ` — motivo: ${d.cancellationReason}` : ''}
                </Text>
                <Muted>{formatDateTime(event.createdAt, 'medium')}</Muted>
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  event: { flexDirection: 'row', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 7 },
  eventText: { fontSize: 14, color: colors.text, lineHeight: 21 },
});
