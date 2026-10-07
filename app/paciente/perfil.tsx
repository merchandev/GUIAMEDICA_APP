import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, Stack } from 'expo-router';
import { request, upload } from '../../src/api';
import { municipalityOptions, useMunicipalities } from '../../src/catalogs';
import { sentence } from '../../src/contracts';
import { useApi, useAction } from '../../src/data';
import { caracasDateKey } from '../../src/dates';
import { discardPicked, pickImage } from '../../src/media';
import { cached, discard, perform, remember, store } from '../../src/offline';
import { PATIENT_AREA_NOTICE } from '../../src/legal';
import { useSession } from '../../src/session';
import {
  Avatar,
  Badge,
  Body,
  Button,
  Card,
  colors,
  DateField,
  ErrorText,
  Field,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Select,
  Title,
  Toggle,
} from '../../src/ui';

interface Medication {
  name: string;
  schedule: string;
}

interface Profile {
  firstName: string | null;
  lastName: string | null;
  cedula: string | null;
  patientCode: string;
  phone: string | null;
  birthDate: string | null;
  sex: string | null;
  bloodType: string | null;
  allergies: string | null;
  emergencyAddress: string | null;
  emergencyMedicalPhone: string | null;
  municipality: string | null;
  isHealthy: boolean;
  conditionSummary: string | null;
  medications: Medication[] | null;
  treatingDoctors: string[] | null;
  photoUrl: string | null;
  hasIdPhoto: boolean;
  identityStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  identityReviewNote: string | null;
  completeness: { percent: number; items: { key: string; label: string; done: boolean }[] };
}

interface Basic {
  firstName: string | null;
  lastName: string | null;
  patientCode: string;
  phone: string | null;
  municipality: string | null;
}

interface Form {
  cedula: string;
  phone: string;
  municipality: string;
  birthDate: string;
  sex: string;
  bloodType: string;
  allergies: string;
  emergencyAddress: string;
  emergencyMedicalPhone: string;
  isHealthy: boolean;
  conditionSummary: string;
  medications: Medication[];
  treatingDoctors: string[];
}

const toForm = (p: Profile): Form => ({
  cedula: '',
  phone: p.phone ?? '',
  municipality: p.municipality ?? '',
  birthDate: p.birthDate ?? '',
  sex: p.sex ?? '',
  bloodType: p.bloodType ?? '',
  allergies: p.allergies ?? '',
  emergencyAddress: p.emergencyAddress ?? '',
  emergencyMedicalPhone: p.emergencyMedicalPhone ?? '',
  isHealthy: p.isHealthy,
  conditionSummary: p.conditionSummary ?? '',
  medications: p.medications ?? [],
  treatingDoctors: p.treatingDoctors ?? [],
});
const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

const PHONE = /^0(412|414|416|424|426)-?\d{7}$/;
const CEDULA = /^[VEJPG]-?\d{5,9}$/i;
const IDENTITY: Record<Profile['identityStatus'], { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'En revisión', tone: 'warning' },
  VERIFIED: { label: 'Verificada', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
};
const SEX = [
  { value: '', label: 'Prefiero no indicarlo' },
  { value: 'F', label: 'Femenino' },
  { value: 'M', label: 'Masculino' },
  { value: 'Otro', label: 'Otro' },
];
const BLOOD = [
  { value: '', label: 'No lo sé' },
  ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => ({ value: t, label: t })),
];

/**
 * Ficha del paciente, como en la web. Por privacidad, la ficha completa (con
 * datos de salud e identidad) solo se pide y se edita con conexión y nunca se
 * guarda en el teléfono: queda en memoria mientras la pantalla está abierta.
 * Sin conexión se ven y se editan solo los datos de contacto guardados.
 */
