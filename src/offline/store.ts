import type { PendingOp } from './outbox';

/**
 * Copia local de lo último que mostró cada pantalla y de los cambios que
 * esperan conexión. Vive en memoria (las pantallas la leen al instante) y se
 * guarda cifrada en el teléfono con la `Persistence` que se le pase.
 *
 * Claves: `pub:` para datos públicos (directorio, fichas de médicos) y `me:`
 * para los de la cuenta, que se borran al cerrar sesión o cambiar de cuenta.
 *
 * Sin dependencias de React Native: se prueba con Node (test/offline.test.ts).
 */
export interface CacheEntry<T = unknown> {
  savedAt: number;
  data: T;
}

export interface OfflineSnapshot {
  version: 2;
  entries: Record<string, CacheEntry>;
  ops: PendingOp[];
}

/** Formato anterior: guardaba la ficha completa del paciente (ver `fromVersion1`). */
interface SnapshotV1 {
  version: 1;
  entries: Record<string, CacheEntry>;
  ops: PendingOp[];
}

export type StoredSnapshot = OfflineSnapshot | SnapshotV1;

/**
 * La versión 1 guardaba en `me:patient` la ficha completa del paciente, con
 * datos de salud e identidad que la app no muestra; ahora la app pide y guarda
 * solo los datos básicos (`/patients/me/basic`). Esa entrada se quita y los
 * cambios de la ficha en espera pasan a la ruta reducida.
 */
function fromVersion1(old: SnapshotV1): OfflineSnapshot {
  const { 'me:patient': _full, ...entries } = old.entries ?? {};
  const ops = (Array.isArray(old.ops) ? old.ops : []).map((op) =>
    op.kind === 'patient-profile' && op.path === '/patients/me' ? { ...op, path: '/patients/me/basic' } : op,
  );
  return { version: 2, entries, ops };
}

export interface Persistence {
  load(): Promise<StoredSnapshot | null>;
  save(snapshot: OfflineSnapshot): Promise<void>;
  /** Reemplaza todo lo guardado por esta copia, de modo que lo anterior ya no se pueda leer. */
  reset(snapshot: OfflineSnapshot): Promise<void>;
}

/**
 * Cuántas páginas del directorio, fichas de médicos y semanas de la agenda se
 * guardan como máximo (las más recientes).
 */
export const LIMITS: readonly (readonly [prefix: string, max: number])[] = [
  ['pub:directory:', 30],
  ['pub:doctor:', 40],
  ['me:calendar:', 12],
];

export interface StoreOptions {
  now?: () => number;
  /** Espera antes de guardar (varias pantallas suelen actualizarse juntas). */
  saveDelayMs?: number;
}

export function createOfflineStore(persistence: Persistence, options: StoreOptions = {}) {
  const now = options.now ?? Date.now;
  const saveDelayMs = options.saveDelayMs ?? 800;
  let entries: Record<string, CacheEntry> = {};
  let ops: PendingOp[] = [];
  let ready = false;
  let version = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  // Las escrituras van en fila: nunca dos a la vez sobre los mismos archivos.
  let chain: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  const snapshot = (): OfflineSnapshot => ({ version: 2, entries, ops });
  function changed() {
    version++;
    listeners.forEach((listener) => listener());
  }
  function enqueue(task: () => Promise<void>) {
    chain = chain.then(task, task).catch(() => {});
    return chain;
  }
  function save() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return chain;
    dirty = false;
    return enqueue(() => persistence.save(snapshot()));
  }
  function saveSoon() {
    dirty = true;
    if (timer || !ready) return;
    timer = setTimeout(() => void save(), saveDelayMs);
  }
  function trim() {
    for (const [prefix, max] of LIMITS) {
      const keys = Object.keys(entries).filter((key) => key.startsWith(prefix));
      if (keys.length <= max) continue;
      keys.sort((a, b) => entries[b].savedAt - entries[a].savedAt);
      const next = { ...entries };
      keys.slice(max).forEach((key) => delete next[key]);
      entries = next;
    }
  }

  let loading: Promise<void> | null = null;
  /**
   * Carga la copia guardada (una sola vez). Si no se puede leer, se empieza de
   * cero. Una copia del formato anterior se reescribe entera con clave nueva:
   * lo que se le quitó no queda legible en ningún archivo.
   */
  function init() {
    loading ??= (async () => {
      let rewrite = false;
      try {
        const loaded = await persistence.load();
        rewrite = loaded?.version === 1;
        const current = loaded?.version === 1 ? fromVersion1(loaded) : loaded?.version === 2 ? loaded : null;
        if (current) {
          // Lo que alguna pantalla guardó mientras tanto es más nuevo.
          entries = { ...current.entries, ...entries };
          ops = Array.isArray(current.ops) ? current.ops : [];
        }
      } catch {
        // Copia ilegible (otra clave, archivo dañado): se reemplaza en la próxima escritura.
      }
      ready = true;
      if (rewrite) dirty = false;
      else if (dirty) saveSoon();
      changed();
      if (rewrite) await enqueue(() => persistence.reset(snapshot()));
    })();
    return loading;
  }

  return {
    init,
    get ready() {
      return ready;
    },
    /** Cambia cuando cambian los pendientes o termina la carga (para useSyncExternalStore). */
    get version() {
      return version;
    },
    peek<T>(key: string): CacheEntry<T> | null {
      return (entries[key] as CacheEntry<T> | undefined) ?? null;
    },
    /** Todas las copias cuya clave empieza así. */
    list(prefix: string): [string, CacheEntry][] {
      return Object.entries(entries).filter(([key]) => key.startsWith(prefix));
    },
    put(key: string, data: unknown) {
      entries = { ...entries, [key]: { savedAt: now(), data } };
      trim();
      saveSoon();
    },
    get ops(): readonly PendingOp[] {
      return ops;
    },
    /** Cambia la cola y la guarda enseguida: un cambio pendiente no se puede perder. */
    async setOps(update: (current: readonly PendingOp[]) => PendingOp[]) {
      await init();
      ops = update(ops);
      dirty = true;
      changed();
      await save();
    },
    /**
     * Borra los datos de la cuenta (`me:`) y los pendientes que no se
     * conservan, y reemplaza la copia guardada para que lo borrado no se
     * pueda recuperar.
     */
    async forget(keepOp: (op: PendingOp) => boolean = () => false) {
      await init();
      entries = Object.fromEntries(Object.entries(entries).filter(([key]) => !key.startsWith('me:')));
      ops = ops.filter(keepOp);
      dirty = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      changed();
      await enqueue(() => persistence.reset(snapshot()));
    },
    /** Guarda ya lo que esté pendiente (al pasar la app a segundo plano). */
    flush: save,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type OfflineStore = ReturnType<typeof createOfflineStore>;
