/**
 * Récipes digitales (los mismos tipos y reglas de la web,
 * frontend/src/lib/prescriptions.ts). Contienen datos de salud: la app no los
 * guarda en el teléfono. Sin dependencias de React Native: se prueba con Node.
 */
export type PrescriptionStatus = 'VALID' | 'EXPIRED' | 'ANNULLED';
export type PrescriptionRequirement =
  'VERIFICATION' | 'MPPS' | 'CEDULA' | 'RULES' | 'ESTABLISHMENT' | 'SIGNATURE' | 'SEAL';
export type PadImageKind = 'logo' | 'signature' | 'seal';

export interface PrescriptionItem {
  activeIngredient: string;
  concentration: string;
  pharmaceuticalForm: string;
  route: string;
  dose: string;
  duration: string;
  quantity: string | null;
  brandNames: string | null;
  nonSubstitutable: boolean;
  instructions: string | null;
}

export interface PrescriptionContent {
  prescriber: {
    fullName: string;
    cedula: string;
    mppsNumber: string;
    colegioNumber: string | null;
    specialties: string[];
  };
  establishment: { name: string; address: string; rif: string; phone: string | null };
  place: string;
  patient: {
    fullName: string;
    cedula: string | null;
    birthYear: number;
    guardian: { fullName: string; cedula: string } | null;
  };
  items: PrescriptionItem[];
  pharmacistNotes: string | null;
  patientInstructions: string | null;
}

export interface PrescriptionView {
  numberLabel: string;
  code: string;
  verifyUrl: string;
  issuedAt: string;
  expiresAt: string;
  status: PrescriptionStatus;
  annulledAt: string | null;
  fingerprint: string;
  content: PrescriptionContent;
}

export interface DoctorPrescription extends PrescriptionView {
  id: string;
  number: number;
  annulReason: string | null;
  deliveredAt: string | null;
  deliveredTo: string | null;
  emailsSent: number;
  emailsLeft: number;
}

export interface PatientPrescription extends PrescriptionView {
  id: string;
  annulReason: string | null;
  doctorSlug: string | null;
}

export interface PrescriptionSummary {
  id: string;
  number: number;
  numberLabel: string;
  issuedAt: string;
  expiresAt: string;
  status: PrescriptionStatus;
  patientName: string;
  patientCedula: string | null;
  itemsSummary: string;
  delivered: boolean;
}

export interface PatientPrescriptionSummary {
  id: string;
  numberLabel: string;
  issuedAt: string;
  expiresAt: string;
  status: PrescriptionStatus;
  patientName: string;
  itemsSummary: string;
  doctor: { name: string; slug: string | null };
}

export interface PrescriptionPad {
  prescriber: {
    fullName: string;
    cedula: string;
    mppsNumber: string;
    colegioNumber: string | null;
    specialties: string[];
    verificationStatus: string;
  };
  pad: {
    saved: boolean;
    establishmentName: string | null;
    establishmentAddress: string | null;
    establishmentRif: string | null;
    establishmentPhone: string | null;
    city: string | null;
    defaultValidityDays: number;
    rulesAcceptedAt: string | null;
    lastNumber: number;
    logoUrl: string | null;
    signatureUrl: string | null;
    sealUrl: string | null;
  };
  rulesVersion: string;
  missing: PrescriptionRequirement[];
  canIssue: boolean;
}

export interface DirectoryPatient {
  patientId: string;
  patientCode: string;
  name: string | null;
}

export const PRESCRIPTION_STATUS: Record<
  PrescriptionStatus,
  { label: string; tone: 'success' | 'neutral' | 'danger' }
> = {
  VALID: { label: 'Vigente', tone: 'success' },
  EXPIRED: { label: 'Vencido', tone: 'neutral' },
  ANNULLED: { label: 'Anulado', tone: 'danger' },
};

export const REQUIREMENTS: Record<PrescriptionRequirement, { label: string; route: string }> = {
  VERIFICATION: { label: 'Tener tus documentos 100 % aprobados (perfil verificado)', route: '/panel/documentos' },
  MPPS: { label: 'Escribir tu N° de registro MPPS en tu perfil', route: '/panel/perfil' },
  CEDULA: { label: 'Escribir tu cédula en tu perfil', route: '/panel/perfil' },
  RULES: { label: 'Aceptar las condiciones del récipe digital', route: '/panel/talonario' },
  ESTABLISHMENT: {
    label: 'Completar el establecimiento: nombre, dirección, RIF y lugar de emisión',
    route: '/panel/talonario',
  },
  SIGNATURE: { label: 'Subir tu firma', route: '/panel/talonario' },
  SEAL: { label: 'Subir tu sello', route: '/panel/talonario' },
};

