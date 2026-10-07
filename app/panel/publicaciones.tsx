import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { request } from '../../src/api';
import { useApi, useAction } from '../../src/data';
import { formatDate } from '../../src/dates';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Title,
} from '../../src/ui';

interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
}

/** Publicaciones de la ficha del médico (como en la web). */
export default function PostsScreen() {
  const { user, online } = useSession();
  const list = useApi<Post[]>(user?.role === 'PROFESSIONAL' ? '/posts/me' : null, {
    cacheKey: 'me:posts',
    topics: ['posts'],
  });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const action = useAction();
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const locked = !!list.error && /plan/i.test(list.error) && !list.data;
  const after = async () => {
    changedLocally('posts');
    await list.reload();
  };

  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh} savedAt={list.savedAt}>
      <Stack.Screen options={{ title: 'Publicaciones' }} />
      <Title>Publicaciones</Title>
      {locked ? (
        <Notice tone="warning">
          Compartir novedades y consejos de salud en tu ficha está disponible desde el plan Plus.
        </Notice>
      ) : (
        <>
          <Card>
            <Heading>Nueva publicación</Heading>
            <Field
              label="Título"
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              hint="Entre 4 y 140 caracteres."
            />
            <Field
              label="Contenido"
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={8000}
              hint="Mínimo 10 caracteres."
            />
            <ErrorText message={action.error} />
            <Button
              title="Publicar"
              loading={action.busy}
              disabled={!online || !title.trim() || !content.trim()}
              onPress={() =>
                void action.run(async () => {
                  await request('/posts', 'POST', { title: title.trim(), content: content.trim(), published: true });
                  setTitle('');
                  setContent('');
                  await after();
                })
              }
            />
          </Card>
          <ErrorText message={list.error} />
          {list.loading && !list.data ? (
            <Loading />
          ) : !list.data?.length ? (
            <Empty title="Aún no tienes publicaciones" />
          ) : (
            list.data.map((post) => (
              <Card key={post.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body>{post.title}</Body>
                  <Badge
                    label={post.published ? 'Publicado' : 'Borrador'}
                    tone={post.published ? 'success' : 'neutral'}
                  />
                </Row>
                <Muted>{post.content.length > 200 ? `${post.content.slice(0, 200)}…` : post.content}</Muted>
                <Muted>{formatDate(post.createdAt, 'medium')}</Muted>
                <Row>
                  <Button
                    title={post.published ? 'Ocultar' : 'Publicar'}
                    variant="secondary"
                    small
                    disabled={!online || action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        await request(`/posts/${post.id}`, 'PATCH', {
                          title: post.title,
                          content: post.content,
                          published: !post.published,
                        });
                        await after();
                      })
                    }
                  />
                  <Button
                    title="Eliminar"
                    variant="ghost"
                    small
                    disabled={!online || action.busy}
                    onPress={() =>
                      Alert.alert('Eliminar publicación', `¿Eliminar «${post.title}»?`, [
                        { text: 'Volver', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: () =>
                            void action.run(async () => {
                              await request(`/posts/${post.id}`, 'DELETE');
                              await after();
                            }),
                        },
                      ])
                    }
                  />
                </Row>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}
