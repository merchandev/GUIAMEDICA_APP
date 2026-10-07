import React, { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { request, upload } from '../../src/api';
import { municipalityOptions, useMunicipalities, useSpecialties } from '../../src/catalogs';
import { ProgressCard } from '../../src/components/DoctorCards';
import { SOCIAL_LABELS } from '../../src/contracts';
import { useApi, useAction } from '../../src/data';
import {
  DOCTOR_SOCIAL_LIMITS,
  parseYouTubeVideoId,
  PLAN_TIER_LABELS,
  SOCIAL_PLATFORM_EXAMPLE,
  useOwnProfile,
  youTubeShortUrl,
  type OwnProfile,
  type PlanTier,
  type SocialPlatform,
} from '../../src/doctor';
import { discardPicked, pickImage } from '../../src/media';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Avatar,
  Badge,
  Body,
  Button,
  Card,
  Chip,
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
} from '../../src/ui';

/** Campos que el médico edita en el formulario (solo esos se envían). */
const FORM_FIELDS = [
  'firstName',
  'lastName',
  'bio',
  'cedula',
  'rif',
  'mppsNumber',
  'colmedMonagasNumber',
  'phone',
  'whatsapp',
  'municipality',
  'address',
  'seoDescription',
] as const;
type Form = Record<(typeof FORM_FIELDS)[number], string>;
const toForm = (p: OwnProfile): Form => Object.fromEntries(FORM_FIELDS.map((f) => [f, p[f] ?? ''])) as Form;
const sameForm = (a: Form, b: Form) => FORM_FIELDS.every((f) => a[f] === b[f]);

