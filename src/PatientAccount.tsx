import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { OfflineError, request } from './api';
import { sentence } from './contracts';
import { cached, discard, fetchCached, pendingFor, perform, store, useOnline, usePendingOps } from './offline';
import { useRealtimeRefresh, useRealtimeStatus } from './realtime';
type Profile = {
  firstName: string;
  lastName: string;
  phone?: string | null;
  municipality?: string | null;
  patientCode?: string;
};
type Grant = {
  id: string;
  professional?: { firstName: string; lastName: string };
  scopes?: string[];
  revokedAt?: string | null;
  expiresAt?: string;
};
const activeGrants = (grants: Grant[]) =>
  grants.filter((grant) => !grant.revokedAt && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > Date.now()));
/** Lo escrito sin conexión en la ficha: lo que espera enviarse o, si no, lo último rechazado. */
const draftOf = (userId: string) => {
  const mine = store.ops.filter((op) => op.userId === userId && op.kind === 'patient-profile');
  return (mine.find((op) => !op.error) ?? [...mine].reverse().find((op) => op.error))?.body;
};
const professionalName = (g: Grant) =>
  g.professional ? `Dr(a). ${g.professional.firstName} ${g.professional.lastName}` : 'Profesional autorizado';
export function PatientAccount({ email, userId }: { email: string; userId: string }) {
  const online = useOnline();
  const ops = usePendingOps();
  // Lo guardado en el teléfono se ve enseguida (también sin conexión). Lo escrito sin conexión sigue en el
  // formulario mientras espera enviarse o, si la plataforma lo rechazó, hasta corregirlo o descartarlo.
  const saved = () => cached<Profile>('me:patient-basic')?.data ?? null;
  const [profile, setProfile] = useState<Profile | null>(saved);
  const [phone, setPhone] = useState(() => String(draftOf(userId)?.phone ?? saved()?.phone ?? ''));
  const [municipality, setMunicipality] = useState(() =>
    String(draftOf(userId)?.municipality ?? saved()?.municipality ?? ''),
  );
  const [grants, setGrants] = useState<Grant[]>(() => activeGrants(cached<Grant[]>('me:grants')?.data ?? []));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletionName, setDeletionName] = useState(() => {
    const p = saved();
    return p ? `${p.firstName} ${p.lastName}` : '';
  });
  const [description, setDescription] = useState('');
  const editing = useRef(false);
  const pending = useRef(false);
  const profileOp = ops.find((op) => op.userId === userId && op.kind === 'patient-profile' && !op.error);
  const rejected = ops.find((op) => op.userId === userId && op.kind === 'patient-profile' && op.error);
  const showProfile = useCallback(
    (p: Profile) => {
      setProfile(p);
      // Lo que se está escribiendo no se pisa.
      if (!editing.current) {
        const draft = draftOf(userId);
        setPhone(String(draft?.phone ?? p.phone ?? ''));
        setMunicipality(String(draft?.municipality ?? p.municipality ?? ''));
      }
      setDeletionName((previous) => previous || `${p.firstName} ${p.lastName}`);
    },
    [userId],
  );
  // Al enviarse o descartarse lo escrito sin conexión, el formulario vuelve a los datos de la plataforma.
  const draftId = (profileOp ?? rejected)?.id;
  useEffect(() => {
    if (profile) showProfile(profile);
  }, [draftId, profile, showProfile]);
  const refresh = useCallback(async () => {
    if (pending.current || AppState.currentState !== 'active') return;
    pending.current = true;
    try {
      const [p, g] = await Promise.all([
        // Solo nombre, código, teléfono y municipio: los datos de salud no llegan a la app.
        fetchCached<Profile>('me:patient-basic', '/patients/me/basic'),
        fetchCached<Grant[]>('me:grants', '/patients/me/grants'),
      ]);
      showProfile(p.data);
      setGrants(activeGrants(g.data));
      setError('');
    } catch (e) {
      setError(
        e instanceof OfflineError
          ? 'Sin conexión: tu ficha todavía no está guardada en este teléfono.'
          : e instanceof Error
            ? e.message
            : 'No se pudo actualizar.',
      );
    } finally {
      pending.current = false;
    }
  }, [showProfile]);
  useEffect(() => {
    void refresh();
  }, [email, refresh]);
  // Si la ficha se edita en la web o un médico gana o pierde acceso, se ve aquí al instante.
  useRealtimeRefresh(['patientProfile', 'access'], refresh);
  // Sin canal pero con conexión, se consulta cada 30 s y al volver la app al frente.
  const live = useRealtimeStatus() === 'live';
  useEffect(() => {
    if (live || !online) return;
    const timer = setInterval(() => void refresh(), 30000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [live, online, refresh]);
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
  const button = (title: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={[s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
  const field = (label: string, value: string, setter: (v: string) => void) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor="#60746e"
      value={value}
      onChangeText={setter}
      style={s.input}
    />
  );
  return (
    <View style={s.panel}>
      <Text style={s.heading}>Mi perfil de paciente</Text>
      {profile && (
        <Text>
          {profile.firstName} {profile.lastName}
          {profile.patientCode ? ` · ${profile.patientCode}` : ''}
        </Text>
      )}
      {field('Teléfono, ejemplo 0414-1234567', phone, (v) => {
        editing.current = true;
        setPhone(v);
      })}
      {field('Municipio', municipality, (v) => {
        editing.current = true;
        setMunicipality(v);
      })}
      {profileOp && <Text style={s.pending}>Cambios guardados en el teléfono: se enviarán al volver la conexión.</Text>}
      {!profileOp && rejected && (
        <Text style={s.rejected}>
          La plataforma no aceptó estos datos: {sentence(rejected.error ?? '')} Corrígelos y vuelve a guardar.
        </Text>
      )}
      {button('Guardar datos de contacto', () => {
        void run(async () => {
          // Solo lo que cambió: si mientras tanto se editó otro dato en la web, no se pisa.
          const body: Record<string, string> = {};
          if (phone.trim() && phone.trim() !== (profile?.phone ?? '')) body.phone = phone.trim();
          if (municipality.trim() !== (profile?.municipality ?? '')) body.municipality = municipality.trim();
          editing.current = false;
          // Guardar de nuevo reemplaza lo que la plataforma había rechazado.
          if (rejected) await discard(rejected.id);
          if (!Object.keys(body).length && !profileOp) {
            Alert.alert('Sin cambios', 'Tus datos de contacto ya están así en la plataforma.');
            return;
          }
          const result = await perform(userId, {
            kind: 'patient-profile',
            method: 'PATCH',
            path: '/patients/me/basic',
            body,
            label: 'Actualizar tus datos de contacto',
          });
          if (result === 'queued') {
            Alert.alert('Guardado sin conexión', 'Tus datos se enviarán solos cuando vuelva la conexión.');
            return;
          }
          await refresh();
          Alert.alert('Perfil actualizado', 'Los datos se guardaron en la plataforma.');
        });
      })}
      <Text style={s.heading}>Accesos a mis datos</Text>
      {!grants.length && <Text>No hay permisos en este listado.</Text>}
      {grants.map((g) => {
        const revoking = pendingFor(ops, userId, g.id, ['grant-revoke']);
        return (
          <View key={g.id} style={s.panel}>
            <Text>{professionalName(g)}</Text>
            <Text>{g.scopes?.join(' · ')}</Text>
            {revoking ? (
              <Text style={s.pending}>
                Revocación en espera de conexión. Hasta que se envíe, el profesional mantiene este permiso.
              </Text>
            ) : (
              button('Revocar permiso', () =>
                Alert.alert('Revocar acceso', 'Este profesional dejará de tener este permiso sobre tus datos.', [
                  { text: 'Volver', style: 'cancel' },
                  {
                    text: 'Revocar',
                    style: 'destructive',
                    onPress: () => {
                      void run(async () => {
                        const result = await perform(userId, {
                          kind: 'grant-revoke',
                          method: 'DELETE',
                          path: `/patients/me/grants/${g.id}`,
                          targetId: g.id,
                          label: `Revocar el permiso de ${professionalName(g)}`,
                        });
                        if (result === 'queued')
                          Alert.alert(
                            'Guardado sin conexión',
                            'La revocación se enviará sola cuando vuelva la conexión. Hasta entonces, el profesional mantiene este permiso.',
                          );
                        else await refresh();
                      });
                    },
                  },
                ]),
              )
            )}
          </View>
        );
      })}
      <Text style={s.heading}>Eliminar mi cuenta</Text>
      <Text>La solicitud se envía al equipo de la plataforma. No borra tu cuenta inmediatamente.</Text>
      {field('Nombre del solicitante', deletionName, setDeletionName)}
      {field('Describe tu solicitud, mínimo 20 caracteres', description, setDescription)}
      {!online && (
        <Text style={s.pending}>Sin conexión: la solicitud necesita internet para enviarse y recibir su número.</Text>
      )}
      {button(
        'Solicitar eliminación',
        () =>
          Alert.alert('Solicitar eliminación de cuenta', '¿Quieres enviar esta solicitud al equipo?', [
            { text: 'Volver', style: 'cancel' },
            {
              text: 'Enviar solicitud',
              style: 'destructive',
              onPress: () => {
                void run(async () => {
                  if (deletionName.trim().length < 3 || description.trim().length < 20)
                    throw new Error('Completa tu nombre y la descripción de al menos 20 caracteres.');
                  const result = await request<{ ticket?: string }>('/legal-requests/me', 'POST', {
                    category: 'ACCOUNT_DELETION',
                    requesterName: deletionName.trim(),
                    description: description.trim(),
                  });
                  setDescription('');
                  Alert.alert(
                    'Solicitud enviada',
                    result.ticket ? `Número de seguimiento: ${result.ticket}` : 'Consulta su estado en la plataforma.',
                  );
                });
              },
            },
          ]),
        !online,
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  panel: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  heading: { fontSize: 18, color: '#125545', fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cddad1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#193e33',
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#e7eee7',
  },
  buttonText: { color: '#125545', fontWeight: '600' },
  pending: { color: '#5f4510', backgroundColor: '#fff6e0', padding: 10, borderRadius: 10, lineHeight: 20 },
  rejected: { color: '#9b2929', backgroundColor: '#ffeded', padding: 10, borderRadius: 10, lineHeight: 20 },
  error: { color: '#9b2929' },
});
