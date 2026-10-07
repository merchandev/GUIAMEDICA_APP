# Guía Médica Monagas · Android e iOS

Proyecto independiente creado el 6 de octubre de 2026. Interfaz nativa Expo/React Native compartida para Android, iPhone e iPad, conectada a la misma API que la web: https://guiamedicamonagas.com/api/v1. Ver MULTIPLATAFORMA.md para configuración, diseño y validaciones pendientes.

## Relación con la plataforma

- **Plataforma (API y web):** https://github.com/merchandev/guiamedicamonagas. Ahí viven las cuentas, los permisos, los datos y la sincronización. La app no tiene base de datos propia.
- **App (este repositorio):** https://github.com/merchandev/GUIAMEDICA_APP. Es solo un cliente de la API.
- **Contrato:** las rutas y los campos que usa la app están en `docs/ENDPOINTS.md` de la plataforma. La API rechaza cualquier campo que no conozca, así que un cambio de contrato se hace primero en la plataforma.
- **Tiempo real:** la app usa el mismo canal que la web (Socket.IO en `/api/v1/realtime`, ACT-0049 de la plataforma). Lo que cambia en la web, en otro dispositivo o en la administración aparece en la app sin recargar, y al revés.
- **Sin conexión:** la app sigue funcionando con la copia guardada en el teléfono y, al volver la señal, envía lo que se hizo mientras tanto y se pone al día sola (ver «Sin conexión»). Usa las mismas rutas que la web. Sin conexión, de la ficha del paciente solo se usa la versión reducida (`/patients/me/basic`).

## Sin conexión

El código está en `src/offline/`; la franja de estado, en `src/SyncBanner.tsx` (arriba de cada pantalla, `src/ui/Screen.tsx`).

- **Qué se ve sin señal:** lo último que mostró cada pantalla: citas y agenda, avisos, cuenta, ficha y permisos del paciente, pedidos de contacto, páginas del directorio y fichas de médicos ya abiertas. Arriba aparece «Sin conexión» con la fecha de esos datos. Una búsqueda nueva se hace entre los médicos guardados en el teléfono.
- **Qué se puede hacer sin señal:** mostrar el código y el QR del paciente; cancelar una cita; confirmar, marcar atendida o no asistida (médicos, y se pueden encadenar); marcar avisos como leídos; editar teléfono y municipio; revocar permisos; retirar pedidos de contacto. Cada cambio queda «En espera de conexión», en orden, y se puede quitar con «No enviar».
- **Qué necesita conexión:** pedir citas (el horario se confirma con la agenda del médico en ese momento), pedir contacto, iniciar sesión, registrarse, recuperar o cambiar la contraseña y la solicitud de eliminación. Sin señal esos botones se desactivan y lo explican.
- **Al volver la señal:** la app lo detecta por los avisos de red del sistema, por cualquier respuesta de la API y por el canal en vivo; sin señal vuelve a probar con esperas crecientes (3 s hasta 1 min). Entonces renueva la sesión, envía lo pendiente en orden y todas las pantallas vuelven a pedir sus datos.
- **Si la plataforma no acepta un cambio** (por ejemplo, la cita se canceló desde la web mientras tanto), se muestra con el motivo. Si el cambio ya estaba hecho porque un envío anterior llegó pero se perdió la respuesta, cuenta como enviado: la app revisa el estado de la cita antes de dar un error.
- **Sesión:** sin señal la sesión no se cierra. Si al volver la plataforma dice que terminó, se borran del teléfono los datos de la cuenta; los cambios en espera se conservan y se envían si se vuelve a entrar con la misma cuenta.
- **Dónde se guarda:** en la carpeta privada de la app, cifrado (AES-GCM) con una clave que vive en el almacén seguro de Android (`expo-crypto`, `expo-file-system` y `expo-secure-store`). La app no hace copias de seguridad (`allowBackup=false`). Se escriben dos archivos alternados, así un corte a mitad de escritura no pierde la copia. Al cerrar sesión se borra lo de la cuenta y se cambia la clave, de modo que lo anterior ya no se puede descifrar.
- **Qué se guarda de la ficha del paciente:** solo nombre, código, teléfono y municipio (`/patients/me/basic`). La ficha completa se ve y se edita con conexión y no se guarda. La primera versión de la copia guardaba la ficha entera; al abrir una versión nueva, esa entrada se borra y la copia se reescribe entera con una clave nueva.
- **En la web** (`npm run web`) no se guarda nada en el navegador: sin conexión solo queda lo cargado en esa visita.

