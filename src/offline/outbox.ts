/**
 * Cambios hechos sin conexión, en orden, a la espera de enviarse.
 *
 * Solo entran acciones que la plataforma puede aplicar más tarde sin que el
 * resultado dependa de lo que pasó mientras tanto: marcar avisos, cancelar o
 * cerrar citas, editar datos de contacto, revocar permisos y retirar pedidos.
 * Reservar, pedir contacto, iniciar sesión o cambiar la contraseña siempre
 * necesitan conexión: el resultado tiene que verse en el momento.
 *
 * La plataforma decide: si un cambio ya no se puede aplicar (la cita se
 * canceló desde la web, el permiso venció…), queda marcado con el motivo y
 * la persona lo ve al volver la conexión.
 *
 * Sin dependencias de React Native: se prueba con Node (test/offline.test.ts).
 */
export type OpKind =
  | 'appointment-cancel'
  | 'appointment-confirm'
  | 'appointment-complete'
  | 'appointment-no-show'
  | 'notification-read'
  | 'patient-profile'
  | 'grant-revoke'
  | 'contact-withdraw';

export interface PendingOp {
  id: string;
  /** Cuenta que hizo el cambio: solo se envía con la sesión de esa cuenta. */
  userId: string;
  kind: OpKind;
  method: 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  /** Cita, aviso, permiso o pedido al que se refiere. */
  targetId?: string;
  /** Qué se hizo, para mostrarlo: «Cancelar la cita del…». */
  label: string;
  /**
   * Dónde ver el estado actual de la cita si la plataforma rechaza el cambio:
   * puede que ya estuviera hecho (un envío anterior llegó pero la respuesta se
   * perdió). Devuelve la cita o una lista que la incluye.
   */
  checkPath?: string;
  createdAt: number;
  attempts: number;
  /** Motivo por el que la plataforma no lo aplicó (ya no se reintenta). */
  error?: string;
}

export type NewOp = Pick<PendingOp, 'kind' | 'method' | 'path' | 'body' | 'targetId' | 'label' | 'checkPath'>;

/** Estados de la cita en los que el cambio ya está hecho. */
export const APPLIED_STATUS: Partial<Record<OpKind, readonly string[]>> = {
  'appointment-cancel': ['CANCELED', 'CANCELLED'],
  'appointment-confirm': ['CONFIRMED', 'COMPLETED', 'NO_SHOW'],
  'appointment-complete': ['COMPLETED'],
  'appointment-no-show': ['NO_SHOW'],
};

/**
 * Si un rechazo de la plataforma significa que el cambio ya estaba hecho.
 * `status`: estado actual de la cita (solo para cambios de citas).
 */
export function rejectionMeansApplied(op: PendingOp, httpStatus: number, status?: string): boolean {
  switch (op.kind) {
    case 'notification-read':
    case 'grant-revoke':
      // Ya no existe: no queda nada que marcar o revocar.
      return httpStatus === 404;
    case 'contact-withdraw':
      // «El pedido ya se retiró o venció»: el médico ya no ve esos datos.
      return httpStatus === 404 || httpStatus === 409;
    case 'patient-profile':
      return false;
    default:
      return !!status && !!APPLIED_STATUS[op.kind]?.includes(status);
  }
}

/** Cómo terminó un intento de envío. */
export type Failure =
  | { type: 'offline' }
  | { type: 'auth' }
  | { type: 'transient'; message: string }
  | { type: 'rejected'; status: number; message: string };

/** Errores de la plataforma (5xx, límite de pedidos) antes de darse por vencido. */
export const MAX_ATTEMPTS = 5;

/** Agrega un cambio sin duplicar: dos ediciones de la ficha se funden en una. */
export function addOp(ops: readonly PendingOp[], op: PendingOp): PendingOp[] {
  const open = (o: PendingOp) => o.userId === op.userId && o.kind === op.kind && !o.error;
  if (op.kind === 'patient-profile') {
    const index = ops.findIndex(open);
    if (index >= 0) {
      const merged = { ...ops[index], body: { ...ops[index].body, ...op.body }, label: op.label };
      return ops.map((o, i) => (i === index ? merged : o));
    }
  } else if (ops.some((o) => open(o) && o.targetId === op.targetId)) {
    return [...ops];
  }
  return [...ops, op];
}

