import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  acceptLogin,
  getAccessToken,
  logout,
  OfflineError,
  refreshSessionStatus,
  request,
  setExpiryHandler,
  type Login,
} from './api';
import type { User } from './contracts';
import {
  cached,
  flush,
  forgetAccount,
  rememberUser,
  startOffline,
  store,
  useOnline,
  useOnReconnect,
  usePendingOps,
  USER_KEY,
  type PendingOp,
} from './offline';
import { restartRealtime, resyncAll, setSessionListener } from './realtime';

/**
 * La cuenta con sesión, para toda la app.
 *
 * - Al abrir, se muestra enseguida la cuenta guardada en el teléfono (también
 *   sin conexión) y luego se renueva la sesión con la plataforma.
 * - Sin conexión la sesión no se cierra. Si al volver la plataforma dice que
 *   terminó, se borran del teléfono los datos de la cuenta; sus cambios en
 *   espera se conservan y se envían si vuelve a entrar la misma cuenta.
 * - Al volver la conexión se envían los cambios hechos sin conexión y todas
 *   las pantallas vuelven a pedir sus datos.
 */
interface SessionValue {
  user: User | null;
  /** Ya se cargó la copia guardada (la primera pantalla puede mostrarse). */
  booted: boolean;
  online: boolean;
  /** Cambios de esta cuenta hechos sin conexión: en espera y rechazados. */
  myOps: readonly PendingOp[];
  sending: boolean;
  /** Cuántos cambios se acaban de enviar al volver la conexión. */
  sent: number;
  /** Motivo por el que terminó la sesión (para mostrarlo al iniciar de nuevo). */
  notice: string | null;
  clearNotice: () => void;
  /** Inicia sesión. Con segundo factor devuelve el desafío. */
  login: (email: string, password: string) => Promise<{ challenge?: string }>;
  verifyMfa: (challenge: string, code: string) => Promise<void>;
  /** Una sesión entregada por la plataforma (registro, cambio de contraseña). */
  acceptSession: (result: Login) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fuera de SessionProvider');
  return value;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const online = useOnline();
  const ops = usePendingOps();
  const mounted = useRef(true);
  // Cambia al cerrar sesión o vencer: descarta las respuestas de /auth/me que estaban en camino.
  const account = useRef(0);
  // La cuenta actual, al día también dentro de las funciones asíncronas (sin esperar al render).
  const userRef = useRef<User | null>(null);
  const showUser = useCallback((next: User | null) => {
    userRef.current = next;
    setUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    const id = account.current;
    const me = await request<User>('/auth/me');
    if (mounted.current && id === account.current) {
      showUser(me);
      await rememberUser(me);
    }
  }, [showUser]);

  const expire = useCallback(
    (message: string) => {
      account.current++;
      const expired = userRef.current?.id ?? cached<User>(USER_KEY)?.data.id;
      showUser(null);
      setNotice(message);
      void forgetAccount(expired);
    },
    [showUser],
  );

  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const current = userRef.current;
      if (current) {
        if (!getAccessToken()) {
          const outcome = await refreshSessionStatus();
          if (outcome === 'offline') return;
          if (outcome === 'denied') {
            expire('Tu sesión terminó. Inicia sesión de nuevo.');
            return;
          }
          // El canal en vivo se había abierto sin sesión: se reabre con ella.
          restartRealtime();
          await refreshUser().catch(() => {});
        }
        if (store.ops.some((op) => op.userId === current.id && !op.error)) {
          setSending(true);
          const result = await flush(current.id).finally(() => setSending(false));
          if (result.sent.length && mounted.current) setSent(result.sent.length);
        }
      }
      resyncAll();
    } finally {
      syncing.current = false;
    }
  }, [expire, refreshUser]);
  useOnReconnect(() => void sync());

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(0), 8000);
    return () => clearTimeout(timer);
  }, [sent]);

  useEffect(() => {
    mounted.current = true;
    setExpiryHandler(() => expire('Tu sesión venció. Inicia sesión de nuevo.'));
    void (async () => {
      // Primero lo guardado en el teléfono: sin conexión, la cuenta y sus datos siguen a la vista.
      await startOffline();
      const saved = cached<User>(USER_KEY);
      if (saved && mounted.current && !userRef.current) showUser(saved.data);
      if (mounted.current) setBooted(true);
      const outcome = await refreshSessionStatus();
      if (!mounted.current) return;
      if (outcome === 'ok') {
        if (saved) restartRealtime();
        await refreshUser().catch(() => {});
        void sync();
      } else if (outcome === 'denied' && saved) expire('Tu sesión terminó. Inicia sesión de nuevo.');
    })();
    return () => {
      mounted.current = false;
      setExpiryHandler(() => {});
    };
  }, [expire, refreshUser, showUser, sync]);

  // El canal en vivo se abre con la sesión de cada momento.
  const userId = user?.id;
  useEffect(() => {
    restartRealtime();
  }, [userId]);
  // La plataforma avisa que la sesión cambió (contraseña, «cerrar sesión en todos lados», suspensión).
  useEffect(() => {
    setSessionListener(() => void refreshUser().catch(() => {}));
    return () => setSessionListener(null);
  }, [refreshUser]);

  const acceptSession = useCallback(
    async (result: Login) => {
      await acceptLogin(result);
      setNotice(null);
      await refreshUser();
      void sync();
    },
    [refreshUser, sync],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await request<Login>('/auth/login', 'POST', { email: email.trim(), password });
      if (result.mfaRequired) return { challenge: result.challengeToken };
      await acceptSession(result);
      return {};
    },
    [acceptSession],
  );

  const verifyMfa = useCallback(
    async (challenge: string, code: string) => {
      await acceptSession(
        await request<Login>('/auth/mfa/verify', 'POST', { challengeToken: challenge, code: code.trim() }),
      );
    },
    [acceptSession],
  );

  // Cierra la sesión y borra del teléfono los datos de la cuenta (también sin conexión).
  const signOut = useCallback(async () => {
    account.current++;
    try {
      await logout();
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
    } finally {
      await forgetAccount();
      showUser(null);
    }
  }, [showUser]);

  const myOps = useMemo(() => (user ? ops.filter((op) => op.userId === user.id) : []), [ops, user]);
  const value = useMemo<SessionValue>(
    () => ({
      user,
      booted,
      online,
      myOps,
      sending,
      sent,
      notice,
      clearNotice: () => setNotice(null),
      login,
      verifyMfa,
      acceptSession,
      signOut,
      refreshUser,
    }),
    [user, booted, online, myOps, sending, sent, notice, login, verifyMfa, acceptSession, signOut, refreshUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