/** Perfil profesional del médico (como «Mi perfil» en la web). */
export default function DoctorProfileScreen() {
  const { user, online } = useSession();
  const own = useOwnProfile(user?.role === 'PROFESSIONAL');
  const specialties = useSpecialties();
  const municipalities = useMunicipalities();
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<OwnProfile | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const photo = useAction();

  const dirty =
    !!form &&
    !!base &&
    (!sameForm(form, toForm(base)) ||
      chosen.slice().sort().join() !==
        base.specialties
          .map((x) => x.specialty.id)
          .sort()
          .join());
  useEffect(() => {
    const p = own.data;
    if (!p || dirty) return;
    setForm(toForm(p));
    setBase(p);
    setChosen(p.specialties.map((x) => x.specialty.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own.data]);

  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  if (!own.data || !form || !base)
    return (
      <Screen refreshing={own.refreshing} onRefresh={own.refresh}>
        <Stack.Screen options={{ title: 'Mi perfil' }} />
        {own.loading ? <Loading /> : <ErrorText message={own.error} />}
      </Screen>
    );

  const set = (key: keyof Form, value: string) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };
  const remoteNewer = dirty && !sameForm(toForm(own.data), toForm(base));
  const planTier = base.planTier ?? 'FREE';
  const tier = PLAN_TIER_LABELS[planTier];

  const submit = () =>
    save.run(async () => {
      setSaved(false);
      const payload = Object.fromEntries(FORM_FIELDS.map((f) => [f, (form[f] ?? '').trim()]));
      await request('/professionals/me', 'PATCH', { ...payload, specialtyIds: chosen });
      const fresh = await request<OwnProfile>('/professionals/me');
      own.setData(fresh);
      setBase(fresh);
      setForm(toForm(fresh));
      setChosen(fresh.specialties.map((x) => x.specialty.id));
      changedLocally('profile');
      setSaved(true);
    });

  const changePhoto = () =>
    photo.run(async () => {
      const file = await pickImage({ square: true });
      if (!file) return;
      try {
        await upload<{ photoUrl: string | null }>('/professionals/me/photo', file);
      } finally {
        discardPicked(file);
      }
      const fresh = await request<OwnProfile>('/professionals/me');
      own.setData(fresh);
      setBase((b) => (b ? { ...b, photoUrl: fresh.photoUrl, progress: fresh.progress } : b));
    });

  return (
    <Screen refreshing={own.refreshing} onRefresh={own.refresh} savedAt={own.savedAt}>
      <Stack.Screen options={{ title: 'Mi perfil' }} />
      <Row>
        <Title>Mi perfil profesional</Title>
        {tier && <Badge label={tier.label} tone={tier.tone} />}
        {base.plan?.kind === 'TRIAL' && <Badge label="Prueba gratis" tone="gold" />}
      </Row>
      <ProgressCard progress={own.data.progress} isPublished={own.data.isPublished} />
      {remoteNewer && (
        <Notice tone="warning" title="Tu perfil cambió en otro dispositivo">
          <Button
            title="Cargar la versión nueva (descarta lo que escribiste)"
            variant="secondary"
            small
            onPress={() => {
              setBase(own.data);
              setForm(toForm(own.data!));
              setChosen(own.data!.specialties.map((x) => x.specialty.id));
            }}
          />
        </Notice>
      )}

      <Section title="Foto de perfil">
        <Card>
          <Row>
            <Avatar uri={base.photoUrl} name={`${base.firstName} ${base.lastName}`} size={80} />
            <View style={{ flex: 1, gap: 6 }}>
              <Button
                title={base.photoUrl ? 'Cambiar foto' : 'Subir foto'}
                variant="secondary"
                loading={photo.busy}
                disabled={!online}
                onPress={() => void changePhoto()}
              />
              <Muted>Obligatoria para publicarte. JPG, PNG o WebP. También acompaña tu ficha cuando se comparte.</Muted>
            </View>
          </Row>
          <ErrorText message={photo.error} />
        </Card>
      </Section>

      <Section title="Información básica">
        <Card>
          <Field
            label="Nombres"
            value={form.firstName}
            onChangeText={(v) => set('firstName', v)}
            autoCapitalize="words"
            maxLength={80}
          />
          <Field
            label="Apellidos"
            value={form.lastName}
            onChangeText={(v) => set('lastName', v)}
            autoCapitalize="words"
            maxLength={80}
          />
          <Field
            label="Biografía profesional"
            value={form.bio}
            onChangeText={(v) => set('bio', v)}
            multiline
            maxLength={2000}
            hint="Obligatoria para publicarte (mínimo 80 caracteres). Cuéntale a los pacientes sobre tu formación y experiencia."
          />
          <Field
            label="Cédula de identidad"
            value={form.cedula}
            onChangeText={(v) => set('cedula', v)}
            placeholder="V-12345678"
            autoCapitalize="characters"
            hint="Privada: solo la ve el equipo que verifica tus documentos."
          />
          <Field
            label="RIF"
            value={form.rif}
            onChangeText={(v) => set('rif', v)}
            placeholder="V-12345678-9"
            autoCapitalize="characters"
            hint="Privado: nunca se muestra ni se puede buscar."
          />
        </Card>
      </Section>

      <Section
        title="Avales legales y gremiales (Monagas)"
        description="Estos números se muestran públicamente en tu perfil verificado, según las normativas del MPPS y el Colegio de Médicos de Monagas."
      >
        <Card>
          <Field
            label="N° Registro MPPS (SACS)"
            value={form.mppsNumber}
            onChangeText={(v) => set('mppsNumber', v)}
            maxLength={20}
          />
          <Field
            label="N° Colegio de Médicos Monagas"
            value={form.colmedMonagasNumber}
            onChangeText={(v) => set('colmedMonagasNumber', v)}
            maxLength={20}
          />
        </Card>
      </Section>

      <Section
        title="Especialidades"
        description="«Medicina General» no pide documentos extra; cualquier otra especialidad requiere tu título de postgrado y la credencial de especialidad en Documentos."
      >
        <Card>
          <Row>
            {specialties.map((sp) => (
              <Chip
                key={sp.id}
                label={sp.name}
                selected={chosen.includes(sp.id)}
                onPress={() => {
                  setSaved(false);
                  setChosen((c) => (c.includes(sp.id) ? c.filter((x) => x !== sp.id) : [...c, sp.id]));
                }}
              />
            ))}
          </Row>
        </Card>
      </Section>

      <Section title="Contacto y ubicación">
        <Card>
          <Field
            label="Teléfono"
            value={form.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
            placeholder="0414-1234567"
            maxLength={12}
          />
          <Field
            label="WhatsApp"
            value={form.whatsapp}
            onChangeText={(v) => set('whatsapp', v)}
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
          <Field
            label="Dirección de consulta"
            value={form.address}
            onChangeText={(v) => set('address', v)}
            multiline
            maxLength={300}
            hint="Se muestra en tu ficha para que los pacientes lleguen; no se puede buscar por ella."
          />
        </Card>
      </Section>

      <Section title="Resumen para buscadores">
        <Card>
          <Field
            label="Resumen corto (extracto)"
            value={form.seoDescription}
            onChangeText={(v) => set('seoDescription', v)}
            multiline
            maxLength={160}
            hint={`1 o 2 líneas sobre tu práctica. Con tu nombre y especialidad forma la descripción que muestra Google. ${form.seoDescription.length}/160 caracteres.`}
          />
        </Card>
      </Section>

      {saved && <Notice tone="success">Perfil actualizado correctamente.</Notice>}
      {!online && <Notice tone="warning">Sin conexión: para guardar tu perfil necesitas internet.</Notice>}
      <ErrorText message={save.error} />
      <Button title="Guardar cambios" loading={save.busy} disabled={!online || !dirty} onPress={() => void submit()} />

      <VideoSection planTier={planTier} initial={base.presentationVideoId} online={online} />
      <SocialSection planTier={planTier} initial={base.socialLinks} online={online} />
      <LocationsSection online={online} />
      <AffiliationsSection online={online} />
    </Screen>
  );
}

function VideoSection({ planTier, initial, online }: { planTier: PlanTier; initial: string | null; online: boolean }) {
  const [videoId, setVideoId] = useState(initial);
  const [url, setUrl] = useState(initial ? youTubeShortUrl(initial) : '');
  const [message, setMessage] = useState<string | null>(null);
  const action = useAction();
  const draftId = parseYouTubeVideoId(url);
  const save = (next: string | null) =>
    action.run(async () => {
      setMessage(null);
      const saved = await request<{ presentationVideoId: string | null }>(
        '/professionals/me/presentation-video',
        'PUT',
        { url: next },
      );
      setVideoId(saved.presentationVideoId);
      setUrl(saved.presentationVideoId ? youTubeShortUrl(saved.presentationVideoId) : '');
      setMessage(
        saved.presentationVideoId ? 'Video guardado: ya se ve en tu ficha.' : 'Quitaste el video de tu ficha.',
      );
    });
  return (
    <Section title="Video de presentación">
      <Card>
        {planTier !== 'AGENCY' ? (
          <>
            <Body>El video de presentación en tu ficha está disponible con el plan Marca Médica.</Body>
            {videoId && (
              <>
                <Muted>Tu video sigue guardado, pero no se muestra con tu plan actual.</Muted>
                <Button
                  title="Quitar video"
                  variant="ghost"
                  small
                  loading={action.busy}
                  disabled={!online}
                  onPress={() => void save(null)}
                />
              </>
            )}
          </>
        ) : (
          <>
            <Body>Cuando tu video esté en YouTube, pega aquí el enlace del que quieras mostrar en tu ficha.</Body>
            <Field
              label="Enlace del video en YouTube"
              value={url}
              onChangeText={setUrl}
              placeholder="https://youtu.be/…"
              autoCapitalize="none"
              maxLength={300}
              error={url.trim() && !draftId ? 'Pega un enlace de YouTube (youtu.be/… o youtube.com/watch?v=…).' : null}
              hint="El video debe ser público u oculto (no privado) y permitir que se inserte en otros sitios."
            />
            <Button
              title={videoId ? 'Cambiar video' : 'Guardar video'}
              loading={action.busy}
              disabled={!online || !draftId || draftId === videoId}
              onPress={() => void save(url.trim())}
            />
            {videoId && (
              <Row>
                <Button
                  title="Ver en YouTube"
                  variant="secondary"
                  small
                  onPress={() => void Linking.openURL(youTubeShortUrl(videoId))}
                />
                <Button title="Quitar video" variant="ghost" small disabled={!online} onPress={() => void save(null)} />
              </Row>
            )}
          </>
        )}
        {!!message && <Notice tone="success">{message}</Notice>}
        <ErrorText message={action.error} />
      </Card>
    </Section>
  );
}

function SocialSection({
  planTier,
  initial,
  online,
}: {
  planTier: PlanTier;
  initial: { platform: SocialPlatform; url: string }[];
  online: boolean;
}) {
  const limits = DOCTOR_SOCIAL_LIMITS[planTier] ?? DOCTOR_SOCIAL_LIMITS.FREE;
  const [links, setLinks] = useState(initial.map(({ platform, url }) => ({ platform, url })));
  const [platform, setPlatform] = useState<SocialPlatform | ''>('');
  const [url, setUrl] = useState('');
  const action = useAction();
  const available = limits.allowedPlatforms.filter((p) => !links.some((l) => l.platform === p));
  const save = (next: typeof links) =>
    action.run(async () => {
      const saved = await request<{ platform: SocialPlatform; url: string }[]>(
        '/professionals/me/social-links',
        'PUT',
        {
          links: next.map(({ platform: p, url: u }) => ({ platform: p, url: u })),
        },
      );
      setLinks(saved.map(({ platform: p, url: u }) => ({ platform: p, url: u })));
      return true;
    });
  return (
    <Section title="Redes sociales y web">
      <Card>
        {limits.maxLinks === 0 ? (
          <Body>Mostrar tus redes sociales y tu sitio web en tu ficha está disponible desde el plan Plus.</Body>
        ) : (
          <>
            <Muted>
              Tu plan permite hasta {limits.maxLinks} {limits.maxLinks === 1 ? 'red' : 'redes'} sin repetir, con la
              dirección oficial de cada una (ej. instagram.com/tu_usuario).
            </Muted>
            {links.map((l) => (
              <Row key={l.platform} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body>{SOCIAL_LABELS[l.platform] ?? l.platform}</Body>
                  <Muted>{l.url}</Muted>
                </View>
                <Button
                  title="Eliminar"
                  variant="ghost"
                  small
                  disabled={!online || action.busy}
                  onPress={() => void save(links.filter((x) => x.platform !== l.platform))}
                />
              </Row>
            ))}
            {links.length >= limits.maxLinks ? (
              <Muted>Ya agregaste el máximo de redes de tu plan.</Muted>
            ) : (
              <>
                <Select
                  label="Red"
                  value={platform}
                  onChange={(v) => setPlatform(v as SocialPlatform)}
                  options={available.map((p) => ({ value: p, label: SOCIAL_LABELS[p] ?? p }))}
                />
                <Field
                  label="Dirección oficial"
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder={platform ? SOCIAL_PLATFORM_EXAMPLE[platform] : 'Elige una red primero'}
                />
                <Button
                  title="Agregar"
                  loading={action.busy}
                  disabled={!online || !platform || !url.trim()}
                  onPress={() =>
                    void save([...links, { platform: platform as SocialPlatform, url: url.trim() }]).then((ok) => {
                      if (ok) {
                        setPlatform('');
                        setUrl('');
                      }
                    })
                  }
                />
              </>
            )}
          </>
        )}
        <ErrorText message={action.error} />
      </Card>
    </Section>
  );
}

interface Location {
  id: string;
  name: string;
  address: string;
  municipality: string | null;
  phone: string | null;
  whatsapp: string | null;
}

function LocationsSection({ online }: { online: boolean }) {
  const municipalities = useMunicipalities();
  const list = useApi<Location[]>('/professionals/me/locations', { cacheKey: 'me:locations', topics: ['profile'] });
  const [form, setForm] = useState({ name: '', address: '', municipality: '', phone: '', whatsapp: '' });
  const action = useAction();
  const locked = !!list.error && /plan/i.test(list.error);
  const add = () =>
    action.run(async () => {
      await request('/professionals/me/locations', 'POST', {
        name: form.name.trim(),
        address: form.address.trim(),
        municipality: form.municipality || undefined,
        phone: form.phone.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
      });
      setForm({ name: '', address: '', municipality: '', phone: '', whatsapp: '' });
      await list.reload();
    });
  return (
    <Section title="Sedes adicionales">
      <Card>
        {locked ? (
          <Body>Atender en varias sedes está disponible desde el plan Plus.</Body>
        ) : (
          <>
            {(list.data ?? []).map((loc) => (
              <Row key={loc.id} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body>{loc.name}</Body>
                  <Muted>
                    {loc.address}
                    {loc.municipality ? `, ${loc.municipality}` : ''}
                  </Muted>
                </View>
                <Button
                  title="Eliminar"
                  variant="ghost"
                  small
                  disabled={!online || action.busy}
                  onPress={() =>
                    Alert.alert('Eliminar sede', `¿Eliminar «${loc.name}»?`, [
                      { text: 'Volver', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: () =>
                          void action.run(async () => {
                            await request(`/professionals/me/locations/${loc.id}`, 'DELETE');
                            await list.reload();
                          }),
                      },
                    ])
                  }
                />
              </Row>
            ))}
            <Field
              label="Nombre de la sede"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              maxLength={120}
            />
            <Select
              label="Municipio"
              value={form.municipality}
              onChange={(v) => setForm({ ...form, municipality: v })}
              options={municipalityOptions(municipalities)}
            />
            <Field
              label="Dirección"
              value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })}
              multiline
              maxLength={300}
            />
            <Field
              label="Teléfono"
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              keyboardType="phone-pad"
              maxLength={12}
            />
            <Field
              label="WhatsApp"
              value={form.whatsapp}
              onChangeText={(v) => setForm({ ...form, whatsapp: v })}
              keyboardType="phone-pad"
              maxLength={12}
            />
            <Button
              title="Agregar sede"
              loading={action.busy}
              disabled={!online || !form.name.trim() || !form.address.trim()}
              onPress={() => void add()}
            />
          </>
        )}
        <ErrorText message={action.error ?? (locked ? null : list.error)} />
      </Card>
    </Section>
  );
}

