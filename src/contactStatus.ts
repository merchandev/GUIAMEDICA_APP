/** «Quiero que me contacte»: estados y canales (los mismos de la plataforma). */
export type ContactRequestStatus = 'OPEN' | 'CONTACTED' | 'CLOSED' | 'WITHDRAWN' | 'EXPIRED';
export type ContactChannel = 'PHONE' | 'WHATSAPP' | 'EMAIL';

export const CONTACT_REQUEST_STATUS: Record<
  ContactRequestStatus,
  { label: string; tone: 'warning' | 'success' | 'neutral' }
> = {
  OPEN: { label: 'Por atender', tone: 'warning' },
  CONTACTED: { label: 'Contactado', tone: 'success' },
  CLOSED: { label: 'Cerrado', tone: 'neutral' },
  WITHDRAWN: { label: 'Retirado', tone: 'neutral' },
  EXPIRED: { label: 'Vencido', tone: 'neutral' },
};

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  PHONE: 'Llamada',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
};

/** Pedidos que el médico todavía ve (se pueden retirar). */
export const ACTIVE_CONTACT: readonly ContactRequestStatus[] = ['OPEN', 'CONTACTED', 'CLOSED'];
