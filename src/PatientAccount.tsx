import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { request } from './api';
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
export function PatientAccount({ email }: { email: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletionName, setDeletionName] = useState('');
  const [description, setDescription] = useState('');
  const editing = useRef(false);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current || AppState.currentState !== 'active') return;
    pending.current = true;
    try {
      const [p, g] = await Promise.all([request<Profile>('/patients/me'), request<Grant[]>('/patients/me/grants')]);
      setProfile(p);
      // Lo que se está escribiendo no se pisa.
      if (!editing.current) {
        setPhone(p.phone || '');
        setMunicipality(p.municipality || '');
      }
      setDeletionName((previous) => previous || `${p.firstName} ${p.lastName}`);
      setGrants(
        g.filter((grant) => !grant.revokedAt && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > Date.now())),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      pending.current = false;
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [email, refresh]);
  // Si la ficha se edita en la web o un médico gana o pierde acceso, se ve aquí al instante.
  useRealtimeRefresh(['patientProfile', 'access'], refresh);
  // Sin canal (sin señal o con el canal apagado), se consulta cada 30 s y al volver la app al frente.
  const live = useRealtimeStatus() === 'live';
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => void refresh(), 30000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [live, refresh]);
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
  const button = (title: string, action: () => void) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={s.button}>
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
      {button('Guardar datos de contacto', () => {
        void run(async () => {
          const p = await request<Profile>('/patients/me', 'PATCH', {
            ...(phone.trim() ? { phone: phone.trim() } : {}),
            municipality: municipality.trim(),
          });
          setProfile(p);
          editing.current = false;
          setPhone(p.phone || '');
          setMunicipality(p.municipality || '');
          Alert.alert('Perfil actualizado', 'Los datos se guardaron en la plataforma.');
        });
      })}
      <Text style={s.heading}>Accesos a mis datos</Text>
      {!grants.length && <Text>No hay permisos en este listado.</Text>}
      {grants.map((g) => (
        <View key={g.id} style={s.panel}>
          <Text>
            {g.professional
              ? `Dr(a). ${g.professional.firstName} ${g.professional.lastName}`
              : 'Profesional autorizado'}
          </Text>
          <Text>{g.scopes?.join(' · ')}</Text>
          {button('Revocar permiso', () =>
            Alert.alert('Revocar acceso', 'Este profesional dejará de tener este permiso sobre tus datos.', [
              { text: 'Volver', style: 'cancel' },
              {
                text: 'Revocar',
                style: 'destructive',
                onPress: () => {
                  void run(async () => {
                    await request(`/patients/me/grants/${g.id}`, 'DELETE');
                    setGrants(
                      (await request<Grant[]>('/patients/me/grants')).filter(
                        (grant) =>
                          !grant.revokedAt && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > Date.now()),
                      ),
                    );
                  });
                },
              },
            ]),
          )}
        </View>
      ))}
      <Text style={s.heading}>Eliminar mi cuenta</Text>
      <Text>La solicitud se envía al equipo de la plataforma. No borra tu cuenta inmediatamente.</Text>
      {field('Nombre del solicitante', deletionName, setDeletionName)}
      {field('Describe tu solicitud, mínimo 20 caracteres', description, setDescription)}
      {button('Solicitar eliminación', () =>
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
  error: { color: '#9b2929' },
});
