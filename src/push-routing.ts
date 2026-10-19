/**
 * De los datos de una notificación push a la pantalla interna que debe abrir
 * al tocarla. Pura (sin React Native) para poder probarse con Node: solo decide
 * la ruta. El enlace se traduce con `appRouteFor`, así que nunca abre la web ni
 * una pantalla ajena. FCM entrega los datos como texto, por eso `link` llega
 * como string (o ausente).
 */
// Con extensión .ts para que el test con Node (`--experimental-strip-types`)
// resuelva el módulo; Metro y tsc (allowImportingTsExtensions) también la aceptan.
import { appRouteFor } from './links.ts';

export function routeForPushData(data: Record<string, unknown> | null | undefined): string | null {
  const link = data?.link;
  return appRouteFor(typeof link === 'string' ? link : null);
}
