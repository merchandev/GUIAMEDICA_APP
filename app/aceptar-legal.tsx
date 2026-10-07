import React, { useState } from 'react';
import { router, Stack } from 'expo-router';
import { request } from '../src/api';
import { allAccepted, LegalChecklist } from '../src/components/LegalChecklist';
import type { LegalDocumentKey } from '../src/contracts';
import { useAction } from '../src/data';
import { LEGAL_EFFECTIVE_DATE_LABEL } from '../src/legal';
import { useSession } from '../src/session';
import { Body, Button, Card, ErrorText, Notice, Screen, Title } from '../src/ui';

/**
 * Si algún texto legal cambió de versión desde la última vez que la cuenta lo
 * aceptó, se pide aceptarlo (una casilla por documento) antes de seguir, como
 * en la web. Los textos se pueden leer desde aquí. La otra salida es cerrar la
 * sesión.
 */
export default function AcceptLegalScreen() {
  const { user, online, refreshUser, signOut } = useSession();
  const [checked, setChecked] = useState<LegalDocumentKey[]>([]);
  const action = useAction();
  const pending = user?.pendingLegalDocuments ?? [];

  const accept = () =>
    action.run(async () => {
      await request('/auth/accept-legal', 'POST', { documents: pending });
      await refreshUser();
      router.replace('/');
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Textos legales', headerBackVisible: false, gestureEnabled: false }} />
      <Title>Actualizamos nuestros textos legales</Title>
      <Body>
        Hay versiones nuevas, vigentes desde el {LEGAL_EFFECTIVE_DATE_LABEL}. Para seguir usando tu cuenta, revisa y
        acepta cada una. Guardamos qué versión aceptaste y cuándo.
      </Body>
      <Card>
        <LegalChecklist documents={pending} checked={checked} onChange={setChecked} />
        {!online && <Notice tone="warning">Sin conexión: para aceptar necesitas internet.</Notice>}
        <ErrorText message={action.error} />
        <Button
          title="Aceptar y continuar"
          loading={action.busy}
          disabled={!online || !pending.length || !allAccepted(pending, checked)}
          onPress={() => void accept()}
        />
        <Button
          title="Cerrar sesión"
          variant="secondary"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              await signOut();
              router.replace('/');
            })
          }
        />
      </Card>
    </Screen>
  );
}
