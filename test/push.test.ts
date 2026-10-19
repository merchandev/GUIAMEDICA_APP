import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeForPushData } from '../src/push-routing.ts';

test('al tocar un push se abre la pantalla interna que indica su enlace', () => {
  assert.equal(
    routeForPushData({ link: '/dashboard/agenda?cita=7f0c', type: 'APPOINTMENT_CONFIRMED' }),
    '/panel/cita/7f0c',
  );
  assert.equal(routeForPushData({ link: '/paciente/recipes/abc-123' }), '/paciente/recetas/abc-123');
  assert.equal(routeForPushData({ link: '/paciente/citas' }), '/citas');
  assert.equal(routeForPushData({ link: '/dashboard/mensajes' }), '/panel/mensajes');
});

test('un push sin enlace, con enlace que no es texto o hacia otro sitio no navega', () => {
  assert.equal(routeForPushData(undefined), null);
  assert.equal(routeForPushData(null), null);
  assert.equal(routeForPushData({}), null);
  assert.equal(routeForPushData({ type: 'CONTACT_REQUEST' }), null);
  assert.equal(routeForPushData({ link: 123 }), null);
  assert.equal(routeForPushData({ link: 'https://otro.example/paciente' }), null);
  assert.equal(routeForPushData({ link: '//evil.example/paciente' }), null);
  assert.equal(routeForPushData({ link: '/admin/pagos' }), null);
});
