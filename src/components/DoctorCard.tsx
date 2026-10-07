import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { doctorName, type Doctor } from '../contracts';
import { Avatar, Badge, Card, colors } from '../ui';

/** Médico en una lista: foto, nombre, especialidades, municipio y su verificación. */
export function DoctorCard({
  doctor,
  onPress,
  sponsored = false,
}: {
  doctor: Doctor;
  onPress: () => void;
  sponsored?: boolean;
}) {
  const specialties = doctor.specialties.map((x) => x.specialty.name).join(' · ') || 'Medicina general';
  const name = doctorName(doctor);
  return (
    <Card onPress={onPress} label={`${name}. ${specialties}. ${doctor.municipality ?? 'Monagas'}`}>
      <View style={s.row}>
        <Avatar uri={doctor.photoUrl} name={`${doctor.firstName} ${doctor.lastName}`} />
        <View style={s.info}>
          <Text style={s.name}>{name}</Text>
          <Text style={s.muted}>{specialties}</Text>
          <Text style={s.muted}>{doctor.municipality || 'Monagas'}</Text>
          <View style={s.badges}>
            <Badge
              label={doctor.verificationStatus === 'VERIFIED' ? 'Documentación verificada' : 'Verificación en curso'}
              tone={doctor.verificationStatus === 'VERIFIED' ? 'success' : 'neutral'}
            />
            {sponsored && <Badge label="Destacado · patrocinado" tone="gold" />}
            {!!doctor.ratingAverage && !!doctor.ratingCount && (
              <Badge label={`★ ${doctor.ratingAverage.toFixed(1)} (${doctor.ratingCount})`} tone="neutral" />
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 17, color: colors.text, fontWeight: '600' },
  muted: { fontSize: 14, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
