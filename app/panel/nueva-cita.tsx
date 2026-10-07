import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../src/api';
import { useAction } from '../../src/data';
import { capitalizeFirst, caracasInstant, dayLabel } from '../../src/dates';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Body,
  Button,
  Card,
  Check,
  Chip,
  DateField,
  ErrorText,
  Field,
  Heading,
  Muted,
  Notice,
  Row,
  Screen,
} from '../../src/ui';

const PHONE = /^0(412|414|416|424|426)-?\d{7}$/;

/** «09:30» + 30 minutos → «10:00» (sin pasar de las 23:59). */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Un espacio de la agenda: cargar una cita (para un paciente que la pidió por
 * teléfono o en persona) o bloquear ese horario. Como en la web.
 */
export default function NewAppointmentScreen() {
  const params = useLocalSearchParams<{ date: string; time?: string; slot?: string; minutes?: string }>();
  const { user, online } = useSession();
  const minutes = Number(params.minutes) || 30;
  const [mode, setMode] = useState<'appointment' | 'block'>('appointment');
  const [date, setDate] = useState(params.date);
  const [time, setTime] = useState(params.time ?? '');
  const [endTime, setEndTime] = useState(params.time ? addMinutes(params.time, minutes) : '');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', reason: '' });
  const [blockReason, setBlockReason] = useState('');
  const [outsideOk, setOutsideOk] = useState(false);
  const action = useAction();
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const fromSlot = !!params.slot && time === params.time && date === params.date;

  const finish = (text: string) => {
    changedLocally('appointments', 'schedule');
    Alert.alert(text);
    router.back();
  };

  const save = () =>
    action.run(async () => {
      if (!date || !time) throw new Error('Elige el día y la hora.');
      if (mode === 'appointment') {
        if (!form.firstName.trim() || !form.lastName.trim())
          throw new Error('Escribe el nombre y el apellido del paciente.');
        if (form.phone.trim() && !PHONE.test(form.phone.trim()))
          throw new Error('Teléfono inválido (ej. 0414-1234567).');
        await request('/appointments/me/manual', 'POST', {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || undefined,
          reason: form.reason.trim() || undefined,
          startsAt: fromSlot && params.slot ? params.slot : caracasInstant(date, time),
          ...(!fromSlot && outsideOk ? { outsideSchedule: true } : {}),
        });
        finish('Cita cargada');
      } else {
        if (!endTime || endTime <= time) throw new Error('La hora de fin debe ser después de la de inicio.');
        await request('/agenda/me/exceptions', 'POST', {
          date,
          isBlocked: true,
          startTime: time,
          endTime,
          reason: blockReason.trim() || undefined,
        });
        finish('Horario bloqueado');
      }
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: mode === 'appointment' ? 'Cargar una cita' : 'Bloquear un horario' }} />
      <Row>
        <Chip label="Cargar una cita" selected={mode === 'appointment'} onPress={() => setMode('appointment')} />
        <Chip label="Bloquear este horario" selected={mode === 'block'} onPress={() => setMode('block')} />
      </Row>
      <Card>
        <Heading>{capitalizeFirst(dayLabel(date))}</Heading>
        <DateField label="Día" value={date} onChange={setDate} />
        <DateField
          label={mode === 'block' ? 'Desde' : 'Hora'}
          mode="time"
          value={time}
          onChange={(v) => {
            setTime(v);
            setEndTime(addMinutes(v, minutes));
          }}
        />
        {mode === 'block' && <DateField label="Hasta" mode="time" value={endTime} onChange={setEndTime} />}
      </Card>
      {mode === 'appointment' ? (
        <Card>
          <Body>
            Para un paciente que te pidió la cita por teléfono o en persona ({minutes} minutos). Las horas son de
            Caracas.
          </Body>
          <Field
            label="Nombre"
            value={form.firstName}
            onChangeText={(v) => setForm({ ...form, firstName: v })}
            autoCapitalize="words"
            maxLength={80}
          />
          <Field
            label="Apellido"
            value={form.lastName}
            onChangeText={(v) => setForm({ ...form, lastName: v })}
            autoCapitalize="words"
            maxLength={80}
          />
          <Field
            label="Teléfono (opcional)"
            value={form.phone}
            onChangeText={(v) => setForm({ ...form, phone: v })}
            keyboardType="phone-pad"
            placeholder="0414-1234567"
            maxLength={12}
          />
          <Field
            label="Motivo (opcional)"
            value={form.reason}
            onChangeText={(v) => setForm({ ...form, reason: v })}
            multiline
            maxLength={500}
          />
          {!fromSlot && (
            <Check
              label="Es fuera de mi horario de atención: cargarla de todos modos"
              description="Nunca encima de otra cita."
              value={outsideOk}
              onValueChange={setOutsideOk}
            />
          )}
        </Card>
      ) : (
        <Card>
          <Muted>Nadie podrá reservar en ese horario. Puedes quitar el bloqueo desde la agenda.</Muted>
          <Field label="Motivo (opcional)" value={blockReason} onChangeText={setBlockReason} maxLength={200} />
        </Card>
      )}
      {!online && <Notice tone="warning">Sin conexión: para guardar necesitas internet.</Notice>}
      <ErrorText message={action.error} />
      <Button
        title={mode === 'appointment' ? 'Guardar la cita' : 'Bloquear'}
        loading={action.busy}
        disabled={!online}
        onPress={() => void save()}
      />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
