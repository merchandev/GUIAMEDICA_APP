import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { randomUUID } from 'expo-crypto';
import { ApiError, OfflineError, request } from '../api';
import { API_URL } from '../config';
import { labels } from '../contracts';
import { net } from './net';
import {
  addOp,
  flushOps,
  rejectionMeansApplied,
  type Failure,
  type FlushDeps,
  type FlushResult,
  type NewOp,
  type PendingOp,
} from './outbox';
import { createOfflineStore, type CacheEntry } from './store';
import { vault } from './vault';

/**
 * Modo sin conexión de la app.
 *
 * - Cada pantalla guarda lo último que recibió (`fetchCached`) y, sin
 *   conexión, muestra esa copia con su fecha.
 * - Los cambios hechos sin conexión (`perform`) quedan en una cola cifrada en
 *   el teléfono y se envían solos, en orden, al volver la conexión (`flush`).
 * - La conexión se vigila con los avisos de red del sistema, con cada pedido
 *   a la API y con el canal en vivo (`net`).
 */
export { net } from './net';
export type { NetStatus } from './net';
export { effectiveStatus, pendingFor, type FlushResult, type PendingOp } from './outbox';

export const store = createOfflineStore(vault);

/** La cuenta con sesión (o la última, sin conexión). */
export const USER_KEY = 'me:user';

