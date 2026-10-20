import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from './theme';

/** Animación de bienvenida que toma el relevo de la pantalla nativa de Android. */
export function StartupSplash({ exiting, onExited }: { exiting: boolean; onExited: () => void }) {
  const { width, height } = useWindowDimensions();
  const fade = useRef(new Animated.Value(1)).current;
  const markScale = useRef(new Animated.Value(0.72)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const compact = height < 700 || width < 360;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.spring(markScale, { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: true }),
      Animated.timing(markOpacity, { toValue: 1, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.loop(Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [breathe, halo, markOpacity, markScale, progress]);

  useEffect(() => {
    if (!exiting) return;
    Animated.timing(fade, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onExited(); });
  }, [exiting, fade, onExited]);

  const markSize = compact ? 112 : 132;
  return (
    <Animated.View style={[s.root, { opacity: fade }]} accessibilityRole="progressbar" accessibilityLabel="Abriendo Guía Médica Monagas">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="splashBackground" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#0A3028" />
              <Stop offset="0.55" stopColor="#0D4034" />
              <Stop offset="1" stopColor="#155C48" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="url(#splashBackground)" />
          <Circle cx={width * 0.08} cy={height * 0.18} r={width * 0.42} fill="none" stroke="#FFFFFF" strokeOpacity="0.045" strokeWidth="1" />
          <Circle cx={width * 0.08} cy={height * 0.18} r={width * 0.32} fill="none" stroke="#FFFFFF" strokeOpacity="0.03" strokeWidth="1" />
          <Circle cx={width * 0.94} cy={height * 0.78} r={width * 0.5} fill="none" stroke="#B8DACB" strokeOpacity="0.06" strokeWidth="1" />
          <Path d={`M0 ${height * 0.82} Q${width * 0.5} ${height * 0.68} ${width} ${height * 0.82}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.05" strokeWidth="1" />
          {[0, 1, 2, 3, 4].map((dot) => <Circle key={dot} cx={width * 0.8 + dot * 10} cy={height * 0.16} r="1.5" fill="#B8DACB" fillOpacity="0.38" />)}
        </Svg>
      </View>

      <View style={s.content}>
        <View style={[s.markArea, { width: markSize + 56, height: markSize + 56 }]}>
          <Animated.View style={[s.halo, { opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.42] }) }] }]} />
          <Animated.View style={[s.markShadow, { width: markSize, height: markSize, borderRadius: markSize / 2, opacity: markOpacity, transform: [{ scale: markScale }, { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]}>
            <View style={s.markCircle}>
              <View style={s.crossVertical} />
              <View style={s.crossHorizontal} />
              <View style={s.pulseLine}>
                <Svg width="100%" height="100%" viewBox="0 0 100 24">
                  <Path d="M1 13h28l7-7 8 15 10-20 9 12h36" fill="none" stroke="#B8DACB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: markOpacity, alignItems: 'center', transform: [{ translateY: markOpacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Text style={[s.wordmark, compact && { fontSize: 25 }]}>GUÍA MÉDICA</Text>
          <Text style={s.location}>MONAGAS</Text>
          <View style={s.separator} />
          <View style={s.promise}>
            <View style={s.promiseDot} />
            <Text style={s.tagline}>Tu salud, más cerca</Text>
            <View style={s.promiseDot} />
          </View>
          <Text style={s.subline}>DIRECTORIO Y SERVICIOS DE SALUD</Text>
        </Animated.View>
      </View>

      <View style={[s.footer, compact && { bottom: 28 }]}>
        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-78, 154] }) }] }]} />
        </View>
        <Text style={s.loading}>INICIANDO LA APP</Text>
        <Text style={s.version}>SALUD · COMUNIDAD · CONFIANZA</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  markArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 21 },
  halo: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: '#B8DACB' },
  markShadow: { backgroundColor: '#FFFFFF', padding: 7, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 14 },
  markCircle: { flex: 1, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  crossVertical: { position: 'absolute', width: 26, height: 66, borderRadius: 8, backgroundColor: '#FFFFFF' },
  crossHorizontal: { position: 'absolute', width: 66, height: 26, borderRadius: 8, backgroundColor: '#FFFFFF' },
  pulseLine: { position: 'absolute', left: '12%', right: '12%', height: 18, top: '67%', opacity: 0.95 },
  wordmark: { color: '#FFFFFF', fontWeight: '800', fontSize: 30, letterSpacing: 2.4 },
  location: { color: '#B8DACB', fontWeight: '700', fontSize: 12, letterSpacing: 5, marginTop: 7, marginLeft: 5 },
  separator: { width: 40, height: 2, borderRadius: 1, backgroundColor: '#86B49C', marginTop: 22, marginBottom: 14 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promiseDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#86B49C' },
  tagline: { color: '#E5F0E9', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  subline: { color: 'rgba(229,240,233,0.55)', fontSize: 8, fontWeight: '700', letterSpacing: 1.7, marginTop: 16 },
  footer: { position: 'absolute', bottom: 38, alignItems: 'center', gap: 11 },
  progressTrack: { width: 154, height: 3, backgroundColor: 'rgba(255,255,255,0.17)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { width: 78, height: 3, backgroundColor: '#C7E5D2', borderRadius: 3 },
  loading: { color: '#D0E2D8', fontSize: 9, fontWeight: '700', letterSpacing: 2.3, marginTop: 2 },
  version: { color: 'rgba(255,255,255,0.45)', fontSize: 8, letterSpacing: 1.7, marginTop: 7 },
});
