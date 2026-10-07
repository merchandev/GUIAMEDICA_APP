import React from 'react';
import { Redirect, router } from 'expo-router';
import { DoctorShareCard, PlanStatusCard, ProgressCard } from '../../src/components/DoctorCards';
import { useOwnProfile, VERIFICATION_LABELS } from '../../src/doctor';
import { useFeatures } from '../../src/features';
import { openDoctor } from '../../src/nav';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  ErrorText,
  List,
  ListItem,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Section,
  Title,
} from '../../src/ui';

/** Inicio del médico: estado de su perfil, su plan, su progreso, su código y el menú del panel. */
export default function DoctorHomeScreen() {
  const { user } = useSession();
  const doctor = user?.role === 'PROFESSIONAL';
  const own = useOwnProfile(doctor);
  const { reviews, prescriptions } = useFeatures();
  if (!user) return <Redirect href="/cuenta" />;
  if (!doctor) return <Redirect href="/" />;
  const p = own.data;
  if (!p)
    return (
      <Screen refreshing={own.refreshing} onRefresh={own.refresh}>
        {own.loading ? <Loading /> : <ErrorText message={own.error} />}
      </Screen>
    );

  const status = VERIFICATION_LABELS[p.verificationStatus] ?? VERIFICATION_LABELS.PENDING;
  const pendingDocs = p.documents.filter((d) => d.status === 'PENDING').length;
  const rejectedDocs = p.documents.filter((d) => d.status === 'REJECTED').length;
  return (
    <Screen refreshing={own.refreshing} onRefresh={own.refresh} savedAt={own.savedAt}>
      <Title>Hola, {p.firstName}</Title>
      <Body>Este es el estado de tu perfil en Guía Médica Monagas.</Body>
      <Card>
        <Muted>Estado de verificación</Muted>
        <Row style={{ justifyContent: 'space-between' }}>
          <Badge label={status.label} tone={status.tone} />
          {p.isPublished && (
            <Button title="Ver mi ficha pública" variant="ghost" small onPress={() => openDoctor(p.slug)} />
          )}
        </Row>
        {p.verificationStatus !== 'VERIFIED' && (
          <Notice tone="warning">
            <Body>
              {rejectedDocs > 0
                ? `Tienes ${rejectedDocs} documento(s) rechazado(s). Revísalos y vuelve a subirlos.`
                : pendingDocs > 0
                  ? `Tienes ${pendingDocs} documento(s) en revisión. Te avisaremos por correo y WhatsApp.`
                  : p.plan.trialAvailable
                    ? 'Sube tus documentos: con todos aprobados, tu biografía y tu foto, tu perfil se publica con 14 días gratis del plan Plus.'
                    : `Sube tus documentos: con ${p.progress.documents.minimumToPublish} de ${p.progress.documents.required} aprobados, tu biografía, tu foto y un plan, tu perfil aparece en el directorio.`}
            </Body>
            <Button
              title="Ir a documentos"
              variant="secondary"
              small
              onPress={() => router.push('/panel/documentos')}
            />
          </Notice>
        )}
      </Card>
      <PlanStatusCard plan={p.plan} />
      <Section title="Mi consultorio">
        <List>
          <ListItem
            title="Agenda y citas"
            subtitle="Calendario, horario y citas"
            onPress={() => router.navigate('/agenda')}
          />
          <ListItem
            title="Pacientes"
            subtitle="Registrar con código o QR y ver sus datos"
            onPress={() => router.navigate('/pacientes')}
          />
          <ListItem
            title="Mensajes"
            subtitle="Mensajes y pedidos de contacto"
            onPress={() => router.push('/panel/mensajes')}
          />
          {prescriptions && (
            <ListItem title="Récipes" subtitle="Emitir, ver y anular" onPress={() => router.push('/panel/recetas')} />
          )}
          {reviews && (
            <ListItem
              title="Valoraciones"
              subtitle="Opiniones de tus pacientes"
              onPress={() => router.push('/panel/valoraciones')}
            />
          )}
          <ListItem title="Estadísticas" onPress={() => router.push('/panel/estadisticas')} />
        </List>
      </Section>
      <Section title="Mi perfil">
        <List>
          <ListItem
            title="Mi perfil profesional"
            subtitle="Datos, especialidades, contacto, redes y sedes"
            onPress={() => router.push('/panel/perfil')}
          />
          <ListItem
            title="Documentos"
            subtitle="Verificación de tus credenciales"
            onPress={() => router.push('/panel/documentos')}
          />
          <ListItem title="Publicaciones" onPress={() => router.push('/panel/publicaciones')} />
          <ListItem
            title="Mi plan"
            subtitle="Estado de la prueba o del plan"
            onPress={() => router.push('/panel/plan')}
          />
        </List>
      </Section>
      <ProgressCard progress={p.progress} isPublished={p.isPublished} />
      {!!p.publicCode && (
        <DoctorShareCard
          code={p.publicCode}
          isPublished={p.isPublished}
          fullName={`Dr(a). ${p.firstName} ${p.lastName}`}
        />
      )}
    </Screen>
  );
}
