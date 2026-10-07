import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../../src/api';
import { PrescriptionPaper, PrescriptionShare } from '../../../src/components/PrescriptionPaper';
import { useApi, useAction } from '../../../src/data';
import { formatDate, formatDateTime } from '../../../src/dates';
import type { DirectoryPatient, DoctorPrescription } from '../../../src/prescriptions';
import { changedLocally } from '../../../src/realtime';
import { useSession } from '../../../src/session';
import {
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Loading,
  Muted,
  Notice,
  Screen,
  Select,
  Title,
} from '../../../src/ui';

/** Un récipe emitido por el médico: compartir, enviar por correo, entregar en la cuenta del paciente y anular. */
export default function DoctorPrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, online } = useSession();
  const rx = useApi<DoctorPrescription>(
    user?.role === 'PROFESSIONAL' ? `/prescriptions/${encodeURIComponent(id)}` : null,
    { topics: ['prescriptions'] },
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [patients, setPatients] = useState<DirectoryPatient[] | null>(null);
  const [deliverTo, setDeliverTo] = useState('');
  const [annulReason, setAnnulReason] = useState('');
  const action = useAction();
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const p = rx.data;
  if (!p)
    return (
      <Screen refreshing={rx.refreshing} onRefresh={rx.refresh}>
        <Stack.Screen options={{ title: 'Récipe' }} />
        {rx.loading ? <Loading /> : <ErrorText message={rx.error} />}
      </Screen>
    );
  const active = p.status !== 'ANNULLED';
  const updated = (next: DoctorPrescription, text: string) => {
    rx.setData(next);
    setNotice(text);
    changedLocally('prescriptions');
  };

  const sendEmail = () => {
    const to = email.trim();
    Alert.alert(
      'Enviar por correo',
      `¿Enviar el récipe con el PDF adjunto a ${to}? Revisa bien el correo: lleva datos de salud.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () =>
            void action.run(async () => {
              const result = await request<{ sent: boolean; emailsLeft: number }>(
                `/prescriptions/${p.id}/email`,
                'POST',
                { email: to },
              );
              rx.setData({ ...p, emailsSent: p.emailsSent + 1, emailsLeft: result.emailsLeft });
              setNotice(`Enviamos el récipe a ${to}.`);
              setEmail('');
            }),
        },
      ],
    );
  };

  const annul = () =>
    Alert.alert('Anular récipe', '¿Anular este récipe? Dejará de servir en la farmacia y no se puede deshacer.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: () =>
          void action.run(async () => {
            updated(
              await request<DoctorPrescription>(`/prescriptions/${p.id}/annul`, 'POST', { reason: annulReason.trim() }),
              'Anulaste el récipe. La verificación con su código ahora lo muestra como anulado.',
            );
          }),
      },
    ]);

  return (
    <Screen refreshing={rx.refreshing} onRefresh={rx.refresh}>
      <Stack.Screen options={{ title: `Récipe N° ${p.numberLabel}` }} />
      <Title>Récipe N° {p.numberLabel}</Title>
      <Body>
        Emitido el {formatDateTime(p.issuedAt, 'long')} para {p.content.patient.fullName}.
      </Body>
      <Button
        title="Usar como base para uno nuevo"
        variant="secondary"
        small
        disabled={!online}
        onPress={() => router.push({ pathname: '/panel/recetas/nuevo', params: { desde: p.id } })}
      />
      {!!notice && <Notice tone="success">{notice}</Notice>}
      <ErrorText message={action.error ?? rx.error} />
      {p.status === 'ANNULLED' && (
        <Notice tone="warning" title="Récipe anulado">
          {`${p.annulledAt ? `El ${formatDate(p.annulledAt, 'long')}. ` : ''}Motivo: ${p.annulReason ?? 'sin indicar'}`}
        </Notice>
      )}
      {p.status === 'EXPIRED' && (
        <Notice tone="warning">Este récipe venció: ya no sirve para comprar medicamentos.</Notice>
      )}
      <PrescriptionShare view={p} pdfPath={`/prescriptions/${encodeURIComponent(p.id)}/pdf`} />

      {p.status === 'VALID' && (
        <Card>
          <Heading>Enviar por correo</Heading>
          <Muted>
            Lo enviamos con el PDF adjunto y el código de verificación al correo que indiques (el del paciente o el de
            quien lo represente). Te quedan {p.emailsLeft} envíos para este récipe.
          </Muted>
          <Field
            label="Correo"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={200}
            editable={p.emailsLeft > 0}
          />
          <Button
            title="Enviar"
            disabled={!online || p.emailsLeft === 0 || !email.trim() || action.busy}
            onPress={sendEmail}
          />
        </Card>
      )}

      <Card>
        <Heading>En la plataforma</Heading>
        {p.deliveredTo ? (
          <Body>
            Está en «Mis récipes» del paciente {p.deliveredTo}
            {p.deliveredAt ? ` desde el ${formatDate(p.deliveredAt, 'long')}` : ''}.
          </Body>
        ) : !active ? (
          <Body>No está en la cuenta de ningún paciente.</Body>
        ) : (
          <>
            <Body>
              Aún no está en la cuenta de ningún paciente. El paciente puede agregarlo con su código desde «Mis récipes»
              (si la cédula del récipe es la suya), o puedes entregárselo tú si está en tu directorio.
            </Body>
            {patients === null ? (
              <Button
                title="Elegir un paciente de mi directorio"
                variant="secondary"
                small
                disabled={!online}
                onPress={() =>
                  void action.run(async () => {
                    setPatients(await request<DirectoryPatient[]>('/prescriptions/patients'));
                  })
                }
              />
            ) : patients.length === 0 ? (
              <Muted>No tienes pacientes con cuenta en tu directorio.</Muted>
            ) : (
              <>
                <Select
                  label="Paciente"
                  value={deliverTo}
                  onChange={setDeliverTo}
                  options={patients.map((x) => ({
                    value: x.patientId,
                    label: x.name ? `${x.name} · ${x.patientCode}` : x.patientCode,
                  }))}
                />
                <Button
                  title="Entregar"
                  disabled={!online || !deliverTo || action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      updated(
                        await request<DoctorPrescription>(`/prescriptions/${p.id}/deliver`, 'POST', {
                          patientId: deliverTo,
                        }),
                        'Listo: el paciente ya lo tiene en «Mis récipes» y recibió un aviso.',
                      );
                    })
                  }
                />
              </>
            )}
          </>
        )}
      </Card>

      <PrescriptionPaper view={p} />

      {active && (
        <Card>
          <Heading>Anular</Heading>
          <Muted>
            Si tiene un error, anúlalo y emite otro. La verificación lo mostrará como anulado y, si está en la cuenta de
            un paciente, le avisamos.
          </Muted>
          <Field label="Motivo" value={annulReason} onChangeText={setAnnulReason} multiline maxLength={300} />
          <Button
            title="Anular récipe"
            variant="danger"
            disabled={!online || annulReason.trim().length < 5 || action.busy}
            onPress={annul}
          />
        </Card>
      )}
    </Screen>
  );
}
