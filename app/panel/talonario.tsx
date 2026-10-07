import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, router, Stack } from 'expo-router';
import { request, upload, type PickedFile } from '../../src/api';
import { MissingRequirements } from '../../src/components/MissingRequirements';
import { useApi, useAction } from '../../src/data';
import { formatDate } from '../../src/dates';
import { discardPicked, downloadAndShare, pickImage, takePhoto } from '../../src/media';
import {
  PAD_IMAGES,
  PRESCRIPTION_RULES,
  PRESCRIPTION_RULES_VERSION,
  type PadImageKind,
  type PrescriptionPad,
} from '../../src/prescriptions';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Check,
  ErrorText,
  Field,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Title,
} from '../../src/ui';

const IMAGE_ORDER: PadImageKind[] = ['signature', 'seal', 'logo'];
const IMAGE_URL: Record<PadImageKind, 'signatureUrl' | 'sealUrl' | 'logoUrl'> = {
  signature: 'signatureUrl',
  seal: 'sealUrl',
  logo: 'logoUrl',
};

interface PadForm {
  establishmentName: string;
  establishmentAddress: string;
  establishmentRif: string;
  establishmentPhone: string;
  city: string;
  defaultValidityDays: string;
}

const toForm = (pad: PrescriptionPad): PadForm => ({
  establishmentName: pad.pad.establishmentName ?? '',
  establishmentAddress: pad.pad.establishmentAddress ?? '',
  establishmentRif: pad.pad.establishmentRif ?? '',
  establishmentPhone: pad.pad.establishmentPhone ?? '',
  city: pad.pad.city ?? '',
  defaultValidityDays: String(pad.pad.defaultValidityDays ?? 30),
});

/**
 * Talonario del médico (como en la web): sus datos, el establecimiento, la
 * firma, el sello y el logo, y las condiciones del récipe digital. Las
 * imágenes no se muestran ni se guardan en el teléfono: se revisan en la
 * vista previa del récipe (PDF).
 */
