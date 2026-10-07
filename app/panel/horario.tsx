import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { request } from '../../src/api';
import type { ScheduleSettings } from '../../src/agenda';
import { useApi, useAction } from '../../src/data';
import { clockLabel, dayLabel } from '../../src/dates';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Check,
  Chip,
  DateField,
  ErrorText,
  Field,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Select,
} from '../../src/ui';

interface Block {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ScheduleException {
  id: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOT_OPTIONS = [15, 20, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} minutos` }));
const WINDOW_OPTIONS = [7, 14, 30, 60, 90, 180].map((d) => ({ value: String(d), label: `Hasta ${d} días adelante` }));
const NOTICE_OPTIONS = [
  { value: '0', label: 'Sin mínimo' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '240', label: '4 horas antes' },
  { value: '720', label: '12 horas antes' },
  { value: '1440', label: '1 día antes' },
  { value: '2880', label: '2 días antes' },
];
const withCurrent = (options: { value: string; label: string }[], value: number, label: string) =>
  options.some((o) => o.value === String(value)) ? options : [...options, { value: String(value), label }];
const strip = (b: Block): Block => ({ dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime });
const byDayAndTime = (a: Block, b: Block) =>
  DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime);

/** Horario de atención del médico (como «Horario» en la web): reglas, horario semanal y días especiales. */
export default function ScheduleScreen() {
  const { user, online } = useSession();
  const doctor = user?.role === 'PROFESSIONAL';
  if (!user || !doctor) return <Redirect href="/cuenta" />;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Horario de atención' }} />
      <Muted>Las horas son de Caracas. Los cambios se ven al instante en la web y en la app.</Muted>
      <SettingsSection online={online} />
      <WeeklySection online={online} />
      <ExceptionsSection online={online} />
    </Screen>
  );
}

function SettingsSection({ online }: { online: boolean }) {
  const config = useApi<ScheduleSettings>('/agenda/me', { cacheKey: 'me:schedule-settings', topics: ['schedule'] });
  const [draft, setDraft] = useState<ScheduleSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  useEffect(() => {
    if (config.data && !draft) setDraft(config.data);
  }, [config.data, draft]);
  const locked = !!config.error && /plan/i.test(config.error);
  if (locked)
    return (
      <Notice tone="warning" title="La agenda no está disponible con tu plan actual">
        La agenda en línea está disponible desde el plan Profesional.
      </Notice>
    );
  if (!draft) return config.loading ? <Loading /> : <ErrorText message={config.error} />;
  const set = (patch: Partial<ScheduleSettings>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  return (
    <Section title="Configuración de la agenda">
      <Card>
        <Select
          label="Duración de cada cita"
          value={String(draft.slotDurationMinutes)}
          onChange={(v) => set({ slotDurationMinutes: Number(v) })}
          options={withCurrent(SLOT_OPTIONS, draft.slotDurationMinutes, `${draft.slotDurationMinutes} minutos`)}
        />
        <Field
          label="Tiempo entre citas (minutos)"
          value={String(draft.bufferMinutes)}
          onChangeText={(v) => set({ bufferMinutes: Math.min(60, Number(v.replace(/\D/g, '')) || 0) })}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Field
          label="Máximo de citas al día (opcional)"
          value={draft.maxDailyAppointments ? String(draft.maxDailyAppointments) : ''}
          onChangeText={(v) => {
            const n = Number(v.replace(/\D/g, ''));
            set({ maxDailyAppointments: n ? Math.min(100, n) : null });
          }}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Check
          label="Confirmar citas automáticamente (sin revisarlas una por una)"
          value={draft.autoConfirm}
          onValueChange={(v) => set({ autoConfirm: v })}
        />
        <Select
          label="Los pacientes reservan"
          value={String(draft.bookingWindowDays)}
          onChange={(v) => set({ bookingWindowDays: Number(v) })}
          options={withCurrent(
            WINDOW_OPTIONS,
            draft.bookingWindowDays,
            `Hasta ${draft.bookingWindowDays} días adelante`,
          )}
        />
        <Select
          label="Antelación mínima de una reserva"
          value={String(draft.minNoticeMinutes)}
          onChange={(v) => set({ minNoticeMinutes: Number(v) })}
          options={withCurrent(NOTICE_OPTIONS, draft.minNoticeMinutes, `${draft.minNoticeMinutes} minutos antes`)}
        />
        <Muted>
          Estos límites son para las reservas de los pacientes. Tú puedes cargar o mover citas en cualquier momento.
        </Muted>
        {saved && <Notice tone="success">Configuración guardada.</Notice>}
        <ErrorText message={action.error} />
        <Button
          title="Guardar"
          loading={action.busy}
          disabled={!online}
          onPress={() =>
            void action.run(async () => {
              const updated = await request<ScheduleSettings>('/agenda/me', 'PUT', {
                slotDurationMinutes: draft.slotDurationMinutes,
                bufferMinutes: draft.bufferMinutes,
                maxDailyAppointments: draft.maxDailyAppointments,
                autoConfirm: draft.autoConfirm,
                bookingWindowDays: draft.bookingWindowDays,
                minNoticeMinutes: draft.minNoticeMinutes,
              });
              config.setData(updated);
              setDraft(updated);
              changedLocally('schedule');
              setSaved(true);
            })
          }
        />
      </Card>
    </Section>
  );
}

function WeeklySection({ online }: { online: boolean }) {
  const list = useApi<Block[]>('/agenda/me/blocks', { cacheKey: 'me:schedule-blocks', topics: ['schedule'] });
  const [form, setForm] = useState({ dayOfWeek: '1', startTime: '08:00', endTime: '12:00' });
  const [saved, setSaved] = useState(false);
  const action = useAction();
  if (list.error && /plan/i.test(list.error)) return null;
  const blocks = (list.data ?? []).map(strip).sort(byDayAndTime);
  const save = (next: Block[]) =>
    action.run(async () => {
      setSaved(false);
      const result = await request<Block[]>('/agenda/me/blocks', 'PUT', { blocks: next.map(strip) });
      list.setData(result);
      changedLocally('schedule');
      setSaved(true);
    });
  return (
    <Section
      title="Horario semanal"
      description="Los turnos en que atiendes cada semana. Los pacientes reservan dentro de ellos."
    >
      <Card>
        {!list.data ? (
          list.loading ? (
            <Loading />
          ) : (
            <ErrorText message={list.error} />
          )
        ) : blocks.length === 0 ? (
          <Muted>Todavía no tienes turnos. Agrega el primero abajo.</Muted>
        ) : (
          DAY_ORDER.filter((d) => blocks.some((b) => b.dayOfWeek === d)).map((d) => (
            <View key={d} style={{ gap: 6 }}>
              <Body>{DAY_LABELS[d]}</Body>
              {blocks
                .filter((b) => b.dayOfWeek === d)
                .map((b) => (
                  <Row key={`${b.dayOfWeek}-${b.startTime}`} style={{ justifyContent: 'space-between' }}>
                    <Muted>
                      {clockLabel(b.startTime)} a {clockLabel(b.endTime)}
                    </Muted>
                    <Button
                      title="Quitar"
                      variant="ghost"
                      small
                      disabled={!online || action.busy}
                      onPress={() =>
                        Alert.alert(
                          'Quitar turno',
                          `¿Quitar el turno del ${DAY_LABELS[d].toLowerCase()} de ${clockLabel(b.startTime)} a ${clockLabel(b.endTime)}?`,
                          [
                            { text: 'Dejarlo', style: 'cancel' },
                            {
                              text: 'Quitar',
                              style: 'destructive',
                              onPress: () => void save(blocks.filter((x) => x !== b)),
                            },
                          ],
                        )
                      }
                    />
                  </Row>
                ))}
            </View>
          ))
        )}
        <Muted>Agregar un turno</Muted>
        <Row>
          {DAY_ORDER.map((d) => (
            <Chip
              key={d}
              label={DAY_LABELS[d].slice(0, 3)}
              selected={form.dayOfWeek === String(d)}
              onPress={() => setForm({ ...form, dayOfWeek: String(d) })}
            />
          ))}
        </Row>
        <DateField
          label="Desde"
          mode="time"
          value={form.startTime}
          onChange={(v) => setForm({ ...form, startTime: v })}
        />
        <DateField label="Hasta" mode="time" value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} />
        {saved && <Notice tone="success">Cambios guardados.</Notice>}
        <ErrorText message={action.error} />
        <Button
          title="Agregar turno"
          loading={action.busy}
          disabled={!online || !list.data}
          onPress={() => {
            if (form.endTime <= form.startTime) {
              action.setError('La hora de fin debe ser posterior a la de inicio.');
              return;
            }
            void save([
              ...blocks,
              { dayOfWeek: Number(form.dayOfWeek), startTime: form.startTime, endTime: form.endTime },
            ]);
          }}
        />
      </Card>
    </Section>
  );
}

function ExceptionsSection({ online }: { online: boolean }) {
  const list = useApi<ScheduleException[]>('/agenda/me/exceptions', {
    cacheKey: 'me:schedule-exceptions',
    topics: ['schedule'],
  });
  const [form, setForm] = useState({ date: '', isBlocked: true, startTime: '', endTime: '', reason: '' });
  const action = useAction();
  if (list.error && /plan/i.test(list.error)) return null;
  const add = () =>
    action.run(async () => {
      if (!form.date) throw new Error('Elige la fecha.');
      if (!form.isBlocked && (!form.startTime || !form.endTime || form.endTime <= form.startTime))
        throw new Error('Para un horario especial, elige desde y hasta (la hora de fin después de la de inicio).');
      await request('/agenda/me/exceptions', 'POST', {
        date: form.date,
        isBlocked: form.isBlocked,
        startTime: form.isBlocked ? undefined : form.startTime,
        endTime: form.isBlocked ? undefined : form.endTime,
        reason: form.reason.trim() || undefined,
      });
      setForm({ date: '', isBlocked: true, startTime: '', endTime: '', reason: '' });
      changedLocally('schedule');
      await list.reload();
    });
  return (
    <Section
      title="Vacaciones y días especiales"
      description="Bloquea días completos (vacaciones, feriados) o define un horario distinto al habitual para una fecha."
    >
      <Card>
        {(list.data ?? []).map((ex) => (
          <Row key={ex.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Body>{dayLabel(ex.date.slice(0, 10), 'long')}</Body>
              <Badge
                label={
                  ex.isBlocked
                    ? ex.startTime
                      ? `Bloqueado de ${clockLabel(ex.startTime)} a ${clockLabel(ex.endTime ?? ex.startTime)}`
                      : 'Sin citas'
                    : `Horario especial ${clockLabel(ex.startTime ?? '00:00')} – ${clockLabel(ex.endTime ?? '00:00')}`
                }
                tone={ex.isBlocked ? 'danger' : 'warning'}
              />
              {!!ex.reason && <Muted>{ex.reason}</Muted>}
            </View>
            <Button
              title="Eliminar"
              variant="ghost"
              small
              disabled={!online || action.busy}
              onPress={() =>
                void action.run(async () => {
                  await request(`/agenda/me/exceptions/${ex.id}`, 'DELETE');
                  changedLocally('schedule');
                  await list.reload();
                })
              }
            />
          </Row>
        ))}
        <DateField
          label="Fecha"
          value={form.date}
          onChange={(v) => setForm({ ...form, date: v })}
          placeholder="Elegir fecha"
        />
        <Row>
          <Chip
            label="Bloquear el día"
            selected={form.isBlocked}
            onPress={() => setForm({ ...form, isBlocked: true })}
          />
          <Chip
            label="Horario especial"
            selected={!form.isBlocked}
            onPress={() => setForm({ ...form, isBlocked: false })}
          />
        </Row>
        {!form.isBlocked && (
          <>
            <DateField
              label="Desde"
              mode="time"
              value={form.startTime}
              onChange={(v) => setForm({ ...form, startTime: v })}
            />
            <DateField
              label="Hasta"
              mode="time"
              value={form.endTime}
              onChange={(v) => setForm({ ...form, endTime: v })}
            />
          </>
        )}
        <Field
          label="Motivo (opcional)"
          value={form.reason}
          onChangeText={(v) => setForm({ ...form, reason: v })}
          maxLength={200}
        />
        <ErrorText message={action.error} />
        <Button title="Agregar" loading={action.busy} disabled={!online} onPress={() => void add()} />
      </Card>
    </Section>
  );
}
