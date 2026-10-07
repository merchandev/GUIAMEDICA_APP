import React from 'react';
import { Linking } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { request } from '../../src/api';
import {
  CONTACT_CHANNEL_LABEL,
  CONTACT_REQUEST_STATUS,
  type ContactChannel,
  type ContactRequestStatus,
} from '../../src/contactStatus';
import { useApi, useAction } from '../../src/data';
import { formatDate, formatDateTime } from '../../src/dates';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  ErrorText,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Title,
} from '../../src/ui';

interface ContactMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
  requestStatus: ContactRequestStatus | null;
  preferredChannel: ContactChannel | null;
  preferredTime: string | null;
  identityVerified: boolean;
  expiresAt: string | null;
}

const whatsapp = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('58') ? digits : `58${digits.replace(/^0/, '')}`}`;
};

/**
 * Mensajes y pedidos «Quiero que me contacte» (como en la web). Pueden traer
 * datos de salud que el paciente escribió: se ven con conexión y no se
 * guardan en el teléfono.
 */
export default function MessagesScreen() {
  const { user, online } = useSession();
  const list = useApi<ContactMessage[]>(user?.role === 'PROFESSIONAL' ? '/contact/me' : null, { topics: ['contact'] });
  const action = useAction();
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;

  const markRead = (id: string) =>
    void request(`/contact/${id}/read`, 'PATCH')
      .then(() => {
        list.setData((current) => current && current.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
        changedLocally('contact');
      })
      .catch(() => {});

  const setStatus = (id: string, status: 'CONTACTED' | 'CLOSED') =>
    action.run(async () => {
      await request(`/contact/requests/${id}/status`, 'PATCH', { status });
      changedLocally('contact');
      await list.reload();
    });

  const items = list.data ?? [];
  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh}>
      <Stack.Screen options={{ title: 'Mensajes' }} />
      <Title>Mensajes de pacientes</Title>
      <Body>
        Los pedidos «Quiero que me contacte» traen solo los datos que el paciente eligió compartir: úsalos solo para
        responder ese pedido. Se borran a los 30 días o cuando el paciente lo retira.
      </Body>
      {!online && !list.data && (
        <Notice tone="warning">
          Sin conexión: por privacidad, los mensajes no se guardan en el teléfono. Se ven al volver la conexión.
        </Notice>
      )}
      <ErrorText message={online ? (list.error ?? action.error) : null} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data && items.length === 0 ? (
        <Empty title="Aún no tienes mensajes" description="Aparecerán aquí cuando alguien te escriba desde tu ficha." />
      ) : (
        items.map((m) => {
          if (!m.requestStatus)
            return (
              <Card
                key={m.id}
                onPress={m.isRead ? undefined : () => markRead(m.id)}
                label={m.isRead ? undefined : `Mensaje nuevo de ${m.senderName}: marcar como leído`}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body>{m.senderName}</Body>
                  {!m.isRead && <Badge label="Nuevo" tone="gold" />}
                </Row>
                <Muted>{formatDateTime(m.createdAt, 'medium')}</Muted>
                <Muted>
                  {m.senderEmail}
                  {m.senderPhone ? ` · ${m.senderPhone}` : ''}
                </Muted>
                <Body>{m.content}</Body>
                <Row>
                  {!!m.senderEmail && (
                    <Button
                      title="Responder por correo"
                      variant="secondary"
                      small
                      onPress={() => void Linking.openURL(`mailto:${m.senderEmail}`)}
                    />
                  )}
                  {!!m.senderPhone && (
                    <Button
                      title="WhatsApp"
                      variant="secondary"
                      small
                      onPress={() => void Linking.openURL(whatsapp(m.senderPhone!))}
                    />
                  )}
                </Row>
              </Card>
            );
          const status = m.requestStatus;
          const erased = status === 'WITHDRAWN' || status === 'EXPIRED';
          return (
            <Card key={m.id}>
              <Body>{erased ? 'Pedido de contacto' : m.senderName}</Body>
              <Row>
                <Badge label="Quiero que me contacte" tone="success" />
                {m.identityVerified && !erased && <Badge label="Identidad verificada" tone="neutral" />}
                <Badge label={CONTACT_REQUEST_STATUS[status].label} tone={CONTACT_REQUEST_STATUS[status].tone} />
              </Row>
              <Muted>{formatDateTime(m.createdAt, 'medium')}</Muted>
              {erased ? (
                <Muted>
                  {status === 'WITHDRAWN'
                    ? 'El paciente retiró el pedido: sus datos se borraron.'
                    : 'El pedido venció a los 30 días: los datos del paciente se borraron.'}
                </Muted>
              ) : (
                <>
                  {m.preferredChannel && (
                    <KeyValue label="Prefiere" value={CONTACT_CHANNEL_LABEL[m.preferredChannel]} />
                  )}
                  {!!m.senderPhone && <KeyValue label="Teléfono" value={m.senderPhone} />}
                  {!!m.senderEmail && <KeyValue label="Correo" value={m.senderEmail} />}
                  {!!m.preferredTime && <KeyValue label="Horario" value={m.preferredTime} />}
                  <Body>{m.content}</Body>
                  {!!m.expiresAt && <Muted>Los datos se borran el {formatDate(m.expiresAt, 'long')}.</Muted>}
                  <Row>
                    {!!m.senderPhone && (
                      <>
                        <Button
                          title="Llamar"
                          variant="secondary"
                          small
                          onPress={() => void Linking.openURL(`tel:${m.senderPhone!.replace(/[^\d+]/g, '')}`)}
                        />
                        <Button
                          title="WhatsApp"
                          variant="secondary"
                          small
                          onPress={() => void Linking.openURL(whatsapp(m.senderPhone!))}
                        />
                      </>
                    )}
                    {!!m.senderEmail && (
                      <Button
                        title="Correo"
                        variant="secondary"
                        small
                        onPress={() => void Linking.openURL(`mailto:${m.senderEmail}`)}
                      />
                    )}
                  </Row>
                  <Row>
                    {status === 'OPEN' && (
                      <Button
                        title="Marcar como contactado"
                        small
                        disabled={!online || action.busy}
                        onPress={() => void setStatus(m.id, 'CONTACTED')}
                      />
                    )}
                    {(status === 'OPEN' || status === 'CONTACTED') && (
                      <Button
                        title="Cerrar el pedido"
                        variant="ghost"
                        small
                        disabled={!online || action.busy}
                        onPress={() => void setStatus(m.id, 'CLOSED')}
                      />
                    )}
                  </Row>
                </>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