export default function PadScreen() {
  const { user, online } = useSession();
  const pad = useApi<PrescriptionPad>(user?.role === 'PROFESSIONAL' ? '/prescriptions/pad' : null, {
    topics: ['prescriptions', 'profile'],
  });
  const [form, setForm] = useState<PadForm | null>(null);
  const [rulesChecked, setRulesChecked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<PadImageKind | null>(null);
  const action = useAction();
  useEffect(() => {
    if (pad.data && !form) setForm(toForm(pad.data));
  }, [pad.data, form]);
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const p = pad.data;
  if (!p || !form)
    return (
      <Screen refreshing={pad.refreshing} onRefresh={pad.refresh}>
        <Stack.Screen options={{ title: 'Talonario' }} />
        {pad.loading ? <Loading /> : <ErrorText message={pad.error} />}
      </Screen>
    );

  const apply = (next: PrescriptionPad, text: string) => {
    pad.setData(next);
    setForm(toForm(next));
    setNotice(text);
    changedLocally('prescriptions');
  };

  const sendImage = async (kind: PadImageKind, pick: () => Promise<PickedFile | null>) => {
    const file = await pick().catch(() => null);
    if (!file) return;
    setUploading(kind);
    await action
      .run(async () => {
        apply(
          await upload<PrescriptionPad>(`/prescriptions/pad/${kind}`, file),
          `${PAD_IMAGES[kind].title.replace(' (opcional)', '')}: guardado.`,
        );
      })
      .finally(() => {
        discardPicked(file);
        setUploading(null);
      });
  };

  const choose = (kind: PadImageKind) =>
    Alert.alert(PAD_IMAGES[kind].title, PAD_IMAGES[kind].hint, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tomar foto', onPress: () => void sendImage(kind, takePhoto) },
      { text: 'Elegir de la galería', onPress: () => void sendImage(kind, () => pickImage()) },
    ]);

  const { prescriber } = p;
  return (
    <Screen refreshing={pad.refreshing} onRefresh={pad.refresh}>
      <Stack.Screen options={{ title: 'Talonario' }} />
      <Title>Talonario</Title>
      <MissingRequirements pad={p} />
      {!!notice && <Notice tone="success">{notice}</Notice>}
      <ErrorText message={action.error} />

      <Card>
        <Heading>Tus datos en el récipe</Heading>
        <Body>
          Dr(a). {prescriber.fullName}
          {prescriber.specialties.length ? ` · ${prescriber.specialties.join(' · ')}` : ''}
        </Body>
        <Muted>
          C.I. {prescriber.cedula || '—'} · M.P.P.S. N° {prescriber.mppsNumber || '—'}
          {prescriber.colegioNumber ? ` · C.M. N° ${prescriber.colegioNumber}` : ''}
        </Muted>
        <Muted>
          Salen de tu perfil verificado. Si los cambias en «Mi perfil», vuelven a revisión antes de que puedas emitir de
          nuevo.
        </Muted>
        <Button title="Ir a mi perfil" variant="ghost" small onPress={() => router.push('/panel/perfil')} />
      </Card>

      <Section title="Establecimiento">
        <Card>
          <Field
            label="Nombre del establecimiento"
            value={form.establishmentName}
            onChangeText={(v) => setForm({ ...form, establishmentName: v })}
            placeholder="Consultorio Dra. Pérez"
            maxLength={120}
          />
          <Field
            label="RIF del establecimiento"
            value={form.establishmentRif}
            onChangeText={(v) => setForm({ ...form, establishmentRif: v })}
            placeholder="J-12345678-9"
            autoCapitalize="characters"
            maxLength={14}
          />
          <Field
            label="Dirección"
            value={form.establishmentAddress}
            onChangeText={(v) => setForm({ ...form, establishmentAddress: v })}
            placeholder="Av. Bolívar, Centro Médico X, consultorio 12, Maturín"
            multiline
            maxLength={200}
          />
          <Field
            label="Teléfono (opcional)"
            value={form.establishmentPhone}
            onChangeText={(v) => setForm({ ...form, establishmentPhone: v })}
            keyboardType="phone-pad"
            placeholder="0291-5550000"
            maxLength={40}
          />
          <Field
            label="Lugar de emisión"
            value={form.city}
            onChangeText={(v) => setForm({ ...form, city: v })}
            placeholder="Maturín, estado Monagas"
            maxLength={80}
          />
          <Field
            label="Vigencia que se propone al emitir (días)"
            value={form.defaultValidityDays}
            onChangeText={(v) => setForm({ ...form, defaultValidityDays: v.replace(/\D/g, '') })}
            keyboardType="number-pad"
            maxLength={3}
            hint="La norma pide una fecha de vencimiento; la eliges en cada récipe."
          />
          <Button
            title="Guardar establecimiento"
            loading={action.busy && !uploading}
            disabled={!online}
            onPress={() =>
              void action.run(async () => {
                apply(
                  await request<PrescriptionPad>('/prescriptions/pad', 'PATCH', {
                    establishmentName: form.establishmentName.trim(),
                    establishmentAddress: form.establishmentAddress.trim(),
                    establishmentRif: form.establishmentRif.trim().toUpperCase(),
                    establishmentPhone: form.establishmentPhone.trim(),
                    city: form.city.trim(),
                    defaultValidityDays: Number(form.defaultValidityDays) || 30,
                  }),
                  'Guardamos los datos del establecimiento.',
                );
              })
            }
          />
        </Card>
      </Section>

      <Section
        title="Firma, sello y logo"
        description="Fotos en JPG, PNG o WebP de hasta 5 MB. Se guardan de forma privada y solo se usan en tus récipes."
      >
        {IMAGE_ORDER.map((kind) => {
          const info = PAD_IMAGES[kind];
          const has = !!p.pad[IMAGE_URL[kind]];
          return (
            <Card key={kind}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Heading>{info.title}</Heading>
                <Badge
                  label={has ? 'Cargada' : info.required ? 'Falta subirla' : 'Sin logo'}
                  tone={has ? 'success' : info.required ? 'warning' : 'neutral'}
                />
              </Row>
              <Muted>{info.hint}</Muted>
              <Row>
                <Button
                  title={has ? 'Cambiar' : 'Subir'}
                  variant="secondary"
                  small
                  loading={uploading === kind}
                  disabled={!online || !!uploading}
                  onPress={() => choose(kind)}
                />
                {has && (
                  <Button
                    title="Quitar"
                    variant="ghost"
                    small
                    disabled={!online || !!uploading}
                    onPress={() =>
                      void action.run(async () => {
                        apply(
                          await request<PrescriptionPad>(`/prescriptions/pad/${kind}`, 'DELETE'),
                          `${info.title.replace(' (opcional)', '')}: quitado.`,
                        );
                      })
                    }
                  />
                )}
              </Row>
            </Card>
          );
        })}
        <Button
          title="Ver la vista previa del récipe (PDF)"
          variant="secondary"
          disabled={!online}
          onPress={() =>
            void action.run(() =>
              downloadAndShare('/prescriptions/pad/preview', 'vista-previa-recipe.pdf', 'application/pdf'),
            )
          }
        />
      </Section>

      <Section title={`Condiciones del récipe digital (versión ${PRESCRIPTION_RULES_VERSION})`}>
        <Card>
          {PRESCRIPTION_RULES.map((rule) => (
            <Body key={rule}>• {rule}</Body>
          ))}
          {p.pad.rulesAcceptedAt ? (
            <Muted>
              Las aceptaste el {formatDate(p.pad.rulesAcceptedAt, 'long')} (versión {p.rulesVersion}).
            </Muted>
          ) : (
            <>
              <Check
                label={`Leí y acepto las condiciones del récipe digital (versión ${PRESCRIPTION_RULES_VERSION}).`}
                value={rulesChecked}
                onValueChange={setRulesChecked}
              />
              <Button
                title="Aceptar las condiciones"
                disabled={!online || !rulesChecked || action.busy}
                onPress={() =>
                  void action.run(async () => {
                    apply(
                      await request<PrescriptionPad>('/prescriptions/pad', 'PATCH', { acceptRules: true }),
                      'Aceptaste las condiciones del récipe digital.',
                    );
                  })
                }
              />
            </>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
