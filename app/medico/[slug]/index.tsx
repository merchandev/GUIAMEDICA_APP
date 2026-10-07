import React from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SITE_URL } from '../../../src/config';
import { ContactRequestForm } from '../../../src/components/ContactRequestForm';
import { average, DoctorReviews, stars, type ReviewPage } from '../../../src/components/DoctorReviews';
import { MessageForm } from '../../../src/components/MessageForm';
import { doctorName, SOCIAL_LABELS, type DoctorProfile } from '../../../src/contracts';
import { useApi } from '../../../src/data';
import { EMERGENCY_NOTICE, MEDICAL_DISCLAIMER, VERIFICATION_NOTICE } from '../../../src/legal';
import { openLegal } from '../../../src/nav';
import { useSession } from '../../../src/session';
import {
  Avatar,
  Badge,
  Body,
  Button,
  Card,
  colors,
  Empty,
  ErrorText,
  KeyValue,
  List,
  ListItem,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Title,
} from '../../../src/ui';

type Profile = DoctorProfile & {
  latitude?: number | null;
  longitude?: number | null;
  rating?: { average: number | null; count: number } | null;
};

/** WhatsApp con el código de Venezuela: «0414-1234567» → «584141234567». */
const whatsappNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('0') ? `58${digits.slice(1)}` : digits;
};

