import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { request } from './api';
import { useRealtimeRefresh, useRealtimeStatus } from './realtime';
type Contact = { id: string; requestStatus: string; content: string; professional: { name: string } };
export function ContactRequests() {
  const [items, setItems] = useState<Contact[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setItems(await request<Contact[]>('/contact/requests/me'));
  }, []);
  const refresh = useCallback(
    () =>
      request<Contact[]>('/contact/requests/me').then(
        (data) => {
          setItems(data);
          setError('');
        },
        (e: Error) => setError(e.message),
      ),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  // La respuesta del médico (o el vencimiento del pedido) aparece sin esperar.
  useRealtimeRefresh(['contact'], refresh);
  // Sin canal, se consulta cada 30 s mientras la app está al frente.
  const live = useRealtimeStatus() === 'live';
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [live, refresh]);
  async function withdraw(id: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(`/contact/requests/${id}/withdraw`, 'PATCH');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo retirar.');
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    OPEN: 'Pendiente',
    CONTACTED: 'Contactado',
    CLOSED: 'Cerrado',
    WITHDRAWN: 'Retirado',
    EXPIRED: 'Vencido',
  };
  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: '#fff', borderRadius: 16 }}>
      <Text style={{ fontSize: 18, color: '#125545', fontWeight: '600' }}>Pedidos de contacto</Text>
      {!items.length && <Text>No hay pedidos en este listado.</Text>}
      {items.map((item) => (
        <View key={item.id} style={{ gap: 8 }}>
          <Text>
            {item.professional.name} · {labels[item.requestStatus] || item.requestStatus}
          </Text>
          <Text>{item.content}</Text>
          {['OPEN', 'CONTACTED', 'CLOSED'].includes(item.requestStatus) && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                Alert.alert('Retirar pedido', 'El médico dejará de ver los datos de este pedido.', [
                  { text: 'Volver', style: 'cancel' },
                  {
                    text: 'Retirar',
                    style: 'destructive',
                    onPress: () => {
                      void withdraw(item.id);
                    },
                  },
                ])
              }
              style={{
                minHeight: 48,
                padding: 14,
                backgroundColor: '#e7eee7',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#125545', fontWeight: '600' }}>Retirar pedido</Text>
            </Pressable>
          )}
        </View>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: '#9b2929' }}>
          {error}
        </Text>
      )}
    </View>
  );
}
