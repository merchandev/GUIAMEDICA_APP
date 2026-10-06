# Entrega Android — 6 de octubre de 2026

## Archivos

- Proyecto: `E:\PROYECTO SEPTIEMBRE 2026\GUIA MEDICA APP`.
- Proyecto Android Studio: subcarpeta `android`.
- APK instalable: `artifacts/guia-medica-monagas-pruebas.apk`.
- Bundle Android: `artifacts/guia-medica-monagas-pruebas.aab`.
- Capturas de comprobación: `artifacts/android-home.png` y `artifacts/android-account.png`.
- Instrucciones para reproducir los builds: `ANDROID.md`.

Los dos binarios usan firma de desarrollo y versión 0.1.0. Para Google Play, recompilar el AAB con la clave de publicación del titular.

Resultado final: APK de 42.226.174 bytes y AAB de 28.880.733 bytes. SHA-256 del APK: `946348FD6DB6BD79AC867477663440D433CF2F8F345BB115B68F4E31C8BCD061`.

## Cambios de esta entrega

1. Generación del proyecto Gradle nativo Android, con wrapper y actividad de entrada.
2. Scripts `android:prebuild`, `android:apk` y `android:aab`.
3. Detección local de Java 17, Android SDK y Gradle; sin cambiar variables globales de Windows.
4. Icono vectorial propio, HTTPS obligatorio para release y backup desactivado.
5. Bloqueo de permisos de almacenamiento y superposición que la app no necesita.
6. Registro nativo de pacientes con consentimientos separados y sin aceptación preseleccionada.
7. Recuperación, restablecimiento y cambio de contraseña.
8. Edición nativa de datos de contacto del paciente.
9. Consulta y revocación de permisos sobre datos de salud; filtrado de permisos vencidos o revocados.
10. Solicitud nativa de eliminación de cuenta, gestionada por el equipo de la plataforma.
11. Pedido de contacto por correo con consentimiento y opción de retirarlo.
12. Acciones de agenda del profesional: confirmar, completar y marcar inasistencia.
13. Botón Atrás de Android y flujos de acceso separados.
14. Mensajes de conexión y timeout en español.
15. Renovación de sesión también para rutas autenticadas de cuenta.
16. Protección ante respuestas de renovación que llegan después de cerrar o cambiar de sesión.
17. Indicador seguro de cierre de sesión para evitar restauración automática mediante una cookie después de un cierre local sin conexión.
18. Actualización periódica de perfil y permisos sin sobrescribir los campos mientras el usuario los está editando.

El directorio, las reservas, la cancelación, los avisos, safe areas y diseño compartido con iOS se conservan y se incorporan al APK nativo.

## Qué se comprobó

- TypeScript sin errores.
- Dos pruebas de contratos aprobadas.
- Bundle JavaScript Android generado.
- Build Gradle APK y AAB exitoso.
- Firma del APK válida mediante apksigner.
- Paquete `com.guiamedicamonagas.app`, minSdk 24, targetSdk 36.
- Arquitecturas arm64-v8a y x86_64.
- Instalación y arranque en emulador Pixel 9 Pro.
- Interfaz del directorio, cuenta y registro visible; navegación Atrás comprobada.
- Reinstalación de la versión final: arranque correcto y formulario de registro visible sin duplicar el login. Captura en `artifacts/android-register.png`.
- No se observaron errores fatales de la app en los registros consultados.
- El directorio mostró cero resultados, de acuerdo con la respuesta de la API pública, sin inventar profesionales de ejemplo.

## Fallos encontrados y resolución

| Problema | Resultado |
|---|---|
| Java y adb no estaban disponibles en PATH | Se localizaron las herramientas instaladas y Java 17 provisionado por Gradle; el script las usa por ruta. |
| Descarga de Gradle interrumpida | Se obtuvo la distribución oficial por fragmentos y se comprobó su SHA-256 antes de usarla. |
| Tarea de CMake fallida en el primer intento | La tarea aislada pasó al repetirla con Java 17 y dependencias preparadas. |
| Descarga de Hermes interrumpida por Connection reset | Se completó desde Maven Central, se comprobó su SHA-1 oficial y el siguiente build pasó. |
| Emulador cerrado durante el build | Se inició el AVD existente sin ventana y se instaló la app. |
| Login visible junto al registro | Se separó la presentación de los formularios y se regeneraron los binarios. |

## Qué falta para declarar la plataforma móvil completa para producción

Esta entrega es una versión Android instalable y ampliada. No implementa todos los módulos del plan consolidado.

- Pruebas con cuentas de ensayo para login, MFA, persistencia de cookies, registro, reservas y escrituras.
- Canal de eventos compartido entre backend, web y móvil, con recuperación tras desconexión; actualmente la app consulta REST cada 15 segundos en primer plano.
- Push FCM y App Links verificados.
- Alta nativa de profesionales y organizaciones, edición avanzada de perfiles, fotos, documentos y permisos avanzados.
- Récipes si el backend los habilita; la configuración productiva consultada los mantiene apagados.
- Pruebas de teléfono físico, tablet, accesibilidad y tamaños de letra.
- Revisión de 22 alertas transitivas de dependencias de desarrollo.
- Firma de publicación y preparación de Google Play con la cuenta y declaraciones del titular.

No se modificaron el backend, la web, el VPS ni sus otros proyectos. No se crearon cuentas ni citas productivas para las pruebas. La compatibilidad de código con iOS se conserva; esta entrega compila únicamente Android.
