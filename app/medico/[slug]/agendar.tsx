import React, { useCallback, useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ApiError, OfflineError, request } from '../../../src/api';
import { SlotPicker } from '../../../src/components/SlotPicker';
import { sentence, type DoctorProfile } from '../../../src/contracts';
import { useApi, useAction } from '../../../src/data';
import { capitalizeFirst, formatDateTime } from '../../../src/dates';
import { EMERGENCY_NOTICE, MEDICAL_DISCLAIMER, PATIENT_CONSENT_VERSION, SCOPES, type Scope } from '../../../src/legal';
import { openLegal } from '../../../src/nav';
import { cached, remember } from '../../../src/offline';
import { changedLocally } from '../../../src/realtime';
import { useSession } from '../../../src/session';
import {
  Body,
  Button,
  Card,
  Check,
  Empty,
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

interface BasicProfile {
  firstName: string | null;
  lastName: string | null;
  patientCode: string;
  phone: string | null;
}

const PHONE = /^0(412|414|416|424|426)-?\d{7}$/;
const DAYS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
];

/**
 * Reservar una cita (como en la web): día y hora libres, motivo y, si quiere,
 * qué puede ver el médico antes de la consulta y por cuántos días.
 */
export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user, online } = useSession();
  const doctor = useApi<DoctorProfile>(`/professionals/${encodeURIComponent(slug)}`, {
    cacheKey: `pub:doctor:${slug}`,
  });
  // undefined = cargando; null = primera reserva (todavía sin ficha de paciente).
  const [own, setOwn] = useState<BasicProfile | null | undefined>(undefined);
  const [slot, setSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [days, setDays] = useState('30');
  const [booked, setBooked] = useState<string | null>(null);
  const action = useAction();

  useEffect(() => {
    if (!user) return;
    let live = true;
    request<BasicProfile>('/patients/me/basic')
      .then((data) => {
        if (!live) return;
        remember('me:patient-basic', data);
        setOwn(data);
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setOwn(null);
        else setOwn(e instanceof OfflineError ? (cached<BasicProfile>('me:patient-basic')?.data ?? null) : null);
      });
    return () => {
      live = false;
    };
  }, [user]);

  const doctorId = doctor.data?.id;
  const loadSlots = useCallback(
    (from: string, to: string) =>
      request<string[]>(`/appointments/availability?professionalId=${doctorId}&from=${from}&to=${to}`),
    [doctorId],
  );

  if (!user)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Agendar cita' }} />
        <Empty
          title="Inicia sesión para agendar"
          description="Necesitas una cuenta de paciente (gratuita) para reservar y ver tus citas."
        >
          <Button title="Iniciar sesión" onPress={() => router.push('/acceso')} />
          <Button title="Crear cuenta" variant="secondary" onPress={() => router.push('/acceso/registro')} />
        </Empty>
      </Screen>
    );
  const d = doctor.data;
  if (!d)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Agendar cita' }} />
        {doctor.loading ? <Loading /> : <ErrorText message={doctor.error} />}
      </Screen>
    );

  if (booked)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Cita solicitada' }} />
        <Card>
          <Title>¡Solicitud enviada!</Title>
          <Body>
            {sentence(`Pediste cita con Dr(a). ${d.firstName} ${d.lastName} para el ${formatDateTime(booked, 'full')}`)}{' '}
            Te avisaremos por correo y en «Avisos» en cuanto la confirme.
          </Body>
          <Button title="Ver mis citas" onPress={() => router.navigate('/citas')} />
        </Card>
      </Screen>
    );

  const book = () =>
    action.run(async () => {
      if (!slot) throw new Error('Elige el día y la hora.');
      if (own === null) {
        if (!firstName.trim() || !lastName.trim())
          throw new Error('Escribe nombres y apellidos de quien va a la consulta.');
        if (phone.trim() && !PHONE.test(phone.trim())) throw new Error('Teléfono inválido (ej. 0414-1234567).');
      }
      await request('/appointments', 'POST', {
        professionalId: d.id,
        startsAt: slot,
        reason: reason.trim() || undefined,
        firstName: own === null ? firstName.trim() : undefined,
        lastName: own === null ? lastName.trim() : undefined,
        phone: own === null && phone.trim() ? phone.trim() : undefined,
        shareScopes: scopes.length ? scopes : undefined,
        shareDays: scopes.length ? Number(days) : undefined,
      });
      changedLocally('appointments');
      setBooked(slot);
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Agendar cita' }} />
      <Title>
        Agendar con Dr(a). {d.firstName} {d.lastName}
      </Title>
      <Muted>{d.specialties.map((x) => x.specialty.name).join(', ') || 'Medicina general'}</Muted>
      {!d.bookingEnabled ? (
        <Notice tone="warning">Este médico no tiene citas disponibles por ahora.</Notice>
      ) : (
        <>
          <Card>
            <Heading>Elige el día y la hora</Heading>
            <SlotPicker loadSlots={loadSlots} selectedSlot={slot} onSelectSlot={setSlot} professionalId={d.id} />
            {!!slot && <Notice tone="success">{`Elegiste: ${capitalizeFirst(formatDateTime(slot, 'full'))}`}</Notice>}
          </Card>
          <Card>
            <Field
              label="Motivo de consulta (opcional)"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
            />
            {own === undefined ? (
              <Loading label="Revisando tu ficha…" />
            ) : own ? (
              <Muted>
                Reservas como {own.firstName} {own.lastName} ({own.patientCode}){own.phone ? ` · ${own.phone}` : ''}.
                Para cambiar tu teléfono u otros datos, ve a Cuenta › Mi ficha.
              </Muted>
            ) : (
              <>
                <Body>Es tu primera reserva: ¿a nombre de quién va la cita?</Body>
                <Field
                  label="Nombres"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  maxLength={80}
                />
                <Field
                  label="Apellidos"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  maxLength={80}
                />
                <Field
                  label="Teléfono"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="0414-1234567"
                  maxLength={12}
                />
              </>
            )}
          </Card>
          <Card>
            <Heading>Opcional: ¿qué puede ver Dr(a). {d.lastName} antes de la consulta?</Heading>
            <Muted>
              Si no marcas nada, solo verá tu código de paciente. Puedes revocar esta autorización cuando quieras desde
              «Permisos». Tu cédula nunca se comparte.
            </Muted>
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
            {scopes.length > 0 && (
              <>
                <Select label="Durante" value={days} onChange={setDays} options={DAYS} />
                <Button
                  title={`Leer la autorización (v${PATIENT_CONSENT_VERSION})`}
                  variant="ghost"
                  small
                  onPress={() => openLegal('/privacidad/autorizacion-medica')}
                />
              </>
            )}
          </Card>
          <Notice tone="neutral">{`${MEDICAL_DISCLAIMER} ${EMERGENCY_NOTICE}`}</Notice>
          {!online && <Notice tone="warning">Sin conexión: para reservar necesitas internet.</Notice>}
          <ErrorText message={action.error} />
          <Button
            title="Solicitar cita"
            loading={action.busy}
            disabled={!slot || !online || own === undefined}
            onPress={() => void book()}
          />
        </>
      )}
    </Screen>
  );
}
