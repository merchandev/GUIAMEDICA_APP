/**
 * expo-router instala react-native-gesture-handler, react-native-reanimated y
 * react-native-worklets (los usa solo su menú lateral, que la app no usa): no
 * se enlazan en el código nativo. Así la app pesa menos y Windows no falla por
 * rutas largas al compilar (el codegen de worklets genera rutas de más de 260
 * caracteres). Si alguna pantalla los necesita, se quitan de esta lista.
 */
module.exports = {
  dependencies: {
    'react-native-gesture-handler': { platforms: { android: null, ios: null } },
    'react-native-reanimated': { platforms: { android: null, ios: null } },
    'react-native-worklets': { platforms: { android: null, ios: null } },
  },
};
