import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../../src/api';
import { MissingRequirements } from '../../../src/components/MissingRequirements';
import { useAction } from '../../../src/data';
import { addDays, caracasDateKey, dayLabel } from '../../../src/dates';
import {
  ADMINISTRATION_ROUTES,
  PHARMACEUTICAL_FORMS,
  PRESCRIPTION_CONTROLLED_NOTICE,
  type DirectoryPatient,
  type DoctorPrescription,
  type PrescriptionPad,
} from '../../../src/prescriptions';
import { changedLocally } from '../../../src/realtime';
import { useSession } from '../../../src/session';
import {
  Body,
  Button,
  Card,
  Check,
  Chip,
  ErrorText,
  Field,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Select,
  Title,
} from '../../../src/ui';

const MAX_ITEMS = 8;
const CEDULA = /^[VEJPG]-?[\d.]{5,11}$/i;

interface ItemForm {
  activeIngredient: string;
  concentration: string;
  pharmaceuticalForm: string;
  route: string;
  dose: string;
  duration: string;
  quantity: string;
  brandNames: string;
  nonSubstitutable: boolean;
  instructions: string;
}

interface IssueForm {
  patientId: string;
  patientName: string;
  patientCedula: string;
  patientBirthYear: string;
  minorWithoutId: boolean;
  guardianName: string;
  guardianCedula: string;
  items: ItemForm[];
  pharmacistNotes: string;
  patientInstructions: string;
  validityDays: string;
}

const EMPTY_ITEM: ItemForm = {
  activeIngredient: '',
  concentration: '',
  pharmaceuticalForm: '',
  route: 'oral',
  dose: '',
  duration: '',
  quantity: '',
  brandNames: '',
  nonSubstitutable: false,
  instructions: '',
};

const EMPTY_FORM: IssueForm = {
  patientId: '',
  patientName: '',
  patientCedula: '',
  patientBirthYear: '',
  minorWithoutId: false,
  guardianName: '',
  guardianCedula: '',
  items: [EMPTY_ITEM],
  pharmacistNotes: '',
  patientInstructions: '',
  validityDays: '30',
};

function fromSource(source: DoctorPrescription, validityDays: number): IssueForm {
  const { patient, items, pharmacistNotes, patientInstructions } = source.content;
  return {
    ...EMPTY_FORM,
    patientName: patient.fullName,
    patientCedula: patient.cedula ?? '',
    patientBirthYear: String(patient.birthYear),
    minorWithoutId: !patient.cedula,
    guardianName: patient.guardian?.fullName ?? '',
    guardianCedula: patient.guardian?.cedula ?? '',
    items: items.map((item) => ({
      ...item,
      quantity: item.quantity ?? '',
      brandNames: item.brandNames ?? '',
      instructions: item.instructions ?? '',
    })),
    pharmacistNotes: pharmacistNotes ?? '',
    patientInstructions: patientInstructions ?? '',
    validityDays: String(validityDays),
  };
}

const optional = (value: string) => value.trim() || undefined;

