/**
 * ¿Hay conexión con la plataforma? Lo que cuenta es llegar a la API, no que
 * el teléfono tenga red: con Wi-Fi sin Internet o la plataforma caída la app
 * también trabaja sin conexión.
 *
 * - Cualquier respuesta de la API (o el canal en vivo al conectarse) confirma
 *   la conexión; un pedido que no llega la da por perdida.
 * - Sin conexión, se vuelve a probar con esperas crecientes mientras la app
 *   está al frente, y enseguida cuando el sistema avisa que volvió la red o la
 *   app vuelve al frente.
 *
 * Sin dependencias de React Native: se prueba con Node (test/offline.test.ts).
 */
export type NetStatus = 'online' | 'offline';

type Timer = ReturnType<typeof setTimeout>;

export interface NetOptions {
  /** Comprueba si la API responde. */
  probe?: () => Promise<boolean>;
  /** Solo se prueba con la app al frente. */
  isActive?: () => boolean;
  /** Esperas entre pruebas sin conexión (la última se repite). */
  delays?: readonly number[];
  timers?: { set: (fn: () => void, ms: number) => Timer; clear: (timer: Timer) => void };
}

export function createNet(options: NetOptions = {}) {
  let probe = options.probe ?? null;
  let isActive = options.isActive ?? (() => true);
  let delays = options.delays ?? [3000, 5000, 10000, 20000, 30000, 60000];
  let timers = options.timers ?? { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: clearTimeout };
  let status: NetStatus = 'online';
  let attempt = 0;
  let timer: Timer | null = null;
  let probing: Promise<boolean> | null = null;
  const listeners = new Set<(status: NetStatus) => void>();

  function stop() {
    if (timer) timers.clear(timer);
    timer = null;
  }
  function schedule() {
    stop();
    if (status !== 'offline' || !probe || !isActive()) return;
    const delay = delays[Math.min(attempt, delays.length - 1)];
    attempt++;
    timer = timers.set(() => {
      timer = null;
      void check();
    }, delay);
  }
  function set(next: NetStatus) {
    if (next === status) return;
    status = next;
    if (next === 'online') {
      attempt = 0;
      stop();
    } else schedule();
    listeners.forEach((listener) => listener(next));
  }
  /** Prueba ahora si la API responde (una sola prueba a la vez). */
  function check(): Promise<boolean> {
    if (!probe) return Promise.resolve(status === 'online');
    const run = probe;
    probing ??= (async () => {
      let ok = false;
      try {
        ok = await run();
      } catch {
        ok = false;
      }
      probing = null;
      if (ok) set('online');
      else if (status === 'offline') schedule();
      else set('offline');
      return ok;
    })();
    return probing;
  }

  return {
    get status() {
      return status;
    },
    /** La API respondió. */
    reachable() {
      set('online');
    },
    /** Un pedido no llegó a la API. */
    unreachable() {
      set('offline');
    },
    /** El sistema avisó un cambio de red: sin red, sin conexión; con red, se prueba ya. */
    systemChanged(state: { isConnected?: boolean | null }) {
      if (state.isConnected === false) {
        set('offline');
        return;
      }
      attempt = 0;
      void check();
    },
    /** La app volvió al frente. */
    resumed() {
      if (status !== 'offline') return;
      attempt = 0;
      stop();
      void check();
    },
    /** La app pasó a segundo plano: no se prueba hasta que vuelva. */
    paused() {
      stop();
    },
    check,
    configure(next: NetOptions) {
      probe = next.probe ?? probe;
      isActive = next.isActive ?? isActive;
      delays = next.delays ?? delays;
      timers = next.timers ?? timers;
    },
    subscribe(listener: (status: NetStatus) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** La conexión de la app (la usan api.ts, el canal en vivo y las pantallas). */
export const net = createNet();
