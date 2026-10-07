import React from 'react';
import { router, Stack } from 'expo-router';
import { LEGAL_DOCS, LEGAL_GROUPS, MEDICAL_DISCLAIMER, type LegalGroup } from '../../src/legal';
import { openLegal } from '../../src/nav';
import { List, ListItem, Muted, Notice, Screen, Section } from '../../src/ui';

/** Centro legal: todos los textos, por tema. Se leen dentro de la app. */
export default function LegalCenter() {
  return (
    <Screen banner={false}>
      <Stack.Screen options={{ title: 'Centro legal' }} />
      <Muted>
        Los textos se abren dentro de la app y siempre muestran la versión vigente. Para leerlos hace falta conexión.
      </Muted>
      {(Object.keys(LEGAL_GROUPS) as LegalGroup[]).map((group) => (
        <Section key={group} title={LEGAL_GROUPS[group]}>
          <List>
            {LEGAL_DOCS.filter((d) => d.group === group).map((d) => (
              <ListItem key={d.slug} title={d.title} onPress={() => openLegal(d.path)} />
            ))}
            {group === 'seguridad' && (
              <ListItem
                title="Canal de reclamos, denuncias y solicitudes legales"
                subtitle="Envía una solicitud o consulta su estado"
                onPress={() => router.push('/reclamos')}
              />
            )}
          </List>
        </Section>
      ))}
      <Notice tone="neutral">{MEDICAL_DISCLAIMER}</Notice>
    </Screen>
  );
}
