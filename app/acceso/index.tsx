import React from 'react';
import { router, Stack } from 'expo-router';
import { LoginForm } from '../../src/components/LoginForm';
import { Body, Button, Screen, Title } from '../../src/ui';

/** Iniciar sesión desde una pantalla que la necesita (reservar, por ejemplo): al entrar, vuelve a ella. */
export default function LoginScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Iniciar sesión' }} />
      <Title>Bienvenido de nuevo</Title>
      <Body>Usa tu cuenta de Guía Médica Monagas: la misma de la web.</Body>
      <LoginForm onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Button title="Crear una cuenta" variant="secondary" onPress={() => router.replace('/acceso/registro')} />
    </Screen>
  );
}