/** El primer cambio en espera de esta cuenta sobre este elemento, si hay. */
export function pendingFor(ops: readonly PendingOp[], userId: string | undefined, targetId: string, kinds?: OpKind[]) {
  return ops.find(
    (o) => o.userId === userId && o.targetId === targetId && !o.error && (!kinds || kinds.includes(o.kind)),
  );
}

const NEXT_STATUS: Partial<Record<OpKind, string>> = {
  'appointment-confirm': 'CONFIRMED',
  'appointment-complete': 'COMPLETED',
  'appointment-no-show': 'NO_SHOW',
  'appointment-cancel': 'CANCELED',
};

/**
 * Cómo quedará la cita cuando se envíen los cambios en espera: así el médico
 * puede, sin conexión, confirmarla y después marcarla atendida.
 */
export function effectiveStatus(status: string, ops: readonly PendingOp[], userId: string, appointmentId: string) {
  return ops
    .filter((o) => o.userId === userId && o.targetId === appointmentId && !o.error)
    .reduce((current, o) => NEXT_STATUS[o.kind] ?? current, status);
}

export interface FlushDeps {
  send(op: PendingOp): Promise<unknown>;
  classify(error: unknown): Failure;
  /**
   * La plataforma rechazó el cambio: ¿es porque ya estaba hecho (un envío
   * anterior llegó aunque la respuesta se perdió)? `true` si ya estaba;
   * un texto agrega contexto al motivo («estado actual: cancelada»).
   */
  applied(op: PendingOp, failure: Extract<Failure, { type: 'rejected' }>): Promise<boolean | string>;
  /** Se aplicó: sale de la cola. */
  done(op: PendingOp): Promise<void>;
  /** Sigue en la cola con estos datos (más intentos o el motivo del rechazo). */
  update(op: PendingOp): Promise<void>;
}

export interface FlushResult {
  sent: PendingOp[];
  failed: PendingOp[];
  /** Por qué se detuvo antes de terminar (sin conexión, sesión, plataforma caída). */
  stopped: 'offline' | 'auth' | 'transient' | null;
}

/**
 * Envía en orden los cambios pendientes de esta cuenta. Se detiene al perder
 * la conexión o la sesión (lo que falta queda para el próximo intento); un
 * cambio rechazado no frena a los siguientes.
 */
export async function flushOps(ops: readonly PendingOp[], userId: string, deps: FlushDeps): Promise<FlushResult> {
  const result: FlushResult = { sent: [], failed: [], stopped: null };
  for (const op of ops) {
    if (op.userId !== userId || op.error) continue;
    try {
      await deps.send(op);
      await deps.done(op);
      result.sent.push(op);
      continue;
    } catch (error) {
      const failure = deps.classify(error);
      if (failure.type === 'offline' || failure.type === 'auth') {
        result.stopped = failure.type;
        break;
      }
      if (failure.type === 'transient') {
        const attempts = op.attempts + 1;
        if (attempts < MAX_ATTEMPTS) {
          await deps.update({ ...op, attempts });
          result.stopped = 'transient';
          break;
        }
        const failed = { ...op, attempts, error: failure.message };
        await deps.update(failed);
        result.failed.push(failed);
        continue;
      }
      let verdict: boolean | string = false;
      try {
        verdict = await deps.applied(op, failure);
      } catch (checkError) {
        const check = deps.classify(checkError);
        if (check.type === 'offline' || check.type === 'auth') {
          result.stopped = check.type;
          break;
        }
      }
      if (verdict === true) {
        await deps.done(op);
        result.sent.push(op);
      } else {
        const reason = typeof verdict === 'string' && verdict ? `${failure.message} (${verdict})` : failure.message;
        const failed = { ...op, attempts: op.attempts + 1, error: reason };
        await deps.update(failed);
        result.failed.push(failed);
      }
    }
  }
  return result;
}
