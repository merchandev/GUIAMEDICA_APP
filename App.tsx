import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  acceptLogin,
  getAccessToken,
  logout,
  OfflineError,
  refreshSessionStatus,
  request,
  setExpiryHandler,
  SITE_URL,
} from './src/api';
import { ContactRequests } from './src/ContactRequests';
import { ContactDoctor } from './src/ContactDoctor';
import { SecuritySettings } from './src/SecuritySettings';
import { DoctorAppointmentActions } from './src/DoctorAppointmentActions';
import { PatientAccount } from './src/PatientAccount';
import { AccountForms } from './src/AccountForms';
import { Appointment, dateLabel, dayKey, Doctor, labels, Notice, searchable, User } from './src/contracts';
import {
  type RealtimeTopic,
  restartRealtime,
  resyncAll,
  setSessionListener,
  useRealtimeRefresh,
  useRealtimeStatus,
  useWatchProfessional,
} from './src/realtime';
import {
  cached,
  discard,
  effectiveStatus,
  fetchCached,
  flush,
  forgetAccount,
  net,
  pendingFor,
  perform,
  remember,
  rememberUser,
  startOffline,
  store,
  useOfflineReady,
  useOnline,
  useOnReconnect,
  usePendingOps,
  USER_KEY,
} from './src/offline';
import { SyncBanner } from './src/SyncBanner';

