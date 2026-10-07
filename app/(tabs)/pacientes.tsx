import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { request } from '../../src/api';
import { useApi, useAction } from '../../src/data';
import { formatDate } from '../../src/dates';
import { SCOPE_LABEL, type Scope } from '../../src/legal';
import { patientCodeFrom } from '../../src/links';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  Heading,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
} from '../../src/ui';

interface PatientListItem {
  patientId: string;
  patientCode: string;
  appointmentCount: number;
  lastVisit: string | null;
  registeredAt: string | null;
  registered: boolean;
  hasAccount: boolean;
  createdByMe: boolean;
  identity: { firstName: string | null; lastName: string | null } | null;
  access: { kind: 'NONE' | 'GRANT' | 'WALK_IN'; scopes: Scope[]; expiresAt: string | null };
}

interface PatientData {
  patientCode: string;
  scopes: Scope[];
  expiresAt: string | null;
  identity: { firstName: string | null; lastName: string | null; identityVerified?: boolean } | null;
  contact: { phone: string | null; emergencyMedicalPhone: string | null; emergencyAddress: string | null } | null;
  health: {
    birthDate: string | null;
    sex: string | null;
    bloodType: string | null;
    allergies: string | null;
    isHealthy: boolean;
    conditionSummary: string | null;
    medications: { name: string; schedule: string }[];
    treatingDoctors: string[];
  } | null;
}

const fullName = (identity: PatientListItem['identity']) =>
  identity ? `${identity.firstName ?? ''} ${identity.lastName ?? ''}`.trim() : '';
const ALL_SCOPES: Scope[] = ['IDENTITY', 'CONTACT', 'HEALTH'];

/**
 * Pacientes del médico (como en la web): registrar con el código o el QR,
 * ver lo que cada uno autorizó y pedir acceso. La lista se guarda en el
 * teléfono para verla sin conexión; los datos de cada paciente (contacto y
 * salud) solo se piden con conexión y no se guardan.
 */
