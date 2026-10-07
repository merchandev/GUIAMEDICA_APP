/**
 * Agenda del médico: tipos, estados y cálculos (los mismos de la web,
 * frontend/src/lib/agenda.ts). Sin dependencias de React Native: se prueba
 * con Node (test/agenda.test.ts).
 */
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentSource = 'WEB' | 'WHATSAPP' | 'APP' | 'PHONE';
export type Party = 'PATIENT' | 'PROFESSIONAL';

/** El paciente tal como lo puede ver el médico (según lo que autorizó). */
export interface PatientLabel {
  patientId: string;
  patientCode: string;
  name: string | null;
  phone: string | null;
  access: 'WALK_IN' | 'GRANT' | 'NONE';
  hasAccount: boolean;
}

export interface AgendaAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  reason: string | null;
  cancellationReason: string | null;
  cancelledBy: Party | null;
  createdAt: string;
  location: { id: string; name: string } | null;
  patient: PatientLabel;
}

export interface AppointmentEventItem {
  type: 'CREATED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  actor: 'PATIENT' | 'PROFESSIONAL' | 'SYSTEM' | 'ADMIN';
  previousStartsAt: string | null;
  newStartsAt: string | null;
  outsideSchedule: boolean;
  createdAt: string;
}

export interface AppointmentDetail extends AgendaAppointment {
  events: AppointmentEventItem[];
}

export interface CalendarDay {
  date: string;
  special: boolean;
  open: { start: string; end: string }[];
  blocked: { id: string | null; start: string; end: string; allDay: boolean; reason: string | null }[];
}

export interface ScheduleSettings {
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxDailyAppointments: number | null;
  autoConfirm: boolean;
  bookingWindowDays: number;
  minNoticeMinutes: number;
}

export interface CalendarData {
  /** Sin plan: se ven y se gestionan las citas ya reservadas, pero no llegan ni se crean citas nuevas. */
  planActive: boolean;
  settings: ScheduleSettings | null;
  days: CalendarDay[];
  appointments: AgendaAppointment[];
}

export interface HistoryPage {
  items: AgendaAppointment[];
  nextCursor: string | null;
  summary: Record<AppointmentStatus, number> | null;
}

export const STATUS_INFO: Record<
  AppointmentStatus,
  { label: string; tone: 'warning' | 'success' | 'neutral' | 'danger'; color: string }
> = {
  PENDING: { label: 'Por confirmar', tone: 'warning', color: '#b45309' },
  CONFIRMED: { label: 'Confirmada', tone: 'success', color: '#0f6e5c' },
  COMPLETED: { label: 'Realizada', tone: 'neutral', color: '#475569' },
  CANCELLED: { label: 'Cancelada', tone: 'danger', color: '#b91c1c' },
  NO_SHOW: { label: 'No asistió', tone: 'danger', color: '#7f1d1d' },
};

export const SOURCE_LABELS: Record<AppointmentSource, string> = {
  WEB: 'Reservada en la web',
  WHATSAPP: 'WhatsApp',
  APP: 'Aplicación',
  PHONE: 'Cargada por ti',
};

/** Nombre si el paciente lo autorizó; si no, su código. */
export function patientDisplay(patient: PatientLabel): string {
  return patient.name ?? patient.patientCode;
}

/** Se puede mover o cancelar mientras no haya pasado ni terminado. */
export function isActive(appointment: Pick<AgendaAppointment, 'status'>): boolean {
  return appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
}

const ACTOR_TEXT: Record<AppointmentEventItem['actor'], string> = {
  PATIENT: 'el paciente',
  PROFESSIONAL: 'ti',
  SYSTEM: 'el sistema',
  ADMIN: 'la administración',
};

/** Texto de cada paso del historial de una cita. */
export function eventText(event: AppointmentEventItem): string {
  const by = ACTOR_TEXT[event.actor];
  switch (event.type) {
    case 'CREATED':
      return event.actor === 'PROFESSIONAL' ? 'La cargaste tú' : `La pidió ${by}`;
    case 'CONFIRMED':
      return `Confirmada por ${by}`;
    case 'RESCHEDULED':
      return `Reprogramada por ${by}`;
    case 'CANCELLED':
      return `Cancelada por ${by}`;
    case 'COMPLETED':
      return 'Marcada como realizada';
    case 'NO_SHOW':
      return 'Marcada como «no asistió»';
  }
}

/**
 * Lo que se guarda en el teléfono de la agenda: sin el motivo de consulta ni
 * el de cancelación (pueden ser datos de salud). Con conexión se ven en el
 * detalle de la cita.
 */
export function calendarForCache(data: CalendarData): CalendarData {
  return { ...data, appointments: data.appointments.map((a) => ({ ...a, reason: null, cancellationReason: null })) };
}

/**
 * Horarios libres de un día del médico: los turnos de su horario de atención
 * que no chocan con una cita activa ni con un bloqueo, desde ahora. Es una
 * ayuda para tocar y cargar una cita: la plataforma vuelve a comprobarlo.
 */
export function freeSlots(
  day: CalendarDay | undefined,
  settings: ScheduleSettings | null,
  appointments: AgendaAppointment[],
  now = Date.now(),
): string[] {
  if (!day || !settings) return [];
  const step = (settings.slotDurationMinutes + settings.bufferMinutes) * 60_000;
  const length = settings.slotDurationMinutes * 60_000;
  if (step <= 0 || length <= 0) return [];
  const busy = [
    ...appointments
      .filter(isActive)
      .map((a) => [new Date(a.startsAt).getTime(), new Date(a.endsAt).getTime()] as const),
    ...day.blocked.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const),
  ];
  const slots: string[] = [];
  for (const period of day.open) {
    const end = new Date(period.end).getTime();
    for (let start = new Date(period.start).getTime(); start + length <= end; start += step) {
      if (start <= now) continue;
      if (busy.some(([from, to]) => start < to && start + length > from)) continue;
      slots.push(new Date(start).toISOString());
    }
  }
  return slots;
}
