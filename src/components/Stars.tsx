import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, TOUCH } from '../ui';

const LABELS = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];

/** Estrellas de una valoración (solo lectura). */
export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <Text accessibilityLabel={`${rounded} de 5 estrellas`} style={[s.stars, { fontSize: size }]}>
      {'★'.repeat(rounded)}
      <Text style={s.off}>{'★'.repeat(5 - rounded)}</Text>
    </Text>
  );
}

/** Elegir de 1 a 5 estrellas. */
export function StarInput({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (value: number) => void;
  error?: string | null;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>Tu calificación</Text>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Calificación de 1 a 5 estrellas">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === n }}
            accessibilityLabel={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${LABELS[n]}`}
            onPress={() => onChange(n)}
            style={s.star}
          >
            <Text style={[s.big, n > value && s.off]}>★</Text>
          </Pressable>
        ))}
      </View>
      {value > 0 && <Text style={s.hint}>{LABELS[value]}</Text>}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  stars: { color: '#c48a12' },
  off: { color: '#d6dcd7' },
  row: { flexDirection: 'row', gap: 4 },
  star: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 34, color: '#c48a12' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  error: { fontSize: 13, color: colors.danger },
});
