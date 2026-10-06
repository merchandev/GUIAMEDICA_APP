import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, errorMessage } from '../src/contracts.ts';
test('la agenda usa Caracas aunque el dispositivo esté en otra zona', () => {
  assert.equal(dayKey(new Date('2026-10-07T02:00:00Z')), '2026-10-06');
});
test('errores de validación API pueden ser listas', () => {
  assert.equal(
    errorMessage({ message: ['Correo inválido', 'Motivo requerido'] }, 'Error'),
    'Correo inválido. Motivo requerido',
  );
  assert.equal(errorMessage(null, 'Sin respuesta'), 'Sin respuesta');
});
