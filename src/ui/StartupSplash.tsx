import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
          <Circle cx={width * 0.08} cy={height * 0.18} r={width * 0.42} fill="none" stroke="#FFFFFF" strokeOpacity="0.035" strokeWidth="1" />
          <Circle cx={width * 0.94} cy={height * 0.78} r={width * 0.5} fill="none" stroke="#B8DACB" strokeOpacity="0.05" strokeWidth="1" />
          <Path d={`M0 ${height * 0.82} Q${width * 0.5} ${height * 0.68} ${width} ${height * 0.82}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.035" strokeWidth="1" />
        </Svg>
      </View>

      <View style={s.content}>
        <View style={[s.markArea, { width: markSize + 56, height: markSize + 56 }]}>
          <Animated.View style={[s.halo, { opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.42] }) }] }]} />
          <Animated.View style={[s.markShadow, { width: markSize, height: markSize, borderRadius: markSize / 2, opacity: markOpacity, transform: [{ scale: markScale }, { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]}>
            <View style={s.markCircle}>
              <View style={s.crossVertical} />
              <View style={s.crossHorizontal} />
              <View style={s.pulseLine}><View style={s.pulseDot} /></View>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: markOpacity, alignItems: 'center', transform: [{ translateY: markOpacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Text style={[s.wordmark, compact && { fontSize: 25 }]}>GUÍA MÉDICA</Text>
          <Text style={s.location}>MONAGAS</Text>
          <View style={s.separator} />
          <Text style={s.tagline}>Salud y atención, más cerca de ti</Text>
        </Animated.View>
      </View>

      <View style={[s.footer, compact && { bottom: 28 }]}>
        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-78, 142] }) }] }]} />
        </View>
        <Text style={s.loading}>PREPARANDO TU EXPERIENCIA</Text>
        <Text style={s.version}>GUÍA MÉDICA MONAGAS</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  markArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  halo: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: '#B8DACB' },
  markShadow: { backgroundColor: '#FFFFFF', padding: 6, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  markCircle: { flex: 1, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  crossVertical: { position: 'absolute', width: 26, height: 66, borderRadius: 8, backgroundColor: '#FFFFFF' },
  crossHorizontal: { position: 'absolute', width: 66, height: 26, borderRadius: 8, backgroundColor: '#FFFFFF' },
  pulseLine: { position: 'absolute', left: '13%', right: '13%', height: 2, top: '67%', backgroundColor: '#B8DACB', opacity: 0.88 },
  pulseDot: { position: 'absolute', width: 7, height: 7, right: '28%', top: -2.5, borderRadius: 4, backgroundColor: '#FFFFFF' },
  wordmark: { color: '#FFFFFF', fontWeight: '800', fontSize: 29, letterSpacing: 2.1 },
  location: { color: '#B8DACB', fontWeight: '700', fontSize: 12, letterSpacing: 5, marginTop: 7, marginLeft: 5 },
  separator: { width: 36, height: 2, borderRadius: 1, backgroundColor: '#86B49C', marginTop: 24, marginBottom: 15 },
  tagline: { color: '#DAE9E0', fontSize: 14, letterSpacing: 0.15 },
  footer: { position: 'absolute', bottom: 42, alignItems: 'center', gap: 11 },
  progressTrack: { width: 142, height: 3, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { width: 76, height: 3, backgroundColor: '#B8DACB', borderRadius: 3 },
  loading: { color: '#D0E2D8', fontSize: 9, fontWeight: '700', letterSpacing: 2.1 },
  version: { color: 'rgba(255,255,255,0.42)', fontSize: 9, letterSpacing: 1.5, marginTop: 8 },
});
