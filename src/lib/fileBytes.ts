import { toByteArray } from 'base64-js';
import * as LegacyFileSystem from 'expo-file-system/legacy';

/**
 * Read a picked file into an ArrayBuffer.
 *
 * Expo SDK 57's expo-file-system gates reads behind a permission service that only
 * grants READ for paths inside the app's own filesDir / cacheDir. Depending on where
 * the document picker leaves the file, both the new (`new File(uri)`) and the legacy
 * APIs can be rejected with "Missing 'READ' permission for accessing the file".
 *
 * So we make sure the bytes live in our own cache directory before reading them.
 * `copyToCache` reports exactly what it did via the optional `trace` callback, which
 * the UI surfaces when an upload fails, making the failing uri visible on-device.
 */

export type Trace = (message: string) => void;

export async function fileToArrayBuffer(uri: string, trace?: Trace): Promise<ArrayBuffer> {
  const localUri = await copyToCache(uri, trace);
  trace?.(`reading: ${localUri}`);

  const base64 = await LegacyFileSystem.readAsStringAsync(localUri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  trace?.(`base64 chars: ${base64.length}`);
  const bytes = toByteArray(normalizeBase64(base64));
  trace?.(`bytes: ${bytes.byteLength}`);

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function copyToCache(uri: string, trace?: Trace): Promise<string> {
  const cacheDir = LegacyFileSystem.cacheDirectory;
  const docDir = LegacyFileSystem.documentDirectory;

  trace?.(`scheme: ${uri.split(':')[0]}`);
  trace?.(`cache: ${cacheDir ?? 'null'}`);

  if (!cacheDir) return uri;

  // Already inside the app sandbox? Read it directly.
  if (uri.startsWith(cacheDir) || (docDir && uri.startsWith(docDir))) {
    trace?.('already in sandbox — no copy needed');
    return uri;
  }

  // Copy the picked file into our own cache directory.
  const dest = `${cacheDir}upload-${Date.now()}-${safeName(uri)}`;
  try {
    trace?.(`copying → ${dest}`);
    await LegacyFileSystem.copyAsync({ from: uri, to: dest });
    trace?.('copy ok');
    return dest;
  } catch (e: any) {
    trace?.(`copy failed: ${e?.message ?? e}`);
    // Fall back to the original uri and let the read surface its own error.
    return uri;
  }
}

function safeName(uri: string): string {
  const tail = uri.split('/').pop()?.split('?')[0] ?? 'file';
  const decoded = (() => {
    try { return decodeURIComponent(tail); } catch { return tail; }
  })();
  return decoded.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

/** Some content providers emit unpadded or whitespace-wrapped base64. */
function normalizeBase64(b64: string): string {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const pad = clean.length % 4;
  return pad === 0 ? clean : clean + '='.repeat(4 - pad);
}
