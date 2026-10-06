import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { request } from './api';
import { fetchCached, useOnline } from './offline';
export function ContactDoctor({ slug, name }: { slug: string; name: string }) {
  const online = useOnline();
  const [days, setDays] = useState<number | null>(null);
  const [emailVerified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [shareName, setName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void fetchCached<{ days: number; emailVerified: boolean }>('me:contact-prefill', '/contact/requests/prefill')
      .then(({ data }) => {
        if (live) {
          setDays(data.days);
          setVerified(data.emailVerified);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [slug]);
  async function submit() {
    if (busy || !consent || !days) return;
    setBusy(true);
    setError('');
    try {
      await request('/contact/requests', 'POST', {
        professionalSlug: slug,
        shareName,
        shareEmail: true,
        channel: 'EMAIL',
        message: message.trim(),
        acceptConsent: consent,
      });
      setMessage('');
      setConsent(false);
      Alert.alert('Pedido enviado', 'El médico podrá responder al correo de tu cuenta.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, color: '#125545', fontWeight: '600' }}>Pedir contacto por correo</Text>
      <Text>
        Comparte tu correo con este médico para que responda a tu pedido. Evita incluir información clínica en el
        mensaje.
      </Text>
      <TextInput
        accessibilityLabel="Mensaje para el médico"
        placeholder="Mensaje, mínimo 10 caracteres"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        style={{ minHeight: 90, padding: 14, borderWidth: 1, borderColor: '#cddad1', borderRadius: 12, fontSize: 16 }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1 }}>Compartir también mi nombre</Text>
        <Switch accessibilityLabel="Compartir mi nombre" value={shareName} onValueChange={setName} />
      </View>
      {days !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1 }}>
            Autorizo a Dr(a). {name} a ver los datos que elegí compartir, solo para responder este pedido. El pedido y
            esos datos se borran a los {days} días y puedo retirarlo antes desde «Pedidos de contacto».
          </Text>
          <Switch
            accessibilityLabel="Acepto compartir mis datos para este pedido"
            value={consent}
            onValueChange={setConsent}
          />
        </View>
      )}
      {!emailVerified && <Text>Verifica tu correo en la plataforma para enviar pedidos de contacto.</Text>}
      {!online && (
        <Text style={{ color: '#5f4510', backgroundColor: '#fff6e0', padding: 10, borderRadius: 10, lineHeight: 20 }}>
          Sin conexión: el pedido necesita internet para enviarse.
        </Text>
      )}
      {!!error && online && (
        <Text accessibilityRole="alert" style={{ color: '#9b2929' }}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy || !online || !emailVerified || !consent || !days || message.trim().length < 10}
        onPress={() => {
          void submit();
        }}
        style={{
          minHeight: 48,
          backgroundColor: '#e7eee7',
          padding: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#125545', fontWeight: '600' }}>{busy ? 'Enviando…' : 'Enviar pedido de contacto'}</Text>
      </Pressable>
    </View>
  );
}