interface Affiliation {
  organizationId: string;
  status: 'PENDING' | 'ACCEPTED';
  organization: { id: string; slug: string; name: string; type: 'PHARMACY' | 'LABORATORY' | 'CLINIC' };
}
const ORG_TYPE: Record<Affiliation['organization']['type'], string> = {
  PHARMACY: 'Farmacia',
  LABORATORY: 'Laboratorio',
  CLINIC: 'Clínica',
};

function AffiliationsSection({ online }: { online: boolean }) {
  const list = useApi<Affiliation[]>('/organizations/affiliations/me', {
    cacheKey: 'me:affiliations',
    topics: ['organization'],
  });
  const action = useAction();
  if (!list.data?.length) return null;
  const respond = (organizationId: string, accept: boolean) =>
    action.run(async () => {
      list.setData(
        await request<Affiliation[]>(`/organizations/affiliations/me/${organizationId}`, 'PATCH', { accept }),
      );
    });
  return (
    <Section
      title="Organizaciones asociadas"
      description="Clínicas o laboratorios que quieren mostrarte como médico asociado. Solo apareces vinculado si aceptas."
    >
      <Card>
        {list.data.map((a) => (
          <View key={a.organizationId} style={{ gap: 6 }}>
            <Row>
              <Body>{a.organization.name}</Body>
              <Muted>{ORG_TYPE[a.organization.type]}</Muted>
              <Badge
                label={a.status === 'ACCEPTED' ? 'Asociado' : 'Invitación'}
                tone={a.status === 'ACCEPTED' ? 'success' : 'warning'}
              />
            </Row>
            <Row>
              {a.status === 'PENDING' && (
                <Button
                  title="Aceptar"
                  small
                  disabled={!online || action.busy}
                  onPress={() => void respond(a.organizationId, true)}
                />
              )}
              <Button
                title={a.status === 'PENDING' ? 'Rechazar' : 'Desvincular'}
                variant="secondary"
                small
                disabled={!online || action.busy}
                onPress={() => void respond(a.organizationId, false)}
              />
            </Row>
          </View>
        ))}
        <ErrorText message={action.error} />
      </Card>
    </Section>
  );
}
