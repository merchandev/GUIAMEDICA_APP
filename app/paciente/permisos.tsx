import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { request } from '../../src/api';
import { useApi, useAction } from '../../src/data';
import { formatDate } from '../../src/dates';
import { PATIENT_CONSENT_VERSION, SCOPE_LABEL, SCOPES, type Scope } from '../../src/legal';
import { openLegal } from '../../src/nav';
import { pendingFor, perform } from '../../src/offline';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Check,
  Empty,
  ErrorText,
  Loading,
  Muted,
  Notice,
  Screen,
  Section,
  Select,
  Title,
} from '../../src/ui';

interface Professional {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
}

interface Grant {
  id: string;
  scopes: Scope[];
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  reason: string | null;
  professional: Professional;
}

const DURATIONS = [
  { value: '1', label: '1 día' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
];

function grantState(grant: Grant): { label: string; tone: 'success' | 'neutral' | 'danger' } {
  if (grant.revokedAt) return { label: 'Revocada', tone: 'danger' };
  if (new Date(grant.expiresAt) <= new Date()) return { label: 'Vencida', tone: 'neutral' };
  return { label: 'Vigente', tone: 'success' };
}

/**
 * Qué médico ve qué datos y hasta cuándo (como «Permisos» en la web).
 * Revocar funciona también sin conexión: se envía sola al volver la señal.
 */
export default function PermissionsScreen() {
  const { user, online, myOps } = useSession();
  const grants = useApi<Grant[]>(user ? '/patients/me/grants' : null, { cacheKey: 'me:grants', topics: ['access'] });
  const professionals = useApi<Professional[]>(user ? '/patients/me/professionals' : null, {
    cacheKey: 'me:my-professionals',
    topics: ['access', 'appointments'],
  });
  const [professionalId, setProfessionalId] = useState('');
  const [scopes, setScopes] = useState<Scope[]>(['IDENTITY']);
  const [days, setDays] = useState('30');
  const [message, setMessage] = useState<string | null>(null);
  const grant = useAction();
  const revoke = useAction();
  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;

  const authorize = () =>
    grant.run(async () => {
      setMessage(null);
      await request('/patients/me/grants', 'POST', { professionalId, scopes, durationDays: Number(days) });
      setMessage('Autorización guardada. Puedes revocarla cuando quieras.');
      changedLocally('access');
      await grants.reload();
    });

  const revokeGrant = (g: Grant) => {
    const name = `Dr(a). ${g.professional.firstName} ${g.professional.lastName}`;
    Alert.alert('Revocar autorización', `${name} dejará de ver estos datos.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Revocar',
        style: 'destructive',
        onPress: () =>
          void revoke.run(async () => {
            setMessage(null);
            const result = await perform(user.id, {
              kind: 'grant-revoke',
              method: 'DELETE',
              path: `/patients/me/grants/${g.id}`,
              targetId: g.id,
              label: `Revocar el permiso de ${name}`,
            });
            if (result === 'queued')
              Alert.alert(
                'Guardado sin conexión',
                'La revocación se enviará sola cuando vuelva la conexión. Hasta entonces, el médico mantiene este permiso.',
              );
            else {
              setMessage('Autorización revocada: el médico ya no puede ver esos datos.');
              await grants.reload();
            }
          }),
      },
    ]);
  };

  const list = grants.data ?? [];
  const doctors = professionals.data ?? [];
  return (
    <Screen refreshing={grants.refreshing} onRefresh={grants.refresh} savedAt={grants.savedAt}>
      <Stack.Screen options={{ title: 'Permisos' }} />
      <Title>Permisos sobre mis datos</Title>
      <Body>
        Tú decides qué médico ve qué datos y por cuánto tiempo. Sin autorización, un médico solo ve tu código de
        paciente. Cada vez que un médico consulta tus datos, queda registrado.
      </Body>
      {!!message && <Notice tone="success">{message}</Notice>}
      <ErrorText message={grants.error ?? revoke.error} />

      <Section title="Autorizar a un médico">
        <Card>
          {doctors.length === 0 ? (
            <Muted>
              Aquí aparecerán los médicos con los que tengas o hayas tenido citas. También puedes autorizar al reservar
              una cita o entregando tu código.
            </Muted>
          ) : (
            <>
              <Select
                label="Médico"
                value={professionalId}
                onChange={setProfessionalId}
                options={[
                  { value: '', label: 'Selecciona un médico' },
                  ...doctors.map((p) => ({ value: p.id, label: `Dr(a). ${p.firstName} ${p.lastName}` })),
                ]}
              />
              <Select label="Durante" value={days} onChange={setDays} options={DURATIONS} />
              {SCOPES.map((scope) => (
                <Check
                  key={scope.value}
                  label={scope.label}
                  description={scope.description}
                  value={scopes.includes(scope.value)}
                  onValueChange={(on) =>
                    setScopes((current) => (on ? [...current, scope.value] : current.filter((x) => x !== scope.value)))
                  }
                />
              ))}
              <Muted>
                Tu cédula nunca se comparte. Una nueva autorización al mismo médico reemplaza la anterior. Al autorizar
                aceptas la Autorización de acceso médico (v{PATIENT_CONSENT_VERSION}).
              </Muted>
              <Button
                title="Leer la autorización"
                variant="ghost"
                small
                onPress={() => openLegal('/privacidad/autorizacion-medica')}
              />
              {!online && <Notice tone="warning">Sin conexión: para autorizar necesitas internet.</Notice>}
              <ErrorText message={grant.error} />
              <Button
                title="Autorizar"
                loading={grant.busy}
                disabled={!online || !professionalId || scopes.length === 0}
                onPress={() => void authorize()}
              />
            </>
          )}
        </Card>
      </Section>

      <Section title="Historial de autorizaciones">
        {grants.loading && !grants.data ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty title="No has autorizado a ningún médico" description="Ningún médico puede ver tus datos." />
        ) : (
          list.map((g) => {
            const state = grantState(g);
            const revoking = pendingFor(myOps, user.id, g.id, ['grant-revoke']);
            return (
              <Card key={g.id}>
                <Body>
                  Dr(a). {g.professional.firstName} {g.professional.lastName}
                </Body>
                <Badge label={state.label} tone={state.tone} />
                <Muted>{g.scopes.map((x) => SCOPE_LABEL[x] ?? x).join(' · ')}</Muted>
                <Muted>
                  Desde {formatDate(g.grantedAt, 'medium')} hasta {formatDate(g.revokedAt ?? g.expiresAt, 'medium')}
                </Muted>
                {!!g.reason && <Muted>Motivo: {g.reason}</Muted>}
                {revoking ? (
                  <Notice tone="warning">
                    Revocación en espera de conexión. Hasta que se envíe, el médico mantiene este permiso.
                  </Notice>
                ) : (
                  state.label === 'Vigente' && (
                    <Button
                      title="Revocar"
                      variant="secondary"
                      small
                      disabled={revoke.busy}
                      onPress={() => revokeGrant(g)}
                    />
                  )
                )}
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}
