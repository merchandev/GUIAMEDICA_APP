import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../src/api';
import { StarInput, Stars } from '../../src/components/Stars';
import { useApi, useAction } from '../../src/data';
import { capitalizeFirst, monthLabel } from '../../src/dates';
import { useFeatures } from '../../src/features';
import { openDoctor } from '../../src/nav';
import {
  REVIEW_BASIS_LABEL,
  REVIEW_RULES,
  REVIEW_RULES_VERSION,
  REVIEW_STATUS,
  type ReviewAuthorDisplay,
  type ReviewBasis,
  type ReviewStatus,
} from '../../src/reviews';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Check,
  colors,
  Empty,
  ErrorText,
  Field,
  Heading,
  Loading,
  Muted,
  Notice,
  radius,
  Row,
  Screen,
  Section,
  s as ui,
  Title,
} from '../../src/ui';

interface Requirements {
  completeness: { percent: number; items: { key: string; label: string; done: boolean }[] };
  identity: 'MISSING' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  emailVerified: boolean;
  adult: boolean;
  canReview: boolean;
  blockers: string[];
}

interface OwnReview {
  id: string;
  rating: number;
  comment: string | null;
  authorDisplay: ReviewAuthorDisplay;
  status: ReviewStatus;
  moderationNote: string | null;
  consultationMonth: string;
  reply: { content: string } | null;
}

interface DoctorEntry {
  professional: { id: string; slug: string; name: string; specialty: string | null; isPublished: boolean };
  consultation: { basis: ReviewBasis; month: string } | null;
  review: OwnReview | null;
}

interface MyReviews {
  requirements: Requirements;
  authorPreview: string | null;
  doctors: DoctorEntry[];
}

const IDENTITY_LABEL: Record<Requirements['identity'], string> = {
  MISSING: 'Falta subir la foto de tu cédula',
  PENDING: 'En revisión',
  VERIFIED: 'Verificada',
  REJECTED: 'Rechazada: sube una foto nueva',
};
const COMMENT_MAX = 1000;

