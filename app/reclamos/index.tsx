import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { request } from '../../src/api';
import { useAction } from '../../src/data';
import { REQUEST_CATEGORIES } from '../../src/legal';
import { openLegal } from '../../src/nav';
import { useSession } from '../../src/session';
import { Body, Button, ErrorText, Field, Muted, Notice, Screen, Select } from '../../src/ui';

/**
 * Canal de reclamos, denuncias y solicitudes legales (el mismo de la web).
 * Con sesión, la solicitud queda en la cuenta y se responde a su correo; sin
 * sesión hace falta un correo para responder y consultar el estado.
 */
export default function ComplaintsScreen() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const { user, online } = useSession();
  const [category, setCategory] = useState(tipo && REQUEST_CATEGORIES[tipo] ? tipo : '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const action = useAction();

  async function submit() {
    await action.run(async () => {
      if (!category) throw new Error('Elige el tipo de solicitud.');
      const body = {
        category,
        requesterName: name.trim(),
        ...(user ? {} : { requesterEmail: email.trim() }),
        requesterPhone: phone.trim() || undefined,
        subjectUrl: subject.trim() || undefined,
        description: description.trim(),
      };
      const result = await request<{ ticket: string }>(user ? '/legal-requests/me' : '/legal-requests', 'POST', body);
      Alert.alert(
        'Solicitud recibida',
        `Su número es ${result.ticket}. Guárdalo: con él y tu correo puedes consultar el estado. Te responderemos por correo.`,
        [{ text: 'Entendido', onPress: () => router.back() }],
      );
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Reclamos y solicitudes' }} />
      <Body>
        Usa este canal para ejercer tus derechos sobre tus datos, pedir el cierre de tu cuenta, denunciar un perfil o un
        contenido, o hacer cualquier otra solicitud legal. Cada solicitud recibe un número de seguimiento.
      </Body>
      <Select
        label="Tipo de solicitud"
        value={category}
        onChange={setCategory}
        placeholder="Elegir el tipo"
        options={Object.entries(REQUEST_CATEGORIES).map(([value, label]) => ({ value, label }))}
      />
      <Field label="Tu nombre" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      {user ? (
        <Muted>Te responderemos a {user.email}.</Muted>
      ) : (
        <Field
          label="Tu correo"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          hint="Te responderemos aquí. Con este correo y el número consultas el estado."
        />
      )}
      <Field label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field
        label="Enlace o código del perfil o contenido (opcional)"
        value={subject}
        onChangeText={setSubject}
        autoCapitalize="none"
        hint="Por ejemplo, el código GM del médico o el enlace de su ficha."
      />
      <Field
        label="Describe tu solicitud"
        value={description}
        onChangeText={setDescription}
        multiline
        hint="Mínimo 20 caracteres. No incluyas datos de salud que no sean necesarios."
        maxLength={5000}
      />
      {category === 'ACCOUNT_DELETION' && (
        <Notice tone="warning">
          La solicitud no borra la cuenta al instante: el equipo comprueba que eres el titular y te responde por correo.
          Algunos datos se conservan por obligación legal, como explica la política de retención.
        </Notice>
      )}
      {category === 'ACCOUNT_DELETION' && (
        <Button
          title="Leer la política de retención"
          variant="ghost"
          onPress={() => openLegal('/privacidad/retencion')}
        />
      )}
      {!online && <Notice tone="warning">Sin conexión: para enviar una solicitud necesitas internet.</Notice>}
      <ErrorText message={action.error} />
      <Button title="Enviar solicitud" loading={action.busy} disabled={!online} onPress={() => void submit()} />
      <Button
        title="Consultar el estado de una solicitud"
        variant="secondary"
        onPress={() => router.push('/reclamos/estado')}
      />
    </Screen>
  );
}
