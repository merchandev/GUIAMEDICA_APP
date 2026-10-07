/**
 * Índice de los textos legales. Los textos mismos no se copian en la app: se
 * leen dentro de la app desde el sitio (siempre la versión vigente, ver
 * app/legal/leer.tsx). Si cambia un título o se agrega un texto en la web
 * (frontend/src/lib/legal.ts), se actualiza esta lista.
 */
import type { LegalDocumentKey } from './contracts';

export type LegalGroup = 'general' | 'privacidad' | 'salud' | 'profesionales' | 'seguridad';

export interface LegalEntry {
  slug: string;
  path: string;
  title: string;
  group: LegalGroup;
}

export const LEGAL_GROUPS: Record<LegalGroup, string> = {
  general: 'Condiciones generales',
  privacidad: 'Privacidad y datos personales',
  salud: 'Salud y responsabilidad médica',
  profesionales: 'Profesionales, planes y pagos',
  seguridad: 'Seguridad y reclamos',
};

export const LEGAL_DOCS: LegalEntry[] = [
  { slug: 'aviso-legal', path: '/aviso-legal', title: 'Aviso legal e identificación del operador', group: 'general' },
  { slug: 'terminos', path: '/terminos-y-condiciones', title: 'Términos y condiciones generales', group: 'general' },
  {
    slug: 'propiedad-intelectual',
    path: '/propiedad-intelectual',
    title: 'Propiedad intelectual y contenido de los usuarios',
    group: 'general',
  },
  {
    slug: 'privacidad',
    path: '/privacidad',
    title: 'Política de privacidad y protección de datos',
    group: 'privacidad',
  },
  {
    slug: 'datos-de-salud',
    path: '/privacidad/datos-de-salud',
    title: 'Política de datos de salud y datos sensibles',
    group: 'privacidad',
  },
  {
    slug: 'consentimiento-paciente',
    path: '/consentimiento-paciente',
    title: 'Consentimiento del paciente para el tratamiento de sus datos',
    group: 'privacidad',
  },
  {
    slug: 'autorizacion-medica',
    path: '/privacidad/autorizacion-medica',
    title: 'Autorización de acceso médico mediante código o QR',
    group: 'privacidad',
  },
  {
    slug: 'derechos',
    path: '/privacidad/derechos',
    title: 'Centro de privacidad y ejercicio de derechos',
    group: 'privacidad',
  },
  {
    slug: 'retencion',
    path: '/privacidad/retencion',
    title: 'Política de retención y eliminación de datos',
    group: 'privacidad',
  },
  {
    slug: 'proveedores',
    path: '/privacidad/proveedores',
    title: 'Política de proveedores y transferencias de datos',
    group: 'privacidad',
  },
  { slug: 'cookies', path: '/cookies', title: 'Política de cookies', group: 'privacidad' },
  { slug: 'menores', path: '/menores', title: 'Política de edad y menores', group: 'privacidad' },
  { slug: 'descargo-medico', path: '/descargo-medico', title: 'Descargo de responsabilidad médica', group: 'salud' },
  {
    slug: 'publicidad-medica',
    path: '/publicidad-medica',
    title: 'Política de publicidad y contenido médico',
    group: 'salud',
  },
  {
    slug: 'verificacion',
    path: '/verificacion-profesionales',
    title: 'Política de verificación de profesionales',
    group: 'profesionales',
  },
  {
    slug: 'condiciones-profesionales',
    path: '/profesionales/condiciones',
    title: 'Condiciones específicas para profesionales',
    group: 'profesionales',
  },
  {
    slug: 'pagos',
    path: '/pagos-y-suscripciones',
    title: 'Política de pagos, planes y suscripciones',
    group: 'profesionales',
  },
  {
    slug: 'reembolsos',
    path: '/reembolsos',
    title: 'Política de cancelación, reembolsos y devoluciones',
    group: 'profesionales',
  },
  {
    slug: 'uso-aceptable',
    path: '/seguridad/uso-aceptable',
    title: 'Política de seguridad y uso aceptable',
    group: 'seguridad',
  },
  { slug: 'seguridad', path: '/seguridad', title: 'Seguridad y reporte de vulnerabilidades', group: 'seguridad' },
];

export const legalByPath = (path: string) => LEGAL_DOCS.find((d) => d.path === path);

/** Avisos que acompañan las pantallas de salud (los mismos de la web). */
export const MEDICAL_DISCLAIMER =
  'Guía Médica Monagas es un directorio tecnológico. No presta atención médica, veterinaria, estética ni de emergencia; no diagnostica, prescribe ni recomienda tratamientos y no vende medicamentos, alimentos o productos sanitarios.';
export const EMERGENCY_NOTICE =
  'Este servicio no es de emergencias. Ante una urgencia, acude al centro de salud más cercano o llama a los servicios de emergencia de tu localidad.';
export const VERIFICATION_NOTICE =
  'La verificación indica que Guía Médica Monagas realizó las comprobaciones documentales definidas en su Política de verificación. No constituye una recomendación clínica, certificación estatal adicional, garantía de calidad asistencial ni garantía de resultados.';

/** Área del paciente (la misma frase de la web). */
export const PATIENT_AREA_NOTICE =
  'Tu información privada se utiliza exclusivamente para operar y proteger las funciones de Guía Médica Monagas. No vendemos tus datos, no los usamos para estudiar tus hábitos de consumo y no utilizamos tu información privada o de salud para entrenar modelos de lenguaje o inteligencia artificial. El acceso de un profesional requiere tu autorización cuando corresponda.';

