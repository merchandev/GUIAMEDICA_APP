import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { OfflineError, request } from './api';
import { cached, remember } from './offline';
import { useRealtimeRefresh, type RealtimeTopic } from './realtime';

/**
 * Datos de una pantalla.
 *
 * - `cacheKey`: lo recibido se guarda cifrado en el teléfono y, sin conexión,
 *   se muestra esa copia con su fecha (`savedAt`). Sin `cacheKey` (datos de
 *   salud, por ejemplo) nada queda en el teléfono: solo en memoria.
 * - `topics`: se vuelve a pedir cuando la plataforma avisa en vivo que cambió.
 * - También se vuelve a pedir, sin indicador, cada vez que la pantalla vuelve
 *   a quedar al frente.
 */
export function useApi<T>(
  path: string | null,
  options: {
    cacheKey?: string;
    topics?: readonly RealtimeTopic[];
    enabled?: boolean;
    /** Sin conexión y sin copia de esto: algo armado con lo que sí está guardado. */
    fallback?: () => T | null;
    /**
     * Lo que se guarda en el teléfono, si no es la respuesta entera: por
     * ejemplo, la agenda sin el motivo de consulta (dato de salud). En
     * pantalla, con conexión, se ve la respuesta completa.
     */
    cacheAs?: (data: T) => T;
  } = {},
) {
  const { cacheKey, topics, enabled = true } = options;
  const [data, setData] = useState<T | null>(() => (cacheKey ? (cached<T>(cacheKey)?.data ?? null) : null));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromFallback, setFromFallback] = useState(false);
  const generation = useRef(0);
  const active = enabled && !!path;
  const fallback = useRef(options.fallback);
  fallback.current = options.fallback;
  const cacheAs = useRef(options.cacheAs);
  cacheAs.current = options.cacheAs;

  const load = useCallback(
    async (mode: 'first' | 'pull' | 'silent') => {
      if (!path || !enabled) return;
      const id = ++generation.current;
      if (mode === 'first') {
        const shown = cacheKey ? cached<T>(cacheKey) : null;
        setData(shown ? shown.data : null);
        setLoading(!shown);
      }
      if (mode === 'pull') setRefreshing(true);
      try {
        const fresh = await request<T>(path);
        if (id !== generation.current) return;
        if (cacheKey) remember(cacheKey, cacheAs.current ? cacheAs.current(fresh) : fresh);
        setData(fresh);
        setSavedAt(null);
        setError(null);
        setFromFallback(false);
      } catch (e) {
        if (id !== generation.current) return;
        const shown = cacheKey ? cached<T>(cacheKey) : null;
        const local = e instanceof OfflineError && !shown ? (fallback.current?.() ?? null) : null;
        if (e instanceof OfflineError && shown) {
          setData(shown.data);
          setSavedAt(shown.savedAt);
          setError(null);
        } else if (local) {
          setData(local);
          setSavedAt(null);
          setError(null);
          setFromFallback(true);
        } else {
          setError(
            e instanceof OfflineError && cacheKey
              ? `${e.message} Esta sección todavía no tiene datos guardados en el teléfono.`
              : e instanceof Error
                ? e.message
                : 'No se pudo cargar.',
          );
        }
      } finally {
        if (id === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, cacheKey, enabled],
  );

  useEffect(() => {
    if (active) void load('first');
    else setLoading(false);
  }, [active, load]);

  useRealtimeRefresh(topics ?? [], () => load('silent'), active && !!topics?.length);

  // Al volver a esta pantalla (desde otra), se pone al día sin indicador.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current && active) void load('silent');
      focused.current = true;
    }, [active, load]),
  );

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    savedAt,
    /** Lo que se ve salió de `fallback` (sin conexión). */
    fromFallback,
    /** Recarga con el indicador de «tirar para actualizar». */
    refresh: () => load('pull'),
    /** Recarga sin indicador (después de guardar algo). */
    reload: () => load('silent'),
  };
}

/** Una acción (guardar, enviar…): evita el doble toque y guarda el error para mostrarlo. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const run = useCallback(async <R>(action: () => Promise<R>): Promise<R | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
      return undefined;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
