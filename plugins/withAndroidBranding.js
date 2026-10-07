const { withAndroidManifest, withDangerousMod, withGradleProperties } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const icon = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#125545" android:pathData="M0,0h108v108h-108z" />
  <path android:fillColor="#FFFFFF" android:pathData="M46,26h16v20h20v16h-20v20h-16v-20h-20v-16h20z" />
  <path android:fillColor="#B8DACB" android:pathData="M18,90h72v4h-72z" />
</vector>`;
module.exports = function withAndroidBranding(config) {
  // Con los módulos de la app completa, el análisis de la compilación de publicación
  // (lint) se queda sin memoria con los 512 MB de metaspace por defecto.
  config = withGradleProperties(config, (mod) => {
    const key = 'org.gradle.jvmargs';
    const value = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';
    mod.modResults = mod.modResults.filter((item) => !(item.type === 'property' && item.key === key));
    mod.modResults.push({ type: 'property', key, value });
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0].$;
    app['android:icon'] = '@drawable/gmm_launcher';
    app['android:roundIcon'] = '@drawable/gmm_launcher';
    app['android:allowBackup'] = 'false';
    app['android:usesCleartextTraffic'] = 'false';
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'gmm_launcher.xml'), icon);
      return mod;
    },
  ]);
};
