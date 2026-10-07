import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { request } from '../../src/api';
import { formatDateTime } from '../../src/dates';
import { useAction } from '../../src/data';
import { REQUEST_CATEGORIES, REQUEST_STATUS } from '../../src/legal';
import { useSession } from '../../src/session';
import { Badge, Body, Button, Card, ErrorText, Field, Heading, KeyValue, Notice, Screen } from '../../src/ui';

interface Found {
  ticket: string;
  category: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

/** Estado de una solicitud: con su número y el correo con que se envió. */
export default function RequestStatusScreen() {
  const { user, online } = useSession();
  const [ticket, setTicket] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [found, setFound] = useState<Found | null>(null);
  const action = useAction();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Estado de una solicitud' }} />
      <Body>Escribe el número que recibiste (por ejemplo, R-7KQ4M9XP) y el correo con que enviaste la solicitud.</Body>
      <Field label="Número de solicitud" value={ticket} onChangeText={setTicket} autoCapitalize="characters" />
      <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {!online && <Notice tone="warning">Sin conexión: para consultar necesitas internet.</Notice>}
      <ErrorText message={action.error} />
      <Button
        title="Consultar"
        loading={action.busy}
        disabled={!online}
        onPress={() =>
          void action.run(async () => {
            setFound(null);
            setFound(
              await request<Found>('/legal-requests/lookup', 'POST', { ticket: ticket.trim(), email: email.trim() }),
            );
          })
        }
      />
      {found && (
        <Card>
          <Heading>{found.ticket}</Heading>
          <Badge
            label={REQUEST_STATUS[found.status] ?? found.status}
            tone={found.status === 'RESOLVED' ? 'success' : 'info'}
          />
          <KeyValue label="Tipo" value={REQUEST_CATEGORIES[found.category] ?? found.category} />
          <KeyValue label="Enviada" value={formatDateTime(found.createdAt)} />
          {found.resolvedAt && <KeyValue label="Respondida" value={formatDateTime(found.resolvedAt)} />}
          {found.resolution && <KeyValue label="Respuesta" value={found.resolution} />}
        </Card>
      )}
    </Screen>
  );
}
