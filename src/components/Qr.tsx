import React, { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { renderSVG } from 'uqr';

/**
 * QR de la marca, dibujado en el teléfono (el mismo de la web): el contenido
 * no viaja a ningún servicio externo.
 */
export function Qr({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const xml = useMemo(
    () => renderSVG(value, { ecc: 'M', border: 2, blackColor: '#0f3d33', whiteColor: '#ffffff' }),
    [value],
  );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ alignSelf: 'center', padding: 6, backgroundColor: '#ffffff', borderRadius: 12 }}
    >
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
