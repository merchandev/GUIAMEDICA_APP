/**
 * Enlaces de la plataforma (avisos, correos) traducidos a pantallas de la
 * app: la app no manda a la web. Sin dependencias de React Native: se prueba
 * con Node (test/links.test.ts).
 */

/** El token de un enlace del correo («…/restablecer-contrasena?token=…») o el token pegado solo. */
export function tokenFrom(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/[?&]token=([^&#\s]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

/**
 * El código de un paciente escrito o leído de su QR («https://…/p/K7Q4-M9TX-P3WD»)
 * → «K7Q4-M9TX-P3WD». `null` si no parece un código de paciente.
 */
export function patientCodeFrom(text: string): string | null {
  const trimmed = text.trim();
  const fromUrl = trimmed.match(/\/p\/([^/?#\s]+)/);
  let raw = fromUrl ? fromUrl[1] : trimmed;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z2-9]{12}$/.test(code)) return null;
  return code.match(/.{4}/g)!.join('-');
}

/** Ruta de la web → pantalla de la app (`null`: no tiene una en la app). */
const ROUTES: readonly (readonly [prefix: string, route: string])[] = [
  ['/paciente/citas', '/citas'],
  ['/paciente/permisos', '/paciente/permisos'],
  ['/paciente/codigo', '/paciente/codigo'],
  ['/paciente/recipes', '/paciente/recetas'],
  ['/paciente/valoraciones', '/paciente/valoraciones'],
  ['/paciente/contactos', '/paciente/contactos'],
  ['/paciente/privacidad', '/paciente/privacidad'],
  ['/paciente/notificaciones', '/avisos'],
  ['/paciente', '/paciente/perfil'],
  ['/dashboard/agenda/horario', '/panel/horario'],
  ['/dashboard/agenda/historial', '/panel/historial'],
  ['/dashboard/agenda', '/agenda'],
  ['/dashboard/citas', '/agenda'],
  ['/dashboard/pacientes', '/pacientes'],
  ['/dashboard/mensajes', '/panel/mensajes'],
  ['/dashboard/perfil', '/panel/perfil'],
  ['/dashboard/documentos', '/panel/documentos'],
  ['/dashboard/pagos', '/panel/plan'],
  ['/dashboard/valoraciones', '/panel/valoraciones'],
  ['/dashboard/recipes/talonario', '/panel/talonario'],
  ['/dashboard/recipes', '/panel/recetas'],
  ['/dashboard/publicaciones', '/panel/publicaciones'],
  ['/dashboard/estadisticas', '/panel/estadisticas'],
  ['/dashboard/notificaciones', '/avisos'],
  ['/dashboard', '/inicio'],
  ['/reclamos', '/reclamos'],
  ['/cuenta/seguridad', '/cuenta/seguridad'],
];

/**
 * Pantalla de la app para el enlace de un aviso. Se respeta el prefijo
 * completo («/pacientex» no es «/paciente»). La cita de la agenda
 * («/dashboard/agenda?cita=…») abre su detalle.
 */
export function appRouteFor(link: string | null | undefined): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  const [path, query = ''] = link.split('?');
  const recipe = path.match(/^\/paciente\/recipes\/([\w-]+)$/);
  if (recipe) return `/paciente/recetas/${recipe[1]}`;
  const appointment = query.match(/(?:^|&)cita=([\w-]+)/);
  if (path === '/dashboard/agenda' && appointment) return `/panel/cita/${appointment[1]}`;
  for (const [prefix, route] of ROUTES) if (path === prefix || path.startsWith(`${prefix}/`)) return route;
  return null;
}
