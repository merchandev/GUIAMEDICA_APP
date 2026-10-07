import React, { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import {
  ACTIVE_CONTACT,
  CONTACT_CHANNEL_LABEL,
  CONTACT_REQUEST_STATUS,
  type ContactChannel,
  type ContactRequestStatus,
} from '../../src/contactStatus';
import { useApi, useAction } from '../../src/data';
import { formatDate } from '../../src/dates';
import { openDoctor } from '../../src/nav';
import { pendingFor, perform } from '../../src/offline';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  colors,
  Empty,
  ErrorText,
  Loading,
  Muted,
  Notice,
  Screen,
  s as ui,
  Title,
} from '../../src/ui';

interface ContactRequest {
  id: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  content: string;
  preferredChannel: ContactChannel | null;
  preferredTime: string | null;
  identityVerified: boolean;
  requestStatus: ContactRequestStatus;
  createdAt: string;
  expiresAt: string | null;
  professional: { slug: string; name: string };
}

/** Los médicos a los que el paciente pidió que lo contacten, con «Retirar» (también sin conexión). */
export default function ContactRequestsScreen() {
  const { user, myOps } = useSession();
  const list = useApi<ContactRequest[]>(user ? '/contact/requests/me' : null, {
    cacheKey: 'me:contacts',
    topics: ['contact'],
  });
  const [message, setMessage] = useState<string | null>(null);
  const action = useAction();
  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;

  const withdraw = (r: ContactRequest) =>
    Alert.alert(
      'Retirar pedido',
      `¿Retirar tu pedido a Dr(a). ${r.professional.name}? Dejará de ver tus datos al instante.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: () =>
            void action.run(async () => {
              setMessage(null);
              const result = await perform(user.id, {
                kind: 'contact-withdraw',
                method: 'PATCH',
                path: `/contact/requests/${r.id}/withdraw`,
                targetId: r.id,
                label: `Retirar el pedido de contacto a Dr(a). ${r.professional.name}`,
              });
              if (result === 'queued')
                Alert.alert(
                  'Guardado sin conexión',
                  'El retiro se enviará solo cuando vuelva la conexión. Hasta entonces, el médico todavía ve los datos de este pedido.',
                );
              else {
                setMessage('Retiraste el pedido: el médico ya no ve tus datos.');
                await list.reload();
              }
            }),
        },
      ],
    );

  const items = list.data ?? [];
  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh} savedAt={list.savedAt}>
      <Stack.Screen options={{ title: 'Pedidos de contacto' }} />
      <Title>Pedidos de contacto</Title>
      <Body>
        Los médicos a los que pediste que te contacten desde su ficha. Cada uno ve solo lo que elegiste compartir,
        durante 30 días o hasta que retires el pedido; después tus datos se borran del pedido.
      </Body>
      {!!message && <Notice tone="success">{message}</Notice>}
      <ErrorText message={list.error ?? action.error} />
      {list.loading && !list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title="No has pedido que te contacten"
          description="En la ficha de un médico que recibe mensajes, usa «Quiero que me contacte»."
        />
      ) : (
        items.map((r) => {
          const active = ACTIVE_CONTACT.includes(r.requestStatus);
          const status = CONTACT_REQUEST_STATUS[r.requestStatus];
          const withdrawing = pendingFor(myOps, user.id, r.id, ['contact-withdraw']);
          return (
            <Card key={r.id}>
              <Pressable accessibilityRole="link" onPress={() => openDoctor(r.professional.slug)} hitSlop={6}>
                <Text style={[ui.itemTitle, { color: colors.primary }]}>Dr(a). {r.professional.name}</Text>
              </Pressable>
              <Badge label={status.label} tone={status.tone} />
              <Muted>
                Enviado el {formatDate(r.createdAt, 'long')}
                {active && r.expiresAt ? ` · tus datos se borran el ${formatDate(r.expiresAt, 'long')}` : ''}
              </Muted>
              {active ? (
                <>
                  <Body>
                    Compartiste: {r.senderName !== 'Paciente' ? `tu nombre (${r.senderName})` : 'sin tu nombre'}
                    {r.senderPhone ? `, tu teléfono ${r.senderPhone}` : ''}
                    {r.senderEmail ? `, tu correo ${r.senderEmail}` : ''}
                    {r.preferredChannel
                      ? `. Prefieres: ${CONTACT_CHANNEL_LABEL[r.preferredChannel].toLocaleLowerCase('es-VE')}`
                      : ''}
                    {r.preferredTime ? `, ${r.preferredTime}` : ''}.
                  </Body>
                  <Muted>{r.content}</Muted>
                  {withdrawing ? (
                    <Notice tone="warning">
                      Retiro en espera de conexión. Hasta que se envíe, el médico todavía ve los datos de este pedido.
                    </Notice>
                  ) : (
                    <Button
                      title="Retirar el pedido"
                      variant="secondary"
                      small
                      disabled={action.busy}
                      onPress={() => withdraw(r)}
                    />
                  )}
                </>
              ) : (
                <Muted>
                  {r.requestStatus === 'WITHDRAWN' ? 'Lo retiraste' : 'Venció'}: tus datos se borraron del pedido.
                </Muted>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
