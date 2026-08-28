import type { PantryBackup } from './domain';

interface EncryptedBackup {
  format: 'pantry-check-encrypted-v1';
  salt: string;
  iv: string;
  data: string;
}

const encoder = new TextEncoder();

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bufferOf(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bufferOf(salt), iterations: 250_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(backup: PantryBackup, passphrase: string): Promise<string> {
  if (passphrase.length < 8) throw new Error('Use a passphrase with at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferOf(iv) }, key, encoder.encode(JSON.stringify(backup)));
  const payload: EncryptedBackup = { format: 'pantry-check-encrypted-v1', salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) };
  return JSON.stringify(payload);
}

export async function decryptBackup(payload: string, passphrase: string): Promise<PantryBackup> {
  let parsed: EncryptedBackup;
  try { parsed = JSON.parse(payload) as EncryptedBackup; }
  catch { throw new Error('That file is not a Pantry Check backup.'); }
  if (parsed.format !== 'pantry-check-encrypted-v1' || !parsed.salt || !parsed.iv || !parsed.data) throw new Error('That file is not a supported Pantry Check backup.');
  try {
    const salt = base64ToBytes(parsed.salt);
    const key = await deriveKey(passphrase, salt);
    const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufferOf(base64ToBytes(parsed.iv)) }, key, bufferOf(base64ToBytes(parsed.data)));
    const backup = JSON.parse(new TextDecoder().decode(result)) as PantryBackup;
    if (backup.schema !== 1 || !Array.isArray(backup.items) || !Array.isArray(backup.events)) throw new Error();
    return backup;
  } catch {
    throw new Error('The passphrase is wrong or this backup is damaged.');
  }
}
