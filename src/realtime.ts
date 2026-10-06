import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken, refreshSession } from './api';
import { API_URL } from './config';
import { net } from './offline/net';

/**
 * Sincronización en tiempo real con la plataforma (el mismo canal que usa la
 * web: Socket.IO en /api/v1/realtime).
 *
 * El canal solo avisa «cambió algo de este tema»; cada pantalla vuelve a pedir
 * sus datos a la API con su sesión. Al conectarse o reconectarse (por ejemplo,
 * al volver la app al frente o recuperar la señal) se avisa de todo, porque
 * mientras tanto pudo cambiar cualquier cosa. En segundo plano el canal se
 * cierra: Android suspende la app y no tiene sentido gastar batería ni datos.
 *
 * Sin conexión, cada pantalla muestra la copia guardada en el teléfono
 * (src/offline); al volver la conexión se reconecta enseguida y todo se pone
 * al día.
 *
 * Temas: los mismos de la plataforma (backend/src/realtime/realtime-audience.ts).
 */
export type RealtimeTopic =
  | 'appointments'
  | 'schedule'
  | 'availability'
  | 'notifications'
  | 'contact'
  | 'prescriptions'
  | 'documents'
  | 'profile'
  | 'directory'
  | 'posts'
  | 'billing'
  | 'reviews'
  | 'access'
  | 'patientProfile'
  | 'identities'
  | 'clinical'
  | 'finance'
  | 'account'
  | 'requests'
  | 'organization'
  | 'catalog';

export type RealtimeStatus = 'off' | 'connecting' | 'live';
type Listener = (changed: ReadonlySet<RealtimeTopic> | 'all') => void;

const parsed = API_URL.match(/^(https?:\/\/[^/]+)(\/.*)?$/);
const ORIGIN = parsed?.[1] ?? 'https://guiamedicamonagas.com';
const PATH = `${(parsed?.[2] ?? '/api/v1').replace(/\/$/, '')}/realtime`;

let socket: Socket | null = null;
let status: RealtimeStatus = 'off';
let appState: AppStateStatus = AppState.currentState;
const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
/** Médicos cuyos horarios se están mirando (con cuántas pantallas). */
const watched = new Map<string, number>();
let sessionListener: (() => void) | null = null;

function setStatus(next: RealtimeStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

function notify(changed: ReadonlySet<RealtimeTopic> | 'all') {
  listeners.forEach((listener) => listener(changed));
}

function connect() {
  if (socket || appState !== 'active') return;
  socket = io(ORIGIN, {
    path: PATH,
    transports: ['websocket'],
    // Se evalúa en cada intento: siempre con el token vigente (o sin sesión).
    auth: (send) => send({ token: getAccessToken() ?? undefined }),
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
  });
  setStatus('connecting');
  socket.on('ready', () => {
    net.reachable();
    setStatus('live');
    watched.forEach((_, professionalId) => socket?.emit('watch', { professionalId }));
    notify('all');
  });
  socket.on('sync', (message: { topics: RealtimeTopic[] }) => notify(new Set(message.topics)));
  socket.on('session', () => sessionListener?.());
  socket.on('connect_error', (error) => {
    setStatus('connecting');
    if (error.message !== 'unauthorized') return;
    // Token vencido: se renueva y se vuelve a intentar; sin sesión, se entra como visitante.
    void refreshSession().then(() => setTimeout(() => socket?.connect(), 1000));
  });
  socket.on('disconnect', (reason) => {
    setStatus('connecting');
    // El servidor cortó (p. ej. cambió la sesión): se reconecta con el token vigente.
    if (reason === 'io server disconnect') setTimeout(() => socket?.connect(), 1500);
  });
}

function disconnect() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  setStatus('off');
}

AppState.addEventListener('change', (next) => {
  appState = next;
  if (next === 'active') connect();
  else disconnect();
});

// Volvió la conexión: se reconecta ya, sin esperar el próximo reintento (hasta 30 s).
net.subscribe((next) => {
  if (next === 'online' && status !== 'live' && appState === 'active') restartRealtime();
});

/** Abre el canal (con la sesión actual si hay una). Se puede llamar varias veces. */
export function startRealtime() {
  connect();
}

/** Vuelve a conectar con otra sesión (al iniciar o cerrar sesión). */
export function restartRealtime() {
  disconnect();
  connect();
}

/** Todas las pantallas abiertas vuelven a pedir sus datos (al volver la conexión). */
export function resyncAll() {
  notify('all');
}

/** Qué hacer cuando la plataforma avisa que la sesión cambió (revisarla). */
export function setSessionListener(listener: (() => void) | null) {
  sessionListener = listener;
}

/**
 * Vuelve a cargar los datos de la pantalla cuando cambia algo de estos temas
 * en la web, en otro dispositivo o en la administración, y al reconectarse.
 */
export function useRealtimeRefresh(topics: readonly RealtimeTopic[], refresh: () => unknown, enabled = true) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  const topicsKey = topics.join(',');
  useEffect(() => {
    if (!enabled) return;
    const wanted = topicsKey.split(',') as RealtimeTopic[];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener: Listener = (changed) => {
      if (changed !== 'all' && !wanted.some((topic) => changed.has(topic))) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void latest.current(), 300);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer) clearTimeout(timer);
    };
  }, [topicsKey, enabled]);
}

function subscribeStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    subscribeStatus,
    () => status,
    () => 'off',
  );
}

/** Mientras la pantalla está abierta, avisa cuando cambian los horarios libres de ese médico. */
export function useWatchProfessional(professionalId: string | null | undefined) {
  useEffect(() => {
    if (!professionalId) return;
    watched.set(professionalId, (watched.get(professionalId) ?? 0) + 1);
    if (status === 'live') socket?.emit('watch', { professionalId });
    return () => {
      const remaining = (watched.get(professionalId) ?? 1) - 1;
      if (remaining > 0) {
        watched.set(professionalId, remaining);
      } else {
        watched.delete(professionalId);
        socket?.emit('unwatch', { professionalId });
      }
    };
  }, [professionalId]);
}