export default function PatientProfileScreen() {
  const { user, online, myOps } = useSession();
  const municipalities = useMunicipalities();
  const profile = useApi<Profile>(user ? '/patients/me' : null, { topics: ['patientProfile'] });
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const photo = useAction();
  const idPhoto = useAction();

  const dirty = !!form && !!base && !same(form, toForm(base));
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    // Se mantiene la copia básica (sin salud) que la app usa sin conexión.
    remember('me:patient-basic', {
      firstName: p.firstName,
      lastName: p.lastName,
      patientCode: p.patientCode,
      phone: p.phone,
      municipality: p.municipality,
    } satisfies Basic);
    // Lo que se está escribiendo no se pisa: si cambió en otro dispositivo, se avisa.
    if (!dirty) {
      setForm(toForm(p));
      setBase(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  if (!user) return <Redirect href="/cuenta" />;
  if (user.role !== 'USER') return <Redirect href="/cuenta" />;

  const notFound = profile.error && !profile.data && /ficha de paciente/i.test(profile.error);
  if (!profile.data || !form || !base) {
    if (profile.loading) return <Loading />;
    return (
      <Screen refreshing={profile.refreshing} onRefresh={profile.refresh}>
        <Stack.Screen options={{ title: 'Mi ficha' }} />
        {notFound ? (
          <Notice tone="info" title="Todavía no tienes una ficha">
            Tu ficha se crea con tu primera cita: búscale un médico y agenda.
          </Notice>
        ) : (
          <>
            <Notice tone="warning" title="Tu ficha completa necesita conexión">
              {`${profile.error ?? ''} Por tu privacidad, tus datos de salud e identidad no se guardan en el teléfono: se ven solo con conexión.`}
            </Notice>
            <OfflineContact userId={user.id} online={online} />
          </>
        )}
      </Screen>
    );
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };
  const remoteNewer = dirty && !same(toForm(profile.data), toForm(base));
  const pendingBasic = myOps.find((op) => op.kind === 'patient-profile' && !op.error);

  const submit = () =>
    save.run(async () => {
      setSaved(false);
      if (form.phone.trim() && !PHONE.test(form.phone.trim())) throw new Error('Teléfono inválido (ej. 0414-1234567).');
      if (form.emergencyMedicalPhone.trim() && !PHONE.test(form.emergencyMedicalPhone.trim()))
        throw new Error('Número de emergencia inválido (ej. 0414-1234567).');
      if (!base.cedula && form.cedula.trim() && !CEDULA.test(form.cedula.trim()))
        throw new Error('Cédula inválida (ej. V-12345678).');
      const updated = await request<Profile>('/patients/me', 'PATCH', {
        cedula: !base.cedula && form.cedula.trim() ? form.cedula.trim().toUpperCase() : undefined,
        phone: form.phone.trim() || undefined,
        birthDate: form.birthDate || undefined,
        sex: form.sex || undefined,
        bloodType: form.bloodType || undefined,
        allergies: form.allergies,
        emergencyAddress: form.emergencyAddress,
        emergencyMedicalPhone: form.emergencyMedicalPhone.trim() || undefined,
        municipality: form.municipality,
        isHealthy: form.isHealthy,
        conditionSummary: form.isHealthy ? undefined : form.conditionSummary,
        medications: form.medications
          .filter((m) => m.name.trim() && m.schedule.trim())
          .map((m) => ({ name: m.name.trim(), schedule: m.schedule.trim() })),
        treatingDoctors: form.treatingDoctors.map((d) => d.trim()).filter(Boolean),
      });
      setBase(updated);
      setForm(toForm(updated));
      profile.setData(updated);
      setSaved(true);
    });

  const sendPhoto = (path: '/patients/me/photo' | '/patients/me/id-photo', action: typeof photo, square: boolean) =>
    action.run(async () => {
      const file = await pickImage({ square });
      if (!file) return;
      try {
        const updated = await upload<Profile>(path, file);
        const patch = {
          photoUrl: updated.photoUrl,
          hasIdPhoto: updated.hasIdPhoto,
          identityStatus: updated.identityStatus,
          identityReviewNote: updated.identityReviewNote,
          completeness: updated.completeness,
        };
        setBase((b) => (b ? { ...b, ...patch } : b));
        profile.setData((p) => (p ? { ...p, ...patch } : p));
      } finally {
        discardPicked(file);
      }
    });

  const missing = base.completeness.items.filter((i) => !i.done).map((i) => i.label.toLocaleLowerCase('es-VE'));
  const identity = IDENTITY[base.identityStatus];
  return (
    <Screen refreshing={profile.refreshing} onRefresh={profile.refresh}>
      <Stack.Screen options={{ title: 'Mi ficha' }} />
      <Row>
        <Title>Mi ficha de paciente</Title>
        <Badge label={base.patientCode} tone="neutral" />
      </Row>
      <Notice tone="info">
        <Body>
          Tus datos personales y de salud se guardan cifrados. En su agenda, los médicos solo ven tu código{' '}
          {base.patientCode}; para ver algo más necesitan tu autorización, que controlas en «Permisos». Para que tu
          médico te registre, entrégale tu código o tu QR.
        </Body>
        <Muted>{PATIENT_AREA_NOTICE}</Muted>
        <Row>
          <Button title="Permisos" variant="secondary" small onPress={() => router.push('/paciente/permisos')} />
          <Button title="Mi código y QR" variant="secondary" small onPress={() => router.push('/paciente/codigo')} />
        </Row>
      </Notice>

      <Card>
        <Text style={s.progressTitle}>Tu registro: {base.completeness.percent} %</Text>
        <View
          style={s.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: base.completeness.percent }}
        >
          <View style={[s.fill, { width: `${base.completeness.percent}%` }]} />
        </View>
        <Muted>
          {missing.length ? `Falta: ${missing.join(', ')}.` : 'Tu registro está completo.'} Solo cuentan tu identidad y
          tu contacto, nunca tus datos de salud.
        </Muted>
      </Card>

      {remoteNewer && (
        <Notice tone="warning" title="Tu ficha cambió en otro dispositivo">
          <Button
            title="Cargar la versión nueva (descarta lo que escribiste)"
            variant="secondary"
            small
            onPress={() => {
              setBase(profile.data);
              setForm(toForm(profile.data!));
            }}
          />
        </Notice>
      )}
      {!!pendingBasic && (
        <Notice tone="warning">{`Hay un cambio de contacto en espera de conexión: ${pendingBasic.label}.`}</Notice>
      )}

      <Section title="Datos personales">
        <Card>
          <Field
            label="Nombres"
            value={base.firstName ?? ''}
            onChangeText={() => {}}
            editable={false}
            hint="No editable aquí"
          />
          <Field
            label="Apellidos"
            value={base.lastName ?? ''}
            onChangeText={() => {}}
            editable={false}
            hint="No editable aquí"
          />
          {base.cedula ? (
            <Field
              label="Cédula de identidad"
              value={base.cedula}
              onChangeText={() => {}}
              editable={false}
              hint="Para corregirla, usa «Reclamos y solicitudes»"
            />
          ) : (
            <Field
              label="Cédula de identidad"
              value={form.cedula}
              onChangeText={(v) => set('cedula', v)}
              placeholder="V-12345678"
              autoCapitalize="characters"
              maxLength={12}
            />
          )}
          <Field
            label="Correo electrónico"
            value={user.email}
            onChangeText={() => {}}
            editable={false}
            hint="No editable aquí"
          />
          <Field
            label="Teléfono"
            value={form.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
            placeholder="0414-1234567"
            maxLength={12}
          />
          <Select
            label="Municipio"
            value={form.municipality}
            onChange={(v) => set('municipality', v)}
            options={municipalityOptions(municipalities)}
          />
        </Card>
      </Section>

      <Section title="Foto de perfil">
        <Card>
          <Row>
            <Avatar uri={base.photoUrl} name={`${base.firstName ?? ''} ${base.lastName ?? ''}`} size={80} />
            <View style={{ flex: 1, gap: 6 }}>
              <Button
                title={base.photoUrl ? 'Cambiar foto' : 'Subir foto'}
                variant="secondary"
                loading={photo.busy}
                disabled={!online}
                onPress={() => void sendPhoto('/patients/me/photo', photo, true)}
              />
              <Muted>JPG, PNG o WebP. Máx. 5 MB. Se eliminan los metadatos (incluida la ubicación).</Muted>
            </View>
          </Row>
          <ErrorText message={photo.error} />
        </Card>
      </Section>

      <Section
        title="Foto de identificación"
        right={
          (base.hasIdPhoto || base.identityStatus === 'REJECTED') && (
            <Badge label={identity.label} tone={identity.tone} />
          )
        }
      >
        <Card>
          <Body>
            Una foto legible de tu cédula u otro documento de identidad. Se guarda en almacenamiento privado: solo el
            equipo de verificación la revisa (cada apertura queda registrada) y ningún médico la ve. La app no la guarda
            en el teléfono.
          </Body>
          {base.identityStatus === 'REJECTED' && (
            <Notice tone="danger">
              {`No pudimos verificar tu identidad con la foto anterior${base.identityReviewNote ? `: ${base.identityReviewNote}` : ''}. Por tu privacidad la eliminamos; sube una nueva.`}
            </Notice>
          )}
          {base.hasIdPhoto && <Muted>Ya subiste una foto de identificación.</Muted>}
          <Button
            title={base.hasIdPhoto ? 'Cambiar foto de identificación' : 'Subir foto de identificación'}
            variant="secondary"
            loading={idPhoto.busy}
            disabled={!online}
            onPress={() => void sendPhoto('/patients/me/id-photo', idPhoto, false)}
          />
          <Muted>JPG, PNG o WebP. Máx. 5 MB.</Muted>
          <ErrorText message={idPhoto.error} />
        </Card>
      </Section>

      <Section title="Datos médicos básicos">
        <Card>
          <DateField
            label="Fecha de nacimiento"
            value={form.birthDate}
            onChange={(v) => set('birthDate', v)}
            maximumDate={new Date(`${caracasDateKey(Date.now())}T12:00:00`)}
            minimumDate={new Date('1900-01-01T12:00:00')}
            placeholder="Sin indicar"
          />
          <Select label="Sexo" value={form.sex} onChange={(v) => set('sex', v)} options={SEX} />
          <Select
            label="Grupo sanguíneo"
            value={form.bloodType}
            onChange={(v) => set('bloodType', v)}
            options={BLOOD}
          />
          <Field
            label="Alergias"
            value={form.allergies}
            onChangeText={(v) => set('allergies', v)}
            multiline
            maxLength={1000}
            placeholder="Ej. Penicilina, mariscos"
          />
        </Card>
      </Section>

      <Section title="Medicamentos" description="Los medicamentos que tomas y el horario en que los tomas.">
        {form.medications.map((m, i) => (
          <Card key={i}>
            <Field
              label="Medicamento"
              value={m.name}
              onChangeText={(v) =>
                set(
                  'medications',
                  form.medications.map((x, j) => (j === i ? { ...x, name: v } : x)),
                )
              }
              placeholder="Ej. Losartán 50mg"
              maxLength={120}
            />
            <Field
              label="Horario"
              value={m.schedule}
              onChangeText={(v) =>
                set(
                  'medications',
                  form.medications.map((x, j) => (j === i ? { ...x, schedule: v } : x)),
                )
              }
              placeholder="Ej. 8:00 a. m. y 8:00 p. m."
              maxLength={120}
            />
            <Button
              title="Quitar"
              variant="ghost"
              small
              onPress={() =>
                set(
                  'medications',
                  form.medications.filter((_, j) => j !== i),
                )
              }
            />
          </Card>
        ))}
        {form.medications.length < 30 && (
          <Button
            title="Agregar medicamento"
            variant="secondary"
            small
            onPress={() => set('medications', [...form.medications, { name: '', schedule: '' }])}
          />
        )}
      </Section>

      <Section title="Resumen de condición">
        <Card>
          <Toggle
            label="Soy una persona sana"
            description="Si lo activas, no necesitas describir ninguna condición médica."
            value={form.isHealthy}
            onValueChange={(v) => {
              setSaved(false);
              setForm((f) => (f ? { ...f, isHealthy: v, conditionSummary: v ? '' : f.conditionSummary } : f));
            }}
          />
          <Field
            label="Resumen de tu condición"
            value={form.conditionSummary}
            onChangeText={(v) => set('conditionSummary', v)}
            multiline
            maxLength={2000}
            editable={!form.isHealthy}
            hint={form.isHealthy ? 'Bloqueado porque indicaste que eres una persona sana.' : undefined}
          />
        </Card>
      </Section>

      <Section title="Contacto de emergencia">
        <Card>
          <Field
            label="Número de emergencia médica"
            value={form.emergencyMedicalPhone}
            onChangeText={(v) => set('emergencyMedicalPhone', v)}
            keyboardType="phone-pad"
            placeholder="0414-1234567"
            hint="A quién llamar en caso de una emergencia"
            maxLength={12}
          />
          <Field
            label="Dirección para emergencia"
            value={form.emergencyAddress}
            onChangeText={(v) => set('emergencyAddress', v)}
            multiline
            maxLength={240}
          />
        </Card>
      </Section>

      <Section title="Doctores tratantes">
        {form.treatingDoctors.map((name, i) => (
          <Card key={i}>
            <Field
              label="Nombre del doctor"
              value={name}
              onChangeText={(v) =>
                set(
                  'treatingDoctors',
                  form.treatingDoctors.map((x, j) => (j === i ? v : x)),
                )
              }
              autoCapitalize="words"
              maxLength={120}
            />
            <Button
              title="Quitar"
              variant="ghost"
              small
              onPress={() =>
                set(
                  'treatingDoctors',
                  form.treatingDoctors.filter((_, j) => j !== i),
                )
              }
            />
          </Card>
        ))}
        {form.treatingDoctors.length < 20 && (
          <Button
            title="Agregar doctor tratante"
            variant="secondary"
            small
            onPress={() => set('treatingDoctors', [...form.treatingDoctors, ''])}
          />
        )}
      </Section>

      {saved && <Notice tone="success">Ficha actualizada correctamente.</Notice>}
      {!online && <Notice tone="warning">Sin conexión: para guardar tu ficha completa necesitas internet.</Notice>}
      <ErrorText message={save.error} />
      <Button title="Guardar cambios" loading={save.busy} disabled={!online || !dirty} onPress={() => void submit()} />
    </Screen>
  );
}

/**
 * Sin conexión: los datos de contacto guardados (sin salud ni identidad) y su
 * edición, que se envía sola al volver la conexión.
 */
function OfflineContact({ userId, online }: { userId: string; online: boolean }) {
  const { myOps } = useSession();
  const municipalities = useMunicipalities();
  const saved = cached<Basic>('me:patient-basic')?.data ?? null;
  const draft = store.ops.find((op) => op.userId === userId && op.kind === 'patient-profile' && !op.error)?.body;
  const [phone, setPhone] = useState(String(draft?.phone ?? saved?.phone ?? ''));
  const [municipality, setMunicipality] = useState(String(draft?.municipality ?? saved?.municipality ?? ''));
  const action = useAction();
  const pending = myOps.find((op) => op.kind === 'patient-profile' && !op.error);
  const rejected = myOps.find((op) => op.kind === 'patient-profile' && op.error);
  if (!saved) return <Muted>Esta sección todavía no tiene datos guardados en el teléfono.</Muted>;
  return (
    <Card>
      <Title>
        {saved.firstName} {saved.lastName}
      </Title>
      <Badge label={saved.patientCode} tone="neutral" />
      <Field
        label="Teléfono"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="0414-1234567"
        maxLength={12}
      />
      <Select
        label="Municipio"
        value={municipality}
        onChange={setMunicipality}
        options={municipalityOptions(municipalities)}
      />
      {pending && <Notice tone="warning">Cambios guardados en el teléfono: se enviarán al volver la conexión.</Notice>}
      {!pending && rejected && (
        <Notice tone="danger">{`La plataforma no aceptó estos datos: ${sentence(rejected.error ?? '')} Corrígelos y vuelve a guardar.`}</Notice>
      )}
      <ErrorText message={action.error} />
      <Button
        title="Guardar datos de contacto"
        loading={action.busy}
        onPress={() =>
          void action.run(async () => {
            if (phone.trim() && !PHONE.test(phone.trim())) throw new Error('Teléfono inválido (ej. 0414-1234567).');
            const body: Record<string, string> = {};
            if (phone.trim() && phone.trim() !== (saved.phone ?? '')) body.phone = phone.trim();
            if (municipality !== (saved.municipality ?? '')) body.municipality = municipality;
            if (rejected) await discard(rejected.id);
            if (!Object.keys(body).length) {
              Alert.alert('Sin cambios', 'Tus datos de contacto ya están así.');
              return;
            }
            const result = await perform(userId, {
              kind: 'patient-profile',
              method: 'PATCH',
              path: '/patients/me/basic',
              body,
              label: 'Actualizar tus datos de contacto',
            });
            Alert.alert(
              result === 'queued' ? 'Guardado sin conexión' : 'Datos actualizados',
              result === 'queued'
                ? 'Tus datos se enviarán solos cuando vuelva la conexión.'
                : 'Los datos se guardaron en la plataforma.',
            );
          })
        }
      />
      {!online && <Muted>Tu ficha completa se verá aquí al volver la conexión.</Muted>}
    </Card>
  );
}

const s = StyleSheet.create({
  progressTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.secondary, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.accent },
});
