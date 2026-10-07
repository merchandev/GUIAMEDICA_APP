import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchable, sentence } from '../src/contracts.ts';
import { createNet } from '../src/offline/net.ts';
import {
  addOp,
  effectiveStatus,
  flushOps,
  MAX_ATTEMPTS,
  pendingFor,
  rejectionMeansApplied,
  type Failure,
  type FlushDeps,
  type PendingOp,
} from '../src/offline/outbox.ts';
import {
  createOfflineStore,
  type OfflineSnapshot,
  type Persistence,
  type StoredSnapshot,
} from '../src/offline/store.ts';
import { utf8Decode, utf8Encode } from '../src/offline/utf8.ts';

const op = (id: string, extra: Partial<PendingOp> = {}): PendingOp => ({
  id,
  userId: 'u1',
  kind: 'notification-read',
  method: 'PATCH',
  path: `/x/${id}`,
  targetId: id,
  label: `cambio ${id}`,
  createdAt: 0,
  attempts: 0,
  ...extra,
});

test('utf8: ida y vuelta con tildes, eñes y emoji, también sin TextEncoder (Hermes)', () => {
  const text = 'Cita con la Dra. Ñañez · cardiología 🩺 — 心';
  assert.equal(utf8Decode(utf8Encode(text)), text);
  const encoder = globalThis.TextEncoder;
  const decoder = globalThis.TextDecoder;
  try {
    // @ts-expect-error: se quitan para probar la versión propia
    delete globalThis.TextEncoder;
    // @ts-expect-error: idem
    delete globalThis.TextDecoder;
    const bytes = utf8Encode(text);
    assert.deepEqual([...bytes], [...new encoder().encode(text)]);
    assert.equal(utf8Decode(bytes), text);
  } finally {
    globalThis.TextEncoder = encoder;
    globalThis.TextDecoder = decoder;
  }
});

test('búsqueda sin conexión: sin tildes ni mayúsculas', () => {
  assert.equal(searchable('  Dra. María  ÑAÑEZ Pérez '), 'dra. maria nanez perez');
});

test('mensajes: sin punto doble tras «p. m.» y con punto tras el motivo de la plataforma', () => {
  assert.equal(sentence('Datos del 6 oct. 2026, 3:44 p. m.'), 'Datos del 6 oct. 2026, 3:44 p. m.');
  assert.equal(sentence('Teléfono inválido (ej. 0414-1234567)'), 'Teléfono inválido (ej. 0414-1234567).');
});

test('cola: no duplica el mismo cambio y funde las ediciones de la ficha', () => {
  let ops = addOp([], op('a'));
  ops = addOp(ops, op('b', { targetId: 'a' }));
  assert.equal(ops.length, 1, 'mismo aviso marcado dos veces');
  ops = addOp(ops, op('p1', { kind: 'patient-profile', targetId: undefined, body: { phone: '0414-1111111' } }));
  ops = addOp(ops, op('p2', { kind: 'patient-profile', targetId: undefined, body: { municipality: 'Maturín' } }));
  ops = addOp(ops, op('p3', { kind: 'patient-profile', targetId: undefined, body: { phone: '0424-2222222' } }));
  assert.equal(ops.length, 2);
  assert.deepEqual(ops[1].body, { phone: '0424-2222222', municipality: 'Maturín' });
  // Otra cuenta no se mezcla; un cambio rechazado no impide volver a intentarlo.
  assert.equal(addOp(ops, op('c', { userId: 'u2', targetId: 'a' })).length, 3);
  const rejected = [op('a', { error: 'no' })];
  assert.equal(addOp(rejected, op('d', { targetId: 'a' })).length, 2);
});

test('cola: estado de la cita con los cambios en espera (confirmar y después atender sin conexión)', () => {
  const ops = [
    op('1', { kind: 'appointment-confirm', targetId: 'cita' }),
    op('2', { kind: 'appointment-complete', targetId: 'cita' }),
    op('3', { kind: 'appointment-cancel', targetId: 'otra', error: 'rechazado' }),
  ];
  assert.equal(effectiveStatus('PENDING', ops, 'u1', 'cita'), 'COMPLETED');
  assert.equal(effectiveStatus('CONFIRMED', ops, 'u1', 'otra'), 'CONFIRMED', 'los rechazados no cuentan');
  assert.equal(effectiveStatus('PENDING', ops, 'u2', 'cita'), 'PENDING', 'solo los de esa cuenta');
  assert.equal(pendingFor(ops, 'u1', 'cita', ['appointment-complete'])?.id, '2');
  assert.equal(pendingFor(ops, 'u1', 'otra'), undefined);
});

