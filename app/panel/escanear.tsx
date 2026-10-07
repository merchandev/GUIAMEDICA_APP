import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { patientCodeFrom } from '../../src/links';
import { Body, Button, Card, colors, Loading, Muted, Notice, Screen } from '../../src/ui';

/**
 * Escanear el QR de un paciente para registrarlo. La imagen no se guarda ni
 * se envía: solo se lee el código y se vuelve a «Pacientes» para confirmarlo.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [wrong, setWrong] = useState(false);
  const handled = useRef(false);

  if (!permission) return <Loading />;
  if (!permission.granted)
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Escanear QR' }} />
        <Card>
          <Body>Para leer el QR del paciente, la app necesita usar la cámara. La imagen no se guarda ni se envía.</Body>
          {!permission.canAskAgain && (
            <Notice tone="warning">
              El permiso de cámara está negado: actívalo en los ajustes del teléfono, en Aplicaciones › Guía Médica
              Monagas.
            </Notice>
          )}
          <Button
            title="Permitir la cámara"
            disabled={!permission.canAskAgain}
            onPress={() => void requestPermission()}
          />
          <Button title="Escribir el código" variant="ghost" onPress={() => router.back()} />
        </Card>
      </Screen>
    );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: 'Escanear QR del paciente' }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const code = patientCodeFrom(data);
          if (!code) {
            setWrong(true);
            return;
          }
          handled.current = true;
          router.dismissTo({ pathname: '/pacientes', params: { codigo: code } });
        }}
      />
      <View style={s.frame} pointerEvents="none" />
      <View style={s.footer}>
        {wrong ? (
          <Notice tone="warning">Ese QR no es un código de paciente de Guía Médica Monagas.</Notice>
        ) : (
          <Muted center>Apunta al QR que el paciente muestra en su teléfono («Mi código»).</Muted>
        )}
        <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 20,
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
  },
});
