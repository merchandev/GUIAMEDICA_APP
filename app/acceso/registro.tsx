import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { request, type Login } from '../../src/api';
import { allAccepted, LegalChecklist } from '../../src/components/LegalChecklist';
import type { LegalDocumentKey } from '../../src/contracts';
import { useAction } from '../../src/data';
import { requiredLegalDocuments } from '../../src/legal';
import { useSession } from '../../src/session';
import { Body, Button, Card, Chip, ErrorText, Field, Notice, Row, Screen, Title } from '../../src/ui';

const CEDULA = /^[VEJPG]-?\d{5,9}$/i;
const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).+$/;
type Role = 'USER' | 'PROFESSIONAL';

/** Crear una cuenta de paciente o de médico (los mismos datos y aceptaciones que en la web). */
export default function RegisterScreen() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const { online, acceptSession } = useSession();
  const [role, setRole] = useState<Role>(tipo === 'medico' ? 'PROFESSIONAL' : 'USER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState<LegalDocumentKey[]>([]);
  const action = useAction();
  const documents = requiredLegalDocuments(role);

  const problems = (() => {
    if (!firstName.trim() || !lastName.trim()) return 'Escribe tus nombres y apellidos.';
    if (role === 'USER' && !CEDULA.test(cedula.trim())) return 'Escribe tu cédula (ej. V-12345678).';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Escribe un correo válido.';
    if (password.length < 10 || !PASSWORD.test(password))
      return 'La contraseña necesita al menos 10 caracteres, con letras y números.';
    if (password !== confirm) return 'Las contraseñas no coinciden.';
    if (!allAccepted(documents, accepted)) return 'Para crear la cuenta, marca todas las casillas de aceptación.';
    return null;
  })();

  const submit = () =>
    action.run(async () => {
      if (problems) throw new Error(problems);
      const result = await request<Login>('/auth/register', 'POST', {
        email: email.trim(),
        password,
        role,
        acceptLegal: true,
        acceptHealthConsent: role === 'USER' ? true : undefined,
        declareAdult: role === 'USER' ? true : undefined,
        acceptProfessionalTerms: role === 'PROFESSIONAL' ? true : undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        cedula: role === 'USER' ? cedula.trim().toUpperCase() : undefined,
      });
      await acceptSession(result);
      setPassword('');
      setConfirm('');
      Alert.alert(
        'Cuenta creada',
        role === 'PROFESSIONAL'
          ? 'Te enviamos un correo para verificar tu cuenta. Ahora completa tu perfil y sube tus documentos: al aprobarse todos, tu perfil se publica con 14 días gratis del plan Plus.'
          : 'Te enviamos un correo para verificar tu cuenta. Ya puedes buscar médicos y agendar citas.',
      );
      router.replace(role === 'PROFESSIONAL' ? '/inicio' : '/');
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Crear cuenta' }} />
      <Title>Crear cuenta</Title>
      <Body>
        La cuenta de paciente y la verificación de los médicos son gratuitas; los médicos publican su perfil con 14 días
        gratis del plan Plus.
      </Body>
      <Card>
        <Row>
          <Chip label="Soy paciente" selected={role === 'USER'} onPress={() => setRole('USER')} />
          <Chip label="Soy médico" selected={role === 'PROFESSIONAL'} onPress={() => setRole('PROFESSIONAL')} />
        </Row>
        <Field
          label="Nombres"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={80}
        />
        <Field
          label="Apellidos"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoComplete="family-name"
          maxLength={80}
        />
        {role === 'USER' && (
          <Field
            label="Cédula de identidad"
            value={cedula}
            onChangeText={setCedula}
            placeholder="V-12345678"
            autoCapitalize="characters"
            maxLength={12}
            hint="Se guarda cifrada; ningún médico la ve sin tu autorización."
          />
        )}
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={180}
        />
        <Field
          label="Contraseña"
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
        <LegalChecklist documents={documents} checked={accepted} onChange={setAccepted} />
        {!online && <Notice tone="warning">Sin conexión: para crear la cuenta necesitas internet.</Notice>}
        <ErrorText message={action.error} />
        <Button title="Crear cuenta" loading={action.busy} disabled={!online} onPress={() => void submit()} />
      </Card>
      <Button title="Ya tengo cuenta: iniciar sesión" variant="ghost" onPress={() => router.replace('/acceso')} />
    </Screen>
  );
}