/** Opinar sobre los médicos con consulta verificada (como «Mis valoraciones» en la web). */
export default function MyReviewsScreen() {
  const { medico } = useLocalSearchParams<{ medico?: string }>();
  const { user, online } = useSession();
  const { reviews: enabled } = useFeatures();
  const data = useApi<MyReviews>(user && enabled ? '/reviews/me' : null, {
    cacheKey: 'me:reviews',
    topics: ['reviews', 'appointments'],
  });
  const [editing, setEditing] = useState<DoctorEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();
  const opened = useRef(false);

  // ?medico=… llega desde «Mis citas»: abre su formulario una vez.
  useEffect(() => {
    const d = data.data;
    if (!d || opened.current || !medico) return;
    opened.current = true;
    const entry = d.doctors.find((x) => x.professional.slug === medico);
    if (entry && d.requirements.canReview && entry.consultation && entry.review?.status !== 'WITHDRAWN')
      setEditing(entry);
  }, [data.data, medico]);

  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;
  if (!enabled)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Mis valoraciones' }} />
        <Empty
          title="Las valoraciones aún no están disponibles"
          description="Te avisaremos cuando puedas opinar sobre tus médicos."
        />
      </Screen>
    );
  const d = data.data;
  if (!d)
    return (
      <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
        <Stack.Screen options={{ title: 'Mis valoraciones' }} />
        {data.loading ? <Loading /> : <ErrorText message={data.error} />}
      </Screen>
    );

  if (editing)
    return (
      <ReviewForm
        entry={editing}
        authorPreview={d.authorPreview}
        online={online}
        onClose={() => setEditing(null)}
        onDone={(status) => {
          setEditing(null);
          setNotice(
            status === 'PUBLISHED'
              ? '¡Gracias! Tu valoración ya está publicada.'
              : '¡Gracias! El equipo revisará tu comentario antes de publicarlo.',
          );
          void data.reload();
        }}
      />
    );

  const { requirements } = d;
  const linkedMissing = !!medico && !d.doctors.some((x) => x.professional.slug === medico && x.consultation);
  const remove = (review: OwnReview) =>
    Alert.alert('Borrar valoración', '¿Borrar tu valoración? Puedes escribir otra después.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          void action.run(async () => {
            await request(`/reviews/${review.id}`, 'DELETE');
            setNotice('Borraste tu valoración.');
            await data.reload();
          }),
      },
    ]);

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh} savedAt={data.savedAt}>
      <Stack.Screen options={{ title: 'Mis valoraciones' }} />
      <Title>Mis valoraciones</Title>
      <Body>
        Puedes opinar sobre los médicos con los que tuviste una consulta verificada: una cita realizada en la plataforma
        o que te hayan registrado con tu código.
      </Body>
      {!!notice && <Notice tone="success">{notice}</Notice>}
      <ErrorText message={data.error ?? action.error} />
      {linkedMissing && (
        <Notice tone="warning">
          Todavía no puedes valorar a ese médico: hace falta una consulta verificada con él o ella (una cita realizada
          en la plataforma o que te haya registrado con tu código).
        </Notice>
      )}

      <Section
        title="Requisitos para valorar"
        right={
          <Badge
            label={requirements.canReview ? 'Cumples los requisitos' : 'Faltan pasos'}
            tone={requirements.canReview ? 'success' : 'warning'}
          />
        }
      >
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={ui.label}>Tu registro</Text>
            <Text style={ui.label}>{requirements.completeness.percent} %</Text>
          </Row>
          <View
            style={s.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: requirements.completeness.percent }}
          >
            <View style={[s.fill, { width: `${requirements.completeness.percent}%` }]} />
          </View>
          {requirements.completeness.items.map((item) => (
            <Text key={item.key} style={[s.item, !item.done && { color: colors.muted }]}>
              {item.done ? '✓' : '○'} {item.label}
            </Text>
          ))}
          <Text style={[s.item, requirements.identity !== 'VERIFIED' && { color: colors.muted }]}>
            {requirements.identity === 'VERIFIED' ? '✓' : '○'} Cédula aprobada: {IDENTITY_LABEL[requirements.identity]}
          </Text>
          {!requirements.canReview && (
            <Notice tone="warning">
              <View style={{ gap: 4 }}>
                {requirements.blockers.map((b) => (
                  <Text key={b} style={s.blocker}>
                    • {b}
                  </Text>
                ))}
              </View>
              <Button
                title="Completar mi ficha"
                variant="secondary"
                small
                onPress={() => router.push('/paciente/perfil')}
              />
            </Notice>
          )}
          <Muted>
            No te pedimos datos de salud para opinar: solo tu identidad y tu contacto, para saber que eres una persona
            real.
          </Muted>
        </Card>
      </Section>

      <Section title="Tus médicos">
        {d.doctors.length === 0 ? (
          <Empty
            title="Todavía no tienes consultas verificadas"
            description="Cuando un médico marque como realizada una cita tuya, o te registre con tu código, podrás valorarlo aquí."
          />
        ) : (
          d.doctors.map((entry) => {
            const { professional, consultation, review } = entry;
            const canWrite =
              requirements.canReview && !!consultation && professional.isPublished && review?.status !== 'WITHDRAWN';
            return (
              <Card
                key={professional.id}
                style={medico === professional.slug ? { borderColor: colors.accent, borderWidth: 2 } : undefined}
              >
                <Pressable accessibilityRole="link" onPress={() => openDoctor(professional.slug)} hitSlop={6}>
                  <Text style={[ui.itemTitle, { color: colors.primary }]}>Dr(a). {professional.name}</Text>
                </Pressable>
                {!!professional.specialty && <Muted>{professional.specialty}</Muted>}
                {consultation && (
                  <Muted>
                    {REVIEW_BASIS_LABEL[consultation.basis]} · {capitalizeFirst(monthLabel(consultation.month))}
                  </Muted>
                )}
                {review && (
                  <Badge label={REVIEW_STATUS[review.status].label} tone={REVIEW_STATUS[review.status].tone} />
                )}
                {review && (
                  <View style={s.review}>
                    <Stars value={review.rating} />
                    {!!review.comment && <Body>{review.comment}</Body>}
                    <Muted>
                      Se muestra como:{' '}
                      {review.authorDisplay === 'INITIAL' && d.authorPreview ? d.authorPreview : 'Paciente verificado'}
                    </Muted>
                    {review.status === 'PENDING' && <Muted>El equipo revisa tu comentario antes de publicarlo.</Muted>}
                    {review.status === 'REJECTED' && (
                      <Notice tone="danger">{`No se publicó${review.moderationNote ? `: ${review.moderationNote}` : '.'} Puedes corregirla y enviarla de nuevo.`}</Notice>
                    )}
                    {review.status === 'WITHDRAWN' && (
                      <Notice tone="neutral">
                        {`La administración la retiró del sitio${review.moderationNote ? `: ${review.moderationNote}` : '.'} Si no estás de acuerdo, puedes reclamar en «Reclamos y solicitudes».`}
                      </Notice>
                    )}
                    {review.reply && (
                      <View style={s.reply}>
                        <Text style={s.replyTitle}>Respuesta del médico</Text>
                        <Body>{review.reply.content}</Body>
                      </View>
                    )}
                  </View>
                )}
                <Row>
                  {canWrite && (
                    <Button
                      title={review ? 'Editar mi opinión' : 'Valorar'}
                      variant={review ? 'secondary' : 'primary'}
                      small
                      onPress={() => setEditing(entry)}
                    />
                  )}
                  {review && review.status !== 'WITHDRAWN' && (
                    <Button
                      title="Borrar"
                      variant="ghost"
                      small
                      disabled={!online || action.busy}
                      onPress={() => remove(review)}
                    />
                  )}
                </Row>
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}

function ReviewForm({
  entry,
  authorPreview,
  online,
  onClose,
  onDone,
}: {
  entry: DoctorEntry;
  authorPreview: string | null;
  online: boolean;
  onClose: () => void;
  onDone: (status: ReviewStatus) => void;
}) {
  const existing = entry.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [authorDisplay, setAuthorDisplay] = useState<ReviewAuthorDisplay>(existing?.authorDisplay ?? 'ANONYMOUS');
  const [accepted, setAccepted] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const action = useAction();

  const submit = () => {
    if (!rating) {
      setRatingError('Elige de 1 a 5 estrellas');
      return;
    }
    setRatingError(null);
    void action.run(async () => {
      const body = { rating, comment: comment.trim(), authorDisplay, acceptRules: accepted };
      const result = existing
        ? await request<{ status: ReviewStatus }>(`/reviews/${existing.id}`, 'PATCH', body)
        : await request<{ status: ReviewStatus }>('/reviews', 'POST', {
            ...body,
            professionalId: entry.professional.id,
          });
      onDone(result.status);
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Tu opinión' }} />
      <Title>Tu opinión sobre Dr(a). {entry.professional.name}</Title>
      {existing?.status === 'PUBLISHED' && (
        <Notice tone="info">
          Si la guardas con comentario, sale del sitio hasta que el equipo revise el comentario.
        </Notice>
      )}
      <Card>
        <StarInput value={rating} onChange={setRating} error={ratingError} />
        <Field
          label="Comentario (opcional)"
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={COMMENT_MAX}
          hint={`${comment.length}/${COMMENT_MAX}. Sobre la atención: trato, puntualidad, explicaciones, el lugar de consulta.`}
        />
        <Text style={ui.label}>Cómo se muestra tu nombre</Text>
        <Check
          label="«Paciente verificado»"
          description="Recomendado: nadie sabe quién eres."
          value={authorDisplay === 'ANONYMOUS'}
          onValueChange={() => setAuthorDisplay('ANONYMOUS')}
        />
        <Check
          label={`Mi nombre y la inicial de mi apellido${authorPreview ? ` («${authorPreview}»)` : ''}`}
          value={authorDisplay === 'INITIAL'}
          onValueChange={() => setAuthorDisplay('INITIAL')}
        />
      </Card>
      <Card>
        <Heading>Reglas de las valoraciones (versión {REVIEW_RULES_VERSION})</Heading>
        {REVIEW_RULES.map((rule) => (
          <Text key={rule} style={s.rule}>
            • {rule}
          </Text>
        ))}
        <Check label="Acepto estas reglas." value={accepted} onValueChange={setAccepted} />
      </Card>
      {!online && <Notice tone="warning">Sin conexión: para enviar tu valoración necesitas internet.</Notice>}
      <ErrorText message={action.error} />
      <Button
        title={existing ? 'Guardar y enviar' : 'Enviar valoración'}
        loading={action.busy}
        disabled={!accepted || !online}
        onPress={submit}
      />
      <Button title="Cancelar" variant="ghost" onPress={onClose} />
    </Screen>
  );
}

const s = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.secondary, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
  item: { fontSize: 14, color: colors.text, lineHeight: 21 },
  blocker: { fontSize: 14, color: colors.warning, lineHeight: 21 },
  review: { backgroundColor: colors.background, borderRadius: radius.m, padding: 12, gap: 6 },
  reply: { backgroundColor: colors.white, borderRadius: radius.s, padding: 10, gap: 4 },
  replyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rule: { fontSize: 14, color: colors.body, lineHeight: 21 },
});
