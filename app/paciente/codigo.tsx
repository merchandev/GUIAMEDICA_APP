import React, { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text } from 'react-native';
import { Redirect, router, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { request } from '../../src/api';
import { Qr } from '../../src/components/Qr';
import { useApi, useAction } from '../../src/data';
import { formatDate } from '../../src/dates';
import { SCOPES, type Scope } from '../../src/legal';
import { openLegal } from '../../src/nav';
import { remember } from '../../src/offline';
import { useSession } from '../../src/session';
import {
  Body,
  Button,
  Card,
  Check,
  colors,
  ErrorText,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Title,
} from '../../src/ui';

interface ShareCode {
  code: string | null;
  url: string | null;
  createdAt: string | null;
  scopes: Scope[];
}

const SHARE_CODE_NOTICE =
  'Compartir este QR o código permite que un médico inicie el acceso a tu información privada. Verifica al profesional, el alcance y la duración antes de entregarlo. Puedes revocar una autorización vigente desde tu cuenta.';
const STEPS = [
  'Entrégale el código a tu médico o muéstrale el QR para que lo escanee con su teléfono.',
  'Tu médico te registra desde su panel y te ubica sin que tu nombre aparezca en ningún sitio público.',
  'Te llega un aviso. En «Permisos» ves quién te registró y puedes retirarle el acceso cuando quieras.',
];

/**
 * Código de paciente y su QR para que un médico lo registre. Se guarda en el
 * teléfono (cifrado): se puede mostrar en el consultorio aunque no haya señal.
 */
export default function ShareCodeScreen() {
  const { user, online } = useSession();
  const share = useApi<ShareCode>(user ? '/patients/me/share-code' : null, {
    cacheKey: 'me:share-code',
    topics: ['patientProfile', 'access'],
  });
  const [scopes, setScopes] = useState<Scope[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const generate = useAction();
  const save = useAction();
  const data = share.data;
  useEffect(() => {
    if (data && scopes === null) setScopes(data.scopes);
  }, [data, scopes]);
  if (!user || user.role !== 'USER') return <Redirect href="/cuenta" />;
  if (!data)
    return (
      <Screen refreshing={share.refreshing} onRefresh={share.refresh}>
        <Stack.Screen options={{ title: 'Mi código' }} />
        {share.loading ? <Loading /> : <ErrorText message={share.error} />}
      </Screen>
    );

  const chosen = scopes ?? data.scopes;
  const changed = [...chosen].sort().join() !== [...data.scopes].sort().join();
  const apply = (next: ShareCode) => {
    share.setData(next);
    remember('me:share-code', next);
  };

  const rotate = () =>
    generate.run(async () => {
      setMessage(null);
      const hadCode = !!data.code;
      apply(await request<ShareCode>('/patients/me/share-code', 'POST'));
      setMessage(hadCode ? 'Generaste un código nuevo: el anterior ya no funciona.' : 'Tu código está listo.');
    });

  return (
    <Screen refreshing={share.refreshing} onRefresh={share.refresh} savedAt={share.savedAt}>
      <Stack.Screen options={{ title: 'Mi código' }} />
      <Title>Mi código de paciente</Title>
      <Body>
        Los pacientes no tienen páginas públicas ni aparecen en buscadores. Este código es la forma de que tu médico te
        ubique en la plataforma sin exponer tu identidad.
      </Body>
      {!!message && <Notice tone="success">{message}</Notice>}
      <ErrorText message={share.error ?? generate.error} />
      <Notice tone="warning" title="Antes de compartirlo">
        {SHARE_CODE_NOTICE}
      </Notice>
      <Button
        title="Cómo funciona la autorización"
        variant="ghost"
        small
        onPress={() => openLegal('/privacidad/autorizacion-medica')}
      />

      {data.code && data.url ? (
        <Card>
          <Qr value={data.url} label={`Código QR del código de paciente ${data.code}`} />
          <Muted center>Tu código</Muted>
          <Text selectable style={s.code} accessibilityLabel={`Tu código: ${data.code.split('').join(' ')}`}>
            {data.code}
          </Text>
          {!!data.createdAt && <Muted center>Generado el {formatDate(data.createdAt, 'long')}</Muted>}
          <Row style={{ justifyContent: 'center' }}>
            <Button
              title="Copiar código"
              variant="secondary"
              small
              onPress={() => void Clipboard.setStringAsync(data.code!).then(() => setMessage('Código copiado.'))}
            />
            <Button
              title="Enviar a mi médico"
              variant="secondary"
              small
              onPress={() =>
                void Share.share({ message: `Mi código de paciente en Guía Médica Monagas: ${data.code}\n${data.url}` })
              }
            />
          </Row>
          <Button
            title="Generar uno nuevo"
            variant="ghost"
            small
            loading={generate.busy}
            disabled={!online}
            onPress={() =>
              Alert.alert(
                '¿Generar un código nuevo?',
                'Tu código actual dejará de funcionar al instante. Los médicos que ya te registraron conservan su acceso; si quieres retirárselo, hazlo desde Permisos.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Generar código nuevo', onPress: () => void rotate() },
                ],
              )
            }
          />
          <Muted>
            Compártelo solo con tu médico, nunca en redes sociales. Si crees que alguien más lo tiene, genera uno nuevo:
            el anterior deja de funcionar al instante.
          </Muted>
        </Card>
      ) : (
        <Card>
          <Heading>Aún no tienes un código</Heading>
          <Body>
            Genera tu código y su QR cuando vayas a consultar a un médico. Es aleatorio y solo sirve para que un médico
            te registre como su paciente.
          </Body>
          {!online && <Notice tone="warning">Sin conexión: para generar el código necesitas internet.</Notice>}
          <Button title="Generar mi código" loading={generate.busy} disabled={!online} onPress={() => void rotate()} />
        </Card>
      )}

      <Section
        title="Qué verá el médico que te registre"
        description="Entregar tu código es tu autorización: el médico que lo registre podrá ver lo que marques aquí durante un año. Puedes retirarle el acceso cuando quieras desde Permisos."
      >
        <Card>
          {SCOPES.map((scope) => (
            <Check
              key={scope.value}
              label={scope.label}
              description={scope.description}
              value={chosen.includes(scope.value)}
              onValueChange={(on) => setScopes(on ? [...chosen, scope.value] : chosen.filter((x) => x !== scope.value))}
            />
          ))}
          {chosen.length === 0 && <ErrorText message="Elige al menos un dato." />}
          <ErrorText message={save.error} />
          <Button
            title="Guardar"
            loading={save.busy}
            disabled={!online || !changed || chosen.length === 0}
            onPress={() =>
              void save.run(async () => {
                setMessage(null);
                const result = await request<ShareCode>('/patients/me/share-code', 'PATCH', { scopes: chosen });
                apply(result);
                setScopes(result.scopes);
                setMessage('Guardado. Se aplica a los médicos que te registren de ahora en adelante.');
              })
            }
          />
          <Button title="Ver mis permisos" variant="ghost" small onPress={() => router.push('/paciente/permisos')} />
        </Card>
      </Section>

      <Section title="Cómo funciona">
        {STEPS.map((step, i) => (
          <Card key={step}>
            <Text style={s.step}>{i + 1}</Text>
            <Body>{step}</Body>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  code: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.heading,
    fontFamily: 'monospace',
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    color: colors.white,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    lineHeight: 28,
    overflow: 'hidden',
  },
});
