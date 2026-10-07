import React, { useState } from 'react';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../src/api';
import { patientDisplay, SOURCE_LABELS, STATUS_INFO, type AppointmentStatus, type HistoryPage } from '../../src/agenda';
import { useApi, useAction } from '../../src/data';
import { addMonths, capitalizeFirst, caracasDateKey, formatDateTime, monthLabel, monthRange } from '../../src/dates';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Select,
} from '../../src/ui';

interface Filters {
  month: string;
  status: string;
  source: string;
  patientCode: string;
}
const EMPTY: Filters = { month: '', status: '', source: '', patientCode: '' };
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...(Object.keys(STATUS_INFO) as AppointmentStatus[]).map((value) => ({ value, label: STATUS_INFO[value].label })),
];
const SOURCE_OPTIONS = [
  { value: '', label: 'Todos los canales' },
  { value: 'WEB', label: SOURCE_LABELS.WEB },
  { value: 'PHONE', label: SOURCE_LABELS.PHONE },
];

function queryFor(filters: Filters, patientId: string | undefined, cursor?: string) {
  const params: string[] = [];
  if (filters.month) {
    const { first, last } = monthRange(filters.month);
    params.push(`from=${first}`, `to=${last}`);
  }
  if (filters.status) params.push(`status=${filters.status}`);
  if (filters.source) params.push(`source=${filters.source}`);
  if (filters.patientCode.trim()) params.push(`patientCode=${encodeURIComponent(filters.patientCode.trim())}`);
  if (patientId) params.push(`patientId=${encodeURIComponent(patientId)}`);
  if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
  return params.join('&');
}

/**
 * Historial de citas del médico (como en la web): de la más reciente a la más
 * vieja, con filtros. Con un paciente, solo sus citas y sus totales.
 */
export default function HistoryScreen() {
  const { paciente, nombre } = useLocalSearchParams<{ paciente?: string; nombre?: string }>();
  const { user, online } = useSession();
  const thisMonth = caracasDateKey(Date.now()).slice(0, 7);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [more, setMore] = useState<HistoryPage['items']>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const loadMore = useAction();
  const page = useApi<HistoryPage>(
    user?.role === 'PROFESSIONAL' ? `/appointments/me/history?${queryFor(applied, paciente)}` : null,
    {
      topics: ['appointments'],
    },
  );
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const locked = !!page.error && /plan/i.test(page.error);
  const items = [...(page.data?.items ?? []), ...more];
  const nextCursor = cursor === undefined ? page.data?.nextCursor : cursor;
  const months = Array.from({ length: 13 }, (_, i) => addMonths(thisMonth, -i));

  const apply = (next: Filters) => {
    setMore([]);
    setCursor(undefined);
    setApplied(next);
  };

  return (
    <Screen refreshing={page.refreshing} onRefresh={page.refresh}>
      <Stack.Screen options={{ title: paciente ? 'Citas del paciente' : 'Historial de citas' }} />
      {locked ? (
        <Notice tone="warning">El historial es parte de la agenda, disponible desde el plan Profesional.</Notice>
      ) : (
        <>
          {paciente && (
            <Card>
              <Body>Citas con {nombre ?? 'este paciente'}</Body>
              {page.data?.summary && (
                <Row>
                  {(Object.keys(STATUS_INFO) as AppointmentStatus[]).map((status) => (
                    <Badge
                      key={status}
                      label={`${STATUS_INFO[status].label}: ${page.data!.summary![status]}`}
                      tone={STATUS_INFO[status].tone}
                    />
                  ))}
                </Row>
              )}
              <Button
                title="Ver todas las citas"
                variant="ghost"
                small
                onPress={() => router.replace('/panel/historial')}
              />
            </Card>
          )}
          <Section title="Filtros">
            <Card>
              <Select
                label="Mes"
                value={filters.month}
                onChange={(v) => setFilters({ ...filters, month: v })}
                options={[
                  { value: '', label: 'Todos los meses' },
                  ...months.map((m) => ({ value: m, label: capitalizeFirst(monthLabel(m)) })),
                ]}
              />
              <Select
                label="Estado"
                value={filters.status}
                onChange={(v) => setFilters({ ...filters, status: v })}
                options={STATUS_OPTIONS}
              />
              <Select
                label="Canal"
                value={filters.source}
                onChange={(v) => setFilters({ ...filters, source: v })}
                options={SOURCE_OPTIONS}
              />
              {!paciente && (
                <Field
                  label="Código del paciente"
                  value={filters.patientCode}
                  onChangeText={(v) => setFilters({ ...filters, patientCode: v })}
                  autoCapitalize="characters"
                  placeholder="GMM-…"
                />
              )}
              <Row>
                <Button title="Filtrar" small onPress={() => apply({ ...filters })} />
                <Button
                  title="Limpiar"
                  variant="ghost"
                  small
                  onPress={() => {
                    setFilters(EMPTY);
                    apply(EMPTY);
                  }}
                />
              </Row>
            </Card>
          </Section>
          {!online && !page.data && <Notice tone="warning">Sin conexión: el historial se ve con internet.</Notice>}
          <ErrorText message={online ? (page.error ?? loadMore.error) : null} />
          {page.loading && !page.data ? (
            <Loading />
          ) : page.data && items.length === 0 ? (
            <Empty title="No hay citas con esos filtros" />
          ) : (
            items.map((a) => {
              const info = STATUS_INFO[a.status];
              return (
                <Card
                  key={a.id}
                  onPress={() => router.push({ pathname: '/panel/cita/[id]', params: { id: a.id } })}
                  label={`${patientDisplay(a.patient)}, ${info.label}`}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body>{patientDisplay(a.patient)}</Body>
                    <Badge label={info.label} tone={info.tone} />
                  </Row>
                  <Muted>{capitalizeFirst(formatDateTime(a.startsAt, 'medium'))}</Muted>
                  <Muted>{SOURCE_LABELS[a.source]}</Muted>
                </Card>
              );
            })
          )}
          {!!nextCursor && (
            <Button
              title="Ver más"
              variant="secondary"
              loading={loadMore.busy}
              disabled={!online}
              onPress={() =>
                void loadMore.run(async () => {
                  const next = await request<HistoryPage>(
                    `/appointments/me/history?${queryFor(applied, paciente, nextCursor)}`,
                  );
                  setMore((current) => [...current, ...next.items]);
                  setCursor(next.nextCursor);
                })
              }
            />
          )}
        </>
      )}
    </Screen>
  );
}