/** Ficha pública de un médico, como en la web, con su reserva y su contacto. */
export default function DoctorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useSession();
  const doctor = useApi<Profile>(`/professionals/${encodeURIComponent(slug)}`, {
    cacheKey: `pub:doctor:${slug}`,
    topics: ['directory'],
  });
  const reviews = useApi<ReviewPage>(`/reviews/professional/${encodeURIComponent(slug)}`);
  const d = doctor.data;
  if (!d)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Médico' }} />
        {doctor.loading ? (
          <Loading />
        ) : (
          <Empty title="No pudimos abrir esta ficha" description={doctor.error ?? undefined} />
        )}
      </Screen>
    );

  const name = doctorName(d);
  const specialties = d.specialties.map((x) => x.specialty.name).join(' · ') || 'Medicina general';
  const isPatient = user?.role === 'USER';
  const hasContact = !!(d.whatsapp || d.phone || d.address || d.socialLinks.length || d.presentationVideoId);
  return (
    <Screen refreshing={doctor.refreshing} onRefresh={doctor.refresh} savedAt={doctor.savedAt}>
      <Stack.Screen options={{ title: `${d.firstName} ${d.lastName}` }} />
      <Card>
        <View style={s.header}>
          <Avatar uri={d.photoUrl} name={`${d.firstName} ${d.lastName}`} size={84} />
          <View style={{ flex: 1, gap: 4 }}>
            <Title>{name}</Title>
            <Text style={s.specialties}>{specialties}</Text>
            <Muted>{d.municipality ? `${d.municipality}, Monagas` : 'Monagas'}</Muted>
          </View>
        </View>
        <Row>
          <Badge
            label={d.verificationStatus === 'VERIFIED' ? 'Documentación verificada' : 'Verificación en curso'}
            tone={d.verificationStatus === 'VERIFIED' ? 'success' : 'neutral'}
          />
          {d.isFeatured && <Badge label="Destacado · patrocinado" tone="gold" />}
        </Row>
        {!!d.rating?.average && (
          <Text style={s.rating}>
            {stars(d.rating.average)} {average(d.rating.average)} ·{' '}
            {d.rating.count === 1 ? '1 opinión' : `${d.rating.count} opiniones`}
          </Text>
        )}
        {!!d.publicCode && (
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>
              Código del médico: <Text style={s.code}>{d.publicCode}</Text>
            </Muted>
            <Button
              title="Compartir"
              variant="secondary"
              small
              onPress={() =>
                void Share.share({
                  message: `${name}, ${specialties}, en Guía Médica Monagas: ${SITE_URL}/medicos/${d.slug}`,
                })
              }
            />
          </Row>
        )}
        {!!d.bio && <Body>{d.bio}</Body>}
      </Card>

      {d.bookingEnabled && (
        <Button
          title="Agendar cita"
          onPress={() => router.push({ pathname: '/medico/[slug]/agendar', params: { slug: d.slug } })}
        />
      )}

      {hasContact ? (
        <Section title="Contacto">
          <List>
            {!!d.whatsapp && (
              <ListItem
                title="Escribir por WhatsApp"
                subtitle={d.whatsapp}
                onPress={() => void Linking.openURL(`https://wa.me/${whatsappNumber(d.whatsapp!)}`)}
              />
            )}
            {!!d.phone && (
              <ListItem
                title="Llamar"
                subtitle={d.phone}
                onPress={() => void Linking.openURL(`tel:${d.phone!.replace(/[^\d+]/g, '')}`)}
              />
            )}
            {!!d.address && (
              <ListItem
                title="Dirección de consulta"
                subtitle={`${d.address}${d.municipality ? `, ${d.municipality}` : ''}`}
                onPress={
                  d.latitude && d.longitude
                    ? () => void Linking.openURL(`geo:${d.latitude},${d.longitude}?q=${d.latitude},${d.longitude}`)
                    : undefined
                }
              />
            )}
            {d.socialLinks.map((link) => (
              <ListItem
                key={link.platform}
                title={SOCIAL_LABELS[link.platform] ?? link.platform}
                subtitle={link.url.replace(/^https:\/\/(www\.)?/, '')}
                onPress={() => void Linking.openURL(link.url)}
              />
            ))}
            {!!d.presentationVideoId && (
              <ListItem
                title="Video de presentación"
                subtitle="Se abre en YouTube"
                onPress={() => void Linking.openURL(`https://www.youtube.com/watch?v=${d.presentationVideoId}`)}
              />
            )}
          </List>
        </Section>
      ) : (
        !d.bookingEnabled && <Muted>Este médico todavía no publicó datos de contacto.</Muted>
      )}

      {d.locations.length > 0 && (
        <Section title="Otras sedes">
          {d.locations.map((loc) => (
            <Card key={loc.id}>
              <Text style={s.locationName}>{loc.name}</Text>
              <Muted>
                {loc.address}
                {loc.municipality ? `, ${loc.municipality}` : ''}
              </Muted>
            </Card>
          ))}
        </Section>
      )}

      <Section title="Transparencia médica y legal">
        <Card>
          <Body>
            {d.verificationStatus === 'VERIFIED'
              ? 'Verificado: Guía Médica Monagas revisó y aprobó todos los documentos exigidos a este profesional. La verificación es la misma para todos los planes.'
              : 'Verificación en curso: un administrador ya aprobó parte de sus documentos y revisa el resto. El sello de verificado se otorga con todos aprobados.'}
          </Body>
          {d.registrations.length > 0 ? (
            d.registrations.map((reg) => (
              <KeyValue
                key={`${reg.type}-${reg.issuer}`}
                label={`${reg.issuer}${reg.verifiedAt ? ' · verificado' : ''}`}
                value={reg.number}
              />
            ))
          ) : (
            <>
              <KeyValue label="N° MPPS" value={d.mppsNumber || 'No especificado'} />
              <KeyValue label="Colegio de Médicos" value={d.colmedMonagasNumber || 'No especificado'} />
            </>
          )}
          {d.organizations.length > 0 && (
            <Muted>Atiende en: {d.organizations.map((o) => o.organization.name).join(', ')}</Muted>
          )}
          <Muted>{VERIFICATION_NOTICE}</Muted>
          <Button
            title="Política de verificación"
            variant="ghost"
            small
            onPress={() => openLegal('/verificacion-profesionales')}
          />
        </Card>
      </Section>

      {d.posts.length > 0 && (
        <Section title="Publicaciones">
          {d.posts.map((post) => (
            <Card key={post.id}>
              <Text style={s.locationName}>{post.title}</Text>
              <Body>{post.content}</Body>
            </Card>
          ))}
        </Section>
      )}

      <Section title={isPatient ? 'Quiero que me contacte' : 'Enviar un mensaje'}>
        <Card>
          {!d.canReceiveMessages ? (
            <Muted>Este médico no recibe mensajes por la plataforma. Usa sus datos de contacto.</Muted>
          ) : isPatient ? (
            <ContactRequestForm slug={d.slug} name={`${d.firstName} ${d.lastName}`} />
          ) : (
            <MessageForm slug={d.slug} name={`${d.firstName} ${d.lastName}`} />
          )}
        </Card>
      </Section>

      {reviews.data?.enabled && <DoctorReviews slug={d.slug} first={reviews.data} />}

      <ErrorText message={doctor.error} />
      <Notice tone="neutral">{`${MEDICAL_DISCLAIMER} ${EMERGENCY_NOTICE}`}</Notice>
      <Button title="Descargo médico" variant="ghost" small onPress={() => openLegal('/descargo-medico')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  specialties: { fontSize: 15, color: colors.accent, fontWeight: '600' },
  rating: { fontSize: 15, color: colors.text },
  code: { fontWeight: '700', color: colors.text, letterSpacing: 1 },
  locationName: { fontSize: 16, color: colors.text, fontWeight: '600' },
});
