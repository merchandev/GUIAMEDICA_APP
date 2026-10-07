import React, { useState } from 'react';
import { Redirect, router, Stack } from 'expo-router';
import { useApi, useAction } from '../../src/data';
import { capitalizeFirst, caracasDateKey, formatDate, formatDateTime } from '../../src/dates';
import { PATIENT_AREA_NOTICE, REQUEST_CATEGORIES, REQUEST_STATUS, SCOPE_LABEL, type Scope } from '../../src/legal';
import { downloadAndShare } from '../../src/media';
import { openLegal } from '../../src/nav';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  ErrorText,
  List,
  ListItem,
  Loading,
  Muted,
  Notice,
  Screen,
  Section,
  Title,
} from '../../src/ui';

interface AccessLogEntry {
  id: string;
  action: string;
  at: string;
  scopes: Scope[] | null;
  professional: { name: string; slug: string | null } | null;
}

interface LegalRequestSummary {
  ticket: string;
  category: string;
  status: string;
  createdAt: string;
  resolution: string | null;
}

const ACTION_TEXT: Record<string, (who: string) => string> = {
  PATIENT_DATA_READ: (who) => `${who} consultó tus datos`,
  PATIENT_DATA_ACCESS_REQUESTED: (who) => `${who} pidió acceso a tus datos`,
  PATIENT_REGISTERED_BY_CODE: (who) => `${who} te registró como paciente con tu código`,
  PATIENT_REMOVED_FROM_DIRECTORY: (who) => `${who} te quitó de su lista de pacientes`,
  PATIENT_DATA_GRANTED: (who) => `Se autorizó el acceso de ${who}`,
  PATIENT_DATA_REVOKED: (who) => `Se revocó el acceso de ${who}`,
  PATIENT_SHARE_CODE_CREATED: () => 'Generaste tu código de paciente',
  PATIENT_SHARE_CODE_ROTATED: () => 'Generaste un código nuevo; el anterior dejó de funcionar',
  PATIENT_IDENTITY_DOCUMENT_VIEWED: () => 'Un administrador abrió tu documento de identidad para verificarlo',
  PATIENT_IDENTITY_VERIFIED: () => 'Un administrador verificó tu identidad',
  PATIENT_IDENTITY_REJECTED: () => 'Un administrador rechazó la foto de tu documento de identidad',
};

const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'warning',
  IN_REVIEW: 'info',
  RESOLVED: 'success',
  REJECTED: 'neutral',
};

/**
 * Centro de privacidad del paciente (como en la web): copia de sus datos,
 * historial de accesos y solicitudes sobre sus datos. El historial y las
 * solicitudes se guardan en el teléfono; la copia de datos (con salud) no.
 */
