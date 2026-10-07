/** Colores y medidas de la app (los mismos tonos de la web: verde pino y crema). */
export const colors = {
  primary: '#125545',
  primaryDark: '#0d4034',
  primarySoft: '#e0eee5',
  background: '#f6f8f5',
  card: '#ffffff',
  border: '#e0e8df',
  inputBorder: '#cddad1',
  heading: '#153f34',
  text: '#193e33',
  body: '#293f37',
  muted: '#60746e',
  placeholder: '#697a78',
  accent: '#236d53',
  secondary: '#e7eee7',
  danger: '#9b2929',
  dangerSoft: '#ffeded',
  warning: '#5f4510',
  warningSoft: '#fff6e0',
  info: '#1d4f73',
  infoSoft: '#e8f1f8',
  success: '#1f5d3f',
  successSoft: '#e5f4ea',
  gold: '#7a5a10',
  goldSoft: '#fbf3df',
  white: '#ffffff',
  headerText: '#d1e5db',
  brandText: '#b8dacb',
} as const;

export const radius = { s: 10, m: 12, l: 18 } as const;

/** Ancho máximo del contenido (tabletas y teléfonos en horizontal). */
export const MAX_WIDTH = 720;

/** Altura mínima de todo lo que se toca (pautas de accesibilidad de Android). */
export const TOUCH = 48;
