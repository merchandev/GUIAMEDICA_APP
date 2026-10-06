# Guía Médica Monagas · Android e iOS

Proyecto independiente creado el 6 de octubre de 2026. Interfaz nativa Expo/React Native compartida para Android, iPhone e iPad, conectada a la misma API que la web: https://guiamedicamonagas.com/api/v1. Ver MULTIPLATAFORMA.md para configuración, diseño y validaciones pendientes.

## Relación con la plataforma

- **Plataforma (API y web):** https://github.com/merchandev/guiamedicamonagas. Ahí viven las cuentas, los permisos, los datos y la sincronización. La app no tiene base de datos propia.
- **App (este repositorio):** https://github.com/merchandev/GUIAMEDICA_APP. Es solo un cliente de la API.
- **Contrato:** las rutas y los campos que usa la app están en `docs/ENDPOINTS.md` de la plataforma. La API rechaza cualquier campo que no conozca, así que un cambio de contrato se hace primero en la plataforma.
- **Tiempo real:** la app usa el mismo canal que la web (Socket.IO en `/api/v1/realtime`, ACT-0049 de la plataforma). Lo que cambia en la web, en otro dispositivo o en la administración aparece en la app sin recargar, y al revés.
- **Sin conexión:** la app sigue funcionando con la copia guardada en el teléfono y, al volver la señal, envía lo que se hizo mientras tanto y se pone al día sola (ver «Sin conexión»). La plataforma no cambió para esto: usa las mismas rutas.

## Sin conexión

El código está en `src/offline/`; la franja de estado, en `src/SyncBanner.tsx`.

- **Qué se ve sin señal:** lo último que mostró cada pantalla: citas y agenda, avisos, cuenta, ficha y permisos del paciente, pedidos de contacto, páginas del directorio y fichas de médicos ya abiertas. Arriba aparece «Sin conexión» con la fecha de esos datos. Una búsqueda nueva se hace entre los médicos guardados en el teléfono.
- **Qué se puede hacer sin señal:** cancelar una cita; confirmar, marcar atendida o no asistida (médicos, y se pueden encadenar); marcar avisos como leídos; editar teléfono y municipio; revocar permisos; retirar pedidos de contacto. Cada cambio queda «En espera de conexión», en orden, y se puede quitar con «No enviar».
- **Qué necesita conexión:** pedir citas (el horario se confirma con la agenda del médico en ese momento), pedir contacto, iniciar sesión, registrarse, recuperar o cambiar la contraseña y la solicitud de eliminación. Sin señal esos botones se desactivan y lo explican.
- **Al volver la señal:** la app lo detecta por los avisos de red del sistema, por cualquier respuesta de la API y por el canal en vivo; sin señal vuelve a probar con esperas crecientes (3 s hasta 1 min). Entonces renueva la sesión, envía lo pendiente en orden y todas las pantallas vuelven a pedir sus datos.
- **Si la plataforma no acepta un cambio** (por ejemplo, la cita se canceló desde la web mientras tanto), se muestra con el motivo. Si el cambio ya estaba hecho porque un envío anterior llegó pero se perdió la respuesta, cuenta como enviado: la app revisa el estado de la cita antes de dar un error.
- **Sesión:** sin señal la sesión no se cierra. Si al volver la plataforma dice que terminó, se borran del teléfono los datos de la cuenta; los cambios en espera se conservan y se envían si se vuelve a entrar con la misma cuenta.
- **Dónde se guarda:** en la carpeta privada de la app, cifrado (AES-GCM) con una clave que vive en el almacén seguro de Android (`expo-crypto`, `expo-file-system` y `expo-secure-store`). La app no hace copias de seguridad (`allowBackup=false`). Se escriben dos archivos alternados, así un corte a mitad de escritura no pierde la copia. Al cerrar sesión se borra lo de la cuenta y se cambia la clave, de modo que lo anterior ya no se puede descifrar. La app no descarga historias clínicas.
- **En la web** (`npm run web`) no se guarda nada en el navegador: sin conexión solo queda lo cargado en esa visita.

## Ejecutar

```powershell
cd "E:\PROYECTO SEPTIEMBRE 2026\GUIA MEDICA APP"
npm install
npm start
```

Usar Android físico o emulador con una versión compatible con Expo SDK 57. Para previsualización web: `npm run web`. Configurar EXPO_PUBLIC_API_URL para pruebas; nunca poner secretos en variables EXPO_PUBLIC.

## Implementado

