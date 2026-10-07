import React, { useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { request } from '../../src/api';
import { useApi } from '../../src/data';
import { useSession } from '../../src/session';
import { Body, Card, ErrorText, Loading, Muted, Notice, Screen, Toggle } from '../../src/ui';

interface Preferences {
  email: { type: string; label: string; enabled: boolean }[];
}

/** Correos que la cuenta puede apagar (los avisos siguen llegando a la app). */
export default function EmailPreferencesScreen() {
  const { user, online } = useSession();
  const prefs = useApi<Preferences>(user ? '/notifications/preferences' : null, { cacheKey: 'me:notice-prefs' });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user) return <Redirect href="/cuenta" />;

  const toggle = (type: string, enabled: boolean) => {
    if (!prefs.data) return;
    const next = prefs.data.email.map((p) => (p.type === type ? { ...p, enabled } : p));
    setSaving(type);
    setError(null);
    request<Preferences>('/notifications/preferences', 'PUT', {
      emailOptOut: next.filter((p) => !p.enabled).map((p) => p.type),
    })
      .then((saved) => prefs.setData(saved))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.'))
      .finally(() => setSaving(null));
  };

  return (
    <Screen refreshing={prefs.refreshing} onRefresh={prefs.refresh} savedAt={prefs.savedAt}>
      <Stack.Screen options={{ title: 'Avisos por correo' }} />
      <Body>
        Los avisos de seguridad, de tu cuenta, de verificación, de pagos y de cambios en tus citas siempre llegan
        también por correo. Estos puedes apagarlos: los seguirás viendo en «Avisos».
      </Body>
      {!online && <Notice tone="warning">Sin conexión: para cambiar tus preferencias necesitas internet.</Notice>}
      <ErrorText message={prefs.error ?? error} />
      <Card>
        {!prefs.data ? (
          <Loading />
        ) : prefs.data.email.length === 0 ? (
          <Muted>Tu tipo de cuenta no tiene correos opcionales.</Muted>
        ) : (
          prefs.data.email.map((p) => (
            <Toggle
              key={p.type}
              label={p.label}
              value={p.enabled}
              disabled={!online || saving === p.type}
              onValueChange={(enabled) => toggle(p.type, enabled)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
