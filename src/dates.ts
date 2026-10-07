/**
 * Fechas y horas siempre en hora de Caracas (la de la plataforma), aunque el
 * teléfono esté configurado en otra zona.
 */
export const CARACAS = 'America/Caracas';

type DateInput = string | number | Date;

/**
 * Los formateadores se crean una sola vez: crear uno por fecha es lento en
 * Android (un mes de horarios libres son cientos de fechas).
 */
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, found);
  }
  return found;
}

/** Caracas está en UTC−4 todo el año (sin horario de verano desde 2016). */
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;

/** «2026-10-07» del día en Caracas. */
export function caracasDateKey(value: DateInput): string {
  return new Date(new Date(value).getTime() - CARACAS_OFFSET_MS).toISOString().slice(0, 10);
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «10:00 a. m.» */
export function formatTime(value: DateInput): string {
  return formatter('es-VE', { timeZone: CARACAS, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

/** «miércoles, 7 de octubre de 2026» (con `full`) o «7 oct 2026» (con `medium`). */
export function formatDate(value: DateInput, style: 'full' | 'long' | 'medium' = 'long'): string {
  return formatter('es-VE', { timeZone: CARACAS, dateStyle: style }).format(new Date(value));
}

/** «miércoles, 7 de octubre de 2026, 10:00 a. m.» */
export function formatDateTime(value: DateInput, style: 'full' | 'long' | 'medium' = 'full'): string {
  return `${formatDate(value, style)}, ${formatTime(value)}`;
}

/** Un día «AAAA-MM-DD» escrito: «miércoles, 7 de octubre de 2026». */
export function dayLabel(dateKey: string, style: 'full' | 'long' | 'medium' = 'full'): string {
  return formatter('es-VE', { timeZone: 'UTC', dateStyle: style }).format(new Date(`${dateKey}T12:00:00Z`));
}

/** «2026-10» → «octubre de 2026». */
export function monthLabel(month: string): string {
  return formatter('es-VE', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
}

/** «2026-10» → «oct 2026». */
export function shortMonthLabel(month: string): string {
  return formatter('es-VE', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
}

/** «14:30» → «2:30 p. m.» (una hora del horario, sin fecha). */
export function clockLabel(hhmm: string): string {
  return formatter('es-VE', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(
    new Date(`2000-01-01T${hhmm}:00Z`),
  );
}

/** Un instante → «09:30» (hora de Caracas, 24 h). */
export function caracasClock(value: DateInput): string {
  return new Date(new Date(value).getTime() - CARACAS_OFFSET_MS).toISOString().slice(11, 16);
}

/** «2026-10» → el mes siguiente o anterior. */
export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Primer y último día de un mes: «2026-10-01», «2026-10-31». */
export function monthRange(month: string): { first: string; last: string } {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, '0')}` };
}

/** «2026-10-07» + n días. */
export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lunes de la semana de ese día (la agenda va de lunes a domingo). */
export function weekStart(dateKey: string): string {
  const weekday = (new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(dateKey, -weekday);
}

/** El instante de una hora de Caracas: «2026-10-07» y «14:30» → ISO. */
export function caracasInstant(dateKey: string, time: string): string {
  return new Date(new Date(`${dateKey}T${time}:00Z`).getTime() + CARACAS_OFFSET_MS).toISOString();
}

/** «hace 5 min», «hace 2 h», o la fecha si pasó más de un día. */
export function relativeTime(value: DateInput, now = Date.now()): string {
  const minutes = Math.round((now - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 24 * 60) return `hace ${Math.round(minutes / 60)} h`;
  return formatDate(value, 'medium');
}