test('cola: qué rechazos significan que el cambio ya estaba hecho', () => {
  assert.equal(rejectionMeansApplied(op('a'), 404), true);
  assert.equal(rejectionMeansApplied(op('a', { kind: 'grant-revoke' }), 404), true);
  assert.equal(rejectionMeansApplied(op('a', { kind: 'contact-withdraw' }), 409), true);
  assert.equal(rejectionMeansApplied(op('a', { kind: 'patient-profile' }), 409), false);
  const cancel = op('a', { kind: 'appointment-cancel' });
  assert.equal(rejectionMeansApplied(cancel, 400, 'CANCELED'), true);
  assert.equal(rejectionMeansApplied(cancel, 400, 'COMPLETED'), false);
  assert.equal(rejectionMeansApplied(op('a', { kind: 'appointment-confirm' }), 400, 'COMPLETED'), true);
});

/** Simula la plataforma: cada ruta responde bien o lanza la falla indicada. */
function harness(failures: Record<string, Failure | Failure[]>, applied: FlushDeps['applied'] = async () => false) {
  const sent: string[] = [];
  const done: string[] = [];
  const updated: PendingOp[] = [];
  const deps: FlushDeps = {
    async send(o) {
      const planned = failures[o.path];
      const failure = Array.isArray(planned) ? planned.shift() : planned;
      if (failure) throw failure;
      sent.push(o.id);
    },
    classify: (error) => error as Failure,
    applied,
    async done(o) {
      done.push(o.id);
    },
    async update(o) {
      updated.push(o);
    },
  };
  return { deps, sent, done, updated };
}

test('envío: en orden, solo los de la cuenta y sin los ya rechazados', async () => {
  const h = harness({});
  const ops = [op('1'), op('2', { userId: 'u2' }), op('3', { error: 'rechazado antes' }), op('4')];
  const result = await flushOps(ops, 'u1', h.deps);
  assert.deepEqual(h.sent, ['1', '4']);
  assert.deepEqual(h.done, ['1', '4']);
  assert.equal(result.stopped, null);
});

test('envío: sin conexión se detiene y lo que falta queda en la cola', async () => {
  const h = harness({ '/x/2': { type: 'offline' } });
  const result = await flushOps([op('1'), op('2'), op('3')], 'u1', h.deps);
  assert.deepEqual(h.done, ['1']);
  assert.equal(result.stopped, 'offline');
  assert.equal(h.updated.length, 0, 'no cuenta como intento');
});

test('envío: la sesión vencida también detiene (se envía al volver a entrar)', async () => {
  const h = harness({ '/x/1': { type: 'auth' } });
  const result = await flushOps([op('1'), op('2')], 'u1', h.deps);
  assert.equal(result.stopped, 'auth');
  assert.deepEqual(h.done, []);
});

test('envío: la plataforma falla → se reintenta más tarde y, tras varios intentos, se informa', async () => {
  const h = harness({ '/x/1': { type: 'transient', message: 'Error del servidor' } });
  const first = await flushOps([op('1'), op('2')], 'u1', h.deps);
  assert.equal(first.stopped, 'transient');
  assert.equal(h.updated[0].attempts, 1);
  assert.equal(h.updated[0].error, undefined);
  const last = await flushOps([op('1', { attempts: MAX_ATTEMPTS - 1 }), op('2')], 'u1', h.deps);
  assert.equal(last.failed[0].error, 'Error del servidor');
  assert.deepEqual(h.done, ['2'], 'el siguiente sí se envía');
});

test('envío: un rechazo que en realidad ya estaba aplicado cuenta como enviado', async () => {
  const h = harness(
    { '/x/1': { type: 'rejected', status: 400, message: 'Esta cita ya no se puede cancelar' } },
    async () => true,
  );
  const result = await flushOps([op('1', { kind: 'appointment-cancel' })], 'u1', h.deps);
  assert.deepEqual(h.done, ['1']);
  assert.equal(result.sent.length, 1);
  assert.equal(result.failed.length, 0);
});