/** Versiones de los textos que acepta el paciente al compartir datos (las mismas de la web). */
export const CONTACT_REQUEST_CONSENT_VERSION = '1.0';
export const PATIENT_CONSENT_VERSION = '2.0';

export function contactRequestConsent(professionalName: string, days: number): string {
  return `Autorizo a Dr(a). ${professionalName} a ver los datos que elegí compartir, solo para responder este pedido. El pedido y esos datos se borran a los ${days} días y puedo retirarlo antes desde «Pedidos de contacto».`;
}

/** Tipos del canal de reclamos y solicitudes (los mismos de la plataforma). */
export const REQUEST_CATEGORIES: Record<string, string> = {
  PRIVACY_RIGHTS: 'Derechos sobre mis datos (acceso, copia, corrección)',
  ACCOUNT_DELETION: 'Cierre y eliminación de mi cuenta',
  UNAUTHORIZED_ACCESS: 'Acceso indebido a datos',
  FALSE_IDENTITY: 'Identidad falsa o suplantación',
  FALSE_CREDENTIAL: 'Título o credencial falsa',
  SUSPENDED_PROFESSIONAL: 'Profesional suspendido o inhabilitado',
  MISLEADING_CONTENT: 'Publicidad o contenido engañoso',
  SECURITY: 'Seguridad o vulnerabilidad',
  BILLING: 'Pagos, cobros o reembolsos',
  INTELLECTUAL_PROPERTY: 'Propiedad intelectual',
  AUTHORITY_REQUEST: 'Requerimiento de una autoridad',
  REVIEW_ABUSE: 'Valoración abusiva o falsa',
  OTHER: 'Otra solicitud',
};

export const REQUEST_STATUS: Record<string, string> = {
  OPEN: 'Recibida',
  IN_REVIEW: 'En revisión',
  RESOLVED: 'Resuelta',
  REJECTED: 'No procede',
};

/** Qué puede ver un médico si el paciente lo autoriza (los mismos de la web). */
export const SCOPES = [
  { value: 'IDENTITY', label: 'Nombre', description: 'Tu nombre y apellido.' },
  {
    value: 'CONTACT',
    label: 'Contacto',
    description: 'Tu teléfono y tus datos de contacto y dirección de emergencia.',
  },
  {
    value: 'HEALTH',
    label: 'Salud',
    description: 'Fecha de nacimiento, sexo, grupo sanguíneo, alergias, condición, medicamentos y médicos tratantes.',
  },
] as const;

export type Scope = (typeof SCOPES)[number]['value'];
export const SCOPE_LABEL: Record<Scope, string> = { IDENTITY: 'Nombre', CONTACT: 'Contacto', HEALTH: 'Salud' };

/** Fecha desde la que rigen las versiones vigentes (la misma de la web). */
export const LEGAL_EFFECTIVE_DATE_LABEL = '30 de septiembre de 2026';

/**
 * Lo que cada cuenta acepta de forma expresa, una casilla por documento (los
 * mismos textos de la web, frontend/src/lib/legal.ts). La plataforma guarda
 * documento, versión, fecha y contexto de cada aceptación.
 */
export const ACCEPTANCE_DOCUMENTS: Record<
  LegalDocumentKey,
  { docs: { path: string; title: string }[]; statement: string }
> = {
  TERMS: {
    docs: [
      { path: '/terminos-y-condiciones', title: 'Términos y condiciones' },
      { path: '/descargo-medico', title: 'Descargo médico' },
    ],
    statement:
      'Acepto los Términos y condiciones y entiendo que Guía Médica Monagas es un directorio tecnológico: no presta atención médica ni de emergencia.',
  },
  PRIVACY: {
    docs: [{ path: '/privacidad', title: 'Política de privacidad' }],
    statement: 'He leído la Política de privacidad y acepto el tratamiento de mis datos para operar mi cuenta.',
  },
  PATIENT_HEALTH_CONSENT: {
    docs: [
      { path: '/consentimiento-paciente', title: 'Consentimiento del paciente' },
      { path: '/privacidad/datos-de-salud', title: 'Datos de salud' },
    ],
    statement:
      'Doy mi consentimiento expreso para que se almacenen y protejan los datos de salud que yo registre, en los términos del Consentimiento del paciente.',
  },
  AGE_DECLARATION: {
    docs: [{ path: '/menores', title: 'Edad y menores' }],
    statement: 'Declaro que tengo 18 años o más.',
  },
  PROFESSIONAL_TERMS: {
    docs: [
      { path: '/profesionales/condiciones', title: 'Condiciones para profesionales' },
      { path: '/verificacion-profesionales', title: 'Verificación de profesionales' },
      { path: '/publicidad-medica', title: 'Publicidad médica' },
    ],
    statement:
      'Acepto las Condiciones para profesionales: mis credenciales son auténticas y guardaré el secreto profesional sobre los datos de los pacientes.',
  },
};

export const ACCEPTANCE_ORDER: LegalDocumentKey[] = [
  'TERMS',
  'PRIVACY',
  'PATIENT_HEALTH_CONSENT',
  'AGE_DECLARATION',
  'PROFESSIONAL_TERMS',
];

/** Lo que acepta cada tipo de cuenta al registrarse (igual que la plataforma). */
export function requiredLegalDocuments(role: string): LegalDocumentKey[] {
  if (role === 'USER') return ['TERMS', 'PRIVACY', 'PATIENT_HEALTH_CONSENT', 'AGE_DECLARATION'];
  if (role === 'PROFESSIONAL') return ['TERMS', 'PRIVACY', 'PROFESSIONAL_TERMS'];
  return ['TERMS', 'PRIVACY'];
}
