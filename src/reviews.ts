/** Valoraciones: tipos, estados y reglas (los mismos de la web, frontend/src/lib/reviews.ts y legal.ts). */
export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'WITHDRAWN';
export type ReviewBasis = 'APPOINTMENT' | 'REGISTERED';
export type ReviewAuthorDisplay = 'ANONYMOUS' | 'INITIAL';
export type ReviewReportReason = 'NOT_MY_PATIENT' | 'HEALTH_DATA' | 'OFFENSIVE' | 'FALSE' | 'OTHER';

export const REVIEW_STATUS: Record<
  ReviewStatus,
  { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }
> = {
  PENDING: { label: 'En revisión', tone: 'warning' },
  PUBLISHED: { label: 'Publicada', tone: 'success' },
  REJECTED: { label: 'No publicada', tone: 'danger' },
  WITHDRAWN: { label: 'Retirada', tone: 'neutral' },
};

export const REVIEW_BASIS_LABEL: Record<ReviewBasis, string> = {
  APPOINTMENT: 'Cita realizada en la plataforma',
  REGISTERED: 'Paciente registrado por el médico',
};

export const REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'NOT_MY_PATIENT', label: 'No fue mi paciente' },
  { value: 'HEALTH_DATA', label: 'Contiene datos de salud' },
  { value: 'OFFENSIVE', label: 'Es ofensiva' },
  { value: 'FALSE', label: 'Es falsa' },
  { value: 'OTHER', label: 'Otro motivo' },
];

export const REVIEW_RULES_VERSION = '1.0';
export const REVIEW_RULES: string[] = [
  'Es tu opinión sobre la atención que recibiste: el trato, la puntualidad, la claridad de las explicaciones y el lugar de consulta.',
  'No incluyas datos de salud tuyos ni de otras personas (diagnósticos, tratamientos o medicamentos), ni teléfonos, correos, enlaces o números de cédula.',
  'Sin insultos ni acusaciones que no puedas sostener.',
  'Si solo eliges las estrellas, tu valoración se publica al enviarla. Si escribes un comentario, el equipo de Guía Médica Monagas lo revisa antes de publicarlo y puede rechazarlo si incumple estas reglas.',
  'Se publica como «Paciente verificado», salvo que elijas mostrar tu nombre y la inicial de tu apellido. Nunca se muestran tu cédula, tu código, tu foto ni la fecha exacta de tu consulta: solo el mes y el año.',
];
