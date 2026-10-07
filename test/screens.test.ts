import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, caracasDateKey, caracasInstant, weekStart } from '../src/dates.ts';
import { normalizePrescriptionCode } from '../src/prescriptions.ts';
import { parseYouTubeVideoId } from '../src/youtube.ts';

test('fechas de la agenda en hora de Caracas', () => {
  assert.equal(caracasDateKey('2026-10-08T02:30:00Z'), '2026-10-07');
  assert.equal(caracasInstant('2026-10-08', '09:30'), '2026-10-08T13:30:00.000Z');
  assert.equal(weekStart('2026-10-08'), '2026-10-05');
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
});

test('el código del récipe se acepta con o sin guiones, en minúsculas o en el enlace', () => {
  assert.equal(normalizePrescriptionCode('k7q4m9txp3wd'), 'K7Q4-M9TX-P3WD');
  assert.equal(normalizePrescriptionCode('https://guiamedicamonagas.com/recipe#K7Q4-M9TX-P3WD'), 'K7Q4-M9TX-P3WD');
  assert.equal(normalizePrescriptionCode('K7Q4-M9TX-P3W0'), null);
  assert.equal(normalizePrescriptionCode('%E0%A4%A'), null);
});

test('el enlace del video de presentación (misma regla que la plataforma)', () => {
  assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('https://youtube.com:8080/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYouTubeVideoId('https://user@youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYouTubeVideoId('https://vimeo.com/123'), null);
});
