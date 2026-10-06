import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { OfflineSnapshot, Persistence } from './store';
import { utf8Decode, utf8Encode } from './utf8';

/**
 * La copia local, cifrada (AES-GCM) con una clave que vive en el almacén
 * seguro del sistema (Android Keystore). Está en la carpeta privada de la
 * app, que no entra en copias de seguridad (allowBackup=false).
 *
 * Se escribe alternando dos archivos con un contador: si el teléfono se apaga
 * a mitad de una escritura, el otro archivo sigue entero y se usa ese.
 *
 * Al cerrar sesión se genera una clave nueva y se reescriben los dos
 * archivos: lo que quedara de la copia anterior ya no se puede descifrar.
 *
 * En la web no se guarda nada en el navegador: la copia vive en memoria.
 */
const KEY_NAME = 'gmm.offline-key';
const AAD = utf8Encode('gmm-offline-v1');
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

let currentKey: Promise<AESEncryptionKey> | null = null;
let sequence = 0;

const folder = () => new Directory(Paths.document, 'gmm-offline');
const slot = (n: number) => new File(folder(), `copia-${n}.bin`);

async function newKey() {
  const key = await AESEncryptionKey.generate();
  await SecureStore.setItemAsync(KEY_NAME, await key.encoded('base64'), KEY_OPTIONS);
  return key;
}

/** La clave guardada, o `null` si no hay o no se puede leer (se reemplaza en la próxima escritura). */
async function storedKey() {
  const stored = await SecureStore.getItemAsync(KEY_NAME, KEY_OPTIONS).catch(() => null);
  if (!stored) return null;
  try {
    return await AESEncryptionKey.import(stored, 'base64');
  } catch {
    return null;
  }
}

function key() {
  currentKey ??= (async () => (await storedKey()) ?? newKey())().catch((error) => {
    currentKey = null;
    throw error;
  });
  return currentKey;
}

async function seal(snapshot: OfflineSnapshot, k: AESEncryptionKey, seq: number) {
  const sealed = await aesEncryptAsync(utf8Encode(JSON.stringify({ seq, snapshot })), k, { additionalData: AAD });
  return sealed.combined('bytes');
}

function write(n: number, bytes: Uint8Array) {
  const directory = folder();
  if (!directory.exists) directory.create({ intermediates: true });
  slot(n).write(bytes);
}

const native: Persistence = {
  async load() {
    const k = await storedKey();
    if (!k) return null;
    currentKey = Promise.resolve(k);
    let best: { seq: number; snapshot: OfflineSnapshot } | null = null;
    for (const n of [0, 1]) {
      const file = slot(n);
      if (!file.exists) continue;
      try {
        const plain = await aesDecryptAsync(AESSealedData.fromCombined(await file.bytes()), k, {
          additionalData: AAD,
        });
        const parsed = JSON.parse(utf8Decode(plain)) as { seq: number; snapshot: OfflineSnapshot };
        if (!best || parsed.seq > best.seq) best = parsed;
      } catch {
        // Archivo a medio escribir o de otra clave: vale el otro.
      }
    }
    sequence = best?.seq ?? 0;
    return best?.snapshot ?? null;
  },
  async save(snapshot) {
    const k = await key();
    sequence++;
    write(sequence % 2, await seal(snapshot, k, sequence));
  },
  async reset(snapshot) {
    const k = await newKey();
    currentKey = Promise.resolve(k);
    sequence++;
    const bytes = await seal(snapshot, k, sequence);
    write(0, bytes);
    write(1, bytes);
  },
};

const memoryOnly: Persistence = {
  load: async () => null,
  save: async () => {},
  reset: async () => {},
};

export const vault: Persistence = Platform.OS === 'web' ? memoryOnly : native;
