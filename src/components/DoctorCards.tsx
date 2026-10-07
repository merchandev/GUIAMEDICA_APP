import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { SITE_URL } from '../config';
import { formatDate, formatTime } from '../dates';
import { PLAN_TIER_LABELS, type DoctorPlanStatus, type ProfessionalProgress } from '../doctor';
import { appRouteFor } from '../links';
import { Badge, Body, Button, Card, colors, Heading, Muted, Notice, Row } from '../ui';
import { Qr } from './Qr';

const DAY = 86_400_000;
const endLabel = (value: string) => `${formatDate(value, 'long')} a las ${formatTime(value)}`;
const period = (text: string) => (text.endsWith('.') ? text : `${text}.`);

/**
 * Estado del plan del médico: la prueba gratis de Plus, su plan o, sin plan,
 * qué significa. En la app no se venden ni se pagan planes (normas de Google
 * Play): solo se informa el estado.
 */
export function PlanStatusCard({ plan }: { plan: DoctorPlanStatus }) {
  const [now] = useState(() => Date.now());
  if (plan.kind === 'TRIAL' && plan.endsAt) {
    const left = new Date(plan.endsAt).getTime() - now;
    if (left <= 0)
      return (
        <Notice tone="warning" title="Tu prueba gratis del plan Plus terminó">
          Tu perfil deja de aparecer en el directorio y de recibir citas nuevas hasta que tengas un plan activo.
        </Notice>
      );
    const days = Math.ceil(left / DAY);
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Prueba gratis del plan Plus</Heading>
          <Badge
            label={days === 1 ? 'Te queda 1 día' : `Te quedan ${days} días`}
            tone={days <= 3 ? 'warning' : 'success'}
          />
        </Row>
        <Body>
          Hasta el {endLabel(plan.endsAt)} tu perfil aparece en el directorio con las herramientas del plan Plus.
          Después, para seguir apareciendo necesitas un plan activo. Si lo activas antes, los días que te quedan se
          suman.
        </Body>
      </Card>
    );
  }
  if (plan.kind === 'PAID') {
    const label = PLAN_TIER_LABELS[plan.tier];
    return (
      <Card>
        <Row>
          <Heading>Tu plan</Heading>
          {label && <Badge label={label.label} tone={label.tone} />}
        </Row>
        {plan.endsAt && <Muted>{period(`Vigente hasta el ${endLabel(plan.endsAt)}`)}</Muted>}
      </Card>
    );
  }
  if (plan.trialAvailable)
    return (
      <Card>
        <Heading>Aún no tienes un plan</Heading>
        <Body>
          Tu perfil todavía no aparece en el directorio. Con todos tus documentos aprobados, tu biografía y tu foto, se
          publica solo con 14 días gratis del plan Plus.
        </Body>
      </Card>
    );
  return (
    <Notice tone="warning" title="Sin plan activo">
      {`${plan.trialEndedAt ? `${period(`Tu prueba gratis terminó el ${endLabel(plan.trialEndedAt)}`)} ` : ''}Tu perfil no aparece en el directorio ni recibe citas nuevas. Tus datos, tus documentos y las citas que ya tenías se conservan.`}
    </Notice>
  );
}

/**
 * Progreso del registro del médico, con lo que exige la publicación y cada
 * paso pendiente (toca para ir a la pantalla que lo resuelve).
 */