## Ejecutar

```powershell
cd "E:\PROYECTO SEPTIEMBRE 2026\GUIA MEDICA APP"
npm install
npm start
```

Usar Android físico o emulador con una versión compatible con Expo SDK 57. Para previsualización web: `npm run web`. Configurar EXPO_PUBLIC_API_URL para pruebas; nunca poner secretos en variables EXPO_PUBLIC.

## Implementado (versión 0.2.0, ACT-0053 de la plataforma)

La app es nativa y completa para pacientes y médicos: no manda a la web. La administración y las organizaciones se gestionan solo en la web. Navegación con Expo Router (carpeta `app/`); componentes comunes en `src/ui`; la sesión en `src/session.tsx`; los datos de cada pantalla con `useApi` (`src/data.ts`).

**Pestañas según quién entra:** visitante: Médicos y Acceder. Paciente: Médicos, Citas, Avisos y Cuenta. Médico: Inicio, Agenda, Pacientes, Avisos y Cuenta.

**Para todos**

- Directorio con búsqueda, especialidad, municipio, destacados y paginación; ficha completa del médico (verificación, registros, contacto, sedes, redes, video, publicaciones, valoraciones y código para compartir).
- Iniciar sesión (con código por correo si la cuenta lo pide), crear cuenta de paciente o de médico con una casilla por texto legal, y recuperar la contraseña pegando el enlace del correo.
- Textos legales vigentes: se leen dentro de la app. El visor carga la página del sitio sin su encabezado ni su pie, y no abre otras páginas del sitio. Cuando cambia una versión, la app pide aceptarla.
- Reclamos y solicitudes (con o sin cuenta) y consulta de su estado.
- Avisos con «marcar leído» (también sin conexión); cada aviso abre su pantalla de la app (`src/links.ts`). Correos opcionales y seguridad (cambiar la contraseña, cerrar todas las sesiones).

**Paciente**

- Reservar con un calendario de horarios libres, el motivo y, si quiere, qué datos ve el médico y por cuántos días. Reprogramar y cancelar.
- Ficha completa: datos personales, foto, foto de la cédula, salud, medicamentos, condición, emergencia y médicos tratantes.
- Código y QR para que su médico lo registre (se ven también sin conexión), permisos (autorizar y revocar), pedidos «Quiero que me contacte», récipes (ver, agregar con código, PDF), valoraciones y centro de privacidad (copia de sus datos, historial de accesos y solicitudes).

**Médico**

- Inicio con la verificación, el estado del plan (solo informativo: en la app no se venden ni se pagan planes), el progreso del registro y su código QR.
- Perfil profesional (foto, datos, avales, especialidades, contacto, resumen, video, redes, sedes y organizaciones asociadas) y documentos de verificación (archivo o foto).
- Agenda semanal, día por día, con los horarios libres: cargar citas y bloquear horarios o días. En el detalle de la cita: confirmar, marcar realizada o «no asistió» y cancelar (también sin conexión), mover y pedir acceso. Horario de atención, vacaciones y días especiales, e historial con filtros.
- Pacientes: registrar con el código o escaneando su QR con la cámara, ver los datos autorizados, pedir acceso y quitar.
- Mensajes y pedidos de contacto, publicaciones, estadísticas, valoraciones (responder y denunciar) y récipes (emitir, compartir, enviar por correo, entregar en la cuenta del paciente y anular; talonario con firma, sello y logo).

**Sesión móvil:** la app manda la cabecera `X-Client: mobile-app` y no manda `Origin`. Con eso la plataforma le entrega el refresh token en el cuerpo, y la app lo guarda en el almacén seguro de Android. Un navegador siempre manda `Origin`, así que en la web el token sigue solo en la cookie.

**Datos de salud en el teléfono:**