export default function PrivacyScreen() {
  const { user, online } = useSession();
  const log = useApi<AccessLogEntry[]>(user ? '/patients/me/access-log' : null, {
    cacheKey: 'me:access-log',
    topics: ['access'],
  });
  const requests = useApi<LegalRequestSummary[]>(user ? '/legal-requests/me' : null, {
    cacheKey: 'me:legal-requests',
    topics: ['requests'],
  });
  const [message, setMessage] = useState<string | null>(null);
  const exporting = useAction();
  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;

  const ask = (tipo: string) => router.push({ pathname: '/reclamos', params: { tipo } });
  return (
    <Screen
      refreshing={log.refreshing}
      onRefresh={() => {
        void log.refresh();
        void requests.refresh();
      }}
      savedAt={log.savedAt}
    >
      <Stack.Screen options={{ title: 'Privacidad y mis datos' }} />
      <Title>Privacidad y mis datos</Title>
      <Body>Descarga una copia de tu información, revisa quién accedió a ella y ejerce tus derechos.</Body>
      <Notice tone="info" title="Cómo usamos tu información">
        {PATIENT_AREA_NOTICE}
      </Notice>
      <Button
        title="Política de datos de salud"
        variant="ghost"
        small
        onPress={() => openLegal('/privacidad/datos-de-salud')}
      />
      {!!message && <Notice tone="success">{message}</Notice>}

      <Section title="Descargar mis datos">
        <Card>
          <Body>
            Un archivo con tu cuenta, tu perfil, tu información de salud, tus citas, tus autorizaciones, el historial de
            accesos y los textos legales que aceptaste. La descarga queda registrada.
          </Body>
          <Muted>
            Contiene información de salud: guárdalo en un lugar seguro. La app no lo conserva después de compartirlo.
          </Muted>
          {!online && <Notice tone="warning">Sin conexión: la copia necesita internet.</Notice>}
          <ErrorText message={exporting.error} />
          <Button
            title="Descargar mis datos"
            loading={exporting.busy}
            disabled={!online}
            onPress={() =>
              void exporting.run(async () => {
                setMessage(null);
                await downloadAndShare(
                  '/patients/me/export',
                  `mis-datos-guia-medica-monagas-${caracasDateKey(Date.now())}.json`,
                  'application/json',
                );
                setMessage('Se generó la copia de tus datos.');
              })
            }
          />
        </Card>
      </Section>

      <Section
        title="Historial de accesos"
        description="Quién consultó tu información, cuándo y con qué alcance. Para retirar un acceso ve a Permisos."
      >
        <ErrorText message={log.error} />
        {log.loading && !log.data ? (
          <Loading />
        ) : !log.data?.length ? (
          <Card>
            <Muted>Todavía no hay actividad sobre tus datos.</Muted>
          </Card>
        ) : (
          <List>
            {log.data.map((entry) => {
              const who = entry.professional?.name ?? 'un médico';
              const text = (ACTION_TEXT[entry.action] ?? (() => 'Actividad sobre tus datos'))(who);
              const scopes = entry.scopes?.length
                ? ` · Alcance: ${entry.scopes.map((x) => SCOPE_LABEL[x] ?? x).join(', ')}`
                : '';
              return (
                <ListItem
                  key={entry.id}
                  title={capitalizeFirst(text)}
                  subtitle={`${formatDateTime(entry.at, 'medium')}${scopes}`}
                />
              );
            })}
          </List>
        )}
        <Button title="Ir a Permisos" variant="secondary" small onPress={() => router.push('/paciente/permisos')} />
      </Section>

      <Section
        title="Solicitudes sobre mis datos"
        description="Lo que no puedas hacer tú mismo desde la app, pídelo aquí. Cada solicitud tiene un número de seguimiento."
      >
        <List>
          <ListItem
            title="Corregir o consultar un dato"
            subtitle="Acceso, copia o corrección de tu información."
            onPress={() => ask('PRIVACY_RIGHTS')}
          />
          <ListItem
            title="Denunciar un acceso indebido"
            subtitle="Si alguien vio tus datos sin tu permiso."
            onPress={() => ask('UNAUTHORIZED_ACCESS')}
          />
          <ListItem
            title="Cerrar mi cuenta"
            subtitle="Baja de la cuenta y eliminación de tus datos."
            danger
            onPress={() => ask('ACCOUNT_DELETION')}
          />
        </List>
        {!!requests.data?.length && (
          <>
            <Muted>Mis solicitudes</Muted>
            {requests.data.map((r) => (
              <Card key={r.ticket}>
                <Body>{r.ticket}</Body>
                <Badge label={REQUEST_STATUS[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? 'neutral'} />
                <Muted>
                  {REQUEST_CATEGORIES[r.category] ?? r.category} · {formatDate(r.createdAt, 'medium')}
                </Muted>
                {!!r.resolution && <Notice tone="neutral">{r.resolution}</Notice>}
              </Card>
            ))}
          </>
        )}
      </Section>
      <Button
        title="Centro de privacidad: todos tus derechos"
        variant="ghost"
        onPress={() => openLegal('/privacidad/derechos')}
      />
    </Screen>
  );
}
