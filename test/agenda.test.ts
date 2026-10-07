import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarForCache,
  freeSlots,
  type AgendaAppointment,
  type CalendarData,
  type CalendarDay,
} from '../src/agenda.ts';

const day: CalendarDay = {
  date: '2026-10-08',
  special: false,
  // 8:00 a 10:00 de Caracas (UTC−4).
  open: [{ start: '2026-10-08T12:00:00.000Z', end: '2026-10-08T14:00:00.000Z' }],
  blocked: [
    { id: 'b1', start: '2026-10-08T13:30:00.000Z', end: '2026-10-08T14:00:00.000Z', allDay: false, reason: null },
  ],
};
const settings = {
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  maxDailyAppointments: null,
  autoConfirm: false,
  bookingWindowDays: 30,
  minNoticeMinutes: 0,
};
const appointment = (startsAt: string, status: AgendaAppointment['status']): AgendaAppointment => ({
  id: startsAt,
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 30 * 60000).toISOString(),
  status,
  source: 'WEB',
  reason: 'Dolor de cabeza',
  cancellationReason: 'Viaje',
  cancelledBy: null,
  createdAt: startsAt,
  location: null,
  patient: { patientId: 'p', patientCode: 'GMM-1', name: null, phone: null, access: 'NONE', hasAccount: true },
});

test('los horarios libres no chocan con citas activas ni con bloqueos', () => {
  const taken = [
    appointment('2026-10-08T12:30:00.000Z', 'CONFIRMED'),
    appointment('2026-10-08T13:00:00.000Z', 'CANCELLED'),
  ];
  const now = new Date('2026-10-07T12:00:00Z').getTime();
  assert.deepEqual(freeSlots(day, settings, taken, now), ['2026-10-08T12:00:00.000Z', '2026-10-08T13:00:00.000Z']);
});

test('no se ofrecen horarios ya pasados ni sin horario configurado', () => {
  const now = new Date('2026-10-08T12:45:00Z').getTime();
  assert.deepEqual(freeSlots(day, settings, [], now), ['2026-10-08T13:00:00.000Z']);
  assert.deepEqual(freeSlots(day, null, [], now), []);
  assert.deepEqual(freeSlots(undefined, settings, [], now), []);
});

test('la agenda guardada en el teléfono no lleva el motivo de consulta', () => {
  const data: CalendarData = {
    planActive: true,
    settings,
    days: [day],
    appointments: [appointment('2026-10-08T12:30:00.000Z', 'CANCELLED')],
  };
  const saved = calendarForCache(data);
  assert.equal(saved.appointments[0].reason, null);
  assert.equal(saved.appointments[0].cancellationReason, null);
  assert.equal(data.appointments[0].reason, 'Dolor de cabeza');
});
