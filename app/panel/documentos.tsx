import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { upload, type PickedFile } from '../../src/api';
import { useApi } from '../../src/data';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from '../../src/doctor';
import { discardPicked, pickDocument, takePhoto } from '../../src/media';
import { changedLocally } from '../../src/realtime';
import { useSession } from '../../src/session';
import { Badge, Body, Button, Card, ErrorText, Loading, Muted, Notice, Row, Screen, Title } from '../../src/ui';

interface Doc {
  id: string;
  type: string;
  status: string;
  originalFileName?: string | null;
  reviewNote?: string | null;
  createdAt: string;
}

interface DocsResponse {
  documents: Doc[];
  required: { type: string; label: string; category: string; categoryLabel: string }[];
  verificationStatus: string;
}

/** Mismo tope que la plataforma: se avisa antes de subir. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Documentos de verificación del médico (como en la web), con archivo o foto de la cámara. */
export default function DocumentsScreen() {
  const { user, online } = useSession();
  const docs = useApi<DocsResponse>(user?.role === 'PROFESSIONAL' ? '/documents/me' : null, {
    cacheKey: 'me:documents',
    topics: ['documents', 'profile'],
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user || user.role !== 'PROFESSIONAL') return <Redirect href="/cuenta" />;
  const data = docs.data;

  const send = async (type: string, pick: () => Promise<PickedFile | null>) => {
    setError(null);
    const file = await pick().catch(() => null);
    if (!file) return;
    if (file.size && file.size > MAX_DOCUMENT_BYTES) {
      discardPicked(file);
      setError(
        `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 10 MB. Comprímelo o escanéalo en menor resolución (una foto nítida en JPG también sirve).`,
      );
      return;
    }
    setUploading(type);
    try {
      await upload(`/documents?type=${encodeURIComponent(type)}`, file);
      changedLocally('documents', 'profile');
      await docs.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el documento');
    } finally {
      discardPicked(file);
      setUploading(null);
    }
  };

  const choose = (type: string) =>
    Alert.alert('Subir documento', DOCUMENT_TYPE_LABELS[type] ?? type, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tomar foto', onPress: () => void send(type, takePhoto) },
      { text: 'Elegir archivo', onPress: () => void send(type, pickDocument) },
    ]);

  const latest = (type: string) =>
    data?.documents
      .filter((d) => d.type === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <Screen refreshing={docs.refreshing} onRefresh={docs.refresh} savedAt={docs.savedAt}>
      <Stack.Screen options={{ title: 'Documentos' }} />
      <Title>Documentos de verificación</Title>
      <Body>
        La verificación es gratuita y la misma para todos los planes. Los requisitos siguen el orden en que se obtienen:
        primero tu identidad y después tus títulos y registros. Un administrador revisa cada documento manualmente. Con
        el 60 % aprobado (más tu biografía y tu foto) tu perfil puede aparecer en el directorio; con el 100 % recibes el
        sello de verificado.
      </Body>
      <Muted>
        Aceptamos PDF, JPG, PNG o WebP de hasta 10 MB; los PDF con scripts o archivos incrustados se rechazan.
      </Muted>
      {!online && <Notice tone="warning">Sin conexión: para subir documentos necesitas internet.</Notice>}
      <ErrorText message={error ?? docs.error} />
      {!data ? (
        <Loading />
      ) : (
        data.required.map((req, index) => {
          const doc = latest(req.type);
          const status = doc ? DOCUMENT_STATUS_LABELS[doc.status] : null;
          return (
            <Card key={req.type}>
              <Body>
                {index + 1}. {DOCUMENT_TYPE_LABELS[req.type] ?? req.label}
              </Body>
              <Muted>{req.categoryLabel}</Muted>
              {doc ? (
                <Row>
                  {status && <Badge label={status.label} tone={status.tone} />}
                  {!!doc.originalFileName && <Muted>{doc.originalFileName}</Muted>}
                </Row>
              ) : (
                <Muted>Aún no has subido este documento.</Muted>
              )}
              {doc?.status === 'REJECTED' && !!doc.reviewNote && (
                <Notice tone="danger">{`Motivo: ${doc.reviewNote}`}</Notice>
              )}
              {doc?.status === 'EXPIRED' && <Notice tone="danger">Este documento venció, debes renovarlo.</Notice>}
              <Button
                title={doc && doc.status !== 'REJECTED' && doc.status !== 'EXPIRED' ? 'Reemplazar' : 'Subir documento'}
                variant={doc && doc.status === 'APPROVED' ? 'secondary' : 'primary'}
                small
                loading={uploading === req.type}
                disabled={!online || (!!uploading && uploading !== req.type)}
                onPress={() => choose(req.type)}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}
