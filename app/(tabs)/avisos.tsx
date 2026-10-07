import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { request } from '../../src/api';
import type { Notice, NoticePage } from '../../src/contracts';
import { useApi, useAction } from '../../src/data';
import { formatDateTime } from '../../src/dates';
import { appRouteFor } from '../../src/links';
import { pendingFor, perform } from '../../src/offline';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import { Button, colors, Empty, ErrorText, Loading, Muted, radius, Row, Screen } from '../../src/ui';

/** Avisos de la cuenta (los mismos de la campana de la web), con «marcar como leído» también sin conexión. */
export default function NoticesScreen() {
  const { user, myOps, online } = useSession();
  const page = useApi<NoticePage>(user ? '/notifications?limit=30' : null, {
    cacheKey: 'me:notices',
    topics: ['notifications'],
  });
  const [older, setOlder] = useState<{ items: Notice[]; nextCursor: string | null } | null>(null);
  const more = useAction();
  const action = useAction();
  if (!user) return <Redirect href="/cuenta" />;

  const firstIds = new Set(page.data?.items.map((n) => n.id));
  const items = [...(page.data?.items ?? []), ...(older?.items.filter((n) => !firstIds.has(n.id)) ?? [])];
  const nextCursor = older ? older.nextCursor : (page.data?.nextCursor ?? null);
  const isRead = (n: Notice) => n.isRead || !!pendingFor(myOps, user.id, n.id, ['notification-read']);
  const unread = items.filter((n) => !isRead(n)).length;

  const markRead = async (n: Notice) => {
    if (isRead(n)) return;
    page.setData(
      (current) =>
        current && { ...current, items: current.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) },
    );
    await perform(user.id, {
      kind: 'notification-read',
      method: 'PATCH',
      path: `/notifications/${n.id}/read`,
      targetId: n.id,
      label: `Marcar como leído el aviso «${n.title}»`,
    }).catch(() => {});
    changedLocally('notifications');
  };

  return (
    <Screen refreshing={page.refreshing} onRefresh={page.refresh} savedAt={page.savedAt}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Muted>{unread ? (unread === 1 ? '1 aviso sin leer' : `${unread} avisos sin leer`) : 'Todo leído'}</Muted>
        {unread > 0 && (
          <Button
            title="Marcar todos como leídos"
            variant="secondary"
            small
            loading={action.busy}
            disabled={!online}
            onPress={() =>
              void action.run(async () => {
                await request('/notifications/read-all', 'PATCH');
                page.setData(
                  (current) => current && { ...current, items: current.items.map((x) => ({ ...x, isRead: true })) },
                );
                setOlder(
                  (current) => current && { ...current, items: current.items.map((x) => ({ ...x, isRead: true })) },
                );
                changedLocally('notifications');
              })
            }
          />
        )}
      </Row>
      <ErrorText message={page.error ?? action.error} />
      {page.loading && !page.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title="No tienes avisos"
          description="Aquí verás los avisos de tu cuenta: citas, documentos, pagos y más."
        />
      ) : (
        <View style={s.list}>
          {items.map((n, i) => {
            const read = isRead(n);
            const route = appRouteFor(n.link);
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}${read ? '' : ', sin leer'}. ${n.content}`}
                accessibilityHint={route ? 'Abre la pantalla del aviso' : 'Lo marca como leído'}
                onPress={() => {
                  void markRead(n);
                  if (route) router.push(route);
                }}
                style={({ pressed }) => [s.item, i > 0 && s.separator, !read && s.unread, pressed && { opacity: 0.8 }]}
              >
                <View style={[s.dot, !read && { backgroundColor: colors.accent }]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[s.title, !read && { fontWeight: '700' }]}>{n.title}</Text>
                  <Text style={s.content}>{n.content}</Text>
                  <Muted>
                    {formatDateTime(n.createdAt, 'medium')}
                    {route ? ' · Toca para ver' : ''}
                  </Muted>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <ErrorText message={more.error} />
      {!!nextCursor && (
        <Button
          title="Ver anteriores"
          variant="secondary"
          loading={more.busy}
          disabled={!online}
          onPress={() =>
            void more.run(async () => {
              const next = await request<NoticePage>(
                `/notifications?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
              );
              setOlder((current) => ({
                items: [...(current?.items ?? []), ...next.items],
                nextCursor: next.nextCursor,
              }));
            })
          }
        />
      )}
      <Button title="Avisos por correo" variant="ghost" onPress={() => router.push('/cuenta/notificaciones')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  list: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', gap: 12, padding: 16 },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  unread: { backgroundColor: '#f1f7f3' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  title: { fontSize: 16, color: colors.text, fontWeight: '600' },
  content: { fontSize: 15, color: colors.body, lineHeight: 22 },
});
