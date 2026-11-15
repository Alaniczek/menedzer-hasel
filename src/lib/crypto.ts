/**
 * Szyfrowanie sejfu – wszystko dzieje się w przeglądarce (Web Crypto API).
 *
 * - Klucz: PBKDF2-SHA256 (domyślnie 600 000 iteracji, losowa 16-bajtowa sól)
 *   wyprowadzony z hasła głównego. Klucz jest „nieeksportowalny” (extractable = false).
 * - Szyfr: AES-256-GCM z nowym, losowym 12-bajtowym IV przy KAŻDYM zapisie.
 * - Nagłówek pliku (format, wersja, parametry KDF) jest uwierzytelniany jako AAD,
 *   więc jego podmiana (np. zmniejszenie liczby iteracji) zostanie wykryta.
 */

import type { VaultData } from "./types";

export const VAULT_FORMAT = "menedzer-hasel";
export const VAULT_VERSION = 1;
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface KdfParams {
  name: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
}

export interface EncryptedVault {
  format: typeof VAULT_FORMAT;
  version: typeof VAULT_VERSION;
  kdf: KdfParams;
  cipher: "AES-256-GCM";
  iv: string; // base64
  data: string; // base64 (szyfrogram + tag uwierzytelniający)
}

export class WrongPasswordError extends Error {
  constructor() {
    super("Nieprawidłowe hasło główne albo uszkodzony plik sejfu.");
    this.name = "WrongPasswordError";
  }
}

export class InvalidVaultFileError extends Error {
  constructor(reason: string) {
    super(`To nie jest prawidłowy plik sejfu: ${reason}`);
    this.name = "InvalidVaultFileError";
  }
}

// ---------- pomocnicze ----------

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) {
    throw new Error(
      "Twoja przeglądarka nie udostępnia Web Crypto API (wymagane HTTPS albo localhost).",
    );
  }
  return s;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  // Kopia do „czystego” ArrayBuffer (unika problemów z typami i różnymi realmami).
  const out = new Uint8Array(encoded.length);
  out.set(encoded);
  return out;
}

/** Dane uwierzytelniane (AAD) – stabilna serializacja nagłówka. */
function headerAad(kdf: KdfParams): Uint8Array<ArrayBuffer> {
  return utf8(
    JSON.stringify([VAULT_FORMAT, VAULT_VERSION, kdf.name, kdf.iterations, kdf.salt]),
  );
}

// ---------- API ----------

export async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await subtle().importKey("raw", utf8(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // klucza nie da się wyeksportować z przeglądarki
    ["encrypt", "decrypt"],
  );
}

export interface UnlockedVault {
  key: CryptoKey;
  kdf: KdfParams;
  data: VaultData;
}

/** Tworzy nowy sejf: losuje sól, wyprowadza klucz i szyfruje dane. */
export async function createVault(
  password: string,
  data: VaultData,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<{ file: EncryptedVault; session: UnlockedVault }> {
  const kdf: KdfParams = {
    name: "PBKDF2-SHA256",
    iterations,
    salt: bytesToBase64(randomBytes(SALT_BYTES)),
  };
  const key = await deriveKey(password, base64ToBytes(kdf.salt), iterations);
  const file = await sealVault(key, kdf, data);
  return { file, session: { key, kdf, data } };
}

/** Szyfruje dane już posiadanym kluczem – za każdym razem z nowym IV. */
export async function sealVault(
  key: CryptoKey,
  kdf: KdfParams,
  data: VaultData,
): Promise<EncryptedVault> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv, additionalData: headerAad(kdf), tagLength: 128 },
    key,
    utf8(JSON.stringify(data)),
  );
  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    kdf,
    cipher: "AES-256-GCM",
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/** Odszyfrowuje sejf. Przy złym haśle rzuca WrongPasswordError. */
export async function unlockVault(
  file: EncryptedVault,
  password: string,
): Promise<UnlockedVault> {
  const valid = parseVaultFile(file);
  const key = await deriveKey(password, base64ToBytes(valid.kdf.salt), valid.kdf.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle().decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(valid.iv),
        additionalData: headerAad(valid.kdf),
        tagLength: 128,
      },
      key,
      base64ToBytes(valid.data),
    );
  } catch {
    // AES-GCM nie przepuści danych, jeśli tag się nie zgadza (złe hasło / modyfikacja).
    throw new WrongPasswordError();
  }
  const data = parseVaultData(JSON.parse(new TextDecoder().decode(plaintext)));
  return { key, kdf: valid.kdf, data };
}

// ---------- walidacja ----------

function isBase64(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Sprawdza strukturę pliku sejfu (np. przy imporcie kopii zapasowej). */
export function parseVaultFile(input: unknown): EncryptedVault {
  if (typeof input !== "object" || input === null) throw new InvalidVaultFileError("brak danych");
  const v = input as Record<string, unknown>;
  if (v.format !== VAULT_FORMAT) throw new InvalidVaultFileError("nieznany format");
  if (v.version !== VAULT_VERSION) throw new InvalidVaultFileError("nieobsługiwana wersja");
  if (v.cipher !== "AES-256-GCM") throw new InvalidVaultFileError("nieobsługiwany szyfr");
  const kdf = v.kdf as Record<string, unknown> | undefined;
  if (!kdf || kdf.name !== "PBKDF2-SHA256") throw new InvalidVaultFileError("nieobsługiwany KDF");
  if (
    typeof kdf.iterations !== "number" ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < MIN_ITERATIONS ||
    kdf.iterations > MAX_ITERATIONS
  ) {
    throw new InvalidVaultFileError("nieprawidłowa liczba iteracji");
  }
  if (!isBase64(kdf.salt)) throw new InvalidVaultFileError("brak soli");
  if (!isBase64(v.iv) || base64ToBytes(v.iv).length !== IV_BYTES)
    throw new InvalidVaultFileError("nieprawidłowy IV");
  if (!isBase64(v.data)) throw new InvalidVaultFileError("brak zaszyfrowanych danych");
  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    cipher: "AES-256-GCM",
    kdf: { name: "PBKDF2-SHA256", iterations: kdf.iterations, salt: kdf.salt },
    iv: v.iv,
    data: v.data,
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Sprawdza i normalizuje odszyfrowaną zawartość sejfu. */
export function parseVaultData(input: unknown): VaultData {
  const raw = (input as { entries?: unknown })?.entries;
  if (!Array.isArray(raw)) throw new InvalidVaultFileError("uszkodzona zawartość sejfu");
  const now = Date.now();
  return {
    entries: raw
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        id: str(e.id) || globalThis.crypto.randomUUID(),
        name: str(e.name),
        username: str(e.username),
        password: str(e.password),
        url: str(e.url),
        notes: str(e.notes),
        category: str(e.category),
        createdAt: typeof e.createdAt === "number" ? e.createdAt : now,
        updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : now,
      })),
  };
}
