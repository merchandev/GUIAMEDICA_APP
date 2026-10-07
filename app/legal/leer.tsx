import React, { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { SITE_URL } from '../../src/config';
import { legalByPath, LEGAL_DOCS } from '../../src/legal';
import { Body, Button, colors, Empty, Loading } from '../../src/ui';

const SITE = SITE_URL.replace(/\/$/, '');
const LEGAL_PATHS = new Set(LEGAL_DOCS.map((d) => d.path));
// Marca la página antes de dibujarla: la web oculta encabezado, pie y aviso de cookies (html[data-embed="app"]).
const EMBED = "document.documentElement.setAttribute('data-embed','app'); true;";

/**
 * Un texto legal, leído dentro de la app desde el sitio (siempre la versión
 * vigente). Los enlaces a otros textos legales se abren aquí mismo; los de
 * secciones que la app tiene (reclamos, fichas de médicos) van a su pantalla
 * nativa, y los de otros sitios, a la aplicación que corresponda.
 */
export default function LegalReader() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const start = path && LEGAL_PATHS.has(path) ? path : '/terminos-y-condiciones';
  const [title, setTitle] = useState(legalByPath(start)?.title ?? 'Texto legal');
  const [failed, setFailed] = useState(false);
  const web = useRef<WebView>(null);

  function decide(request: WebViewNavigation) {
    const url = request.url;
    if (url === SITE || url.startsWith(`${SITE}/`)) {
      // La ruta sin la consulta ni el ancla (URL de React Native no implementa todo).
      const pathname = url.slice(SITE.length).split(/[?#]/)[0] || '/';
      if (LEGAL_PATHS.has(pathname)) {
        setTitle(legalByPath(pathname)?.title ?? 'Texto legal');
        return true;
      }
      if (pathname === '/legal') router.replace('/legal');
      else if (pathname.startsWith('/reclamos')) router.push('/reclamos');
      else if (pathname.startsWith('/medicos/'))
        router.push({ pathname: '/medico/[slug]', params: { slug: pathname.split('/')[2] } });
      return false;
    }
    if (/^(https?|mailto|tel):/.test(url)) void Linking.openURL(url).catch(() => {});
    return false;
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title }} />
      {failed ? (
        <Empty title="No se pudo abrir el texto" description="Para leer los textos legales hace falta conexión.">
          <Button
            title="Intentar de nuevo"
            onPress={() => {
              setFailed(false);
              web.current?.reload();
            }}
          />
        </Empty>
      ) : (
        <WebView
          ref={web}
          source={{ uri: `${SITE}${start}` }}
          injectedJavaScriptBeforeContentLoaded={EMBED}
          onShouldStartLoadWithRequest={decide}
          startInLoadingState
          renderLoading={() => <Loading label="Abriendo el texto…" />}
          onError={() => setFailed(true)}
          onHttpError={(e) => e.nativeEvent.statusCode >= 500 && setFailed(true)}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          textZoom={100}
          style={s.web}
        />
      )}
      {!failed && (
        <View style={s.footer}>
          <Body>Versión vigente publicada en guiamedicamonagas.com.</Body>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  web: { flex: 1, backgroundColor: colors.background },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});