export default function PatientsScreen() {
  const { codigo } = useLocalSearchParams<{ codigo?: string }>();
  const { user, online } = useSession();
  const doctor = user?.role === 'PROFESSIONAL';
  const list = useApi<PatientListItem[]>(doctor ? '/appointments/me/patients' : null, {
    cacheKey: 'me:patients',
    topics: ['access', 'appointments'],
  });
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, PatientData>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const register = useAction();
  const action = useAction();

  // Código leído con el escáner: queda escrito para confirmarlo.
  useEffect(() => {
    if (codigo) setCode(codigo);
  }, [codigo]);

  if (!user) return <Redirect href="/cuenta" />;
  if (!doctor) return <Redirect href="/" />;
  const locked = !!list.error && /plan/i.test(list.error) && !list.data;

  const submit = () =>
    register.run(async () => {
      setNotice(null);
      const normalized = patientCodeFrom(code);
      if (!normalized) throw new Error('El código tiene 12 letras y números, por ejemplo K7Q4-M9TX-P3WD.');
      const result = await request<{ scopes: Scope[] }>('/appointments/me/patients/register', 'POST', {
        code: normalized,
      });
      setNotice(
        `Paciente registrado. Puedes ver: ${result.scopes.map((x) => (SCOPE_LABEL[x] ?? x).toLowerCase()).join(', ')}. El paciente recibió un aviso.`,
      );
      setCode('');
      router.setParams({ codigo: undefined });
      changedLocally('access');
      await list.reload();
    });

  const read = (patientId: string) =>
    action.run(async () => {
      setNotice(null);
      setBusyId(patientId);
      try {
        const result = await request<PatientData>(`/appointments/me/patients/${patientId}/data`, 'POST');
        setShown((prev) => ({ ...prev, [patientId]: result }));
      } finally {
        setBusyId(null);
      }
    });

  const askAccess = (patientId: string) =>
    action.run(async () => {
      setNotice(null);
      setBusyId(patientId);
      try {
        await request(`/appointments/me/patients/${patientId}/access-request`, 'POST', { scopes: ALL_SCOPES });
        setNotice('Solicitud enviada. El paciente decide qué compartir y por cuánto tiempo.');
      } finally {
        setBusyId(null);
      }
    });

  const remove = (p: PatientListItem) =>
    Alert.alert(
      '¿Quitar de tu directorio?',
      `Dejarás de ver los datos de ${fullName(p.identity) || p.patientCode}. Para volver a registrarlo necesitarás que el paciente te entregue su código otra vez.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar paciente',
          style: 'destructive',
          onPress: () =>
            void action.run(async () => {
              await request(`/appointments/me/patients/${p.patientId}`, 'DELETE');
              setShown((prev) => {
                const { [p.patientId]: _removed, ...rest } = prev;
                return rest;
              });
              setNotice('Paciente quitado de tu directorio. Ya no ves sus datos.');
              changedLocally('access');
              await list.reload();
            }),
        },
      ],
    );

  if (locked)
    return (
      <Screen>
        <Notice tone="warning" title="El directorio de pacientes no está disponible con tu plan actual">
          Registrar pacientes con su código está disponible desde el plan Profesional.
        </Notice>
      </Screen>
    );

  const patients = list.data ?? [];
  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh} savedAt={list.savedAt}>
      <Body>
        Registra a tus pacientes con el código o el QR que te entreguen. Solo ves los datos que cada paciente autoriza,
        durante el tiempo que elija; cada consulta queda registrada. Usa estos datos únicamente para su atención.
      </Body>
      <Card>
        <Heading>Registrar paciente</Heading>
        <Muted>Pídele al paciente su código de 12 caracteres (en su cuenta, «Mi código») o escanea su QR.</Muted>
        <Field
          label="Código del paciente"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="K7Q4-M9TX-P3WD"
          autoCapitalize="characters"
          maxLength={80}
        />
        <ErrorText message={register.error} />
        <Row>
          <Button
            title="Registrar paciente"
            loading={register.busy}
            disabled={!online || !patientCodeFrom(code)}
            onPress={() => void submit()}
          />
          <Button title="Escanear QR" variant="secondary" onPress={() => router.push('/panel/escanear')} />
        </Row>
      </Card>
      {!!notice && <Notice tone="success">{notice}</Notice>}
      <ErrorText message={action.error ?? (locked ? null : list.error)} />
      {list.loading && !list.data ? (
        <Loading />
      ) : patients.length === 0 ? (
        <Empty
          title="Todavía no tienes pacientes"
          description="Aparecerán aquí cuando los registres con su código o cuando tengan una cita contigo."
        />
      ) : (
        <Section title={`${patients.length} ${patients.length === 1 ? 'paciente' : 'pacientes'}`}>
          {patients.map((p) => {
            const data = shown[p.patientId];
            const name = fullName(p.identity);
            const canRead = p.access.kind !== 'NONE';
            const facts = [
              p.registeredAt && `Registrado con su código el ${formatDate(p.registeredAt, 'medium')}`,
              p.appointmentCount > 0 &&
                `${p.appointmentCount} ${p.appointmentCount === 1 ? 'cita' : 'citas'}${p.lastVisit ? ` · Última: ${formatDate(p.lastVisit, 'medium')}` : ''}`,
              p.access.expiresAt && `Autorización hasta ${formatDate(p.access.expiresAt, 'medium')}`,
            ].filter(Boolean);
            return (
              <Card key={p.patientId}>
                <Body>{name || p.patientCode}</Body>
                <Row>
                  {!!name && <Badge label={p.patientCode} tone="neutral" />}
                  {p.access.kind === 'GRANT' && (
                    <Badge
                      label={`Autorizado: ${p.access.scopes.map((x) => SCOPE_LABEL[x] ?? x).join(', ')}`}
                      tone="success"
                    />
                  )}
                  {p.access.kind === 'WALK_IN' && <Badge label="Ficha registrada por ti" tone="neutral" />}
                  {p.access.kind === 'NONE' && <Badge label="Sin autorización" tone="warning" />}
                </Row>
                {facts.length > 0 && <Muted>{facts.join(' · ')}</Muted>}
                {data && (
                  <View style={{ gap: 8 }}>
                    {data.identity && (
                      <>
                        <KeyValue
                          label="Nombre"
                          value={`${data.identity.firstName ?? ''} ${data.identity.lastName ?? ''}`.trim()}
                        />
                        {data.identity.identityVerified && (
                          <Muted>✓ Identidad verificada por Guía Médica Monagas</Muted>
                        )}
                      </>
                    )}
                    {data.contact && (
                      <>
                        <KeyValue label="Teléfono" value={data.contact.phone} />
                        <KeyValue label="Emergencia" value={data.contact.emergencyMedicalPhone} />
                        <KeyValue label="Dirección de emergencia" value={data.contact.emergencyAddress} />
                      </>
                    )}
                    {data.health && (
                      <>
                        <KeyValue label="Nacimiento" value={data.health.birthDate} />
                        <KeyValue label="Sexo" value={data.health.sex} />
                        <KeyValue label="Grupo sanguíneo" value={data.health.bloodType} />
                        <KeyValue label="Alergias" value={data.health.allergies} />
                        <KeyValue
                          label="Condición"
                          value={data.health.isHealthy ? 'Persona sana' : data.health.conditionSummary}
                        />
                        <KeyValue
                          label="Medicamentos"
                          value={data.health.medications.map((m) => `${m.name} (${m.schedule})`).join(', ')}
                        />
                        <KeyValue label="Médicos tratantes" value={data.health.treatingDoctors.join(', ')} />
                      </>
                    )}
                    <Button
                      title="Ocultar datos"
                      variant="ghost"
                      small
                      onPress={() =>
                        setShown((prev) => {
                          const { [p.patientId]: _hidden, ...rest } = prev;
                          return rest;
                        })
                      }
                    />
                  </View>
                )}
                <Row>
                  {canRead
                    ? !data && (
                        <Button
                          title="Ver datos autorizados"
                          variant="secondary"
                          small
                          loading={busyId === p.patientId}
                          disabled={!online}
                          onPress={() => void read(p.patientId)}
                        />
                      )
                    : p.hasAccount && (
                        <Button
                          title="Solicitar acceso"
                          variant="secondary"
                          small
                          loading={busyId === p.patientId}
                          disabled={!online}
                          onPress={() => void askAccess(p.patientId)}
                        />
                      )}
                  <Button
                    title="Sus citas"
                    variant="ghost"
                    small
                    onPress={() =>
                      router.push({
                        pathname: '/panel/historial',
                        params: { paciente: p.patientId, nombre: name || p.patientCode },
                      })
                    }
                  />
                  {p.registered && (
                    <Button title="Quitar" variant="ghost" small disabled={!online} onPress={() => remove(p)} />
                  )}
                </Row>
              </Card>
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
