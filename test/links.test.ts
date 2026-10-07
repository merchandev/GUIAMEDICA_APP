import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appRouteFor, patientCodeFrom, tokenFrom } from '../src/links.ts';

test('los avisos de la plataforma abren pantallas de la app, no la web', () => {
  assert.equal(appRouteFor('/paciente/citas'), '/citas');
  assert.equal(appRouteFor('/paciente'), '/paciente/perfil');
  assert.equal(appRouteFor('/paciente/recipes/abc-123'), '/paciente/recetas/abc-123');
  assert.equal(appRouteFor('/dashboard/agenda?cita=7f0c'), '/panel/cita/7f0c');
  assert.equal(appRouteFor('/dashboard/agenda'), '/agenda');
  assert.equal(appRouteFor('/dashboard/pagos'), '/panel/plan');
  assert.equal(appRouteFor('/dashboard'), '/inicio');
  assert.equal(appRouteFor('/dashboard/mensajes'), '/panel/mensajes');
});

test('enlaces sin pantalla en la app, de otro sitio o con prefijo parecido no abren nada', () => {
  assert.equal(appRouteFor('/admin/pagos'), null);
  assert.equal(appRouteFor('//evil.example/paciente'), null);
  assert.equal(appRouteFor('https://otro.example/paciente'), null);
  assert.equal(appRouteFor('/pacientex'), null);
  assert.equal(appRouteFor(null), null);
});

test('el enlace del correo de recuperación se pega entero o solo el token', () => {
  assert.equal(tokenFrom(' https://guiamedicamonagas.com/restablecer-contrasena?token=abc%2Bdef&x=1 '), 'abc+def');
  assert.equal(tokenFrom('soloeltoken'), 'soloeltoken');
});

test('el código de paciente se lee del QR o escrito a mano', () => {
  assert.equal(patientCodeFrom('https://guiamedicamonagas.com/p/k7q4-m9tx-p3wd'), 'K7Q4-M9TX-P3WD');
  assert.equal(patientCodeFrom('k7q4m9txp3wd'), 'K7Q4-M9TX-P3WD');
  assert.equal(patientCodeFrom('K7Q4 M9TX P3WD'), 'K7Q4-M9TX-P3WD');
  assert.equal(patientCodeFrom('https://guiamedicamonagas.com/m/ABC123'), null);
  assert.equal(patientCodeFrom('K7Q4-M9TX'), null);
});
