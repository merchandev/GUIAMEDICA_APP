import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { formatDate } from '../dates';
import { downloadAndShare } from '../media';
import {
  PRESCRIPTION_STATUS,
  prescriptionFileName,
  prescriptionShareText,
  type PrescriptionView,
} from '../prescriptions';
import { Badge, Button, Card, colors, ErrorText, Heading, Muted, Notice, radius, Row } from '../ui';
import { Qr } from './Qr';

/**
 * El récipe en pantalla, con las mismas dos partes que el PDF: el cuerpo para
 * la farmacia y las indicaciones para el paciente.
 */
export function PrescriptionPaper({ view }: { view: PrescriptionView }) {
  const { prescriber, establishment, patient, items, place } = view.content;
  const status = PRESCRIPTION_STATUS[view.status];
  return (
    <View style={s.paper} accessibilityLabel={`Récipe N° ${view.numberLabel}`}>
      <View style={s.header}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={s.doctor}>Dr(a). {prescriber.fullName}</Text>
          <Badge label={status.label} tone={status.tone} />
        </Row>
        {prescriber.specialties.length > 0 && <Muted>{prescriber.specialties.join(' · ')}</Muted>}
        <Text style={s.small}>
          C.I. {prescriber.cedula} · M.P.P.S. N° {prescriber.mppsNumber}
          {prescriber.colegioNumber ? ` · C.M. N° ${prescriber.colegioNumber}` : ''}
        </Text>
        <Text style={s.small}>
          {establishment.name} · {establishment.address} · RIF {establishment.rif}
          {establishment.phone ? ` · Tel. ${establishment.phone}` : ''}
        </Text>
      </View>
      <View style={s.block}>
        <Text style={s.text}>
          <Text style={s.bold}>Paciente:</Text> {patient.fullName}
        </Text>
        <Text style={s.text}>
          {patient.cedula ? `C.I. ${patient.cedula}` : 'Sin cédula'} · Año de nacimiento: {patient.birthYear}
        </Text>
        {patient.guardian && (
          <Text style={s.text}>
            Representante: {patient.guardian.fullName} (C.I. {patient.guardian.cedula})
          </Text>
        )}
        <Muted>
          {place}, {formatDate(view.issuedAt, 'long')} · Vence el {formatDate(view.expiresAt, 'long')}
        </Muted>
      </View>
      <View style={s.block}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={s.section}>RÉCIPE</Text>
          <Text style={s.bold}>N° {view.numberLabel}</Text>
        </Row>
        {items.map((item, i) => (
          <View key={i} style={{ gap: 2 }}>
            <Text style={s.bold}>
              {i + 1}. {item.activeIngredient} {item.concentration}
              {item.nonSubstitutable ? <Text style={s.danger}> INSUSTITUIBLE</Text> : null}
            </Text>
            <Text style={s.indent}>
              {item.pharmaceuticalForm}, vía {item.route}
              {item.brandNames ? ` (${item.brandNames})` : ''}
            </Text>
            <Text style={s.indent}>
              Dosis: {item.dose}. Duración: {item.duration}.{item.quantity ? ` Cantidad: ${item.quantity}.` : ''}
            </Text>
          </View>
        ))}
        {!!view.content.pharmacistNotes && (
          <Text style={s.text}>
            <Text style={s.bold}>Advertencias al farmacéutico:</Text> {view.content.pharmacistNotes}
          </Text>
        )}
      </View>
      <View style={[s.block, s.dashed]}>
        <Text style={s.section}>INDICACIONES</Text>
        {items.map((item, i) => (
          <Text key={i} style={s.text}>
            <Text style={s.bold}>
              {i + 1}. {item.activeIngredient} {item.concentration}
            </Text>{' '}
            ({item.pharmaceuticalForm}, vía {item.route}): {item.dose}. Duración: {item.duration}.
            {item.instructions ? ` ${item.instructions}` : ''}
          </Text>
        ))}
        {!!view.content.patientInstructions && (
          <Text style={s.text}>
            <Text style={s.bold}>Indicaciones generales:</Text> {view.content.patientInstructions}
          </Text>
        )}
      </View>
      <View style={s.footer}>
        <Text style={s.small}>
          Código de verificación <Text style={s.mono}>{view.code}</Text> · Huella{' '}
          <Text style={s.mono}>{view.fingerprint}</Text>
          {view.annulledAt ? ` · Anulado el ${formatDate(view.annulledAt, 'long')}` : ''}
        </Text>
      </View>
    </View>
  );
}

/**
 * Código y QR del récipe, el PDF y las formas de compartirlo. El PDF se
 * descarga, se comparte con el menú del teléfono y no queda guardado en la app.
 */
export function PrescriptionShare({ view, pdfPath }: { view: PrescriptionView; pdfPath: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usable = view.status === 'VALID';
  const copy = (value: string, done: string) =>
    void Clipboard.setStringAsync(value).then(
      () => setMessage(done),
      () => setMessage('No se pudo copiar.'),
    );
  return (
    <Card>
      <Heading>{usable ? 'Descargar y compartir' : 'Descargar'}</Heading>
      <Qr value={view.verifyUrl} size={150} label={`Código QR del récipe ${view.code}`} />
      <Muted center>Código de verificación</Muted>
      <Text selectable style={s.code}>
        {view.code}
      </Text>
      <Muted>
        Con este código o el QR, el paciente y la farmacia ven el récipe y lo descargan en guiamedicamonagas.com/recipe.
      </Muted>
      <Button
        title="Descargar o compartir el PDF"
        loading={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          setMessage(null);
          downloadAndShare(pdfPath, prescriptionFileName(view.numberLabel), 'application/pdf')
            .then(() => {
              if (usable)
                setMessage('Imprime las dos páginas: el original queda en la farmacia y la copia vuelve sellada.');
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo preparar el PDF. Intenta de nuevo.'))
            .finally(() => setBusy(false));
        }}
      />
      {usable && (
        <Row>
          <Button
            title="Enviar por mensaje"
            variant="secondary"
            small
            onPress={() => void Share.share({ message: prescriptionShareText(view) })}
          />
          <Button
            title="Copiar enlace"
            variant="secondary"
            small
            onPress={() => copy(view.verifyUrl, 'Enlace copiado.')}
          />
          <Button title="Copiar código" variant="secondary" small onPress={() => copy(view.code, 'Código copiado.')} />
        </Row>
      )}
      {!!message && <Notice tone="success">{message}</Notice>}
      <ErrorText message={error} />
    </Card>
  );
}

const s = StyleSheet.create({
  paper: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: { padding: 16, gap: 4, borderBottomWidth: 2, borderBottomColor: colors.primary },
  doctor: { fontSize: 17, fontWeight: '700', color: colors.heading, flexShrink: 1 },
  block: { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  dashed: { borderStyle: 'dashed' },
  section: { fontSize: 13, fontWeight: '800', letterSpacing: 3, color: colors.primary },
  text: { fontSize: 14, color: colors.body, lineHeight: 21 },
  bold: { fontSize: 14, fontWeight: '700', color: colors.text },
  indent: { fontSize: 14, color: colors.body, paddingLeft: 14, lineHeight: 20 },
  danger: { fontSize: 12, fontWeight: '800', color: colors.danger },
  small: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  footer: { padding: 12, backgroundColor: colors.background },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.text },
  code: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    color: colors.heading,
    fontFamily: 'monospace',
  },
});
