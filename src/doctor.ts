import { useApi } from './data';

/** El panel del médico: su perfil, su plan y su progreso (los mismos tipos de la web). */
export type PlanTier = 'FREE' | 'PROFESSIONAL' | 'PROFESSIONAL_PLUS' | 'PREMIUM' | 'AGENCY' | 'ORGANIZATION';

export interface DoctorPlanStatus {
  kind: 'TRIAL' | 'PAID' | 'NONE';
  tier: PlanTier;
  /** Fin de la prueba o del periodo pagado. */
  endsAt: string | null;
  /** La prueba todavía no se usó: empieza sola al cumplir los requisitos. */
  trialAvailable: boolean;
  trialEndedAt: string | null;
}

export interface ProfessionalProgressItem {
  key: string;
  label: string;
  done: boolean;
  fraction?: number;
  detail?: string;
  href?: string;
  requiredToPublish?: boolean;
  lockedUntil?: PlanTier;
}

export interface ProfessionalProgress {
  percent: number;
  items: ProfessionalProgressItem[];
  publication: { key: string; label: string; done: boolean }[];
  canPublish: boolean;
  fullDocuments: boolean;
  documents: { approved: number; required: number; minimumToPublish: number };
}

export interface OwnDocument {
  id: string;
  type: string;
  status: string;
  originalName?: string | null;
  rejectionReason?: string | null;
  reviewNote?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface OwnProfile {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  cedula: string | null;
  rif: string | null;
  mppsNumber: string | null;
  colmedMonagasNumber: string | null;
  phone: string | null;
  whatsapp: string | null;
  municipality: string | null;
  address: string | null;
  seoDescription: string | null;
  photoUrl: string | null;
  publicCode: string | null;
  planTier: PlanTier;
  presentationVideoId: string | null;
  isPublished: boolean;
  isSpecialist?: boolean;
  bookingEnabled: boolean;
  verificationStatus: string;
  specialties: { specialty: { id: string; name: string; slug: string } }[];
  socialLinks: { platform: SocialPlatform; url: string }[];
  documents: OwnDocument[];
  progress: ProfessionalProgress;
  plan: DoctorPlanStatus;
}

export type SocialPlatform = 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'WEBSITE';

/** El perfil propio del médico, guardado (cifrado) para verlo sin conexión. */
export function useOwnProfile(enabled = true) {
  return useApi<OwnProfile>(enabled ? '/professionals/me' : null, {
    cacheKey: 'me:professional',
    topics: ['profile', 'documents', 'billing', 'appointments', 'contact'],
  });
}

type Tone = 'neutral' | 'success' | 'gold' | 'danger' | 'warning';

export const VERIFICATION_LABELS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendiente de documentos', tone: 'neutral' },
  IN_REVIEW: { label: 'En revisión', tone: 'warning' },
  VERIFIED: { label: 'Verificado', tone: 'success' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
  SUSPENDED: { label: 'Suspendido', tone: 'danger' },
};

export const DOCUMENT_STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'En revisión', tone: 'warning' },
  APPROVED: { label: 'Aprobado', tone: 'success' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
  EXPIRED: { label: 'Vencido', tone: 'danger' },
};

export const PLAN_TIER_LABELS: Record<string, { label: string; tone: Tone }> = {
  FREE: { label: 'Sin plan', tone: 'neutral' },
  PROFESSIONAL: { label: 'Profesional', tone: 'success' },
  PROFESSIONAL_PLUS: { label: 'Plus', tone: 'success' },
  PREMIUM: { label: 'Premium', tone: 'gold' },
  AGENCY: { label: 'Marca Médica', tone: 'gold' },
  ORGANIZATION: { label: 'Organización', tone: 'success' },
};

const PLAN_ORDER: PlanTier[] = ['FREE', 'PROFESSIONAL', 'PROFESSIONAL_PLUS', 'PREMIUM', 'AGENCY'];
export const tierAtLeast = (tier: PlanTier, min: PlanTier) => PLAN_ORDER.indexOf(tier) >= PLAN_ORDER.indexOf(min);

/** Redes que permite cada plan (las mismas reglas de la plataforma). */
export const DOCTOR_SOCIAL_LIMITS: Record<PlanTier, { maxLinks: number; allowedPlatforms: SocialPlatform[] }> = {
  FREE: { maxLinks: 0, allowedPlatforms: [] },
  PROFESSIONAL: { maxLinks: 0, allowedPlatforms: [] },
  PROFESSIONAL_PLUS: { maxLinks: 2, allowedPlatforms: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'] },
  PREMIUM: { maxLinks: 4, allowedPlatforms: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEBSITE'] },
  AGENCY: { maxLinks: 4, allowedPlatforms: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEBSITE'] },
  ORGANIZATION: { maxLinks: 4, allowedPlatforms: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEBSITE'] },
};

export const SOCIAL_PLATFORM_EXAMPLE: Record<SocialPlatform, string> = {
  INSTAGRAM: 'https://instagram.com/tu_usuario',
  FACEBOOK: 'https://facebook.com/tu_pagina',
  TIKTOK: 'https://tiktok.com/@tu_usuario',
  WEBSITE: 'https://tu-sitio.com',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TITULO_MEDICO: 'Título de Médico Cirujano',
  REGISTRO_MPPS_SACS: 'Registro MPPS (SACS)',
  ARTICULO_8: 'Constancia Artículo 8',
  MATRICULA_COLEGIO_MONAGAS: 'Matrícula Colegio de Médicos Monagas',
  INPREMEDICO: 'Registro complementario (histórico)',
  SOLVENCIA_DEONTOLOGICA: 'Solvencia Deontológica (ya no se exige)',
  TITULO_POSTGRADO: 'Título de Postgrado',
  CREDENCIAL_ESPECIALIDAD: 'Credencial de Especialidad',
  CEDULA_IDENTIDAD: 'Cédula de Identidad',
  RIF: 'RIF',
};

export { parseYouTubeVideoId, youTubeShortUrl } from './youtube';
