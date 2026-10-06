export interface User {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  needsLegalAcceptance?: boolean;
}
export interface Doctor {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  bio?: string | null;
  municipality?: string | null;
  verificationStatus: string;
  bookingEnabled?: boolean;
  specialties: { specialty: { name: string } }[];
}
export interface Appointment {
  id: string;
  startsAt: string;
  status: string;
  professional?: { firstName: string; lastName: string };
  patient?: { name?: string | null; patientCode?: string };
  patientCode?: string;
}
export interface Notice {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}
export const labels: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELED: 'Cancelada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
const ACCENTS: Record<string, string> = {
  á: 'a',
  à: 'a',
  ä: 'a',
  â: 'a',
  é: 'e',
  è: 'e',
  ë: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  ï: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ö: 'o',
  ô: 'o',
  ú: 'u',
  ù: 'u',
  ü: 'u',
  û: 'u',
  ñ: 'n',
};
/** Texto para comparar en búsquedas: minúsculas, sin tildes y sin espacios repetidos. */
export function searchable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàäâéèëêíìïîóòöôúùüûñ]/g, (c) => ACCENTS[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}
/** Cierra la oración sin duplicar el punto de una abreviatura final («p. m.»). */
export function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
export function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}
