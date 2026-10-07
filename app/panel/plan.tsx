import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { PlanStatusCard } from '../../src/components/DoctorCards';
import { useApi } from '../../src/data';
import { formatDate } from '../../src/dates';
import { PLAN_TIER_LABELS, useOwnProfile } from '../../src/doctor';
import { useSession } from '../../src/session';
import { Badge, Body, Card, ErrorText, Heading, KeyValue, Loading, Muted, Row, Screen, Title } from '../../src/ui';

interface Subscription {
  id: string;
  status: string;
  plan: { name: string; tier: string };
  currentPeriodEnd: string | null;
  installments: {
    id: string;
    payments: { id: string; status: string; amountBs: string; createdAt: string; reviewNote?: string }[];
  }[];
}

const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  ACTIVE: { label: 'Activa', tone: 'success' },
  PAST_DUE: { label: 'Vencida', tone: 'danger' },
  CANCELED: { label: 'Cancelada', tone: 'neutral' },
  UNPAID: { label: 'Sin pagar', tone: 'danger' },
};
const PAYMENT_STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'En revisión', tone: 'warning' },
  COMPLETED: { label: 'Aprobado', tone: 'success' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
};

/**
 * Estado del plan del médico. Solo informativo: en la app no se venden ni se
 * pagan planes (normas de pagos de Google Play).
 */
export default function PlanScreen() {
  const { user } = useSession();
  const doctor = user?.role === 'PROFESSIONAL';
  const own = useOwnProfile(doctor);
  const sub = useApi<Subscription | null>(doctor ? '/subscriptions/me' : null, {
    cacheKey: 'me:subscription',
    topics: ['billing'],
  });
  if (!user || !doctor) return <Redirect href="/cuenta" />;
  const plan = own.data?.plan;
  const current = sub.data;
  const payments = current?.installments.flatMap((i) => i.payments) ?? [];
  const status = current ? SUBSCRIPTION_STATUS[current.status] : null;
  const tier = current ? PLAN_TIER_LABELS[current.plan.tier] : null;
  return (
    <Screen
      refreshing={own.refreshing || sub.refreshing}
      onRefresh={() => {
        void own.refresh();
        void sub.refresh();
      }}
      savedAt={own.savedAt}
    >
      <Stack.Screen options={{ title: 'Mi plan' }} />
      <Title>Mi plan</Title>
      <ErrorText message={own.error ?? sub.error} />
      {!plan ? <Loading /> : <PlanStatusCard plan={plan} />}
      {current && (
        <Card>
          <Heading>Suscripción</Heading>
          <Row>
            {status && <Badge label={status.label} tone={status.tone} />}
            {tier && <Badge label={tier.label} tone={tier.tone} />}
          </Row>
          <KeyValue label="Plan" value={current.plan.name} />
          {!!current.currentPeriodEnd && (
            <KeyValue label="Vence" value={formatDate(current.currentPeriodEnd, 'long')} />
          )}
        </Card>
      )}
      {current && (
        <Card>
          <Heading>Historial de pagos</Heading>
          {payments.length === 0 ? (
            <Muted>No hay pagos registrados.</Muted>
          ) : (
            payments.map((p) => (
              <Row key={p.id} style={{ justifyContent: 'space-between' }}>
                <Body>
                  Bs. {p.amountBs} · {formatDate(p.createdAt, 'medium')}
                </Body>
                <Badge
                  label={PAYMENT_STATUS[p.status]?.label ?? p.status}
                  tone={PAYMENT_STATUS[p.status]?.tone ?? 'warning'}
                />
              </Row>
            ))
          )}
        </Card>
      )}
      <Muted>La app muestra el estado de tu plan. Los planes no se contratan ni se pagan desde la app.</Muted>
    </Screen>
  );
}
