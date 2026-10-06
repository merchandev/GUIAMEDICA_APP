# Android — Guía Médica Monagas

Proyecto nativo generado el 6 de octubre de 2026 en `android/`. El código React Native sigue compartido con iOS. Esta entrega amplía la app de desarrollo; no equivale a implementar todos los módulos del plan ni a publicar en Google Play.

## Abrir en Android Studio

Abrir `E:\PROYECTO SEPTIEMBRE 2026\GUIA MEDICA APP\android` y esperar la sincronización Gradle. El SDK local está en `C:\Users\merch\AppData\Local\Android\Sdk`; `android/local.properties` es local y está excluido de Git.

En Settings → Build, Execution, Deployment → Build Tools → Gradle, seleccionar Java 17. En este equipo Gradle provisionó `C:\Users\merch\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2`. El script de build encuentra ese JDK sin modificar las variables de entorno globales de Windows.

## Compilar

Desde la carpeta principal:

```powershell
npm run android:apk
```

El script usa JAVA_HOME o el JBR de Android Studio y ANDROID_HOME o la ubicación habitual del SDK. Si existe `.tools/gradle-9.3.1`, usa esa descarga local; en otro equipo utiliza el wrapper. Descarga las dependencias que falten. Compila para arm64-v8a y x86_64: teléfonos modernos y emulador de este equipo.

Solo después de un build exitoso se copia el resultado a `artifacts/guia-medica-monagas-pruebas.apk`. Es un APK con JavaScript integrado que no necesita Metro, firmado con la clave de desarrollo. La carpeta `artifacts/` está excluida de Git.

```powershell
npm run android:aab
```

Genera un bundle de pruebas con la misma clave de desarrollo. Antes de usar Google Play, configurar la firma de publicación y validar el titular del paquete. Alternativa: EAS Build con el perfil production y credenciales del titular.

## Desarrollo

```powershell
npm run android
```

Compila la versión debug y abre Metro. Si Android Studio ejecuta el debug, mantener `npm start` abierto. La versión debug depende de Metro; el APK release de pruebas integra su propio bundle.

Para regenerar los archivos nativos:

```powershell
npm run android:prebuild
```

Revisar cambios nativos propios antes de regenerar. El icono, HTTPS obligatorio y la desactivación de backup se conservan con el plugin local `plugins/withAndroidBranding.js`. Los permisos de almacenamiento y superposición se bloquean en app.json.

## Funciones incorporadas

1. Directorio, búsqueda, paginación y detalle del profesional.
2. Consulta de disponibilidad, reserva y cancelación con confirmación.
3. Agenda del médico y acciones de confirmación, atención e inasistencia.
4. Login y MFA por correo.
5. Registro de pacientes con consentimientos separados, inicialmente desmarcados.
6. Recuperación por correo, restablecimiento mediante token y cambio de contraseña.
7. Listado de avisos y marcado como leído.
8. Edición de teléfono y municipio del paciente.
9. Consulta y revocación de permisos de datos de salud.
10. Solicitud de eliminación de cuenta a través del mecanismo real de la plataforma.
11. Pedido de contacto por correo, consentimiento y retirada.
12. Diseño adaptable, safe areas, teclado y botón Atrás de Android.

Todos los cambios se envían a la API HTTPS de la plataforma; no hay una base de datos paralela. No se modificaron el backend, la web ni el VPS en esta entrega. Las verificaciones sin sesión no crean usuarios, citas ni datos productivos.

## Validación y pendientes de publicación

- TypeScript y dos pruebas de contratos pasaron.
- Exportación del bundle Android pasa; esto no demuestra que el APK compile ni funcione en un dispositivo.
- APK y AAB compilados correctamente; APK instalado y abierto en el emulador Pixel 9 Pro. No se observaron errores fatales de la app en los registros consultados. Ver ENTREGA-ANDROID.md para la evidencia y los límites de las pruebas.
- Validar login, MFA, cookies después de cerrar la app y renovación de sesión con cuentas de prueba.
- Validar escrituras con staging y datos sintéticos, no con pacientes reales.
- Probar teléfono físico, tablet, orientación, accesibilidad y tamaños de letra.
- Implementar eventos compartidos en backend/web/app para sincronización inmediata. La versión actual consulta cada 15 segundos mientras está activa.
- Implementar push FCM y enlazado de Android verificado.
- Completar módulos avanzados pendientes: alta profesional/organización, documentos, fotos, permisos avanzados y récipes si el backend los habilita.
- Revisar las 22 alertas transitivas de npm audit antes de liberar.
- Preparar clave de publicación, ficha de tienda, privacidad y declaraciones de datos y salud del titular.

El APK de pruebas y una publicación en tienda son entregas diferentes. No marcar esta app como completa para producción mientras estos puntos sigan pendientes.
