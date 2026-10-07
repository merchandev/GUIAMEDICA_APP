import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { request } from '../api';
import { monthLabel } from '../dates';
import { Button, Card, colors, Muted, Section } from '../ui';

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  author: string;
  basis: 'APPOINTMENT' | 'REGISTERED';
  consultationMonth: string;
  reply: { content: string } | null;
}

export type ReviewPage =
  | { enabled: false }
  | {
      enabled: true;
      summary: { average: number | null; count: number; distribution: { stars: number; count: number }[] | null };
      items: PublicReview[];
      total: number;
      page: number;
      totalPages: number;
    };

export const BASIS_LABEL = {
  APPOINTMENT: 'Cita realizada en la plataforma',
  REGISTERED: 'Paciente registrado por el médico',
};

export const stars = (value: number) => '★'.repeat(Math.round(value)) + '☆'.repeat(5 - Math.round(value));
export const average = (value: number) =>
  value.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Opiniones publicadas de un médico (solo con las valoraciones encendidas en la plataforma). */
export function DoctorReviews({ slug, first }: { slug: string; first: Extract<ReviewPage, { enabled: true }> }) {
  const [items, setItems] = useState(first.items);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const { summary } = first;
  return (
    <Section
      title="Opiniones de pacientes"
      description="Solo de pacientes con una consulta verificada. Se moderan antes de publicarse."
    >
      {summary.average !== null ? (
        <Card>
          <Text style={s.big}>
            {average(summary.average)} <Text style={s.stars}>{stars(summary.average)}</Text>
          </Text>
          <Muted>{summary.count === 1 ? '1 opinión' : `${summary.count} opiniones`}</Muted>
          {summary.distribution?.map((d) => (
            <View key={d.stars} style={s.bar}>
              <Text style={s.barLabel}>{d.stars} ★</Text>
              <View style={s.track}>
                <View style={[s.fill, { width: `${summary.count ? (d.count / summary.count) * 100 : 0}%` }]} />
              </View>
              <Text style={s.barLabel}>{d.count}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <Muted>El promedio se muestra desde 3 opiniones publicadas.</Muted>
      )}
      {items.map((r) => (
        <Card key={r.id}>
          <Text style={s.stars}>{stars(r.rating)}</Text>
          {!!r.comment && <Text style={s.comment}>{r.comment}</Text>}
          <Muted>
            {r.author} · {BASIS_LABEL[r.basis]} · {monthLabel(r.consultationMonth)}
          </Muted>
          {r.reply && (
            <View style={s.reply}>
              <Text style={s.replyTitle}>Respuesta del médico</Text>
              <Text style={s.comment}>{r.reply.content}</Text>
            </View>
          )}
        </Card>
      ))}
      {page < first.totalPages && (
        <Button
          title="Ver más opiniones"
          variant="secondary"
          loading={busy}
          onPress={() => {
            setBusy(true);
            request<Extract<ReviewPage, { enabled: true }>>(
              `/reviews/professional/${encodeURIComponent(slug)}?page=${page + 1}`,
            )
              .then((next) => {
                setItems((current) => [...current, ...next.items]);
                setPage(page + 1);
              })
              .catch(() => {})
              .finally(() => setBusy(false));
          }}
        />
      )}
    </Section>
  );
}

const s = StyleSheet.create({
  big: { fontSize: 28, fontWeight: '700', color: colors.heading },
  stars: { fontSize: 16, color: '#c48a12' },
  comment: { fontSize: 15, color: colors.body, lineHeight: 22 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 34, fontSize: 13, color: colors.muted },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.secondary, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
  reply: { marginTop: 6, padding: 12, borderRadius: 12, backgroundColor: colors.background, gap: 4 },
  replyTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
