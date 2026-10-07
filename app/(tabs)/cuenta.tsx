import React from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { request } from '../../src/api';
import { LoginForm } from '../../src/components/LoginForm';
import { useAction } from '../../src/data';
import { useFeatures } from '../../src/features';
import { useSession } from '../../src/session';
import {
  Badge,
  Body,
  Button,
  Card,
  ErrorText,
  List,
  ListItem,
  Muted,
  Notice,
  Screen,
  Section,
  Title,
} from '../../src/ui';

const ROLE_LABEL: Record<string, string> = {
  USER: 'Paciente',
  PROFESSIONAL: 'Médico',
  ORGANIZATION: 'Organización',
  ADMIN: 'Administración',
  SUPERADMIN: 'Administración',
};

/** Acceder (sin sesión) o el menú de la cuenta: ficha, permisos, seguridad, avisos, textos legales y salir. */
export default function AccountScreen() {
  const { user, online, signOut } = useSession();
  const { reviews, prescriptions } = useFeatures();
  const action = useAction();
  const version = Constants.expoConfig?.version ?? '';

  if (!user)
    return (
      <Screen>
        <Title>Bienvenido</Title>
        <Body>Inicia sesión con tu cuenta de Guía Médica Monagas: la misma de la web.</Body>
        <LoginForm onDone={() => router.replace('/')} />
        <Section title="¿No tienes cuenta?">
          <List>
            <ListItem
              title="Crear cuenta de paciente"
              subtitle="Gratis: agenda citas y guarda tu ficha"
              onPress={() => router.push({ pathname: '/acceso/registro', params: { tipo: 'paciente' } })}
            />
            <ListItem
              title="Soy médico: crear mi cuenta"
              subtitle="Verificación gratuita y 14 días del plan Plus al publicar"
              onPress={() => router.push({ pathname: '/acceso/registro', params: { tipo: 'medico' } })}
            />
          </List>
        </Section>
        <Section title="Ayuda y legal">
          <List>
            <ListItem title="Textos legales" onPress={() => router.push('/legal')} />
            <ListItem title="Reclamos y solicitudes" onPress={() => router.push('/reclamos')} />
            <ListItem title="Consultar una solicitud" onPress={() => router.push('/reclamos/estado')} />
          </List>
        </Section>
        <Muted center>Versión {version}</Muted>
      </Screen>
    );

  const patient = user.role === 'USER';
  const doctor = user.role === 'PROFESSIONAL';
  return (
    <Screen>
      <Card>
        <Title>{user.email}</Title>
        <Badge label={ROLE_LABEL[user.role] ?? user.role} tone="primary" />
        {user.isEmailVerified ? (
          <Muted>Correo verificado.</Muted>
        ) : (
          <>
            <Notice tone="warning">Verifica tu correo para completar tu acceso: abre el enlace que te enviamos.</Notice>
            <Button
              title="Reenviar el correo de verificación"
              variant="secondary"
              small
              loading={action.busy}
              disabled={!online}
              onPress={() =>
                void action.run(async () => {
                  await request('/auth/resend-verification', 'POST');
                  Alert.alert('Correo enviado', 'Revisa tu bandeja de entrada (y la de correo no deseado).');
                })
              }
            />
          </>
        )}
        <ErrorText message={action.error} />
      </Card>

      {patient && (
        <Section title="Mi salud">
          <List>
            <ListItem
              title="Mi ficha"
              subtitle="Datos personales, de emergencia y de salud"
              onPress={() => router.push('/paciente/perfil')}
            />
            <ListItem
              title="Código para mi médico"
              subtitle="Comparte tu ficha con código o QR"
              onPress={() => router.push('/paciente/codigo')}
            />
            <ListItem
              title="Permisos"
              subtitle="Qué médicos ven tus datos y hasta cuándo"
              onPress={() => router.push('/paciente/permisos')}
            />
            <ListItem
              title="Pedidos de contacto"
              subtitle="«Quiero que me contacte»"
              onPress={() => router.push('/paciente/contactos')}
            />
            {prescriptions && <ListItem title="Mis récipes" onPress={() => router.push('/paciente/recetas')} />}
            {reviews && <ListItem title="Mis valoraciones" onPress={() => router.push('/paciente/valoraciones')} />}
            <ListItem
              title="Privacidad y mis datos"
              subtitle="Historial de accesos y copia de tus datos"
              onPress={() => router.push('/paciente/privacidad')}
            />
          </List>
        </Section>
      )}

      {doctor && (
        <Section title="Mi consultorio">
          <List>
            <ListItem
              title="Panel del médico"
              subtitle="Resumen, plan y accesos"
              onPress={() => router.navigate('/inicio')}
            />
            <ListItem title="Mi perfil público" onPress={() => router.push('/panel/perfil')} />
            <ListItem title="Documentos de verificación" onPress={() => router.push('/panel/documentos')} />
            <ListItem
              title="Mi plan"
              subtitle="Estado de la prueba o del plan"
              onPress={() => router.push('/panel/plan')}
            />
          </List>
        </Section>
      )}

      {!patient && !doctor && (
        <Notice tone="info">
          La administración y las organizaciones se gestionan desde la web. En la app puedes ver tus avisos y tu
          seguridad.
        </Notice>
      )}

      <Section title="Cuenta">
        <List>
          <ListItem
            title="Seguridad"
            subtitle="Contraseña y sesiones abiertas"
            onPress={() => router.push('/cuenta/seguridad')}
          />
          <ListItem title="Avisos por correo" onPress={() => router.push('/cuenta/notificaciones')} />
          <ListItem title="Textos legales" onPress={() => router.push('/legal')} />
          <ListItem title="Reclamos y solicitudes" onPress={() => router.push('/reclamos')} />
          <ListItem
            title="Cerrar sesión"
            danger
            onPress={() =>
              Alert.alert('Cerrar sesión', 'Se borrarán de este teléfono los datos guardados de tu cuenta.', [
                { text: 'Volver', style: 'cancel' },
                {
                  text: 'Cerrar sesión',
                  style: 'destructive',
                  onPress: () =>
                    void action.run(async () => {
                      await signOut();
                      router.replace('/');
                    }),
                },
              ])
            }
          />
        </List>
      </Section>
      <Muted center>Versión {version}</Muted>
    </Screen>
  );
}