- Directorio real con búsqueda y paginación.
- Perfil público del médico y disponibilidad de agenda.
- Login existente y desafío MFA por correo.
- Registro nativo de pacientes con aceptación explícita de términos, privacidad, consentimiento de salud y mayoría de edad.
- Recuperación y restablecimiento de contraseña; cambio de contraseña con sesión iniciada.
- Edición nativa del teléfono y municipio del paciente.
- Consulta y revocación de permisos de datos; solicitud nativa de eliminación de cuenta.
- Pedidos de contacto por correo con consentimiento y retirada desde la app.
- Acciones de agenda del médico: confirmar, completar y marcar inasistencia.
- Proyecto Gradle en `android/`, icono nativo y scripts de compilación APK/AAB. Ver ANDROID.md.
- Sesión Bearer en memoria y renovación mediante cookie actual de la API. Si una API futura devuelve refreshToken, el cliente puede guardarlo en SecureStore, pero ese transporte no está habilitado en el backend actual.
- Listado de citas de paciente y agenda del médico para 30 días.
- Reserva sin concesión implícita de datos clínicos y cancelación con confirmación.
- Avisos y marcado como leído.
- Privacidad, perfil y eliminación mediante enlaces a la plataforma.
- Sincronización en tiempo real con la plataforma (`src/realtime.ts`):
  - **Qué se actualiza solo:** citas y agenda, avisos, pedidos de contacto, ficha y permisos del paciente, horarios libres del médico que se está mirando, directorio y cuenta. El canal no envía datos: avisa qué cambió y la pantalla vuelve a pedirlo a la API con la sesión.
  - **Sesión:** un cambio de sesión hecho en otro lado (contraseña, «cerrar sesión en todos lados», suspensión) se revisa al instante.
  - **Segundo plano:** el canal se cierra. Al volver la app al frente se reconecta y se pone al día con todo.
  - **Sin canal:** con conexión pero con el canal apagado en el servidor, la app consulta cada 30 segundos. Sin conexión, ver «Sin conexión».
- Las escrituras utilizan la API real, sin base duplicada.
- La copia para usar la app sin conexión se guarda cifrada en el teléfono y se borra al cerrar sesión (ver «Sin conexión»). No se almacenan historias clínicas en el dispositivo.

## Límites de esta entrega

Es una primera versión funcional de desarrollo, no la app completa del plan ni una publicación en Google Play.

La sincronización en tiempo real ya existe en la plataforma (bandeja de eventos en PostgreSQL y canal Socket.IO) y la usan la web y esta app. Sin conexión no hay sincronización instantánea: al recuperarla, la app se pone al día. Los avisos push (FCM) con la app cerrada siguen pendientes.

Hay que validar persistencia/renovación de cookies en Android real. No se considera terminado el transporte seguro de refresh token móvil. El registro nativo es para pacientes; las altas de profesionales y organizaciones y la edición avanzada de perfiles siguen disponibles en la web. No se incluye compra de planes.

Pendientes: transporte de sesión móvil dedicado, push FCM, App Links verificados, alta nativa de profesionales y organizaciones, concesión avanzada de permisos, documentos y fotos, récipes condicionados, preferencias y pruebas físicas completas.

El identificador Android com.guiamedicamonagas.app es provisional hasta confirmar titular y publicación. eas.json contiene perfiles APK de pruebas y AAB de producción; no se creó cuenta Expo ni una clave de publicación. La compilación local usa la firma de desarrollo del proyecto y no habilita publicación en Google Play por sí sola.

## Verificar

```powershell
npm run typecheck
npm test
npm run format
npx expo export --platform android --output-dir dist-android
```

`npm run format` da formato al código con Prettier (`.prettierrc.json`). El código se reformateó el 6 de octubre de 2026: antes tenía componentes enteros en una sola línea.

`npm test` incluye `test/offline.test.ts`: la cola de cambios (orden, duplicados, reintentos, rechazos y cambios que ya estaban hechos), la copia local (carga, escritura agrupada, borrado al cerrar sesión, límite del directorio) y la detección de la conexión.

Prueba sin conexión en el emulador Android (6 de octubre de 2026, compilación de depuración contra una API local con cuentas de ensayo; la red se cortó y se devolvió con `adb shell svc wifi|data`):

- Sin red se vieron las citas, los avisos, la ficha, el directorio y la ficha de la médica guardados. La búsqueda «cardiologia» encontró a la médica guardada, y la reserva y el cambio de contraseña quedaron bloqueados con su explicación.
- Tras cerrar y abrir la app sin red siguieron la cuenta, los datos y los tres cambios en espera. Los dos archivos de la copia (unos 21 KB) no tenían ningún texto legible.
- Al volver la red, la app lo detectó en 3 a 4 segundos y envió los cambios en orden. Una cancelación que mientras tanto se había hecho desde la web contó como enviada, sin error. El teléfono inválido se mostró rechazado con el motivo de la plataforma; el formulario conservó lo escrito y, al corregirlo, se guardó.
- Sin red, la médica confirmó una cita y la marcó atendida. Al volver la red quedó «COMPLETED» en la plataforma.
- Al cerrar sesión cambió la clave y la copia quedó solo con el directorio público. Abierta de nuevo sin red, no mostró ningún dato de la cuenta.

Falta repetirla en un teléfono físico.

Las pruebas de desarrollo contra cuentas reales pueden cambiar citas y avisos. Usar staging y datos sintéticos para validar escrituras. Las comprobaciones públicas de conectividad no prueban login, reservas ni sesiones Android.

## Resultado inicial de comprobaciones

La API productiva respondió HTTP 200 en health, directorio y configuración de récipes. El directorio devolvió cero perfiles publicados y los récipes están desactivados. No se crearon usuarios ni citas de producción durante estas comprobaciones.

TypeScript y dos pruebas de contratos pasaron. npm audit informa 22 alertas transitivas (7 moderadas y 15 altas) del árbol de Expo/Metro y herramientas; la corrección compatible automática no las resolvió. No se aplicó la degradación incompatible a Expo 44 sugerida por --force. Deben evaluarse y resolverse o justificarse antes de liberar la app; no se declara esta versión lista para tienda.
