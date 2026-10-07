import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LegalDocumentKey } from '../contracts';
import { ACCEPTANCE_DOCUMENTS, ACCEPTANCE_ORDER } from '../legal';
import { openLegal } from '../nav';
import { Check, colors, s as ui } from '../ui';

/**
 * Una casilla por cada texto que la cuenta debe aceptar, con su declaración y
 * el acceso a cada documento completo (se lee dentro de la app). Las
 * aceptaciones son separadas a propósito: la plataforma registra cada
 * documento con su versión.
 */
export function LegalChecklist({
  documents,
  checked,
  onChange,
}: {
  documents: readonly LegalDocumentKey[];
  checked: readonly LegalDocumentKey[];
  onChange: (next: LegalDocumentKey[]) => void;
}) {
  const ordered = ACCEPTANCE_ORDER.filter((key) => documents.includes(key));
  return (
    <View style={{ gap: 10 }}>
      <Text style={ui.label}>Para continuar, marca cada casilla</Text>
      {ordered.map((key) => {
        const item = ACCEPTANCE_DOCUMENTS[key];
        const on = checked.includes(key);
        return (
          <Check
            key={key}
            label={item.statement}
            value={on}
            onValueChange={() => onChange(on ? checked.filter((k) => k !== key) : [...checked, key])}
          >
            <View style={s.links}>
              <Text style={ui.hint}>Leer:</Text>
              {item.docs.map((doc) => (
                <Pressable
                  key={doc.path}
                  accessibilityRole="link"
                  accessibilityLabel={`Leer ${doc.title}`}
                  onPress={() => openLegal(doc.path)}
                  hitSlop={8}
                >
                  <Text style={s.link}>{doc.title}</Text>
                </Pressable>
              ))}
            </View>
          </Check>
        );
      })}
    </View>
  );
}

export function allAccepted(documents: readonly LegalDocumentKey[], checked: readonly LegalDocumentKey[]) {
  return documents.every((key) => checked.includes(key));
}

const s = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingLeft: 36, alignItems: 'center' },
  link: { fontSize: 14, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline', paddingVertical: 4 },
});