/** Emitir un récipe (como en la web): paciente, medicamentos por principio activo, indicaciones y vigencia. */
export default function NewPrescriptionScreen() {
  const { desde } = useLocalSearchParams<{ desde?: string }>();
  const { user, online } = useSession();
  const [pad, setPad] = useState<PrescriptionPad | null>(null);
  const [patients, setPatients] = useState<DirectoryPatient[]>([]);
  const [form, setForm] = useState<IssueForm>(EMPTY_FORM);
  const [loadError, setLoadError] = useState<string | null>(null);
  const action = useAction();

  useEffect(() => {
    let live = true;
    Promise.all([
      request<PrescriptionPad>('/prescriptions/pad'),
      request<DirectoryPatient[]>('/prescriptions/patients').catch(() => [] as DirectoryPatient[]),
      desde
        ? request<DoctorPrescription>(`/prescriptions/${encodeURIComponent(desde)}`).catch(() => null)
        : Promise.resolve(null),
    ]).then(
      ([loadedPad, loadedPatients, source]) => {
        if (!live) return;
        setPad(loadedPad);
        setPatients(loadedPatients);
        const days = loadedPad.pad.defaultValidityDays;
        setForm(source ? fromSource(source, days) : { ...EMPTY_FORM, validityDays: String(days) });
      },
      (e) => live && setLoadError(e instanceof Error ? e.message : 'No se pudo cargar tu talonario'),
    );
    return () => {
      live = false;
    };
  }, [desde]);

  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  if (!pad)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nuevo récipe' }} />
        {loadError ? <ErrorText message={loadError} /> : <Loading />}
      </Screen>
    );

  const set = <K extends keyof IssueForm>(key: K, value: IssueForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setItem = (index: number, patch: Partial<ItemForm>) =>
    setForm((f) => ({ ...f, items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  const validity = Number(form.validityDays) || 0;
  const thisYear = Number(caracasDateKey(Date.now()).slice(0, 4));

  const problems = (): string | null => {
    if (form.patientName.trim().length < 3) return 'Escribe el nombre y apellido del paciente.';
    if (!form.minorWithoutId && !CEDULA.test(form.patientCedula.trim()))
      return 'Cédula del paciente inválida (ej. V-12345678).';
    const year = Number(form.patientBirthYear);
    if (!year || year < 1900 || year > thisYear) return 'Escribe el año de nacimiento del paciente.';
    if (form.minorWithoutId && (form.guardianName.trim().length < 3 || !CEDULA.test(form.guardianCedula.trim())))
      return 'Escribe el nombre y la cédula del representante.';
    for (const [i, item] of form.items.entries()) {
      const n = i + 1;
      if (item.activeIngredient.trim().length < 2) return `Medicamento ${n}: escribe el principio activo.`;
      if (!item.concentration.trim()) return `Medicamento ${n}: indica la concentración.`;
      if (item.pharmaceuticalForm.trim().length < 2) return `Medicamento ${n}: indica la forma farmacéutica.`;
      if (item.route.trim().length < 2) return `Medicamento ${n}: indica la vía de administración.`;
      if (item.dose.trim().length < 2) return `Medicamento ${n}: indica la dosis.`;
      if (item.duration.trim().length < 2) return `Medicamento ${n}: indica la duración.`;
    }
    if (validity < 1 || validity > 365) return 'La vigencia va de 1 a 365 días.';
    return null;
  };

  const issue = () => {
    const problem = problems();
    if (problem) {
      action.setError(problem);
      return;
    }
    Alert.alert(
      'Emitir récipe',
      `¿Emitir el récipe para ${form.patientName.trim()}? Un récipe emitido no se edita: si tiene un error, lo anulas y emites otro.`,
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Emitir',
          onPress: () =>
            void action.run(async () => {
              const created = await request<DoctorPrescription>('/prescriptions', 'POST', {
                ...(form.patientId ? { patientId: form.patientId } : {}),
                patientName: form.patientName.trim(),
                ...(form.minorWithoutId
                  ? { guardianName: form.guardianName.trim(), guardianCedula: form.guardianCedula.trim().toUpperCase() }
                  : { patientCedula: form.patientCedula.trim().toUpperCase() }),
                patientBirthYear: Number(form.patientBirthYear),
                items: form.items.map((item) => ({
                  activeIngredient: item.activeIngredient.trim(),
                  concentration: item.concentration.trim(),
                  pharmaceuticalForm: item.pharmaceuticalForm.trim(),
                  route: item.route.trim(),
                  dose: item.dose.trim(),
                  duration: item.duration.trim(),
                  quantity: optional(item.quantity),
                  brandNames: optional(item.brandNames),
                  nonSubstitutable: item.nonSubstitutable,
                  instructions: optional(item.instructions),
                })),
                pharmacistNotes: optional(form.pharmacistNotes),
                patientInstructions: optional(form.patientInstructions),
                validityDays: validity,
              });
              changedLocally('prescriptions');
              router.replace({ pathname: '/panel/recetas/[id]', params: { id: created.id } });
            }),
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Nuevo récipe' }} />
      <Title>Nuevo récipe</Title>
      <Body>
        Lleva tus datos, los del establecimiento, tu firma y tu sello. Al emitirlo recibe un número y un código para que
        el paciente y la farmacia lo verifiquen.
      </Body>
      <MissingRequirements pad={pad} />
      <Notice tone="warning">{PRESCRIPTION_CONTROLLED_NOTICE}</Notice>

      <Section title="Paciente">
        <Card>
          {patients.length > 0 && (
            <Select
              label="Enviarlo también a «Mis récipes» de un paciente de tu directorio (opcional)"
              value={form.patientId}
              onChange={(v) => {
                const chosen = patients.find((x) => x.patientId === v);
                setForm((f) => ({ ...f, patientId: v, patientName: chosen?.name ?? f.patientName }));
              }}
              options={[
                { value: '', label: 'No enviarlo a ninguna cuenta' },
                ...patients.map((x) => ({
                  value: x.patientId,
                  label: x.name ? `${x.name} · ${x.patientCode}` : x.patientCode,
                })),
              ]}
            />
          )}
          <Field
            label="Nombre y apellidos"
            value={form.patientName}
            onChangeText={(v) => set('patientName', v)}
            autoCapitalize="words"
            maxLength={120}
          />
          {!form.minorWithoutId && (
            <Field
              label="Cédula"
              value={form.patientCedula}
              onChangeText={(v) => set('patientCedula', v)}
              autoCapitalize="characters"
              placeholder="V-12345678"
              maxLength={14}
            />
          )}
          <Field
            label="Año de nacimiento"
            value={form.patientBirthYear}
            onChangeText={(v) => set('patientBirthYear', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Check
            label="Es menor de edad y no tiene cédula"
            description="Se escriben los datos de su representante."
            value={form.minorWithoutId}
            onValueChange={(v) => set('minorWithoutId', v)}
          />
          {form.minorWithoutId && (
            <>
              <Field
                label="Nombre del representante"
                value={form.guardianName}
                onChangeText={(v) => set('guardianName', v)}
                autoCapitalize="words"
                maxLength={120}
              />
              <Field
                label="Cédula del representante"
                value={form.guardianCedula}
                onChangeText={(v) => set('guardianCedula', v)}
                autoCapitalize="characters"
                maxLength={14}
              />
            </>
          )}
        </Card>
      </Section>

      <Section
        title="Medicamentos"
        description="Por el principio activo o Denominación Común Internacional (DCI), con su concentración, forma, vía, dosis y duración."
      >
        {form.items.map((item, index) => (
          <Card key={index}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Heading>Medicamento {index + 1}</Heading>
              {form.items.length > 1 && (
                <Button
                  title="Quitar"
                  variant="ghost"
                  small
                  onPress={() =>
                    set(
                      'items',
                      form.items.filter((_, i) => i !== index),
                    )
                  }
                />
              )}
            </Row>
            <Field
              label="Principio activo (DCI)"
              value={item.activeIngredient}
              onChangeText={(v) => setItem(index, { activeIngredient: v })}
              maxLength={120}
            />
            <Field
              label="Concentración"
              value={item.concentration}
              onChangeText={(v) => setItem(index, { concentration: v })}
              placeholder="500 mg"
              maxLength={60}
            />
            <Field
              label="Forma farmacéutica"
              value={item.pharmaceuticalForm}
              onChangeText={(v) => setItem(index, { pharmaceuticalForm: v })}
              maxLength={60}
            />
            <Row>
              {PHARMACEUTICAL_FORMS.slice(0, 8).map((f) => (
                <Chip
                  key={f}
                  label={f}
                  selected={item.pharmaceuticalForm === f}
                  onPress={() => setItem(index, { pharmaceuticalForm: f })}
                />
              ))}
            </Row>
            <Select
              label="Vía de administración"
              value={ADMINISTRATION_ROUTES.includes(item.route) ? item.route : ''}
              onChange={(v) => setItem(index, { route: v })}
              options={ADMINISTRATION_ROUTES.map((r) => ({ value: r, label: r }))}
            />
            <Field
              label="Dosis"
              value={item.dose}
              onChangeText={(v) => setItem(index, { dose: v })}
              placeholder="1 tableta cada 8 horas"
              maxLength={160}
            />
            <Field
              label="Duración del tratamiento"
              value={item.duration}
              onChangeText={(v) => setItem(index, { duration: v })}
              placeholder="7 días"
              maxLength={60}
            />
            <Field
              label="Cantidad a dispensar (opcional)"
              value={item.quantity}
              onChangeText={(v) => setItem(index, { quantity: v })}
              placeholder="21 cápsulas"
              maxLength={60}
            />
            <Field
              label="Marcas comerciales equivalentes (opcional)"
              value={item.brandNames}
              onChangeText={(v) => setItem(index, { brandNames: v })}
              maxLength={120}
            />
            <Check
              label="Insustituible (no se cambia por otro equivalente)"
              value={item.nonSubstitutable}
              onValueChange={(v) => setItem(index, { nonSubstitutable: v })}
            />
            <Field
              label="Indicación para el paciente (opcional)"
              value={item.instructions}
              onChangeText={(v) => setItem(index, { instructions: v })}
              multiline
              maxLength={300}
            />
          </Card>
        ))}
        {form.items.length < MAX_ITEMS && (
          <Button
            title="Agregar medicamento"
            variant="secondary"
            small
            onPress={() => set('items', [...form.items, EMPTY_ITEM])}
          />
        )}
      </Section>

      <Section title="Indicaciones y vigencia">
        <Card>
          <Field
            label="Advertencias al farmacéutico (opcional)"
            value={form.pharmacistNotes}
            onChangeText={(v) => set('pharmacistNotes', v)}
            multiline
            maxLength={500}
          />
          <Field
            label="Indicaciones generales para el paciente (opcional)"
            value={form.patientInstructions}
            onChangeText={(v) => set('patientInstructions', v)}
            multiline
            maxLength={1500}
          />
          <Field
            label="Vigencia (días)"
            value={form.validityDays}
            onChangeText={(v) => set('validityDays', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
          {validity > 0 && validity <= 365 && (
            <Muted>Vence el {dayLabel(addDays(caracasDateKey(Date.now()), validity), 'long')}.</Muted>
          )}
        </Card>
      </Section>

      {!online && <Notice tone="warning">Sin conexión: para emitir un récipe necesitas internet.</Notice>}
      <ErrorText message={action.error} />
      <Button title="Emitir récipe" loading={action.busy} disabled={!online || !pad.canIssue} onPress={issue} />
    </Screen>
  );
}
