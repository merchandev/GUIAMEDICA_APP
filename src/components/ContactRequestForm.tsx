import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { request } from '../api';
import { useAction } from '../data';
import { CONTACT_REQUEST_CONSENT_VERSION, contactRequestConsent } from '../legal';
import { fetchCached } from '../offline';
import { useSession } from '../session';
import { Body, Button, ErrorText, Field, Loading, Muted, Notice, Select, Toggle } from '../ui';

interface Prefill {
  name: string | null;
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  identityVerified: boolean;
  days: number;
}

const PHONE = /^0(412|414|416|424|426)-?\d{7}$/;
const CHANNELS = [
  { value: 'PHONE', label: 'Llamada' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Correo' },
];

/**
 * «Quiero que me contacte» (paciente con sesión): elige qué compartir con ese
 * médico y cómo quiere que lo contacte. El médico ve esos datos solo dentro del
 * pedido y por un tiempo limitado.
 */
export function ContactRequestForm({ slug, name }: { slug: string; name: string }) {
  const { online } = useSession();
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [shareName, setShareName] = useState(true);
  const [sharePhone, setSharePhone] = useState(true);
  const [phone, setPhone] = useState('');
  const [shareEmail, setShareEmail] = useState(false);
  const [channel, setChannel] = useState('PHONE');
  const [preferredTime, setPreferredTime] = useState('');
  const [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [sent, setSent] = useState(false);
  const action = useAction();

  useEffect(() => {
    let live = true;
    fetchCached<Prefill>('me:contact-prefill', '/contact/requests/prefill')
      .then(({ data }) => {
        if (!live) return;
        setPrefill(data);
        setShareName(!!data.name);
        setPhone(data.phone ?? '');
        setSharePhone(!!data.phone);
        setShareEmail(!data.phone);
        setChannel(data.phone ? 'PHONE' : 'EMAIL');
      })
      .catch((e) => live && action.setError(e instanceof Error ? e.message : 'No se pudo cargar tu cuenta.'));
    return () => {
      live = false;
    };
  }, [slug, action.setError]);

  if (sent)
    return (
      <Notice tone="success" title="Pedido enviado">
        {`Dr(a). ${name} verá solo lo que elegiste compartir durante ${prefill?.days ?? 30} días. Puedes retirarlo cuando quieras en «Pedidos de contacto».`}
      </Notice>
    );
  if (!prefill) return action.error ? <ErrorText message={action.error} /> : <Loading />;

  const phoneChannel = channel === 'PHONE' || channel === 'WHATSAPP';
  async function submit() {
    await action.run(async () => {
      if (phoneChannel && (!sharePhone || !PHONE.test(phone.trim())))
        throw new Error('Para que te llame o te escriba por WhatsApp, comparte un teléfono válido (ej. 0414-1234567).');
      if (channel === 'EMAIL' && !shareEmail) throw new Error('Para que te escriba, comparte tu correo.');
      await request('/contact/requests', 'POST', {
        professionalSlug: slug,
        shareName,
        phone: sharePhone && phone.trim() ? phone.trim() : undefined,
        shareEmail,
        channel,
        preferredTime: preferredTime.trim() || undefined,
        message: message.trim(),
        acceptConsent: accepted,
      });
      setSent(true);
    });
  }

  return (
    <>
      <Body>
        Elige qué compartir con Dr(a). {name}. Solo verá estos datos dentro de tu pedido.
        {prefill.identityVerified ? ' Verá también que tu identidad está verificada.' : ''}
      </Body>
      {!prefill.emailVerified && (
        <Notice tone="warning">Verifica tu correo para poder enviar el pedido (revisa tu bandeja de entrada).</Notice>
      )}
      <Toggle
        label={prefill.name ? `Mi nombre: ${prefill.name}` : 'Mi nombre (complétalo en tu perfil)'}
        value={shareName}
        onValueChange={setShareName}
        disabled={!prefill.name}
      />
      <Toggle label="Mi teléfono" value={sharePhone} onValueChange={setSharePhone} />
      {sharePhone && (
        <Field label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} />
      )}
      <Toggle label={`Mi correo: ${prefill.email ?? ''}`} value={shareEmail} onValueChange={setShareEmail} />
      <Select label="Cómo prefieres que te contacte" value={channel} onChange={setChannel} options={CHANNELS} />
      <Field
        label="Horario en que prefieres que te contacte (opcional)"
        value={preferredTime}
        onChangeText={setPreferredTime}
        placeholder="Ej. en las mañanas"
        maxLength={100}
      />
      <Field
        label="Mensaje"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        hint="Mínimo 10 caracteres. No incluyas más información de salud de la necesaria. No es para emergencias."
      />
      <Toggle
        label={contactRequestConsent(name, prefill.days)}
        description={`Versión ${CONTACT_REQUEST_CONSENT_VERSION}`}
        value={accepted}
        onValueChange={setAccepted}
      />
      {!online && <Notice tone="warning">Sin conexión: el pedido necesita internet para enviarse.</Notice>}
      <ErrorText message={action.error} />
      <Button
        title="Enviar pedido de contacto"
        loading={action.busy}
        disabled={!online || !accepted || !prefill.emailVerified || message.trim().length < 10}
        onPress={() => void submit()}
      />
      <Muted>Tus pedidos están en Cuenta › Pedidos de contacto.</Muted>
      <Button title="Ver mis pedidos de contacto" variant="ghost" onPress={() => router.push('/paciente/contactos')} />
    </>
  );
}
