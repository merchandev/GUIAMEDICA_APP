import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, router, Stack } from 'expo-router';
import { request, type Login } from '../../src/api';
import { useAction } from '../../src/data';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorText, Field, Heading, Muted, Notice, Screen } from '../../src/ui';

const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).+$/;

/** Cambiar la contraseña y cerrar todas las sesiones (como «Seguridad» en la web). */
export default function SecurityScreen() {
  const { user, online, acceptSession, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changed, setChanged] = useState(false);
  const change = useAction();
  const all = useAction();
  if (!user) return <Redirect href="/cuenta" />;

  const save = () =>
    change.run(async () => {
      setChanged(false);
      if (!current) throw new Error('Escribe tu contraseña actual.');
      if (next.length < 10 || !PASSWORD.test(next))
        throw new Error('La nueva contraseña necesita al menos 10 caracteres, con letras y números.');
      if (next === current) throw new Error('La nueva contraseña debe ser distinta de la actual.');
      if (next !== confirm) throw new Error('Las contraseñas no coinciden.');
      await acceptSession(
        await request<Login>('/auth/change-password', 'POST', { currentPassword: current, newPassword: next }),
      );
      setCurrent('');
      setNext('');
      setConfirm('');
      setChanged(true);
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Seguridad' }} />
      <Muted>{user.email}</Muted>
      {!online && <Notice tone="warning">Sin conexión: estos cambios necesitan internet.</Notice>}
      <Card>
        <Heading>Cambiar contraseña</Heading>
        <Body>Al cambiarla cerramos tu sesión en los demás dispositivos; en este sigues conectado.</Body>
        <Field
          label="Contraseña actual"
          value={current}
          onChangeText={setCurrent}
          secure
          autoComplete="current-password"
        />
        <Field
          label="Nueva contraseña"
          value={next}
          onChangeText={setNext}
          secure
          autoComplete="new-password"
          maxLength={72}
          hint="Mínimo 10 caracteres, con letras y números."
        />
        <Field
          label="Confirmar nueva contraseña"
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoComplete="new-password"
          maxLength={72}
        />
        {changed && <Notice tone="success">Contraseña actualizada. Cerramos tus otras sesiones.</Notice>}
        <ErrorText message={change.error} />
        <Button title="Cambiar contraseña" loading={change.busy} disabled={!online} onPress={() => void save()} />
      </Card>
      <Card>
        <Heading>Sesiones abiertas</Heading>
        <Body>
          Si iniciaste sesión en un equipo que no es tuyo, o crees que alguien más entró a tu cuenta, cierra todas las
          sesiones. Se cierran de inmediato, incluida esta.
        </Body>
        <ErrorText message={all.error} />
        <Button
          title="Cerrar sesión en todos los dispositivos"
          variant="danger"
          loading={all.busy}
          disabled={!online}
          onPress={() =>
            Alert.alert('Cerrar todas las sesiones', '¿Cerrar sesión en todos tus dispositivos, incluido este?', [
              { text: 'Volver', style: 'cancel' },
              {
                text: 'Sí, cerrar todas',
                style: 'destructive',
                onPress: () =>
                  void all.run(async () => {
                    await request('/auth/logout-all', 'POST');
                    await signOut();
                    router.replace('/cuenta');
                  }),
              },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