export function ProgressCard({ progress, isPublished }: { progress: ProfessionalProgress; isPublished: boolean }) {
  const missing = progress.publication.filter((r) => !r.done);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Heading>Tu registro: {progress.percent} %</Heading>
        <Badge
          label={isPublished ? 'Perfil público' : 'Aún no es público'}
          tone={isPublished ? 'success' : 'warning'}
        />
      </Row>
      <View
        style={s.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
      >
        <View style={[s.fill, { width: `${progress.percent}%` }]} />
      </View>
      {!isPublished && missing.length > 0 && (
        <Notice tone="warning" title="Para aparecer en el directorio te falta:">
          <View style={{ gap: 2 }}>
            {missing.map((r) => (
              <Text key={r.key} style={s.missing}>
                • {r.label}
              </Text>
            ))}
          </View>
        </Notice>
      )}
      {progress.items.map((item) => {
        const locked = !!item.lockedUntil;
        const route = !item.done && !locked ? appRouteFor(item.href) : null;
        const content = (
          <View style={s.item}>
            <View style={[s.dot, item.done && s.dotDone, locked && s.dotLocked]}>
              <Text style={s.dotText}>{item.done ? '✓' : locked ? '🔒' : ''}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.label, (item.done || locked) && { color: colors.muted, fontWeight: '400' }]}>
                {item.label}
                {item.requiredToPublish && !item.done ? (
                  <Text style={s.required}> · obligatorio para publicarte</Text>
                ) : null}
                {locked && item.lockedUntil ? (
                  <Text style={s.required}>
                    {' '}
                    · disponible con {PLAN_TIER_LABELS[item.lockedUntil]?.label ?? item.lockedUntil}
                  </Text>
                ) : null}
              </Text>
              {!!item.detail && <Muted>{item.detail}</Muted>}
              {item.fraction !== undefined && !item.done && (
                <View style={[s.track, { height: 6, width: 160 }]}>
                  <View style={[s.fill, { height: 6, width: `${Math.round(item.fraction * 100)}%` }]} />
                </View>
              )}
            </View>
            {route && <Text style={s.chevron}>›</Text>}
          </View>
        );
        return route ? (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => router.push(route)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            {content}
          </Pressable>
        ) : (
          <View key={item.key}>{content}</View>
        );
      })}
      <Muted>
        {progress.fullDocuments
          ? 'Tienes todos tus documentos aprobados: puedes tener Plus, Premium o Marca Médica.'
          : `La prueba gratis de Plus y los planes Plus, Premium y Marca Médica requieren el 100 % de tus documentos aprobados (tienes ${progress.documents.approved} de ${progress.documents.required}).`}
      </Muted>
    </Card>
  );
}

/** Código y QR del médico para compartir su ficha (abre /m/<código>). */
export function DoctorShareCard({
  code,
  isPublished,
  fullName,
}: {
  code: string;
  isPublished: boolean;
  fullName: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const url = `${SITE_URL}/m/${code}`;
  const copy = (text: string, done: string) =>
    void Clipboard.setStringAsync(text).then(
      () => setMessage(done),
      () => setMessage('No se pudo copiar.'),
    );
  return (
    <Card>
      <Heading>Tu código y QR para compartir</Heading>
      <Qr value={url} size={170} label={`Código QR de tu ficha (${code})`} />
      <Text selectable style={s.code}>
        {code}
      </Text>
      <Muted>
        Tus pacientes pueden escanear el QR o escribir este código en el buscador para abrir tu ficha. No muestra tu
        cédula, RIF ni correo.
      </Muted>
      {!isPublished && <Notice tone="warning">Funcionará en cuanto tu perfil esté publicado en el directorio.</Notice>}
      <Row>
        <Button title="Copiar código" variant="secondary" small onPress={() => copy(code, 'Código copiado.')} />
        <Button title="Copiar enlace" variant="secondary" small onPress={() => copy(url, 'Enlace copiado.')} />
        <Button
          title="Compartir"
          variant="secondary"
          small
          onPress={() => void Share.share({ message: `${fullName} en Guía Médica Monagas: ${url}` })}
        />
      </Row>
      {!!message && <Muted>{message}</Muted>}
    </Card>
  );
}

const s = StyleSheet.create({
  track: { height: 10, borderRadius: 5, backgroundColor: colors.secondary, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.accent },
  missing: { fontSize: 14, color: colors.warning, lineHeight: 21 },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6, minHeight: 40 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotLocked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  dotText: { fontSize: 11, color: colors.white, fontWeight: '800' },
  label: { fontSize: 15, color: colors.text, fontWeight: '600', lineHeight: 21 },
  required: { fontSize: 12, color: colors.warning, fontWeight: '400' },
  chevron: { fontSize: 20, color: colors.muted },
  code: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    color: colors.heading,
    fontFamily: 'monospace',
  },
});
