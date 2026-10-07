import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { request } from '../../src/api';
import { useAction } from '../../src/data';
import { tokenFrom } from '../../src/links';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorText, Field, Heading, Muted, Notice, Screen } from '../../src/ui';

const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).+$/;

/**
 * Recuperar el acceso: se pide el correo y, con el enlace que llega, se elige
 * una contraseña nueva aquí mismo (se pega el enlace completo del correo).
 */
export default function RecoverScreen() {
  const { online } = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [link, setLink] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const ask = useAction();
  const reset = useAction();

  const requestLink = () =>
    ask.run(async () => {
      await request('/auth/forgot-password', 'POST', { email: email.trim() });
      setSent(true);
    });

  const save = () =>
    reset.run(async () => {
      const token = tokenFrom(link);
      if (token.length < 20) throw new Error('Pega el enlace completo que te llegó por correo.');
      if (password.length < 10 || !PASSWORD.test(password))
        throw new Error('La contraseña necesita al menos 10 caracteres, con letras y números.');
      if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
      await request('/auth/reset-password', 'POST', { token, newPassword: password });
      Alert.alert('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.');
      router.replace('/acceso');
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Recuperar acceso' }} />
      {!online && <Notice tone="warning">Sin conexión: para recuperar tu acceso necesitas internet.</Notice>}
      <Card>
        <Heading>1. Pide el enlace</Heading>
        <Body>
          Escribe el correo de tu cuenta. Si existe, te enviaremos un enlace para elegir una contraseña nueva.
        </Body>
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        {sent && (
          <Notice tone="success">
            Si el correo corresponde a una cuenta, te llegarán las instrucciones en unos minutos. Revisa también la
            carpeta de correo no deseado.
          </Notice>
        )}
        <ErrorText message={ask.error} />
        <Button
          title={sent ? 'Enviar de nuevo' : 'Enviar enlace'}
          variant={sent ? 'secondary' : 'primary'}
          loading={ask.busy}
          disabled={!online || !email.trim()}
          onPress={() => void requestLink()}
        />
      </Card>
      <Card>
        <Heading>2. Elige tu nueva contraseña</Heading>
        <Muted>
          En el correo, mantén presionado el botón o el enlace, elige «Copiar enlace» y pégalo aquí. El enlace vence en
          poco tiempo y sirve una sola vez.
        </Muted>
        <Field
          label="Enlace del correo"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          placeholder="https://…"
        />
        <Field
          label="Nueva contraseña"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="new-password"
          maxLength={72}
          hint="Mínimo 10 caracteres, con letras y números."
        />
        <Field
          label="Confirmar contraseña"
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoComplete="new-password"
          maxLength={72}
        />
        <ErrorText message={reset.error} />
        <Button
          title="Guardar contraseña"
          loading={reset.busy}
          disabled={!online || !link.trim() || !password}
          onPress={() => void save()}
        />
      </Card>
    </Screen>
  );
}
