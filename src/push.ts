/**
 * Notificaciones push de la app (Firebase Cloud Messaging).
 *
 * Al iniciar sesión, la app pide permiso, obtiene el token del dispositivo de
 * FCM y lo registra en la plataforma. Cuando llega un aviso, el servidor lo
 * entrega por FCM aunque la app esté cerrada. Al cerrar sesión, se borra el
 * token para que no sigan llegando avisos de esa cuenta.
 *
 * El contenido del push es el mismo título y texto del aviso de la campana
 * (sin datos de salud); al tocarlo, la app abre la pantalla interna que indique
 * el enlace (`appRouteFor`), nunca la web.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { OfflineError, request } from './api';

const TOKEN_KEY = 'push.fcmToken';
const ANDROID_CHANNEL = 'default';

/** Mientras la app está abierta, igual mostramos el aviso del sistema. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registration: Promise<void> | null = null;

/** Marca opaca del dispositivo para depurar (sin datos personales). */
function deviceTag(): string {
  const os = `${Platform.OS} ${Device.osVersion ?? ''}`.trim();
  const app = Constants.expoConfig?.version ?? '';
  return `${os}${app ? ` · app ${app}` : ''}`.slice(0, 180);
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Avisos',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/**
 * Registra el token de esta instalación en la plataforma. Idempotente y
 * silencioso: si el usuario no da permiso, o no hay servicios de Google, o no
 * hay conexión, no pasa nada (se reintenta en el próximo inicio de sesión).
 */
export function registerPushToken(): Promise<void> {
  if (registration) return registration;
  registration = (async () => {
    try {
      // El servidor envía directamente por FCM. En iOS, el token nativo que
      // devuelve expo-notifications es APNs; no es válido para este transporte.
      if (Platform.OS !== 'android') return;
      await ensureAndroidChannel();

      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.granted;
      if (!granted && existing.canAskAgain) {
        const asked = await Notifications.requestPermissionsAsync();
        granted = asked.granted;
      }
      if (!granted) return;

      const token = (await Notifications.getDevicePushTokenAsync()).data;
      if (typeof token !== 'string' || !token) return;

      await request('/notifications/device-tokens', 'POST', {
        token,
        platform: 'ANDROID',
        deviceInfo: deviceTag(),
      });
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      // Sin conexión o sin Google Play: se intentará de nuevo. Nunca interrumpe la sesión.
      if (!(error instanceof OfflineError)) {
        console.warn('No se pudo registrar el token de notificaciones:', (error as Error).message);
      }
    } finally {
      registration = null;
    }
  })();
  return registration;
}

/** Borra el token de la plataforma al cerrar sesión (si hay sesión y conexión). */
export async function removePushToken(): Promise<void> {
  // Si el registro ya estaba en curso, espera a que termine de guardar el token
  // para que el cierre de sesión también pueda eliminarlo del servidor.
  await registration?.catch(() => undefined);
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  if (!token) return;
  try {
    await request('/notifications/device-tokens', 'DELETE', { token });
  } catch {
    // Sin conexión o sesión ya vencida: el servidor limpia el token muerto al primer envío fallido.
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  }
}