- Con conexión y solo en memoria: la ficha completa, los récipes, los mensajes, los datos que un paciente autorizó a su médico y el motivo de consulta.
- La copia guardada de citas y agenda va sin el motivo.
- Las fotos de documentos se borran de la carpeta temporal después de enviarlas.
- Los PDF y las copias de datos descargados se borran al abrir la app, al cambiar de cuenta y antes de cada descarga.

## Límites de esta entrega

No es todavía una publicación en Google Play. Falta lo que depende del titular: cuenta de organización con D-U-N-S, clave de publicación, declaraciones de la tienda y revisión del abogado. Faltan también los avisos push (FCM), los App Links verificados (hoy el enlace de recuperación del correo se pega en la app) y las pruebas en un teléfono físico.

El identificador Android com.guiamedicamonagas.app es provisional hasta confirmar titular y publicación. La compilación local usa la firma de desarrollo.

## Verificar

```powershell
npm run typecheck
npm test
npm run format
npx expo export --platform android --output-dir dist-android
```

`npm run format` da formato al código con Prettier (`.prettierrc.json`). El código se reformateó el 6 de octubre de 2026: antes tenía componentes enteros en una sola línea.

`npm test` incluye `test/offline.test.ts`: la cola de cambios (orden, duplicados, reintentos, rechazos y cambios que ya estaban hechos), la copia local (carga, escritura agrupada, borrado al cerrar sesión, límite del directorio, limpieza de la copia anterior) y la detección de la conexión.

Prueba sin conexión en el emulador Android (6 de octubre de 2026, compilación de depuración contra una API local con cuentas de ensayo; la red se cortó y se devolvió con `adb shell svc wifi|data`):

- Sin red se vieron las citas, los avisos, la ficha, el directorio y la ficha de la médica guardados. La búsqueda «cardiologia» encontró a la médica guardada, y la reserva y el cambio de contraseña quedaron bloqueados con su explicación.
- Tras cerrar y abrir la app sin red siguieron la cuenta, los datos y los tres cambios en espera. Los dos archivos de la copia (unos 21 KB) no tenían ningún texto legible.
- Al volver la red, la app lo detectó en 3 a 4 segundos y envió los cambios en orden. Una cancelación que mientras tanto se había hecho desde la web contó como enviada, sin error. El teléfono inválido se mostró rechazado con el motivo de la plataforma; el formulario conservó lo escrito y, al corregirlo, se guardó.
- Sin red, la médica confirmó una cita y la marcó atendida. Al volver la red quedó «COMPLETED» en la plataforma.
- Al cerrar sesión cambió la clave y la copia quedó solo con el directorio público. Abierta de nuevo sin red, no mostró ningún dato de la cuenta.

Actualización desde la versión anterior (mismo día, misma preparación; la paciente de ensayo tenía una alergia de prueba):

- Con la app anterior, la copia guardada contenía la ficha completa, alergia incluida.
- Al abrir la app nueva, la ficha completa desapareció de la copia y se reescribieron los dos archivos.
- Sin red, la cuenta mostró nombre, código, teléfono y municipio desde la copia.
- Un teléfono cambiado sin red llegó a la plataforma al volver la señal, y la alergia siguió intacta en la plataforma.

Falta repetirla en un teléfono físico.

Las pruebas de desarrollo contra cuentas reales pueden cambiar citas y avisos. Usar staging y datos sintéticos para validar escrituras. Las comprobaciones públicas de conectividad no prueban login, reservas ni sesiones Android.

## Resultado inicial de comprobaciones

La API productiva respondió HTTP 200 en health, directorio y configuración de récipes. El directorio devolvió cero perfiles publicados y los récipes están desactivados. No se crearon usuarios ni citas de producción durante estas comprobaciones.

TypeScript y dos pruebas de contratos pasaron. npm audit informa 22 alertas transitivas (7 moderadas y 15 altas) del árbol de Expo/Metro y herramientas; la corrección compatible automática no las resolvió. No se aplicó la degradación incompatible a Expo 44 sugerida por --force. Deben evaluarse y resolverse o justificarse antes de liberar la app; no se declara esta versión lista para tienda.
