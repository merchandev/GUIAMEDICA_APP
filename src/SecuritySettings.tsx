import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { acceptLogin, request } from './api';
import { useOnline } from './offline';
export function SecuritySettings() {
  const online = useOnline();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptLogin(await request('/auth/change-password', 'POST', { currentPassword, newPassword }));
      setCurrent('');
      setNew('');
      Alert.alert('Contraseña actualizada', 'La plataforma cerró tus otras sesiones.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: '#fff', borderRadius: 16 }}>
      <Text style={{ fontSize: 18, color: '#125545', fontWeight: '600' }}>Seguridad de mi cuenta</Text>
      {[
        { label: 'Contraseña actual', value: currentPassword, setter: setCurrent },
        { label: 'Nueva contraseña, 10 a 72 caracteres', value: newPassword, setter: setNew },
      ].map((f) => (
        <TextInput
          key={f.label}
          accessibilityLabel={f.label}
          placeholder={f.label}
          placeholderTextColor="#60746e"
          value={f.value}
          onChangeText={f.setter}
          autoCapitalize="none"
          secureTextEntry
          style={{ minHeight: 48, padding: 14, borderWidth: 1, borderColor: '#cddad1', borderRadius: 12, fontSize: 16 }}
        />
      ))}
      {!online && (
        <Text style={{ color: '#5f4510', backgroundColor: '#fff6e0', padding: 10, borderRadius: 10, lineHeight: 20 }}>
          Sin conexión: para cambiar la contraseña necesitas internet.
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: '#9b2929' }}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy || !online || !currentPassword || !newPassword}
        onPress={() => {
          void submit();
        }}
        style={{
          minHeight: 48,
          padding: 14,
          borderRadius: 12,
          backgroundColor: '#e7eee7',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: online ? 1 : 0.5,
        }}
      >
        <Text style={{ color: '#125545', fontWeight: '600' }}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</Text>
      </Pressable>
    </View>
  );
}
