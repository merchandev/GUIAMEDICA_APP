import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';
import { errorMessage } from './contracts';
import { net } from './offline/net';

export { API_URL, SITE_URL } from './config';
let accessToken: string | null = null;
let refreshPromise: Promise<RefreshOutcome> | null = null;
let onExpired = () => {};
let sessionGeneration = 0;
const KEY = 'gmm.refresh';
const LOGGED_OUT = 'gmm.logged-out';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/**
 * El pedido no llegó a la plataforma (sin señal, sin Internet o la plataforma
 * caída). Las pantallas muestran lo guardado y los cambios quedan en espera.
 */
export class OfflineError extends Error {
  name = 'OfflineError';
}
export function setExpiryHandler(handler: () => void) {
  onExpired = handler;
}
export function setToken(token: string | null) {
  sessionGeneration++;
  accessToken = token;
}
/** Token de acceso vigente (solo en memoria): lo usa el canal en tiempo real al conectarse. */
export function getAccessToken() {
  return accessToken;
}
async function getRefresh() {
  return Platform.OS === 'web' ? null : SecureStore.getItemAsync(KEY);
}
export async function forgetSession() {
  sessionGeneration++;
  accessToken = null;
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(LOGGED_OUT, 'true');
    await SecureStore.deleteItemAsync(KEY);
  }
}

export async function request<T>(path: string, method = 'GET', body?: unknown, retry = true): Promise<T> {
  const requestGeneration = sessionGeneration;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    net.unreachable();
    if (e instanceof Error && e.name === 'AbortError')
      throw new OfflineError('La plataforma tardó demasiado en responder. Intenta actualizar de nuevo.');
    throw new OfflineError('No se pudo conectar con la plataforma. Revisa tu conexión e intenta de nuevo.');
  } finally {
    clearTimeout(timer);
  }
  // 502–504: responde el proxy, pero la plataforma no (por ejemplo, durante una actualización).
  if (response.status >= 502 && response.status <= 504) {
    net.unreachable();
    throw new OfflineError('La plataforma no responde en este momento. Intenta de nuevo en unos minutos.');
  }
  net.reachable();
  const credentialEndpoint = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
    '/auth/mfa/verify',
  ].includes(path);
  if (
    response.status === 401 &&
    retry &&
    accessToken &&
    !credentialEndpoint &&
    requestGeneration === sessionGeneration
  ) {
    const outcome = await refreshSessionStatus();
    if (outcome === 'ok') return request<T>(path, method, body, false);
    // Sin conexión no se sabe si la sesión sigue vigente: no se cierra.
    if (outcome === 'offline') throw new OfflineError('Se perdió la conexión al renovar tu sesión.');
    if (requestGeneration === sessionGeneration) {
      await forgetSession();
      onExpired();
    }
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, errorMessage(data, 'No se pudo completar la solicitud.'));
  return data as T;
}

interface Login {
  accessToken?: string;
  refreshToken?: string;
  mfaRequired?: boolean;
  challengeToken?: string;
}
export async function acceptLogin(result: Login) {
  if (!result.accessToken) throw new Error('No se recibió una sesión completa.');
  sessionGeneration++;
  accessToken = result.accessToken;
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(LOGGED_OUT);
  if (result.refreshToken && Platform.OS !== 'web') await SecureStore.setItemAsync(KEY, result.refreshToken);
}
/**
 * `ok`: sesión renovada. `denied`: la plataforma dice que no hay sesión (venció,
 * se cerró en todos lados o se cerró aquí). `offline`: no se pudo preguntar.
 */
export type RefreshOutcome = 'ok' | 'denied' | 'offline';
export function refreshSessionStatus(): Promise<RefreshOutcome> {
  if (!refreshPromise)
    refreshPromise = (async (): Promise<RefreshOutcome> => {
      const generation = sessionGeneration;
      if (Platform.OS !== 'web' && (await SecureStore.getItemAsync(LOGGED_OUT)) === 'true') return 'denied';
      const token = await getRefresh();
      let result: Login;
      try {
        result = await request<Login>('/auth/refresh', 'POST', token ? { refreshToken: token } : undefined, false);
      } catch (e) {
        if (e instanceof OfflineError) return 'offline';
        // Límite de pedidos o falla de la plataforma: la sesión puede seguir vigente.
        if (e instanceof ApiError && (e.status === 429 || e.status >= 500)) return 'offline';
        return 'denied';
      }
      if (generation !== sessionGeneration) return 'denied';
      if (!result.accessToken) {
        accessToken = null;
        return 'denied';
      }
      await acceptLogin(result);
      return 'ok';
    })()
      .catch((): RefreshOutcome => 'denied')
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
export async function refreshSession(): Promise<boolean> {
  return (await refreshSessionStatus()) === 'ok';
}
export async function logout() {
  try {
    const token = await getRefresh();
    await request('/auth/logout', 'POST', token ? { refreshToken: token } : undefined, false);
  } finally {
    await forgetSession();
  }
}
