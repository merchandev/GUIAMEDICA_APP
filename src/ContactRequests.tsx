import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { OfflineError } from './api';
import { cached, fetchCached, pendingFor, perform, useOnline, usePendingOps } from './offline';
import { useRealtimeRefresh, useRealtimeStatus } from './realtime';
type Contact = { id: string; requestStatus: string; content: string; professional: { name: string } };
export function ContactRequests({ userId }: { userId: string }) {
  const online = useOnline();
  const ops = usePendingOps();
  const [items, setItems] = useState<Contact[]>(() => cached<Contact[]>('me:contacts')?.data ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    () =>
      fetchCached<Contact[]>('me:contacts', '/contact/requests/me').then(
        ({ data }) => {
          setItems(data);
          setError('');
        },
        (e: Error) =>
          setError(
            e instanceof OfflineError
              ? 'Sin conexión: tus pedidos todavía no están guardados en este teléfono.'
              : e.message,
          ),
      ),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  // La respuesta del médico (o el vencimiento del pedido) aparece sin esperar.
  useRealtimeRefresh(['contact'], refresh);
  // Sin canal pero con conexión, se consulta cada 30 s mientras la app está al frente.
  const live = useRealtimeStatus() === 'live';
  useEffect(() => {
    if (live || !online) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [live, online, refresh]);
  async function withdraw(item: Contact) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await perform(userId, {
        kind: 'contact-withdraw',
        method: 'PATCH',
        path: `/contact/requests/${item.id}/withdraw`,
        targetId: item.id,
        label: `Retirar el pedido de contacto a ${item.professional.name}`,
      });
      if (result === 'queued')
        Alert.alert(
          'Guardado sin conexión',
          'El retiro se enviará solo cuando vuelva la conexión. Hasta entonces, el médico todavía ve los datos de este pedido.',
        );
      else await refresh();
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
      {items.map((item) => {
        const withdrawing = pendingFor(ops, userId, item.id, ['contact-withdraw']);
        return (
          <View key={item.id} style={{ gap: 8 }}>
            <Text>
              {item.professional.name} · {labels[item.requestStatus] || item.requestStatus}
            </Text>
            <Text>{item.content}</Text>
            {withdrawing ? (
              <Text
                style={{ color: '#5f4510', backgroundColor: '#fff6e0', padding: 10, borderRadius: 10, lineHeight: 20 }}
              >
                Retiro en espera de conexión. Hasta que se envíe, el médico todavía ve los datos de este pedido.
              </Text>
            ) : (
              ['OPEN', 'CONTACTED', 'CLOSED'].includes(item.requestStatus) && (
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
                          void withdraw(item);
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
              )
            )}
          </View>
        );
      })}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: '#9b2929' }}>
          {error}
        </Text>
      )}
    </View>
  );
}