test('envío: un rechazo real queda informado con el motivo y no frena a los demás', async () => {
  const h = harness(
    { '/x/1': { type: 'rejected', status: 400, message: 'Solo se pueden confirmar citas pendientes' } },
    async () => 'estado actual: cancelada',
  );
  const result = await flushOps([op('1', { kind: 'appointment-confirm' }), op('2')], 'u1', h.deps);
  assert.equal(result.failed[0].error, 'Solo se pueden confirmar citas pendientes (estado actual: cancelada)');
  assert.deepEqual(h.done, ['2']);
});

test('envío: si al comprobar el estado se corta la conexión, se detiene sin marcar nada', async () => {
  const h = harness({ '/x/1': { type: 'rejected', status: 400, message: 'x' } }, async () => {
    throw { type: 'offline' };
  });
  const result = await flushOps([op('1', { kind: 'appointment-cancel' }), op('2')], 'u1', h.deps);
  assert.equal(result.stopped, 'offline');
  assert.equal(h.updated.length, 0);
  assert.deepEqual(h.done, []);
});

/** Persistencia en memoria que registra lo que se guardó. */
function memory(initial: StoredSnapshot | null = null, failLoad = false) {
  const saves: OfflineSnapshot[] = [];
  const resets: OfflineSnapshot[] = [];
  const persistence: Persistence = {
    async load() {
      if (failLoad) throw new Error('clave distinta');
      return initial;
    },
    async save(snapshot) {
      saves.push(structuredClone(snapshot));
    },
    async reset(snapshot) {
      resets.push(structuredClone(snapshot));
    },
  };
  return { persistence, saves, resets };
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('copia local: carga lo guardado y guarda los cambios (agrupados) poco después', async () => {
  const m = memory({ version: 2, entries: { 'me:notices': { savedAt: 1, data: ['viejo'] } }, ops: [op('1')] });
  const store = createOfflineStore(m.persistence, { saveDelayMs: 5, now: () => 42 });
  store.put('pub:directory:1:', { items: [] }); // antes de cargar: no se pierde
  await store.init();
  assert.deepEqual(store.peek('me:notices')?.data, ['viejo']);
  assert.equal(store.peek('pub:directory:1:')?.savedAt, 42);
  assert.equal(store.ops.length, 1);
  store.put('me:notices', ['nuevo']);
  store.put('me:agenda', []);
  await wait(30);
  assert.equal(m.saves.length, 1, 'una sola escritura para varios cambios seguidos');
  assert.deepEqual(m.saves[0].entries['me:notices'].data, ['nuevo']);
  assert.equal(m.resets.length, 0, 'la copia del formato actual no se reescribe');
});

test('copia local: la del formato anterior pierde la ficha completa y se reescribe entera con clave nueva', async () => {
  const full = { firstName: 'Ana', lastName: 'Pérez', cedula: 'V-12345678', allergies: 'Penicilina' };
  const m = memory({
    version: 1,
    entries: { 'me:patient': { savedAt: 1, data: full }, 'me:user': { savedAt: 1, data: { id: 'u1' } } },
    ops: [
      op('1', { kind: 'patient-profile', path: '/patients/me', body: { phone: '0414-1234567' }, targetId: undefined }),
      op('2'),
    ],
  });
  const store = createOfflineStore(m.persistence, { saveDelayMs: 5 });
  await store.init();
  assert.equal(store.peek('me:patient'), null);
  assert.ok(store.peek('me:user'), 'lo demás de la cuenta se conserva');
  assert.deepEqual(
    store.ops.map((o) => o.path),
    ['/patients/me/basic', '/x/2'],
  );
  assert.equal(m.resets.length, 1);
  assert.equal(m.saves.length, 0);
  assert.equal(m.resets[0].version, 2);
  for (const value of ['Penicilina', 'V-12345678']) assert.ok(!JSON.stringify(m.resets[0]).includes(value));
  store.put('me:notices', []);
  await wait(30);
  assert.equal(m.resets.length, 1, 'solo la primera vez');
  assert.equal(m.saves.length, 1);
});

test('copia local: un cambio pendiente se guarda enseguida', async () => {
  const m = memory();
  const store = createOfflineStore(m.persistence, { saveDelayMs: 10_000 });
  await store.init();
  let notified = 0;
  store.subscribe(() => notified++);
  await store.setOps((ops) => [...ops, op('1')]);
  assert.equal(m.saves.length, 1);
  assert.equal(m.saves[0].ops[0].id, '1');
  assert.equal(notified, 1);
});

test('copia local: al cerrar sesión se borra lo de la cuenta y se reemplaza todo lo guardado', async () => {
  const m = memory({
    version: 2,
    entries: { 'me:user': { savedAt: 1, data: { id: 'u1' } }, 'pub:doctor:ana': { savedAt: 1, data: {} } },
    ops: [op('1'), op('2', { userId: 'u2' })],
  });
  const store = createOfflineStore(m.persistence);
  await store.init();
  await store.forget((o) => o.userId === 'u1');
  assert.equal(store.peek('me:user'), null);
  assert.ok(store.peek('pub:doctor:ana'), 'el directorio público se conserva');
  assert.deepEqual(
    store.ops.map((o) => o.id),
    ['1'],
  );
  assert.equal(m.resets.length, 1);
  assert.equal(m.saves.length, 0);
  assert.equal(m.resets[0].entries['me:user'], undefined);
});

test('copia local: guarda solo las páginas del directorio más recientes', async () => {
  let clock = 0;
  const store = createOfflineStore(memory().persistence, { now: () => ++clock });
  await store.init();
  for (let page = 1; page <= 35; page++) store.put(`pub:directory:${page}:`, { items: [] });
  const kept = store.list('pub:directory:').map(([key]) => key);
  assert.equal(kept.length, 30);
  assert.ok(!kept.includes('pub:directory:1:'));
  assert.ok(kept.includes('pub:directory:35:'));
  await store.flush();
});

test('copia local: si no se puede leer (otra clave), empieza vacía', async () => {
  const store = createOfflineStore(memory(null, true).persistence);
  await store.init();
  assert.equal(store.ready, true);
  assert.equal(store.ops.length, 0);
});

function fakeTimers() {
  const queue: (() => void)[] = [];
  const delays: number[] = [];
  return {
    queue,
    delays,
    timers: {
      set: (fn: () => void, ms: number) => {
        queue.push(fn);
        delays.push(ms);
        return queue.length as unknown as ReturnType<typeof setTimeout>;
      },
      clear: () => {
        queue.length = 0;
      },
    },
  };
}

test('conexión: se pierde con un pedido fallido y vuelve sola cuando la API responde', async () => {
  const t = fakeTimers();
  let up = false;
  const net = createNet({ probe: async () => up, delays: [10, 20], timers: t.timers });
  const seen: string[] = [];
  net.subscribe((status) => seen.push(status));
  net.unreachable();
  assert.equal(net.status, 'offline');
  assert.deepEqual(t.delays, [10]);
  t.queue.shift()!();
  await wait(0);
  assert.equal(net.status, 'offline');
  assert.deepEqual(t.delays, [10, 20], 'esperas crecientes');
  up = true;
  t.queue.shift()!();
  await wait(0);
  assert.equal(net.status, 'online');
  assert.deepEqual(seen, ['offline', 'online']);
});

test('conexión: avisos del sistema y vuelta al frente', async () => {
  const t = fakeTimers();
  let probes = 0;
  const net = createNet({
    probe: async () => {
      probes++;
      return true;
    },
    timers: t.timers,
  });
  net.systemChanged({ isConnected: false });
  assert.equal(net.status, 'offline');
  net.systemChanged({ isConnected: true });
  await wait(0);
  assert.equal(net.status, 'online', 'volvió la red: se prueba ya, sin esperar');
  assert.equal(probes, 1);
  net.unreachable();
  net.resumed();
  await wait(0);
  assert.equal(net.status, 'online');
  assert.equal(probes, 2);
  // Una respuesta cualquiera de la API también confirma la conexión.
  net.unreachable();
  net.reachable();
  assert.equal(net.status, 'online');
  assert.equal(t.queue.length, 0, 'sin pruebas pendientes');
});
