import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { request } from '../../src/api';
import { average, BASIS_LABEL } from '../../src/components/DoctorReviews';
import { Stars } from '../../src/components/Stars';
import { useApi, useAction } from '../../src/data';
import { capitalizeFirst, monthLabel, formatDate } from '../../src/dates';
import { useFeatures } from '../../src/features';
import { openDoctor } from '../../src/nav';
import {
  REPORT_REASONS,
  REVIEW_STATUS,
  type ReviewBasis,
  type ReviewReportReason,
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
  Title,
} from '../../src/ui';

interface DoctorReview {
  id: string;
  rating: number;
  comment: string | null;
  author: string;
  basis: ReviewBasis;
  consultationMonth: string;
  reply: { content: string; status: ReviewStatus; moderationNote: string | null; updatedAt: string } | null;
  report: { reason: ReviewReportReason; status: 'OPEN' | 'UPHELD' | 'DISMISSED'; createdAt: string } | null;
}

interface DoctorReviewsPage {
  slug: string;
  isPublished: boolean;
  summary: { average: number | null; count: number; distribution: { stars: number; count: number }[] | null };
  items: DoctorReview[];
  total: number;
  page: number;
  totalPages: number;
}

const REPORT_STATUS: Record<NonNullable<DoctorReview['report']>['status'], string> = {
  OPEN: 'La administración la está revisando',
  UPHELD: 'La administración te dio la razón',
  DISMISSED: 'La administración la revisó y la mantuvo',
};
const REVIEW_REPLY_NOTICE =
  'Tu respuesta es pública y el equipo la revisa antes de publicarla. Por el secreto médico, no reveles nada clínico del paciente ni datos que permitan identificarlo.';
const TEXT_MAX = 1000;

/** Opiniones de los pacientes del médico, con respuesta y denuncia (como en la web). */
export default function DoctorReviewsScreen() {
  const { user, online } = useSession();
  const { reviews: enabled } = useFeatures();
  const [page, setPage] = useState(1);
  const [replying, setReplying] = useState<DoctorReview | null>(null);
  const [reporting, setReporting] = useState<DoctorReview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();
  const data = useApi<DoctorReviewsPage>(
    user?.role === 'PROFESSIONAL' && enabled ? `/reviews/me/professional?page=${page}` : null,
    {
      cacheKey: `me:doctor-reviews:${page}`,
      topics: ['reviews'],
    },
  );
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  if (!enabled)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Valoraciones' }} />
        <Empty title="Las valoraciones aún no están disponibles" />
      </Screen>
    );
  if (replying)
    return (
      <ReplyForm
        review={replying}
        online={online}
        onClose={() => setReplying(null)}
        onDone={() => {
          setReplying(null);
          setNotice('Enviaste tu respuesta: se publica cuando el equipo la revise.');
          void data.reload();
        }}
      />
    );
  if (reporting)
    return (
      <ReportForm
        review={reporting}
        online={online}
        onClose={() => setReporting(null)}
        onDone={() => {
          setReporting(null);
          setNotice('Enviaste la denuncia. La administración la revisa; mientras tanto la opinión sigue publicada.');
          void data.reload();
        }}
      />
    );
  const d = data.data;
  if (!d)
    return (
      <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
        <Stack.Screen options={{ title: 'Valoraciones' }} />
        {data.loading ? <Loading /> : <ErrorText message={data.error} />}
      </Screen>
    );

  const removeReply = (review: DoctorReview) =>
    Alert.alert('Borrar respuesta', '¿Borrar tu respuesta?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          void action.run(async () => {
            await request(`/reviews/${review.id}/reply`, 'DELETE');
            setNotice('Borraste tu respuesta.');
            await data.reload();
          }),
      },
    ]);

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh} savedAt={data.savedAt}>
      <Stack.Screen options={{ title: 'Valoraciones' }} />
      <Title>Valoraciones</Title>
      <Body>
        Lo que tus pacientes opinan de tu atención. Solo opinan pacientes con la identidad verificada y una consulta
        verificada contigo.
      </Body>
      {d.isPublished && (
        <Button title="Ver cómo se ve en mi ficha" variant="ghost" small onPress={() => openDoctor(d.slug)} />
      )}
      {!!notice && <Notice tone="success">{notice}</Notice>}
      <ErrorText message={data.error ?? action.error} />
      <Card>
        {d.summary.average !== null ? (
          <>
            <Text style={s.big}>
              {average(d.summary.average)} <Stars value={d.summary.average} size={20} />
            </Text>
            <Muted>{d.summary.count === 1 ? '1 opinión' : `${d.summary.count} opiniones`}</Muted>
          </>
        ) : (
          <Muted>El promedio se muestra desde 3 opiniones publicadas ({d.summary.count} hasta ahora).</Muted>
        )}
        <Muted>
          No puedes borrar ni ocultar opiniones, ni pedirlas a cambio de descuentos o beneficios. Puedes responder una
          vez a cada una y, si una incumple las reglas, denunciarla: la administración la revisa. No ves quién escribió
          una opinión anónima.
        </Muted>
      </Card>
      {d.items.length === 0 ? (
        <Empty title="Todavía no tienes opiniones publicadas" />
      ) : (
        d.items.map((review) => (
          <Card key={review.id}>
            <Stars value={review.rating} />
            {!!review.comment && <Body>{review.comment}</Body>}
            <Muted>
              {review.author} · {BASIS_LABEL[review.basis]} · {capitalizeFirst(monthLabel(review.consultationMonth))}
            </Muted>
            {review.reply && (
              <View style={s.reply}>
                <Row>
                  <Text style={s.replyTitle}>Tu respuesta</Text>
                  <Badge
                    label={REVIEW_STATUS[review.reply.status].label}
                    tone={REVIEW_STATUS[review.reply.status].tone}
                  />
                </Row>
                <Body>{review.reply.content}</Body>
                {!!review.reply.moderationNote && <Muted>Nota del equipo: {review.reply.moderationNote}</Muted>}
              </View>
            )}
            <Row>
              {review.reply?.status !== 'WITHDRAWN' && (
                <Button
                  title={review.reply ? 'Editar respuesta' : 'Responder'}
                  variant="secondary"
                  small
                  disabled={!online}
                  onPress={() => setReplying(review)}
                />
              )}
              {review.reply && review.reply.status !== 'WITHDRAWN' && (
                <Button
                  title="Borrar respuesta"
                  variant="ghost"
                  small
                  disabled={!online || action.busy}
                  onPress={() => removeReply(review)}
                />
              )}
              {review.report ? (
                <Muted>
                  Denunciada el {formatDate(review.report.createdAt, 'long')}: {REPORT_STATUS[review.report.status]}
                </Muted>
              ) : (
                <Button
                  title="Denunciar"
                  variant="ghost"
                  small
                  disabled={!online}
                  onPress={() => setReporting(review)}
                />
              )}
            </Row>
          </Card>
        ))
      )}
      {d.totalPages > 1 && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title="Anteriores" variant="secondary" small disabled={page <= 1} onPress={() => setPage(page - 1)} />
          <Muted>
            Página {d.page} de {d.totalPages}
          </Muted>
          <Button
            title="Siguientes"
            variant="secondary"
            small
            disabled={page >= d.totalPages}
            onPress={() => setPage(page + 1)}
          />
        </Row>
      )}
    </Screen>
  );
}