type Tab = 'directorio' | 'citas' | 'avisos' | 'cuenta';
function Action({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, secondary && { color: '#125545' }]}>{title}</Text>
    </Pressable>
  );
}
function Field({
  placeholder,
  value,
  onChangeText,
  secret = false,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secret?: boolean;
}) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor="#697a78"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secret}
      autoCapitalize="none"
      style={s.input}
    />
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
function AppContent() {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 12 : width >= 768 ? 32 : 20;
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('directorio');
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [date, setDate] = useState(dayKey(new Date()));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  // Sin conexión: fecha de la copia guardada que se está mostrando.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Sin conexión, la búsqueda se hace entre los médicos guardados en el teléfono.
  const [localResults, setLocalResults] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, true>>({});
  const online = useOnline();
  const ready = useOfflineReady();
  const ops = usePendingOps();
  const myOps = user ? ops.filter((op) => op.userId === user.id) : [];
  const generation = useRef(0);
  // Cambia al cerrar sesión o vencer: descarta las respuestas de /auth/me que estaban en camino.
  const account = useRef(0);
  const mounted = useRef(true);
  // La cuenta actual, al día también dentro de las funciones asíncronas (sin esperar al render).
  const userRef = useRef<User | null>(null);
  const showUser = useCallback((next: User | null) => {
    userRef.current = next;
    setUser(next);
  }, []);
  const session = useCallback(async () => {
    const id = account.current;
    const me = await request<User>('/auth/me');
    if (mounted.current && id === account.current) {
      showUser(me);
      await rememberUser(me);
    }
  }, [showUser]);
  // La sesión terminó: se borran del teléfono los datos de la cuenta. Los
  // cambios en espera se conservan y se envían si vuelve a entrar la misma cuenta.
  const expire = useCallback(
    (message: string) => {
      generation.current++;
      account.current++;
      const expired = userRef.current?.id ?? cached<User>(USER_KEY)?.data.id;
      showUser(null);
      setAppointments([]);
      setNotices([]);
      setSavedAt(null);
      setError(message);
      void forgetAccount(expired);
    },
    [showUser],
  );
  // Al volver la conexión (o al entrar): renueva la sesión si hace falta, envía
  // lo hecho sin conexión y todas las pantallas vuelven a pedir sus datos.
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
          await session().catch(() => {});
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
  }, [expire, session]);
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
      const outcome = await refreshSessionStatus();
      if (!mounted.current) return;
      if (outcome === 'ok') {
        if (saved) restartRealtime();
        await session().catch(() => {});
        void sync();
      } else if (outcome === 'denied' && saved) expire('Tu sesión terminó. Inicia sesión de nuevo.');
    })();
    return () => {
      mounted.current = false;
      setExpiryHandler(() => {});
    };
  }, [expire, session, showUser, sync]);
  // `silent`: recarga por un aviso en vivo o por la consulta de respaldo, sin el indicador de carga.
  // Muestra enseguida la copia guardada y la reemplaza con la respuesta; sin conexión, se queda con la copia.
  const load = useCallback(
    async (silent = false) => {
      if (!ready) return;
      const id = ++generation.current;
      let view: {
        key: string | null;
        fetch: () => Promise<unknown>;
        apply: (data: unknown) => void;
        /** Tras un error, lo que no debe quedar a la vista. */
        clear?: () => void;
        /** Sin conexión y sin copia guardada de esta vista. */
        fallback?: () => void;
      } | null = null;
      if (tab === 'directorio') {
        if (doctor) {
          // Los horarios libres solo valen en el momento: sin conexión no se muestran.
          if (doctor.bookingEnabled && /^\d{4}-\d{2}-\d{2}$/.test(date) && net.status === 'online')
            view = {
              key: null,
              fetch: () =>
                request<string[]>(`/appointments/availability?professionalId=${doctor.id}&from=${date}&to=${date}`),
              apply: (data) => setSlots(data as string[]),
              clear: () => setSlots([]),
            };
        } else
          view = {
            key: `pub:directory:${page}:${query}`,
            fetch: () =>
              request<{ items: Doctor[]; totalPages: number }>(
                `/professionals?limit=12&page=${page}&search=${encodeURIComponent(query)}`,
              ),
            apply: (data) => {
              const list = data as { items: Doctor[]; totalPages: number };
              setDoctors(list.items);
              setPages(list.totalPages);
              setLocalResults(false);
            },
            fallback: () => {
              // Sin copia de esta búsqueda: se busca entre los médicos guardados en el teléfono.
              const found = new Map<string, Doctor>();
              for (const [, entry] of store.list('pub:directory:'))
                (entry.data as { items: Doctor[] }).items.forEach((d) => found.set(d.id, d));
              for (const [, entry] of store.list('pub:doctor:'))
                found.set((entry.data as Doctor).id, entry.data as Doctor);
              const wanted = searchable(query);
              setDoctors(
                [...found.values()].filter((d) =>
                  searchable(
                    `${d.firstName} ${d.lastName} ${d.specialties.map((x) => x.specialty.name).join(' ')} ${d.municipality ?? ''}`,
                  ).includes(wanted),
                ),
              );
              setPages(1);
              setLocalResults(true);
            },
          };
      } else if (user && tab === 'citas') {
        const from = dayKey(new Date());
        const to = dayKey(new Date(Date.now() + 30 * 86400000));
        view = {
          key: user.role === 'PROFESSIONAL' ? 'me:agenda' : 'me:appointments',
          fetch: () =>
            request<Appointment[]>(
              user.role === 'PROFESSIONAL' ? `/appointments/me/agenda?from=${from}&to=${to}` : '/appointments/me',
            ),
          apply: (data) => setAppointments(data as Appointment[]),
        };
      } else if (user && tab === 'avisos') {
        view = {
          key: 'me:notices',
          fetch: () => request<{ items: Notice[] }>('/notifications?limit=30'),
          apply: (data) => setNotices((data as { items: Notice[] }).items),
        };
      } else if (user && tab === 'cuenta') {
        // session() guarda la cuenta en el teléfono.
        view = { key: USER_KEY, fetch: async () => void (await session()), apply: () => {} };
      }
      if (!view) {
        // La ficha del médico abierta conserva la fecha de su copia.
        if (!doctor) setSavedAt(null);
        return;
      }
      const shown = view.key ? cached(view.key) : null;
      if (!silent) {
        setLoading(true);
        if (shown) view.apply(shown.data);
      }
      try {
        const data = await view.fetch();
        if (id !== generation.current) return;
        if (view.key && data !== undefined) remember(view.key, data);
        if (data !== undefined) view.apply(data);
        setSavedAt(null);
        setError('');
        setUpdated(new Date());
      } catch (e) {
        if (id !== generation.current) return;
        if (e instanceof OfflineError && shown) {
          view.apply(shown.data);
          setSavedAt(shown.savedAt);
          setError('');
        } else if (e instanceof OfflineError && view.fallback) {
          view.fallback();
          setSavedAt(null);
          setError('');
        } else {
          view.clear?.();
          setSavedAt(null);
          setError(
            e instanceof OfflineError && view.key
              ? `${e.message} Esta sección todavía no tiene datos guardados en el teléfono.`
              : e instanceof Error
                ? e.message
                : 'No hay conexión.',
          );
        }
      } finally {
        if (mounted.current && id === generation.current) setLoading(false);
      }
    },
    [ready, tab, user?.id, user?.role, doctor, date, page, query, session],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // Sincronización en tiempo real con la plataforma: el canal se abre desde el
  // inicio (el directorio es público) y se vuelve a abrir con la sesión al
  // iniciarla o cerrarla. Si la plataforma avisa que la sesión cambió (otra
  // contraseña, «cerrar sesión en todos lados», suspensión), se revisa.
  const userId = user?.id;
  useEffect(() => {
    restartRealtime();
  }, [userId]);
  useEffect(() => {
    setSessionListener(() => void session().catch(() => {}));
    return () => setSessionListener(null);
  }, [session]);
  const live = useRealtimeStatus() === 'live';
  const topics: RealtimeTopic[] =
    tab === 'directorio'
      ? doctor
        ? ['availability']
        : ['directory']
      : tab === 'citas'
        ? ['appointments']
        : tab === 'avisos'
          ? ['notifications']
          : ['account'];
  useRealtimeRefresh(topics, () => load(true));
  useWatchProfessional(tab === 'directorio' ? doctor?.id : null);

  // Sin canal pero con conexión (el canal no pudo abrirse), se consulta cada 30 s y al volver la app
  // al frente. Sin conexión no: se vuelve a probar sola y, al recuperarla, todo se pone al día.
  useEffect(() => {
    if (live || !online) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void load(true);
    }, 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(true);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [load, live, online]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (doctor) {
        setDoctor(null);
        setSlots([]);
        return true;
      }
      if (challenge) {
        setChallenge(null);
        return true;
      }
      if (tab !== 'directorio') {
        setAccountFormOpen(false);
        setTab('directorio');
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [doctor, challenge, tab]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  async function login() {
    await run(async () => {
      const result = await request<{ accessToken?: string; mfaRequired?: boolean; challengeToken?: string }>(
        '/auth/login',
        'POST',
        { email: email.trim(), password },
      );
      if (result.mfaRequired) {
        setChallenge(result.challengeToken!);
        setPassword('');
        return;
      }
      await acceptLogin(result);
      await session();
      void sync();
      setPassword('');
      setTab('citas');
    });
  }
  async function mfa() {
    await run(async () => {
      await acceptLogin(await request('/auth/mfa/verify', 'POST', { challengeToken: challenge, code }));
      await session();
      void sync();
      setChallenge(null);
      setCode('');
      setTab('citas');
    });
  }
  async function openDoctor(d: Doctor) {
    await run(async () => {
      try {
        const opened = await fetchCached<Doctor>(
          `pub:doctor:${d.slug}`,
          `/professionals/${encodeURIComponent(d.slug)}`,
        );
        setDoctor(opened.data);
        setSavedAt(opened.savedAt);
      } catch (e) {
        if (!(e instanceof OfflineError)) throw e;
        // Sin conexión y sin la ficha guardada: lo que ya se ve en el listado.
        setDoctor(d);
        setSavedAt(null);
      }
      setSlots([]);
    });
  }
  const changeTab = (next: Tab) => {
    generation.current++;
    setTab(next);
    setAccountFormOpen(false);
    setError('');
    setDoctor(null);
    setSlots([]);
  };
  function book(startsAt: string) {
    if (!user) {
      changeTab('cuenta');
      return;
    }
    Alert.alert(
      'Confirmar cita',
      `¿Solicitar cita el ${dateLabel(startsAt)}? No se otorgan permisos de datos de salud con esta reserva.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: () =>
            void run(async () => {
              await request('/appointments', 'POST', { professionalId: doctor!.id, startsAt });
              setSlots([]);
              await load();
              Alert.alert('Cita solicitada', 'Puedes consultar el estado en Citas.');
            }),
        },
      ],
    );
  }
  // Cierra la sesión y borra del teléfono los datos de la cuenta (también sin conexión).
  async function signOut() {
    await run(async () => {
      generation.current++;
      account.current++;
      try {
        await logout();
      } catch (e) {
        if (!(e instanceof OfflineError)) throw e;
      } finally {
        await forgetAccount();
        showUser(null);
        setAppointments([]);
        setNotices([]);
        setChallenge(null);
        setSavedAt(null);
      }
    });
  }
  return (
    <SafeAreaView style={s.root} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerContent}>
          <Text style={s.brand}>GUÍA MÉDICA</Text>
          <Text style={s.title}>Monagas</Text>
          <Text style={s.subtitle}>Tu salud, más cerca.</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={s.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={s.body}
          contentContainerStyle={[s.content, { paddingHorizontal: horizontalPadding }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        >
          <SyncBanner
            online={online}
            savedAt={savedAt}
            ops={myOps}
            sending={sending}
            sent={sent}
            status={`${
              loading
                ? 'Consultando la plataforma…'
                : updated
                  ? `Actualizado ${updated.toLocaleTimeString('es-VE')}`
                  : 'Conectando…'
            } · ${live ? 'En vivo con la plataforma' : 'Actualización automática'}`}
            onDiscard={(id) => void discard(id)}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {tab === 'directorio' && !doctor && (
            <>
              <Text style={s.heading}>Encuentra a tu especialista</Text>
              <Text style={s.muted}>Médicos y servicios de tu región.</Text>
              <Field placeholder="Nombre, especialidad o código" value={search} onChangeText={setSearch} />
              <Action
                title="Buscar médicos"
                disabled={busy}
                onPress={() => {
                  setPage(1);
                  setQuery(search.trim());
                }}
              />
              {localResults && (
                <Text style={s.muted}>Sin conexión: resultados entre los médicos guardados en este teléfono.</Text>
              )}
              {doctors.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" onPress={() => void openDoctor(d)} style={s.card}>
                  <View style={s.row}>
                    {d.photoUrl && !brokenPhotos[d.photoUrl] ? (
                      <Image
                        source={{ uri: d.photoUrl }}
                        style={s.avatar}
                        // Sin conexión (o con el enlace vencido) quedan las iniciales.
                        onError={() => setBrokenPhotos((broken) => ({ ...broken, [d.photoUrl!]: true }))}
                      />
                    ) : (
                      <View style={[s.avatar, s.initial]}>
                        <Text style={s.initialText}>
                          {d.firstName[0]}
                          {d.lastName[0]}
                        </Text>
                      </View>
                    )}
                    <View style={s.flex}>
                      <Text style={s.cardTitle}>
                        Dr(a). {d.firstName} {d.lastName}
                      </Text>
                      <Text style={s.muted}>
                        {d.specialties.map((x) => x.specialty.name).join(' · ') || 'Medicina general'}
                      </Text>
                      <Text style={s.muted}>{d.municipality || 'Monagas'}</Text>
                      <Text style={s.badge}>
                        {d.verificationStatus === 'VERIFIED' ? 'Documentación verificada' : 'Verificación en curso'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              {!loading && !doctors.length && (
                <Text style={s.muted}>
                  {localResults
                    ? 'Ningún médico guardado en este teléfono coincide con la búsqueda.'
                    : 'No hay resultados.'}
                </Text>
              )}
              <View style={s.row}>
                <Action title="Anterior" secondary disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
                <Text>
                  {page} / {Math.max(1, pages)}
                </Text>
                <Action title="Siguiente" secondary disabled={page >= pages} onPress={() => setPage((p) => p + 1)} />
              </View>
            </>
          )}
          {tab === 'directorio' && doctor && (
            <>
              <Action
                title="← Volver al directorio"
                secondary
                onPress={() => {
                  setDoctor(null);
                  setSlots([]);
                }}
              />
              <View style={s.card}>
                <Text style={s.heading}>
                  Dr(a). {doctor.firstName} {doctor.lastName}
                </Text>
                <Text style={s.muted}>{doctor.specialties.map((x) => x.specialty.name).join(' · ')}</Text>
                <Text style={s.copy}>{doctor.bio}</Text>
                <Text style={s.muted}>{doctor.municipality}</Text>
              </View>
              {doctor.bookingEnabled && !online ? (
                <>
                  <Text style={s.heading}>Solicitar cita</Text>
                  <Text style={s.muted}>
                    Sin conexión no se pueden pedir citas: el horario se confirma con la agenda del médico en el
                    momento. Vuelve a intentarlo cuando tengas señal.
                  </Text>
                </>
              ) : doctor.bookingEnabled ? (
                <>
                  <Text style={s.heading}>Solicitar cita</Text>
                  <Field placeholder="Fecha AAAA-MM-DD" value={date} onChangeText={setDate} />
                  <Action title="Consultar horarios" secondary onPress={() => void load()} />
                  {slots.map((slot) => (
                    <Action key={slot} title={dateLabel(slot)} disabled={busy} secondary onPress={() => book(slot)} />
                  ))}
                  {!loading && !slots.length && (
                    <Text style={s.muted}>No hay horarios disponibles para esa fecha.</Text>
                  )}
                </>
              ) : (
                <Text style={s.muted}>Este médico no tiene reservas online habilitadas.</Text>
              )}
              {user?.role === 'USER' && (
                <ContactDoctor key={doctor.id} slug={doctor.slug} name={`${doctor.firstName} ${doctor.lastName}`} />
              )}
            </>
          )}
          {(tab === 'citas' || tab === 'avisos') && !user && (
            <>
              <Text style={s.heading}>Tu espacio de salud</Text>
              <Text style={s.copy}>Inicia sesión con la misma cuenta que usas en la web.</Text>
              <Action title="Iniciar sesión" onPress={() => changeTab('cuenta')} />
            </>
          )}
          {tab === 'citas' && user && (
            <>
              <Text style={s.heading}>
                {user.role === 'PROFESSIONAL' ? 'Mi agenda · próximos 30 días' : 'Mis citas'}
              </Text>
              {appointments.map((a) => {
                const waiting = myOps.filter((op) => op.targetId === a.id && !op.error);
                const status = effectiveStatus(a.status, myOps, user.id, a.id);
                return (
                  <View style={s.card} key={a.id}>
                    <Text style={s.cardTitle}>{dateLabel(a.startsAt)}</Text>
                    <Text style={s.copy}>
                      {a.professional
                        ? `Dr(a). ${a.professional.firstName} ${a.professional.lastName}`
                        : a.patient?.name || a.patient?.patientCode || a.patientCode || 'Cita'}
                    </Text>
                    <Text style={s.badge}>{labels[a.status] || a.status}</Text>
                    {waiting.map((op) => (
                      <Text key={op.id} style={s.pending}>
                        En espera de conexión: {op.label}
                      </Text>
                    ))}
                    {!['CANCELED', 'CANCELLED'].includes(status) && (
                      <>
                        {user.role === 'PROFESSIONAL' && (
                          <DoctorAppointmentActions userId={user.id} appointment={a} status={status} onSaved={load} />
                        )}
                        {!['COMPLETED', 'NO_SHOW'].includes(status) && (
                          <Action
                            title="Cancelar cita"
                            secondary
                            disabled={busy}
                            onPress={() =>
                              Alert.alert('Cancelar cita', '¿Quieres cancelar esta cita?', [
                                { text: 'Volver', style: 'cancel' },
                                {
                                  text: 'Cancelar cita',
                                  style: 'destructive',
                                  onPress: () =>
                                    void run(async () => {
                                      const result = await perform(user.id, {
                                        kind: 'appointment-cancel',
                                        method: 'PATCH',
                                        path: `/appointments/${a.id}/cancel`,
                                        body: { cancellationReason: 'Cancelada desde la app' },
                                        targetId: a.id,
                                        label: `Cancelar la cita del ${dateLabel(a.startsAt)}${
                                          a.professional
                                            ? ` con Dr(a). ${a.professional.firstName} ${a.professional.lastName}`
                                            : ''
                                        }`,
                                        checkPath:
                                          user.role === 'PROFESSIONAL'
                                            ? `/appointments/me/${a.id}`
                                            : '/appointments/me',
                                      });
                                      if (result === 'queued')
                                        Alert.alert(
                                          'Guardado sin conexión',
                                          'La cancelación se enviará sola cuando vuelva la conexión. Hasta entonces, el consultorio no la recibe.',
                                        );
                                      else await load();
                                    }),
                                },
                              ])
                            }
                          />
                        )}
                      </>
                    )}
                  </View>
                );
              })}
              {!loading && !appointments.length && <Text style={s.muted}>No tienes citas en este listado.</Text>}
            </>
          )}
          {tab === 'avisos' && user && (
            <>
              <Text style={s.heading}>Tus avisos</Text>
              {notices.map((n) => {
                const reading = pendingFor(myOps, user.id, n.id, ['notification-read']);
                return (
                  <View key={n.id} style={s.card}>
                    <Text style={s.cardTitle}>{n.title}</Text>
                    <Text style={s.copy}>{n.content}</Text>
                    <Text style={s.muted}>{dateLabel(n.createdAt)}</Text>
                    {reading ? (
                      <Text style={s.pending}>Se marcará como leído al volver la conexión.</Text>
                    ) : (
                      !n.isRead && (
                        <Action
                          title="Marcar como leído"
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void run(async () => {
                              const result = await perform(user.id, {
                                kind: 'notification-read',
                                method: 'PATCH',
                                path: `/notifications/${n.id}/read`,
                                targetId: n.id,
                                label: `Marcar como leído el aviso «${n.title}»`,
                              });
                              if (result === 'sent') await load();
                            })
                          }
                        />
                      )
                    )}
                  </View>
                );
              })}
              {!loading && !notices.length && <Text style={s.muted}>No tienes avisos.</Text>}
            </>
          )}
          {tab === 'cuenta' && !user && (
            <>
              <Text style={s.heading}>
                {challenge ? 'Verificar acceso' : accountFormOpen ? 'Tu cuenta' : 'Bienvenido de nuevo'}
              </Text>
              <Text style={s.copy}>Usa tu cuenta de Guía Médica Monagas.</Text>
              {!online && (
                <Text style={s.pending}>Sin conexión: para iniciar sesión o crear una cuenta necesitas internet.</Text>
              )}
              {ops.some((op) => !op.error) && (
                <Text style={s.muted}>
                  Hay cambios hechos sin conexión guardados en este teléfono: se enviarán cuando vuelvas a entrar con la
                  misma cuenta.
                </Text>
              )}
              {challenge ? (
                <>
                  <Field placeholder="Código recibido por correo" value={code} onChangeText={setCode} />
                  <Action title="Verificar código" disabled={busy || !online} onPress={() => void mfa()} />
                  <Action title="Volver" secondary onPress={() => setChallenge(null)} />
                </>
              ) : (
                <>
                  {!accountFormOpen && (
                    <>
                      <Field placeholder="Correo electrónico" value={email} onChangeText={setEmail} />
                      <Field placeholder="Contraseña" value={password} onChangeText={setPassword} secret />
                      <Action
                        title={busy ? 'Ingresando…' : 'Entrar'}
                        disabled={busy || !email || !password || !online}
                        onPress={() => void login()}
                      />
                    </>
                  )}
                  <AccountForms
                    onModeChange={setAccountFormOpen}
                    onLogin={async () => {
                      await session();
                      void sync();
                      setTab('citas');
                    }}
                  />
                </>
              )}
            </>
          )}
          {tab === 'cuenta' && user && (
            <>
              <Text style={s.heading}>Mi cuenta</Text>
              <View style={s.card}>
                <Text style={s.cardTitle}>{user.email}</Text>
                <Text style={s.copy}>
                  {user.role === 'PROFESSIONAL' ? 'Médico' : user.role === 'USER' ? 'Paciente' : 'Cuenta de plataforma'}
                </Text>
                <Text style={s.muted}>
                  {user.isEmailVerified ? 'Correo verificado' : 'Verifica tu correo para completar tu acceso.'}
                </Text>
                {user.needsLegalAcceptance && (
                  <Text style={s.error}>Debes revisar y aceptar los textos legales vigentes en la plataforma.</Text>
                )}
              </View>
              <SecuritySettings />
              {user.role === 'USER' && (
                <>
                  <PatientAccount email={user.email} userId={user.id} />
                  <ContactRequests userId={user.id} />
                </>
              )}
              <Action
                title="Gestionar mi perfil en la web"
                secondary
                onPress={() =>
                  void Linking.openURL(`${SITE_URL}/${user.role === 'PROFESSIONAL' ? 'dashboard/perfil' : 'paciente'}`)
                }
              />
              <Action
                title="Privacidad y gestión de datos"
                secondary
                onPress={() => void Linking.openURL(`${SITE_URL}/privacidad`)}
              />
              <Action
                title="Solicitar eliminación de cuenta"
                secondary
                onPress={() => void Linking.openURL(`${SITE_URL}/reclamos?tipo=ACCOUNT_DELETION`)}
              />
              <Action
                title="Cerrar sesión"
                disabled={busy}
                onPress={() => {
                  const waiting = myOps.filter((op) => !op.error).length;
                  if (!waiting) return void signOut();
                  Alert.alert(
                    'Cambios sin enviar',
                    waiting === 1
                      ? 'Hay 1 cambio que hiciste sin conexión y todavía no llegó a la plataforma. Si cierras sesión, se descarta.'
                      : `Hay ${waiting} cambios que hiciste sin conexión y todavía no llegaron a la plataforma. Si cierras sesión, se descartan.`,
                    [
                      { text: 'Volver', style: 'cancel' },
                      { text: 'Cerrar sesión y descartar', style: 'destructive', onPress: () => void signOut() },
                    ],
                  );
                }}
              />
            </>
          )}
          {busy && <ActivityIndicator color="#125545" />}
          <Text style={s.footer}>Guía Médica Monagas · Datos de la plataforma oficial</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={s.tabs}>
        {(['directorio', 'citas', 'avisos', 'cuenta'] as Tab[]).map((t) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            key={t}
            onPress={() => changeTab(t)}
            style={s.tab}
          >
            <Text style={[s.tabText, tab === t && s.active]}>
              {{ directorio: 'Médicos', citas: 'Citas', avisos: 'Avisos', cuenta: 'Cuenta' }[t]}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8f5' },
  header: { backgroundColor: '#125545' },
  headerContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  brand: { color: '#b8dacb', fontSize: 12, letterSpacing: 3, fontWeight: '700' },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4 },
  subtitle: { color: '#d1e5db', marginTop: 6 },
  body: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 35, gap: 12 },
  heading: { fontSize: 24, color: '#153f34', fontWeight: '700' },
  muted: { fontSize: 14, color: '#60746e', lineHeight: 21 },
  copy: { fontSize: 15, color: '#293f37', lineHeight: 23, marginVertical: 8 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e0e8df', gap: 6 },
  cardTitle: { flexShrink: 1, fontSize: 17, color: '#193e33', fontWeight: '600' },
  row: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  flex: { flex: 1, minWidth: 150 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  initial: { backgroundColor: '#e0eee5', alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 18, color: '#125545', fontWeight: '700' },
  badge: { color: '#236d53', fontSize: 12, marginTop: 7 },
  pending: { color: '#5f4510', backgroundColor: '#fff6e0', padding: 10, borderRadius: 10, lineHeight: 20 },
  input: {
    minHeight: 48,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cddad1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#193e33',
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#125545',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  secondary: { backgroundColor: '#e7eee7' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { color: '#9b2929', backgroundColor: '#ffeded', padding: 13, borderRadius: 10 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dce7dc',
    paddingBottom: 0,
    paddingTop: 8,
  },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', paddingVertical: 12, alignItems: 'center' },
  tabText: { color: '#6a7b73', fontWeight: '600' },
  active: { color: '#125545' },
  footer: { fontSize: 11, textAlign: 'center', color: '#819087', marginTop: 15 },
});
