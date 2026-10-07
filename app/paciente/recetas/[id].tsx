import React from 'react';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { PrescriptionPaper, PrescriptionShare } from '../../../src/components/PrescriptionPaper';
import { useApi } from '../../../src/data';
import { formatDate } from '../../../src/dates';
import { openDoctor } from '../../../src/nav';
import type { PatientPrescription } from '../../../src/prescriptions';
import { useSession } from '../../../src/session';
import { Body, Button, ErrorText, Loading, Notice, Screen, Title } from '../../../src/ui';

/** Un récipe del paciente: el papel, el código, el QR y el PDF (sin guardarlo en el teléfono). */
export default function PatientPrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const prescription = useApi<PatientPrescription>(user ? `/prescriptions/me/${encodeURIComponent(id)}` : null, {
    topics: ['prescriptions'],
  });
  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;
  const p = prescription.data;
  if (!p)
    return (
      <Screen refreshing={prescription.refreshing} onRefresh={prescription.refresh}>
        <Stack.Screen options={{ title: 'Récipe' }} />
        {prescription.loading ? <Loading /> : <ErrorText message={prescription.error} />}
      </Screen>
    );
  const doctor = p.content.prescriber.fullName;
  return (
    <Screen refreshing={prescription.refreshing} onRefresh={prescription.refresh}>
      <Stack.Screen options={{ title: `Récipe N° ${p.numberLabel}` }} />
      <Title>Récipe N° {p.numberLabel}</Title>
      <Body>
        De Dr(a). {doctor}, emitido el {formatDate(p.issuedAt, 'long')}.
      </Body>
      {!!p.doctorSlug && (
        <Button
          title={`Ver la ficha de Dr(a). ${doctor}`}
          variant="ghost"
          small
          onPress={() => openDoctor(p.doctorSlug!)}
        />
      )}
      {p.status === 'ANNULLED' && (
        <Notice tone="warning" title="Tu médico anuló este récipe">
          {`Ya no sirve para comprar medicamentos. Motivo: ${p.annulReason ?? 'sin indicar'}. Si tienes dudas, consulta a tu médico.`}
        </Notice>
      )}
      {p.status === 'EXPIRED' && (
        <Notice tone="warning">
          Este récipe venció: ya no sirve para comprar medicamentos. Pide uno nuevo a tu médico si lo necesitas.
        </Notice>
      )}
      <PrescriptionShare view={p} pdfPath={`/prescriptions/me/${encodeURIComponent(p.id)}/pdf`} />
      <PrescriptionPaper view={p} />
    </Screen>
  );
}
