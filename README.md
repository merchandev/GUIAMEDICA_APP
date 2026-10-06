# Guía Médica Monagas · Android e iOS

Proyecto independiente creado el 6 de octubre de 2026. Interfaz nativa Expo/React Native compartida para Android, iPhone e iPad, conectada a la misma API que la web: https://guiamedicamonagas.com/api/v1. Ver MULTIPLATAFORMA.md para configuración, diseño y validaciones pendientes.

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
- Actualización periódica cada 15 segundos de la pantalla activa y al recuperar foco. Las escrituras utilizan la API real, sin base duplicada.
- Datos sensibles solo en memoria; no se almacenan historias clínicas en el dispositivo.

## Límites de esta entrega

Es una primera versión funcional de desarrollo, no la app completa del plan ni una publicación en Google Play. No se modificaron el backend, la web ni el VPS.

No existe aún canal Socket.IO/outbox en el backend inspeccionado. La actualización de esta versión usa REST; no promete sincronización instantánea entre todas las pantallas. La web mantiene su comportamiento actual.

Hay que validar persistencia/renovación de cookies en Android real. No se considera terminado el transporte seguro de refresh token móvil. El registro nativo es para pacientes; las altas de profesionales y organizaciones y la edición avanzada de perfiles siguen disponibles en la web. No se incluye compra de planes.

Pendientes: transporte de sesión móvil dedicado, outbox y recuperación, cliente de eventos web y móvil, push FCM, App Links verificados, alta nativa de profesionales y organizaciones, concesión avanzada de permisos, documentos y fotos, récipes condicionados, preferencias y pruebas físicas completas.

El identificador Android com.guiamedicamonagas.app es provisional hasta confirmar titular y publicación. eas.json contiene perfiles APK de pruebas y AAB de producción; no se creó cuenta Expo ni una clave de publicación. La compilación local usa la firma de desarrollo del proyecto y no habilita publicación en Google Play por sí sola.

## Verificar

```powershell
npm run typecheck
npm test
npx expo export --platform android --output-dir dist-android
```

Las pruebas de desarrollo contra cuentas reales pueden cambiar citas y avisos. Usar staging y datos sintéticos para validar escrituras. Las comprobaciones públicas de conectividad no prueban login, reservas ni sesiones Android.

## Resultado inicial de comprobaciones

La API productiva respondió HTTP 200 en health, directorio y configuración de récipes. El directorio devolvió cero perfiles publicados y los récipes están desactivados. No se crearon usuarios ni citas de producción durante estas comprobaciones.

TypeScript y dos pruebas de contratos pasaron. npm audit informa 22 alertas transitivas (7 moderadas y 15 altas) del árbol de Expo/Metro y herramientas; la corrección compatible automática no las resolvió. No se aplicó la degradación incompatible a Expo 44 sugerida por --force. Deben evaluarse y resolverse o justificarse antes de liberar la app; no se declara esta versión lista para tienda.
