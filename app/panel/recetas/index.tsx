import React, { useState } from 'react';
import { Redirect, router, Stack } from 'expo-router';
import { request } from '../../../src/api';
import { MissingRequirements } from '../../../src/components/MissingRequirements';
import { useApi, useAction } from '../../../src/data';
import { formatDate } from '../../../src/dates';
import { useFeatures } from '../../../src/features';
import { PRESCRIPTION_STATUS, type PrescriptionPad, type PrescriptionSummary } from '../../../src/prescriptions';
import { useSession } from '../../../src/session';
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
  Title,
} from '../../../src/ui';

interface PrescriptionPage {
  items: PrescriptionSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Récipes del médico (como en la web). Llevan datos de salud de sus
 * pacientes: se ven con conexión y no se guardan en el teléfono.
 */
export default function DoctorPrescriptionsScreen() {
  const { user, online } = useSession();
  const { prescriptions: enabled } = useFeatures();
  const doctor = user?.role === 'PROFESSIONAL';
  const pad = useApi<PrescriptionPad>(doctor && enabled ? '/prescriptions/pad' : null, {
    topics: ['prescriptions', 'profile', 'documents'],
  });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [more, setMore] = useState<PrescriptionSummary[]>([]);
  const [page, setPage] = useState(1);
  const list = useApi<PrescriptionPage>(
    doctor && enabled ? `/prescriptions?page=1${search ? `&q=${encodeURIComponent(search)}` : ''}` : null,
    {
      topics: ['prescriptions'],
    },
  );
  const loadMore = useAction();
  if (!user || !doctor) return <Redirect href="/cuenta" />;
  if (!enabled)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Récipes' }} />
        <Empty title="Los récipes digitales todavía no están disponibles" />
      </Screen>
    );

  const items = [...(list.data?.items ?? []), ...more];
  const apply = (value: string) => {
    setMore([]);
    setPage(1);
    setSearch(value);
  };
  return (
    <Screen
      refreshing={list.refreshing}
      onRefresh={() => {
        void pad.refresh();
        void list.refresh();
      }}
    >
      <Stack.Screen options={{ title: 'Récipes' }} />
      <Title>Récipes</Title>
      <Body>
        Emite récipes con tu firma, tu sello y los datos que exige la norma del MPPS. Descárgalos en PDF, envíalos por
        mensaje o por correo, o entrégalos a un paciente de tu directorio. La farmacia los verifica con su código.
      </Body>
      {!online && !list.data && (
        <Notice tone="warning">Sin conexión: los récipes se ven con internet (no se guardan en el teléfono).</Notice>
      )}
      <ErrorText message={online ? (pad.error ?? list.error ?? loadMore.error) : null} />
      {pad.data && <MissingRequirements pad={pad.data} />}
      <Row>
        <Button
          title="Nuevo récipe"
          disabled={!online || !pad.data?.canIssue}
          onPress={() => router.push('/panel/recetas/nuevo')}
        />
        <Button
          title="Talonario: firma, sello y logo"
          variant="secondary"
          onPress={() => router.push('/panel/talonario')}
        />
      </Row>
      <Card>
        <Field label="Buscar" value={query} onChangeText={setQuery} placeholder="Paciente, cédula, N° o medicamento" />
        <Row>
          <Button title="Buscar" variant="secondary" small disabled={!online} onPress={() => apply(query.trim())} />
          {!!search && (
            <Button
              title="Ver todos"
              variant="ghost"
              small
              onPress={() => {
                setQuery('');
                apply('');
              }}
            />
          )}
        </Row>
      </Card>
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data && items.length === 0 ? (
        <Empty
          title={search ? 'Ningún récipe coincide' : 'Aún no has emitido récipes'}
          description={
            search
              ? 'Prueba con otro nombre, cédula o número.'
              : 'Cuando emitas uno, aparecerá aquí con su código de verificación.'
          }
        />
      ) : (
        <>
          {!!list.data && (
            <Muted>
              {list.data.total === 1 ? '1 récipe' : `${list.data.total} récipes`}
              {search ? ` para «${search}»` : ''}
            </Muted>
          )}
          {items.map((item) => (
            <Card
              key={item.id}
              onPress={() => router.push({ pathname: '/panel/recetas/[id]', params: { id: item.id } })}
              label={`Récipe N° ${item.numberLabel}`}
            >
              <Body>
                N° {item.numberLabel} · {item.patientName}
                {item.patientCedula ? ` · C.I. ${item.patientCedula}` : ''}
              </Body>
              <Row>
                {item.delivered && <Badge label="En su cuenta" tone="gold" />}
                <Badge label={PRESCRIPTION_STATUS[item.status].label} tone={PRESCRIPTION_STATUS[item.status].tone} />
              </Row>
              <Muted>{item.itemsSummary}</Muted>
              <Muted>
                Emitido el {formatDate(item.issuedAt, 'long')} · vence el {formatDate(item.expiresAt, 'long')}
              </Muted>
            </Card>
          ))}
          {!!list.data && items.length < list.data.total && (
            <Button
              title="Ver más"
              variant="secondary"
              loading={loadMore.busy}
              disabled={!online}
              onPress={() =>
                void loadMore.run(async () => {
                  const next = await request<PrescriptionPage>(
                    `/prescriptions?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
                  );
                  setMore((current) => [...current, ...next.items]);
                  setPage(page + 1);
                })
              }
            />
          )}
        </>
      )}
    </Screen>
  );
}
