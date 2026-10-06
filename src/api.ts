import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { errorMessage } from './contracts';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://guiamedicamonagas.com/api/v1').replace(/\/$/, '');
export const SITE_URL = 'https://guiamedicamonagas.com';
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
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
    if (e instanceof Error && e.name === 'AbortError')
      throw new Error('La plataforma tardó demasiado en responder. Intenta actualizar de nuevo.');
    throw new Error('No se pudo conectar con la plataforma. Revisa tu conexión e intenta de nuevo.');
  } finally {
    clearTimeout(timer);
  }
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
    if (await refreshSession()) return request<T>(path, method, body, false);
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
export async function refreshSession(): Promise<boolean> {
  if (!refreshPromise)
    refreshPromise = (async () => {
      const generation = sessionGeneration;
      if (Platform.OS !== 'web' && (await SecureStore.getItemAsync(LOGGED_OUT)) === 'true') return false;
      const token = await getRefresh();
      const result = await request<Login>('/auth/refresh', 'POST', token ? { refreshToken: token } : undefined, false);
      if (generation !== sessionGeneration) return false;
      if (!result.accessToken) {
        accessToken = null;
        return false;
      }
      await acceptLogin(result);
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
export async function logout() {
  try {
    const token = await getRefresh();
    await request('/auth/logout', 'POST', token ? { refreshToken: token } : undefined, false);
  } finally {
    await forgetSession();
  }
}
