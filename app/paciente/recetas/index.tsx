import React, { useState } from 'react';
import { Redirect, router, Stack } from 'expo-router';
import { request } from '../../../src/api';
import { useApi, useAction } from '../../../src/data';
import { formatDate } from '../../../src/dates';
import { useFeatures } from '../../../src/features';
import {
  normalizePrescriptionCode,
  PRESCRIPTION_PATIENT_NOTICE,
  PRESCRIPTION_STATUS,
  type PatientPrescriptionSummary,
} from '../../../src/prescriptions';
import { useSession } from '../../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  Heading,
  Loading,
  Muted,
  Notice,
  Screen,
  Title,
} from '../../../src/ui';

/**
 * Récipes del paciente. Tienen datos de salud (medicamentos): se ven con
 * conexión y no se guardan en el teléfono.
 */
export default function PatientPrescriptionsScreen() {
  const { user, online } = useSession();
  const { prescriptions } = useFeatures();
  const list = useApi<PatientPrescriptionSummary[]>(user ? '/prescriptions/me' : null, { topics: ['prescriptions'] });
  const [code, setCode] = useState('');
  const claim = useAction();
  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;

  const add = () =>
    claim.run(async () => {
      const normalized = normalizePrescriptionCode(code);
      if (!normalized) throw new Error('El código tiene 12 letras y números, por ejemplo K7Q4-M9TX-P3WD.');
      const result = await request<{ id: string; alreadySaved: boolean }>('/prescriptions/claim', 'POST', {
        code: normalized,
      });
      setCode('');
      router.push({ pathname: '/paciente/recetas/[id]', params: { id: result.id } });
    });

  const items = list.data ?? [];
  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh}>
      <Stack.Screen options={{ title: 'Mis récipes' }} />
      <Title>Mis récipes</Title>
      <Body>{PRESCRIPTION_PATIENT_NOTICE}</Body>
      {!prescriptions && (
        <Notice tone="info">Los récipes digitales todavía no están disponibles en la plataforma.</Notice>
      )}
      <Card>
        <Heading>Agregar un récipe con su código</Heading>
        <Muted>
          Si tu médico te lo envió por WhatsApp, por correo o impreso, escribe el código que trae. Se guarda en tu
          cuenta si la cédula del récipe es la tuya (o la que diste como representante).
        </Muted>
        <Field
          label="Código del récipe"
          value={code}
          onChangeText={setCode}
          placeholder="K7Q4-M9TX-P3WD"
          autoCapitalize="characters"
          maxLength={80}
        />
        <ErrorText message={claim.error} />
        <Button title="Agregar" loading={claim.busy} disabled={!online || !code.trim()} onPress={() => void add()} />
      </Card>
      {!online && !list.data && (
        <Notice tone="warning">
          Sin conexión: por tu privacidad, tus récipes no se guardan en el teléfono. Se ven al volver la conexión.
        </Notice>
      )}
      <ErrorText message={online ? list.error : null} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data && items.length === 0 ? (
        <Empty
          title="Aún no tienes récipes aquí"
          description="Cuando un médico te entregue un récipe en la plataforma, o lo agregues con su código, aparecerá en esta lista."
        />
      ) : (
        items.map((item) => {
          const status = PRESCRIPTION_STATUS[item.status];
          return (
            <Card
              key={item.id}
              label={`Récipe N° ${item.numberLabel} de Dr(a). ${item.doctor.name}`}
              onPress={() => router.push({ pathname: '/paciente/recetas/[id]', params: { id: item.id } })}
            >
              <Body>
                Dr(a). {item.doctor.name} · N° {item.numberLabel}
              </Body>
              <Badge label={status.label} tone={status.tone} />
              <Muted>
                {item.itemsSummary} · para {item.patientName}
              </Muted>
              <Muted>
                Emitido el {formatDate(item.issuedAt, 'long')} · vence el {formatDate(item.expiresAt, 'long')}
              </Muted>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
