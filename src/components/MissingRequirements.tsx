import React from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { REQUIREMENTS, type PrescriptionPad } from '../prescriptions';
import { colors, Notice } from '../ui';

/** Lo que le falta al médico para emitir récipes, con acceso a la pantalla que lo resuelve. */
export function MissingRequirements({ pad }: { pad: PrescriptionPad }) {
  if (pad.canIssue) return null;
  return (
    <Notice tone="warning" title="Para emitir récipes te falta:">
      {pad.missing.map((key) => (
        <Pressable key={key} accessibilityRole="link" onPress={() => router.push(REQUIREMENTS[key].route)} hitSlop={4}>
          <Text style={{ fontSize: 14, color: colors.warning, textDecorationLine: 'underline', lineHeight: 22 }}>
            • {REQUIREMENTS[key].label}
          </Text>
        </Pressable>
      ))}
    </Notice>
  );
}