export const PAD_IMAGES: Record<PadImageKind, { title: string; hint: string; required: boolean }> = {
  signature: {
    title: 'Firma',
    hint: 'Firma con tinta oscura sobre una hoja blanca y tómale una foto de frente, con buena luz. Quitamos el fondo para que quede sobre la línea de firma.',
    required: true,
  },
  seal: {
    title: 'Sello',
    hint: 'Estampa tu sello sobre una hoja blanca y tómale una foto de frente. Quitamos el fondo para que quede junto a tu firma.',
    required: true,
  },
  logo: {
    title: 'Logo (opcional)',
    hint: 'Solo el logo de tu consultorio o centro de salud: la norma prohíbe en el récipe nombres, logos o lemas de laboratorios, medicamentos o marcas comerciales.',
    required: false,
  },
};

export const PHARMACEUTICAL_FORMS = [
  'Tabletas',
  'Comprimidos',
  'Cápsulas',
  'Grageas',
  'Jarabe',
  'Suspensión',
  'Solución oral',
  'Gotas orales',
  'Sobres',
  'Crema',
  'Ungüento',
  'Gel',
  'Loción',
  'Solución inyectable',
  'Ampollas',
  'Óvulos',
  'Supositorios',
  'Inhalador',
  'Spray nasal',
  'Colirio',
  'Gotas óticas',
  'Parches',
];

export const ADMINISTRATION_ROUTES = [
  'oral',
  'sublingual',
  'tópica',
  'intramuscular',
  'intravenosa',
  'subcutánea',
  'inhalatoria',
  'nasal',
  'oftálmica',
  'ótica',
  'rectal',
  'vaginal',
  'transdérmica',
];

/** Condiciones del récipe digital que acepta el médico (las mismas de la web). */
export const PRESCRIPTION_RULES_VERSION = '1.0';
export const PRESCRIPTION_RULES: string[] = [
  'Soy responsable del contenido de cada récipe que emito: el paciente, los medicamentos, las dosis y las indicaciones.',
  'No emito aquí estupefacientes, psicotrópicos ni otros medicamentos que exijan un récipe especial u oficial: esos van en el formato que pide la autoridad sanitaria.',
  'La firma y el sello que subo son míos, y el logo es de mi consultorio o del centro donde atiendo, nunca de laboratorios, medicamentos ni marcas comerciales.',
  'Mi cuenta es personal: no dejo que otra persona emita récipes con mi firma y mi sello.',
  'Si un récipe tiene un error, lo anulo y emito otro: un récipe emitido no se edita.',
  'Guía Médica Monagas guarda una copia de cada récipe para que el paciente la vea y lo descargue, y para que la farmacia compruebe con su código que es auténtico y está vigente.',
];

export const PRESCRIPTION_CONTROLLED_NOTICE =
  'No emitas aquí estupefacientes ni psicotrópicos: requieren el récipe especial u oficial que exige la autoridad sanitaria.';

export const PRESCRIPTION_PATIENT_NOTICE =
  'Tus médicos emiten estos récipes y responden por su contenido. Guía Médica Monagas no prescribe ni vende medicamentos: guarda el récipe para que lo veas, lo descargues y la farmacia compruebe con su código que es auténtico.';

const longDate = (value: string) =>
  new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', dateStyle: 'long' }).format(new Date(value));

/** Texto para compartir: el enlace lleva el código después de «#», que no llega a ningún servidor. */
export function prescriptionShareText(
  view: Pick<PrescriptionView, 'numberLabel' | 'code' | 'verifyUrl' | 'expiresAt' | 'content'>,
): string {
  return `Récipe N° ${view.numberLabel} de Dr(a). ${view.content.prescriber.fullName}, vigente hasta el ${longDate(view.expiresAt)}. Puedes verlo y descargarlo en PDF aquí: ${view.verifyUrl} (código ${view.code}).`;
}

/** «K7Q4M9TXP3WD», «k7q4-m9tx-p3wd» o un enlace con «#…» → «K7Q4-M9TX-P3WD» (o null si no parece un código). */
export function normalizePrescriptionCode(input: string): string | null {
  const raw = input.includes('#') ? input.slice(input.lastIndexOf('#') + 1) : input;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const code = decoded.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/.test(code)) return null;
  return code.match(/.{4}/g)!.join('-');
}

export const prescriptionFileName = (numberLabel: string) => `recipe-${numberLabel}.pdf`;
