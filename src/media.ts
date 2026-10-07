import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { download, type PickedFile } from './api';

/**
 * Fotos, documentos y archivos descargados.
 *
 * - Las fotos se eligen con el selector de fotos del sistema: no hace falta
 *   permiso para leer todo el almacenamiento.
 * - Los PDF y las copias de datos se guardan en la carpeta temporal de la app
 *   y se abren con «Compartir» para guardarlos o enviarlos.
 */

/** Elige una imagen de la galería (JPG, PNG o WebP). `null` si se cancela. */
export async function pickImage(options: { square?: boolean } = {}): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromImage(result.assets[0]);
}

function fromImage(asset: ImagePicker.ImagePickerAsset): PickedFile {
  const type = asset.mimeType ?? 'image/jpeg';
  const extension = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  return { uri: asset.uri, name: asset.fileName ?? `foto.${extension}`, type, size: asset.fileSize };
}

/**
 * Toma una foto con la cámara (un documento, la firma, el sello). Pide el
 * permiso de cámara solo en ese momento. `null` si se cancela o no hay permiso.
 */
export async function takePhoto(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Sin permiso de cámara',
      'Para tomar la foto, permite el uso de la cámara en los ajustes del teléfono.',
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  return fromImage(result.assets[0]);
}

/** Elige un PDF o una imagen (documentos de verificación). `null` si se cancela. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf', size: asset.size };
}

/**
 * Borra la copia local de una foto o documento ya enviado (el selector deja
 * una copia en la carpeta temporal de la app): una foto de la cédula, por
 * ejemplo, no queda guardada en el teléfono.
 */
export function discardPicked(file: PickedFile) {
  try {
    const local = new File(file.uri);
    if (local.exists) local.delete();
  } catch {
    // Archivo fuera de la carpeta de la app: el sistema lo maneja.
  }
}

const downloads = () => new Directory(Paths.cache, 'descargas');

/**
 * Borra los archivos descargados antes (récipes, copias de datos). Se llama
 * al abrir la app y antes de cada descarga: no quedan datos de salud en el
 * teléfono más tiempo del necesario para compartirlos.
 */
export function clearDownloads() {
  try {
    const dir = downloads();
    if (dir.exists) dir.delete();
  } catch {
    // Nada que borrar.
  }
}

/** Descarga un archivo con la sesión y lo ofrece para guardar o compartir. */
export async function downloadAndShare(
  path: string,
  fileName: string,
  mimeType: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
) {
  const bytes = new Uint8Array(await download(path, method, body));
  clearDownloads();
  const dir = downloads();
  dir.create();
  const file = new File(dir, fileName);
  file.create();
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Archivo descargado', 'Este teléfono no permite compartir archivos desde la app.');
    return;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle: fileName,
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}
