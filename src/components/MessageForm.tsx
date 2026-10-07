import React, { useState } from 'react';
import { request } from '../api';
import { useAction } from '../data';
import { useSession } from '../session';
import { Body, Button, ErrorText, Field, Notice } from '../ui';

/** Mensaje desde la ficha (sin cuenta de paciente): llega al correo y al panel del médico. */
export function MessageForm({ slug, name }: { slug: string; name: string }) {
  const { online, user } = useSession();
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState(user?.email ?? '');
  const [senderPhone, setSenderPhone] = useState('');
  const [content, setContent] = useState('');
  const [sent, setSent] = useState(false);
  const action = useAction();
  if (sent)
    return (
      <Notice tone="success" title="Mensaje enviado">
        {`Dr(a). ${name} recibirá tu mensaje por correo y en su panel, y te responderá directamente.`}
      </Notice>
    );
  return (
    <>
      <Body>Escribe a Dr(a). {name}. Te responderá a tu correo o teléfono.</Body>
      <Field
        label="Tu nombre"
        value={senderName}
        onChangeText={setSenderName}
        autoCapitalize="words"
        autoComplete="name"
      />
      <Field
        label="Tu correo"
        value={senderEmail}
        onChangeText={setSenderEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        label="Tu teléfono (opcional)"
        value={senderPhone}
        onChangeText={setSenderPhone}
        keyboardType="phone-pad"
      />
      <Field
        label="Mensaje"
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={2000}
        hint="Mínimo 10 caracteres. No incluyas datos de salud innecesarios. No es para emergencias."
      />
      {!online && <Notice tone="warning">Sin conexión: el mensaje necesita internet para enviarse.</Notice>}
      <ErrorText message={action.error} />
      <Button
        title="Enviar mensaje"
        loading={action.busy}
        disabled={!online || content.trim().length < 10 || senderName.trim().length < 2}
        onPress={() =>
          void action.run(async () => {
            await request('/contact', 'POST', {
              professionalSlug: slug,
              senderName: senderName.trim(),
              senderEmail: senderEmail.trim(),
              senderPhone: senderPhone.trim() || undefined,
              content: content.trim(),
            });
            setSent(true);
          })
        }
      />
    </>
  );
}