async function probeApi() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_URL}/health`, { signal: controller.signal, cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

net.configure({ probe: probeApi, isActive: () => AppState.currentState === 'active' });

let started = false;
/** Carga la copia guardada y empieza a vigilar la red. Se puede llamar varias veces. */
export function startOffline() {
  if (!started) {
    started = true;
    try {
      Network.addNetworkStateListener((state) => net.systemChanged(state));
      void Network.getNetworkStateAsync()
        .then((state) => {
          if (state.isConnected === false) net.unreachable();
        })
        .catch(() => {});
    } catch {
      // Sin avisos del sistema: la conexión se sigue detectando con los pedidos.
    }
    AppState.addEventListener('change', (state) => {
      if (state === 'active') net.resumed();
      else {
        net.paused();
        void store.flush();
      }
    });
  }
  return store.init();
}

const subscribeStore = (listener: () => void) => store.subscribe(listener);
const subscribeNet = (listener: () => void) => net.subscribe(listener);

/** `true` mientras la app llega a la plataforma. */
export function useOnline() {
  return useSyncExternalStore(
    subscribeNet,
    () => net.status === 'online',
    () => true,
  );
}

/** `true` cuando ya se cargó la copia guardada. */
export function useOfflineReady() {
  return useSyncExternalStore(
    subscribeStore,
    () => store.ready,
    () => false,
  );
}

/** Los cambios en espera o rechazados (de todas las cuentas; filtrar por `userId`). */
export function usePendingOps(): readonly PendingOp[] {
  return useSyncExternalStore(
    subscribeStore,
    () => store.ops,
    () => store.ops,
  );
}

/** Se llama cada vez que vuelve la conexión. */
export function useOnReconnect(callback: () => void) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(
    () =>
      net.subscribe((status) => {
        if (status === 'online') latest.current();
      }),
    [],
  );
}

export function cached<T>(key: string): CacheEntry<T> | null {
  return store.peek<T>(key);
}

export function remember(key: string, data: unknown) {
  store.put(key, data);
}

/**
 * Pide los datos a la plataforma y guarda la respuesta. Sin conexión devuelve
 * la copia guardada con su fecha (`savedAt`); sin copia, el error.
 */
export async function fetchCached<T>(key: string, path: string): Promise<{ data: T; savedAt: number | null }> {
  try {
    const data = await request<T>(path);
    store.put(key, data);
    return { data, savedAt: null };
  } catch (error) {
    const hit = error instanceof OfflineError ? store.peek<T>(key) : null;
    if (hit) return { data: hit.data, savedAt: hit.savedAt };
    throw error;
  }
}

/** Guarda la cuenta con sesión; si es otra cuenta, antes se borra lo de la anterior. */
export async function rememberUser(user: { id: string }) {
  const previous = store.peek<{ id: string }>(USER_KEY);
  const otherAccount = previous ? previous.data.id !== user.id : store.ops.some((op) => op.userId !== user.id);
  if (otherAccount) await store.forget((op) => op.userId === user.id);
  store.put(USER_KEY, user);
}

/**
 * Borra del teléfono los datos de la cuenta. `keepOpsOf`: conserva los
 * cambios en espera de esa cuenta (la sesión venció: se envían cuando vuelva
 * a entrar con la misma cuenta).
 */
export function forgetAccount(keepOpsOf?: string) {
  return store.forget(keepOpsOf ? (op) => op.userId === keepOpsOf : () => false);
}

function classify(error: unknown): Failure {
  if (error instanceof OfflineError) return { type: 'offline' };
  if (error instanceof ApiError) {
    if (error.status === 401) return { type: 'auth' };
    if (error.status === 408 || error.status === 429 || error.status >= 500)
      return { type: 'transient', message: error.message };
    return { type: 'rejected', status: error.status, message: error.message };
  }
  return { type: 'transient', message: error instanceof Error ? error.message : 'No se pudo enviar.' };
}

const deps: FlushDeps = {
  send: (op) => request(op.path, op.method, op.body),
  classify,
  async applied(op, failure) {
    if (!op.checkPath) return rejectionMeansApplied(op, failure.status);
    const found = await request<{ id: string; status: string } | { id: string; status: string }[]>(op.checkPath);
    const appointment = Array.isArray(found) ? found.find((a) => a.id === op.targetId) : found;
    if (rejectionMeansApplied(op, failure.status, appointment?.status)) return true;
    return appointment ? `estado actual: ${(labels[appointment.status] ?? appointment.status).toLowerCase()}` : false;
  },
  done: (op) => store.setOps((ops) => ops.filter((o) => o.id !== op.id)),
  update: (op) => store.setOps((ops) => ops.map((o) => (o.id === op.id ? op : o))),
};

let flushing: Promise<FlushResult> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

/** Envía en orden los cambios en espera de esta cuenta. */
export function flush(userId: string): Promise<FlushResult> {
  flushing ??= (async () => {
    if (retry) clearTimeout(retry);
    retry = null;
    const total: FlushResult = { sent: [], failed: [], stopped: null };
    // Otra vuelta si entraron cambios nuevos mientras se enviaban los anteriores.
    for (let round = 0; round < 5; round++) {
      const waiting = store.ops.filter((op) => op.userId === userId && !op.error);
      if (!waiting.length) break;
      const result = await flushOps(waiting, userId, deps);
      total.sent.push(...result.sent);
      total.failed.push(...result.failed);
      total.stopped = result.stopped;
      if (result.stopped) break;
    }
    // La plataforma falló o limitó los pedidos: otro intento en 30 s.
    if (total.stopped === 'transient') retry = setTimeout(() => void flush(userId), 30_000);
    return total;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * Hace un cambio: con conexión lo envía ya; sin conexión lo deja en espera.
 * Si hay cambios anteriores en espera, va detrás de ellos (el orden importa:
 * dos ediciones de la ficha, por ejemplo). Los errores de la plataforma
 * (cita que ya no se puede cancelar…) se lanzan como siempre.
 */
export async function perform(userId: string, op: NewOp): Promise<'sent' | 'queued'> {
  const waiting = store.ops.some((o) => o.userId === userId && !o.error);
  if (net.status === 'online' && !waiting) {
    try {
      await request(op.path, op.method, op.body);
      return 'sent';
    } catch (error) {
      if (!(error instanceof OfflineError)) throw error;
    }
  }
  const pending: PendingOp = { ...op, id: randomUUID(), userId, createdAt: Date.now(), attempts: 0 };
  await store.setOps((ops) => addOp(ops, pending));
  if (net.status === 'online') {
    const same = (o: PendingOp) => o.kind === op.kind && o.targetId === op.targetId;
    const result = await flush(userId);
    if (result.sent.some(same)) return 'sent';
    const failed = result.failed.find(same);
    if (failed) {
      // Se muestra en el momento, como cualquier error: no hace falta guardarlo.
      await discard(failed.id);
      throw new Error(failed.error);
    }
  }
  return 'queued';
}

/** Quita un cambio de la cola (en espera o rechazado). */
export function discard(id: string) {
  return store.setOps((ops) => ops.filter((op) => op.id !== id));
}
