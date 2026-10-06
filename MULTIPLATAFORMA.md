# Base compartida Android e iOS

La app comparte App.tsx, componentes, contratos, conexión API y lógica de sesión entre Android, iPhone e iPad. React Native utiliza unidades lógicas independientes de densidad; no se fijan dimensiones según píxeles de un modelo de teléfono.

## Diseño

- SafeAreaProvider y SafeAreaView para notch, Dynamic Island, barras del sistema e indicador de inicio.
- Contenido flexible con ancho máximo de 720 unidades, centrado en tablets.
- Márgenes adaptativos según useWindowDimensions; orientación flexible.
- Filas con ajuste y texto flexible para pantallas estrechas.
- Botones con altura mínima de 48 unidades y texto sin altura fija.
- Escalado de texto del sistema habilitado por defecto; revisar manualmente tamaños de accesibilidad.
- KeyboardAvoidingView con comportamiento adecuado para iOS y Android; formularios desplazables.
- Colores y componentes comunes, usando controles nativos. No se añade una segunda interfaz específica de iOS.

## Configuración

app.json incluye ios.bundleIdentifier provisional com.guiamedicamonagas.app, supportsTablet y buildNumber, además del identificador Android. Confirmar identificadores definitivos antes de publicar.

eas.json:

- preview: APK Android o build para simulador iOS.
- preview-device: distribución interna en dispositivos registrados.
- production: AAB Android o build iOS para distribución de tienda.

El soporte multiplataforma no significa que la misma firma o binario sirva para ambas tiendas. Cada plataforma tiene credenciales y revisión propias.

## Validaciones pendientes

En Windows se pueden generar bundles JavaScript/Hermes para iOS; esto no equivale a compilar un IPA ni probar UIKit. Simulador iOS requiere macOS/Xcode. Builds firmados pueden realizarse mediante EAS con la cuenta Apple y credenciales correspondientes.

Matriz mínima: iPhone compacto, iPhone con Dynamic Island, iPad, Android compacto y tablet; vertical/horizontal; texto normal/ampliado; teclado; VoiceOver/TalkBack; pérdida de conexión; cambio de cuenta. No se declara validación física realizada.

Validar especialmente cookies y renovación de sesión en ambas plataformas. SecureStore usa implementación nativa en Android/iOS; en iOS puede conservar valores tras reinstalación, por lo que no debe asumirse que desinstalar equivale a revocar la sesión del servidor.

Push iOS necesitará APNs y permisos; App Links Android y Universal Links iOS requieren archivos distintos en el dominio. Cámara, biometría y fotos necesitarán declaraciones de permiso de cada plataforma cuando se implementen. Revisar obligaciones de cifrado/exportación de Apple antes de publicar; no se ha declarado una exención automática.

La sincronización usa el canal en vivo de la plataforma y, sin conexión, la copia cifrada del teléfono (README, «Sin conexión»). Push sigue pendiente.
