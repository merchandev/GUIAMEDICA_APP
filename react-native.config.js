/**
 * expo-router instala react-native-gesture-handler y react-native-reanimated
 * (los usa solo su menú lateral, que la app no usa): no se enlazan en el
 * código nativo. Así la app pesa menos y Windows no falla por rutas largas al
 * compilar. Si alguna pantalla los necesita, se quitan de esta lista.
 */
module.exports = {
  dependencies: {
    'react-native-gesture-handler': { platforms: { android: null, ios: null } },
    'react-native-reanimated': { platforms: { android: null, ios: null } },
  },
};
