import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useApi } from '../../src/data';
import { shortMonthLabel } from '../../src/dates';
import { PLAN_TIER_LABELS } from '../../src/doctor';
import { useSession } from '../../src/session';
import { Body, Card, colors, ErrorText, Heading, Loading, Muted, radius, Row, Screen, Title } from '../../src/ui';

type Level = 'NONE' | 'BASIC' | 'FULL' | 'ADVANCED';
type Counts = Record<string, number>;

interface Stats {
  level: Level;
  planTier: string;
  periodDays?: number;
  events?: { total: Counts; last30: Counts; previous30?: Counts };
  appointments?: { last30: { total: number; byStatus: Record<string, number> }; previous30?: { total: number } };
  messages?: { last30: number; previous30?: number };
  searches?: {
    last30: number;
    previous30?: number;
    bySpecialty: { slug: string; name: string; count: number }[];
    byMunicipality: { name: string; count: number }[];
  };
  monthly?: { month: string; events: Counts; appointments: number }[];
}

const EVENT_LABELS: Record<string, string> = {
  PROFILE_VIEW: 'Visitas a tu ficha',
  WHATSAPP_CLICK: 'Clics en WhatsApp',
  PHONE_CLICK: 'Clics en tu teléfono',
  SOCIAL_LINK_CLICK: 'Clics en tus redes y web',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Por confirmar',
  CONFIRMED: 'Confirmadas',
  COMPLETED: 'Realizadas',
  CANCELLED: 'Canceladas',
  NO_SHOW: 'No asistió',
};
const LEVEL_TEXT: Record<Exclude<Level, 'NONE'>, string> = {
  BASIC: 'Estadísticas básicas',
  FULL: 'Estadísticas completas',
  ADVANCED: 'Analítica avanzada',
};

function trend(now: number, before?: number): string | null {
  if (before === undefined) return null;
  if (before === 0) return now > 0 ? 'Sin datos del periodo anterior' : 'Igual que el periodo anterior';
  const change = Math.round(((now - before) / before) * 100);
  return change > 0
    ? `▲ ${change} % frente a los 30 días anteriores`
    : change < 0
      ? `▼ ${Math.abs(change)} % frente a los 30 días anteriores`
      : 'Igual que el periodo anterior';
}

function Tile({ label, value, total, before }: { label: string; value: number; total?: number; before?: number }) {
  const t = trend(value, before);
  return (
    <View style={s.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.value}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {total !== undefined && <Text style={s.small}>Desde el inicio: {total}</Text>}
      {!!t && <Text style={s.small}>{t}</Text>}
    </View>
  );
}

/** Estadísticas del médico según su plan (como en la web). */
export default function StatsScreen() {
  const { user } = useSession();
  const stats = useApi<Stats>(user?.role === 'PROFESSIONAL' ? '/analytics/me' : null, { cacheKey: 'me:stats' });
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const st = stats.data;
  if (!st)
    return (
      <Screen refreshing={stats.refreshing} onRefresh={stats.refresh}>
        <Stack.Screen options={{ title: 'Estadísticas' }} />
        {stats.loading ? <Loading /> : <ErrorText message={stats.error} />}
      </Screen>
    );
  const plan = PLAN_TIER_LABELS[st.planTier]?.label ?? st.planTier;
  if (st.level === 'NONE')
    return (
      <Screen refreshing={stats.refreshing} onRefresh={stats.refresh} savedAt={stats.savedAt}>
        <Stack.Screen options={{ title: 'Estadísticas' }} />
        <Title>Estadísticas</Title>
        <Card>
          <Body>Tu plan actual ({plan}) no incluye estadísticas. Están disponibles desde el plan Profesional.</Body>
        </Card>
      </Screen>
    );
  const events = st.events!;
  const keys = Object.keys(events.last30);
  return (
    <Screen refreshing={stats.refreshing} onRefresh={stats.refresh} savedAt={stats.savedAt}>
      <Stack.Screen options={{ title: 'Estadísticas' }} />
      <Title>Estadísticas</Title>
      <Muted>
        {LEVEL_TEXT[st.level]} · plan {plan} · últimos {st.periodDays} días. Visitas y clics son conteos anónimos de
        quienes aceptaron la analítica del sitio. Las citas y los mensajes salen de tu agenda y de tu bandeja.
      </Muted>
      <Card>
        <Heading>Visitas y contactos</Heading>
        <Row>
          {keys.map((key) => (
            <Tile
              key={key}
              label={EVENT_LABELS[key] ?? key}
              value={events.last30[key] ?? 0}
              total={events.total[key] ?? 0}
              before={events.previous30?.[key]}
            />
          ))}
          {st.messages && (
            <Tile label="Mensajes recibidos" value={st.messages.last30} before={st.messages.previous30} />
          )}
        </Row>
      </Card>
      {st.searches && (
        <Card>
          <Heading>Apariciones en búsquedas</Heading>
          <Body>
            Tu ficha apareció {st.searches.last30} {st.searches.last30 === 1 ? 'vez' : 'veces'} en los resultados del
            directorio y de las páginas de especialidad, y se abrió {events.last30.PROFILE_VIEW ?? 0}{' '}
            {(events.last30.PROFILE_VIEW ?? 0) === 1 ? 'vez' : 'veces'}.
          </Body>
          <Row>
            <Tile label="Apariciones" value={st.searches.last30} before={st.searches.previous30} />
          </Row>
          {st.searches.bySpecialty.length > 0 && (
            <>
              <Muted>Por especialidad buscada</Muted>
              {st.searches.bySpecialty.map((row) => (
                <Body key={row.slug}>
                  {row.name}: {row.count}
                </Body>
              ))}
            </>
          )}
          {st.searches.byMunicipality.length > 0 && (
            <>
              <Muted>Por municipio buscado</Muted>
              {st.searches.byMunicipality.map((row) => (
                <Body key={row.name}>
                  {row.name}: {row.count}
                </Body>
              ))}
            </>
          )}
          <Muted>
            Son conteos totales de quienes aceptaron la analítica del sitio, así que son menores que los reales. Nunca
            sabemos ni te mostramos quién buscó ni qué escribió.
          </Muted>
        </Card>
      )}
      {st.appointments && (
        <Card>
          <Heading>Citas pedidas</Heading>
          <Muted>Por fecha en que se pidieron, con su estado actual.</Muted>
          <Row>
            <Tile
              label="Citas pedidas"
              value={st.appointments.last30.total}
              before={st.appointments.previous30?.total}
            />
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <Tile key={status} label={label} value={st.appointments!.last30.byStatus[status] ?? 0} />
            ))}
          </Row>
        </Card>
      )}
      {st.level === 'ADVANCED' && st.monthly && (
        <Card>
          <Heading>Últimos 6 meses</Heading>
          {st.monthly.map((row) => (
            <View key={row.month} style={s.month}>
              <Text style={s.monthName}>{shortMonthLabel(row.month)}</Text>
              <Muted>
                {keys.map((key) => `${EVENT_LABELS[key] ?? key}: ${row.events[key] ?? 0}`).join(' · ')} · Citas pedidas:{' '}
                {row.appointments}
              </Muted>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.background,
    borderRadius: radius.m,
    padding: 12,
    gap: 2,
  },
  value: { fontSize: 26, fontWeight: '700', color: colors.heading },
  tileLabel: { fontSize: 13, color: colors.text },
  small: { fontSize: 12, color: colors.muted },
  month: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  monthName: { fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
});
