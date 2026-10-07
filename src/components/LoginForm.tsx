import React, { useState } from 'react';
import { router } from 'expo-router';
import { useAction } from '../data';
import { useSession } from '../session';
import { Body, Button, Card, ErrorText, Field, Muted, Notice } from '../ui';

/**
 * Iniciar sesión con la misma cuenta de la web. Si la cuenta tiene activado
 * el código por correo, se pide ese código después de la contraseña.
 */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const { online, login, verifyMfa, notice, clearNotice, myOps } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const action = useAction();

  const enter = () =>
    action.run(async () => {
      const result = await login(email, password);
      setPassword('');
      if (result.challenge) {
        setChallenge(result.challenge);
        return;
      }
      clearNotice();
      onDone?.();
    });

  const verify = () =>
    action.run(async () => {
      await verifyMfa(challenge!, code);
      setChallenge(null);
      setCode('');
      clearNotice();
      onDone?.();
    });

  return (
    <Card>
      {!!notice && <Notice tone="warning">{notice}</Notice>}
      {!online && <Notice tone="warning">Sin conexión: para iniciar sesión necesitas internet.</Notice>}
      {myOps.length > 0 && (
        <Muted>
          Hay cambios hechos sin conexión guardados en este teléfono: se enviarán cuando vuelvas a entrar con la misma
          cuenta.
        </Muted>
      )}
      {challenge ? (
        <>
          <Body>Te enviamos un código de 6 dígitos a tu correo. Escríbelo para terminar de entrar.</Body>
          <Field
            label="Código recibido por correo"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
          />
          <ErrorText message={action.error} />
          <Button
            title="Verificar y entrar"
            loading={action.busy}
            disabled={!online || code.length !== 6}
            onPress={() => void verify()}
          />
          <Button
            title="Volver"
            variant="ghost"
            onPress={() => {
              setChallenge(null);
              setCode('');
              action.setError(null);
            }}
          />
        </>
      ) : (
        <>
          <Field
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secure
            autoComplete="current-password"
          />
          <ErrorText message={action.error} />
          <Button
            title="Entrar"
            loading={action.busy}
            disabled={!online || !email.trim() || !password}
            onPress={() => void enter()}
          />
          <Button title="Olvidé mi contraseña" variant="ghost" onPress={() => router.push('/acceso/recuperar')} />
        </>
      )}
    </Card>
  );
}
