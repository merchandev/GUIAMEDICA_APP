import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { request } from '../../src/api';
import {
  calendarForCache,
  freeSlots,
  isActive,
  patientDisplay,
  STATUS_INFO,
  type CalendarData,
} from '../../src/agenda';
import { useApi, useAction } from '../../src/data';
import {
  addDays,
  capitalizeFirst,
  caracasClock,
  caracasDateKey,
  dayLabel,
  formatTime,
  weekStart,
} from '../../src/dates';
import { effectiveStatus } from '../../src/offline';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Chip,
  colors,
  Empty,
  ErrorText,
  Loading,
  Muted,
  Notice,
  radius,
  Row,
  Screen,
  Section,
  Toggle,
  TOUCH,
} from '../../src/ui';

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/**
 * Agenda del médico: la semana, día por día, con su horario, sus bloqueos,
 * sus citas y los horarios libres (tocar uno carga una cita o lo bloquea).
 * La semana se guarda en el teléfono (sin los motivos de consulta) para verla
 * sin conexión.
 */
export default function AgendaScreen() {
  const { user, online, myOps } = useSession();
  const doctor = user?.role === 'PROFESSIONAL';
  const today = caracasDateKey(Date.now());
  const [day, setDay] = useState(today);
  const [showCancelled, setShowCancelled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const from = weekStart(day);
  const to = addDays(from, 6);
  const calendar = useApi<CalendarData>(doctor ? `/appointments/me/calendar?from=${from}&to=${to}` : null, {
    cacheKey: `me:calendar:${from}`,
    topics: ['appointments', 'schedule'],
    cacheAs: calendarForCache,
  });
  const action = useAction();
  if (!user) return <Redirect href="/cuenta" />;
  if (!doctor) return <Redirect href="/" />;

  const data = calendar.data;
  const locked = !!calendar.error && /plan/i.test(calendar.error) && !data;
  const dayData = data?.days.find((d) => d.date === day);
  const status = (id: string, current: string) => effectiveStatus(current, myOps, user.id, id);
  const appointments = (data?.appointments ?? [])
    .filter((a) => caracasDateKey(a.startsAt) === day)
    .map((a) => ({ ...a, status: status(a.id, a.status) as typeof a.status }))
    .filter((a) => showCancelled || a.status !== 'CANCELLED')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const slots = data?.planActive ? freeSlots(dayData, data.settings, data.appointments) : [];
  const counts = (key: string) =>
    (data?.appointments ?? []).filter((a) => caracasDateKey(a.startsAt) === key && isActive(a)).length;

  const changed = (text: string) => {
    setMessage(text);
    changedLocally('appointments', 'schedule');
    void calendar.reload();
  };

  const blockDay = () =>
    Alert.alert('Bloquear el día', `¿Bloquear todo el ${dayLabel(day)}? Nadie podrá reservar ese día.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: () =>
          void action.run(async () => {
            await request('/agenda/me/exceptions', 'POST', { date: day, isBlocked: true });
            changed('Día bloqueado');
          }),
      },
    ]);

  const removeBlock = (id: string, label: string) =>
    Alert.alert(
      'Quitar el bloqueo',
      `¿Quitar el bloqueo ${label}? Esos horarios vuelven a quedar disponibles para reservar.`,
      [
        { text: 'Dejarlo', style: 'cancel' },
        {
          text: 'Quitar',
          onPress: () =>
            void action.run(async () => {
              await request(`/agenda/me/exceptions/${id}`, 'DELETE');
              changed('Bloqueo quitado');
            }),
        },
      ],
    );

  const openSlot = (slot: string) =>
    router.push({
      pathname: '/panel/nueva-cita',
      params: {
        date: day,
        time: caracasClock(slot),
        slot,
        minutes: String(data?.settings?.slotDurationMinutes ?? 30),
      },
    });

  return (
    <Screen refreshing={calendar.refreshing} onRefresh={calendar.refresh} savedAt={calendar.savedAt}>
      {!!message && <Notice tone="success">{message}</Notice>}
      <ErrorText message={locked ? null : (calendar.error ?? action.error)} />
      {locked && (
        <Notice tone="warning" title="La agenda no está disponible con tu plan actual">
          La agenda en línea está disponible desde el plan Profesional.
        </Notice>
      )}
      {data && !data.planActive && (
        <Notice tone="warning">
          Sin un plan activo no recibes citas nuevas ni puedes cargarlas. Las que ya tenías siguen aquí: puedes
          confirmarlas, atenderlas o cancelarlas.
        </Notice>
      )}
      {data && data.planActive && !data.settings && (
        <Notice tone="warning" title="Configura tu horario de atención">
          <Body>Todavía no configuraste tu horario de atención: hazlo para recibir reservas.</Body>
          <Button
            title="Configurar mi horario"
            variant="secondary"
            small
            onPress={() => router.push('/panel/horario')}
          />
        </Notice>
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <Button title="‹ Semana" variant="secondary" small onPress={() => setDay(addDays(from, -7))} />
        {day !== today && <Button title="Hoy" variant="ghost" small onPress={() => setDay(today)} />}
        <Button title="Semana ›" variant="secondary" small onPress={() => setDay(addDays(from, 7))} />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {WEEKDAYS.map((w, i) => {
          const key = addDays(from, i);
          const selected = key === day;
          const count = counts(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${dayLabel(key)}${count ? `, ${count} ${count === 1 ? 'cita' : 'citas'}` : ''}`}
              onPress={() => setDay(key)}
              style={[s.day, selected && s.daySelected, key === today && !selected && s.dayToday]}
            >
              <Text style={[s.dayName, selected && { color: colors.white }]}>{w}</Text>
              <Text style={[s.dayNumber, selected && { color: colors.white }]}>{Number(key.slice(8))}</Text>
              {count > 0 && (
                <View style={[s.count, selected && { backgroundColor: colors.white }]}>
                  <Text style={[s.countText, selected && { color: colors.primary }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Section
        title={capitalizeFirst(dayLabel(day))}
        right={dayData?.special ? <Badge label="Día especial" tone="info" /> : undefined}
      >
        {!data ? (
          calendar.loading ? (
            <Loading />
          ) : null
        ) : (
          <>
            {dayData && dayData.open.length > 0 ? (
              <Muted>
                Atiendes: {dayData.open.map((p) => `${formatTime(p.start)} a ${formatTime(p.end)}`).join(' · ')}
              </Muted>
            ) : (
              <Muted>Sin horario de atención este día.</Muted>
            )}
            {dayData?.blocked.map((b, i) => {
              const label = b.allDay ? `del ${dayLabel(day)}` : `de ${formatTime(b.start)} a ${formatTime(b.end)}`;
              return (
                <Card key={b.id ?? `bloqueo-${i}`} style={s.block}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Body>{b.allDay ? 'Día bloqueado' : `Bloqueado ${label}`}</Body>
                      {!!b.reason && <Muted>{b.reason}</Muted>}
                    </View>
                    {b.id && (
                      <Button
                        title="Quitar"
                        variant="ghost"
                        small
                        disabled={!online || action.busy}
                        onPress={() => removeBlock(b.id!, `${label}${b.reason ? ` (${b.reason})` : ''}`)}
                      />
                    )}
                  </Row>
                </Card>
              );
            })}
            {appointments.length === 0 ? (
              <Empty title="No hay citas este día" />
            ) : (
              appointments.map((a) => {
                const info = STATUS_INFO[a.status];
                const waiting = myOps.some((op) => op.targetId === a.id && !op.error);
                return (
                  <Card
                    key={a.id}
                    label={`${formatTime(a.startsAt)}, ${patientDisplay(a.patient)}, ${info.label}`}
                    onPress={() => router.push({ pathname: '/panel/cita/[id]', params: { id: a.id } })}
                    style={[s.appointment, { borderLeftColor: info.color }]}
                  >
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={s.time}>
                        {formatTime(a.startsAt)} – {formatTime(a.endsAt)}
                      </Text>
                      <Badge label={info.label} tone={info.tone} />
                    </Row>
                    <Body>{patientDisplay(a.patient)}</Body>
                    {a.location && <Muted>{a.location.name}</Muted>}
                    {waiting && <Muted>Con cambios en espera de conexión.</Muted>}
                  </Card>
                );
              })
            )}
            <Toggle label="Mostrar las canceladas" value={showCancelled} onValueChange={setShowCancelled} />
            {data.planActive && data.settings && slots.length > 0 && (
              <>
                <Muted>Horarios libres: toca uno para cargar una cita o bloquearlo.</Muted>
                <Row>
                  {slots.map((slot) => (
                    <Chip key={slot} label={formatTime(slot)} selected={false} onPress={() => openSlot(slot)} />
                  ))}
                </Row>
              </>
            )}
            {data.planActive && (
              <Row>
                <Button
                  title="Cargar cita en otra hora"
                  variant="secondary"
                  small
                  disabled={!online}
                  onPress={() =>
                    router.push({
                      pathname: '/panel/nueva-cita',
                      params: { date: day, minutes: String(data.settings?.slotDurationMinutes ?? 30) },
                    })
                  }
                />
                {!dayData?.blocked.some((b) => b.allDay) && (
                  <Button
                    title="Bloquear el día"
                    variant="ghost"
                    small
                    disabled={!online || action.busy}
                    onPress={blockDay}
                  />
                )}
              </Row>
            )}
          </>
        )}
      </Section>

      <Section title="Tu agenda">
        <Row>
          <Button title="Horario de atención" variant="secondary" small onPress={() => router.push('/panel/horario')} />
          <Button
            title="Historial de citas"
            variant="secondary"
            small
            onPress={() => router.push('/panel/historial')}
          />
        </Row>
        <Muted>Las horas son de Caracas.</Muted>
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  day: {
    width: 56,
    minHeight: TOUCH + 22,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayToday: { borderColor: colors.accent, borderWidth: 2 },
  dayName: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  dayNumber: { fontSize: 18, color: colors.text, fontWeight: '700' },
  count: {
    minWidth: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  countText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  block: { backgroundColor: colors.secondary },
  appointment: { borderLeftWidth: 5 },
  time: { fontSize: 15, fontWeight: '700', color: colors.text },
});