function ReplyForm({
  review,
  online,
  onClose,
  onDone,
}: {
  review: DoctorReview;
  online: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [content, setContent] = useState(review.reply?.content ?? '');
  const action = useAction();
  return (
    <Screen>
      <Stack.Screen options={{ title: review.reply ? 'Editar tu respuesta' : 'Responder la opinión' }} />
      <Card>
        <Stars value={review.rating} />
        {!!review.comment && <Body>{review.comment}</Body>}
      </Card>
      <Notice tone="warning">{REVIEW_REPLY_NOTICE}</Notice>
      <Card>
        <Field
          label="Tu respuesta"
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={TEXT_MAX}
          hint={`${content.length}/${TEXT_MAX}`}
        />
        <ErrorText message={action.error} />
        <Button
          title="Enviar respuesta"
          loading={action.busy}
          disabled={!online || content.trim().length < 2}
          onPress={() =>
            void action.run(async () => {
              await request(`/reviews/${review.id}/reply`, 'PUT', { content: content.trim() });
              onDone();
            })
          }
        />
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
      </Card>
    </Screen>
  );
}

function ReportForm({
  review,
  online,
  onClose,
  onDone,
}: {
  review: DoctorReview;
  online: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<ReviewReportReason | ''>('');
  const [details, setDetails] = useState('');
  const action = useAction();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Denunciar la opinión' }} />
      <Card>
        <Stars value={review.rating} />
        {!!review.comment && <Body>{review.comment}</Body>}
      </Card>
      <Card>
        <Heading>¿Por qué la denuncias?</Heading>
        {REPORT_REASONS.map((r) => (
          <Check key={r.value} label={r.label} value={reason === r.value} onValueChange={() => setReason(r.value)} />
        ))}
        <Field label="Detalles (opcional)" value={details} onChangeText={setDetails} multiline maxLength={TEXT_MAX} />
        <Muted>La administración revisa la denuncia; mientras tanto, la opinión sigue publicada.</Muted>
        <ErrorText message={action.error} />
        <Button
          title="Enviar denuncia"
          loading={action.busy}
          disabled={!online || !reason}
          onPress={() =>
            void action.run(async () => {
              await request(`/reviews/${review.id}/report`, 'POST', { reason, details: details.trim() || undefined });
              onDone();
            })
          }
        />
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  big: { fontSize: 28, fontWeight: '700', color: colors.heading },
  reply: { backgroundColor: colors.background, borderRadius: radius.m, padding: 12, gap: 6 },
  replyTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
