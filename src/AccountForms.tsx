import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { acceptLogin, request, SITE_URL } from './api';
import { useOnline } from './offline';

type Mode = 'register' | 'forgot' | 'reset' | null;
export function AccountForms({
  onLogin,
  onModeChange,
}: {
  onLogin: () => Promise<void>;
  onModeChange: (open: boolean) => void;
}) {
  const online = useOnline();
  const [mode, setMode] = useState<Mode>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cedula, setCedula] = useState('');
  const [token, setToken] = useState('');
  const [legal, setLegal] = useState(false);
  const [health, setHealth] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = (label: string, value: string, setter: (v: string) => void, secret = false) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor="#60746e"
      value={value}
      onChangeText={setter}
      secureTextEntry={secret}
      autoCapitalize="none"
      style={s.input}
    />
  );
  const button = (title: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={[s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
  const consent = (title: string, value: boolean, setter: (v: boolean) => void) => (
    <View style={s.row}>
      <Text style={s.consent}>{title}</Text>
      <Switch accessibilityLabel={title} value={value} onValueChange={setter} />
    </View>
  );
  function choose(next: Mode) {
    setMode(next);
    onModeChange(next !== null);
    setError('');
    setPassword('');
    setToken('');
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        if (!legal || !health || !adult) throw new Error('Revisa y acepta cada declaración para crear tu cuenta.');
        await acceptLogin(
          await request('/auth/register', 'POST', {
            email: email.trim(),
            password,
            role: 'USER',
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            cedula: cedula.trim().toUpperCase(),
            acceptLegal: legal,
            acceptHealthConsent: health,
            declareAdult: adult,
          }),
        );
        setPassword('');
        await onLogin();
        choose(null);
        Alert.alert('Cuenta creada', 'Revisa tu correo para verificar tu cuenta.');
      } else if (mode === 'forgot') {
        await request('/auth/forgot-password', 'POST', { email: email.trim() });
        Alert.alert(
          'Solicitud enviada',
          'Si el correo corresponde a una cuenta, recibirás las instrucciones de recuperación.',
        );
      } else if (mode === 'reset') {
        await request('/auth/reset-password', 'POST', { token: token.trim(), newPassword: password });
        choose(null);
        Alert.alert('Contraseña actualizada', 'Ya puedes iniciar sesión.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la solicitud.');
    } finally {
      setBusy(false);
    }
  }
  if (!mode)
    return (
      <View style={s.stack}>
        {button('Crear cuenta de paciente', () => choose('register'))}
        {button('Recuperar contraseña', () => choose('forgot'))}
      </View>
    );
  return (
    <View style={s.panel}>
      <Text style={s.title}>
        {mode === 'register'
          ? 'Registro de paciente'
          : mode === 'forgot'
            ? 'Recuperar acceso'
            : 'Restablecer contraseña'}
      </Text>
      {mode === 'register' && (
        <>
          {field('Nombres', firstName, setFirstName)}
          {field('Apellidos', lastName, setLastName)}
          {field('Cédula, ejemplo V-12345678', cedula, setCedula)}
        </>
      )}
      {mode !== 'reset' && field('Correo electrónico', email, setEmail)}
      {mode === 'reset' && (
        <>
          <Text>Copia el valor token del enlace de recuperación recibido por correo.</Text>
          {field('Token de recuperación', token, setToken)}
        </>
      )}
      {mode !== 'forgot' && (
        <>
          {field('Contraseña: 10 a 72 caracteres, letras y números', password, setPassword, true)}
          <Text style={s.note}>La contraseña debe incluir una letra y un número.</Text>
        </>
      )}
      {mode === 'register' && (
        <>
          {button('Leer términos y privacidad', () => {
            void Linking.openURL(`${SITE_URL}/terminos-y-condiciones`);
          })}
          {button('Leer política de privacidad', () => {
            void Linking.openURL(`${SITE_URL}/privacidad`);
          })}
          {button('Leer consentimiento de salud', () => {
            void Linking.openURL(`${SITE_URL}/consentimiento-paciente`);
          })}
          {consent('Acepto los términos y la política de privacidad vigentes', legal, setLegal)}
          {consent('Consiento el tratamiento de mis datos de salud', health, setHealth)}
          {consent('Declaro tener 18 años o más', adult, setAdult)}
        </>
      )}
      {!online && <Text style={s.offline}>Sin conexión: para esto necesitas internet.</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {button(
        busy
          ? 'Procesando…'
          : mode === 'register'
            ? 'Crear cuenta'
            : mode === 'forgot'
              ? 'Enviar instrucciones'
              : 'Guardar contraseña',
        () => {
          void submit();
        },
        busy ||
          !online ||
          (mode === 'reset'
            ? !token || !password
            : !email ||
              (mode === 'register' &&
                (!password || !firstName || !lastName || !cedula || !legal || !health || !adult))),
      )}
      {mode === 'forgot' && button('Ya tengo el enlace de recuperación', () => choose('reset'), busy)}
      {button('Volver al inicio de sesión', () => choose(null), busy)}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 10 },
  panel: { gap: 12, backgroundColor: '#fff', padding: 16, borderRadius: 16 },
  title: { fontSize: 20, color: '#125545', fontWeight: '700' },
  input: {
    minHeight: 48,
    borderColor: '#cddad1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#193e33',
  },
  button: {
    minHeight: 48,
    backgroundColor: '#e7eee7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  buttonText: { color: '#125545', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  consent: { flex: 1, color: '#293f37', lineHeight: 22 },
  note: { color: '#60746e' },
  offline: { color: '#5f4510', backgroundColor: '#fff6e0', padding: 10, borderRadius: 10, lineHeight: 20 },
  error: { color: '#9b2929' },
});
