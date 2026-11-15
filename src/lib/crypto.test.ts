import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITERATIONS,
  InvalidVaultFileError,
  MIN_ITERATIONS,
  WrongPasswordError,
  base64ToBytes,
  bytesToBase64,
  createVault,
  parseVaultFile,
  sealVault,
  unlockVault,
} from "./crypto";
import type { VaultData } from "./types";

const ITER = MIN_ITERATIONS; // szybciej w testach; logika identyczna jak dla 600 000

const sample: VaultData = {
  entries: [
    {
      id: "a1",
      name: "Poczta",
      username: "jan@example.com",
      password: "Super$ekretne-Hasło-123",
      url: "https://poczta.example.com",
      notes: "kod zapasowy: 9876",
      category: "Praca",
      createdAt: 1,
      updatedAt: 2,
    },
  ],
};

describe("szyfrowanie sejfu", () => {
  it("szyfruje i odszyfrowuje dane poprawnym hasłem", async () => {
    const { file } = await createVault("poprawne hasło główne", sample, ITER);
    const unlocked = await unlockVault(file, "poprawne hasło główne");
    expect(unlocked.data).toEqual(sample);
  });

  it("odrzuca złe hasło główne (WrongPasswordError)", async () => {
    const { file } = await createVault("poprawne hasło główne", sample, ITER);
    await expect(unlockVault(file, "złe hasło")).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(unlockVault(file, "")).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("nie zapisuje żadnych danych jawnym tekstem", async () => {
    const { file } = await createVault("hasło-główne-xyz", sample, ITER);
    const json = JSON.stringify(file);
    expect(json).not.toContain("Super$ekretne");
    expect(json).not.toContain("jan@example.com");
    expect(json).not.toContain("hasło-główne-xyz");
    expect(file.cipher).toBe("AES-256-GCM");
    expect(file.kdf.name).toBe("PBKDF2-SHA256");
  });

  it("używa nowego losowego IV przy każdym zapisie i losowej soli dla każdego sejfu", async () => {
    const { file, session } = await createVault("hasło główne", sample, ITER);
    const again = await sealVault(session.key, session.kdf, sample);
    expect(base64ToBytes(file.iv)).toHaveLength(12);
    expect(again.iv).not.toBe(file.iv);
    expect(again.data).not.toBe(file.data);
    expect(again.kdf.salt).toBe(file.kdf.salt);

    const other = await createVault("hasło główne", sample, ITER);
    expect(other.file.kdf.salt).not.toBe(file.kdf.salt);
    expect(base64ToBytes(file.kdf.salt)).toHaveLength(16);
  });

  it("wykrywa modyfikację zaszyfrowanych danych", async () => {
    const { file } = await createVault("hasło główne", sample, ITER);
    const bytes = base64ToBytes(file.data);
    bytes[0] ^= 0xff;
    await expect(unlockVault({ ...file, data: bytesToBase64(bytes) }, "hasło główne")).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
  });

  it("wykrywa podmianę nagłówka (np. liczby iteracji) dzięki AAD", async () => {
    const { file, session } = await createVault("hasło główne", sample, ITER);
    // Ten sam klucz, ale nagłówek twierdzi coś innego – tag GCM się nie zgodzi.
    const forged = { ...file, kdf: { ...file.kdf, iterations: ITER + 1 } };
    await expect(unlockVault(forged, "hasło główne")).rejects.toBeInstanceOf(WrongPasswordError);
    expect(session.kdf.iterations).toBe(ITER);
  });

  it("klucz nie daje się wyeksportować z Web Crypto", async () => {
    const { session } = await createVault("hasło główne", sample, ITER);
    expect(session.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", session.key)).rejects.toThrow();
  });

  it("domyślnie używa 600 000 iteracji PBKDF2", async () => {
    expect(DEFAULT_ITERATIONS).toBe(600_000);
    const { file } = await createVault("hasło główne", { entries: [] });
    expect(file.kdf.iterations).toBe(600_000);
    const unlocked = await unlockVault(file, "hasło główne");
    expect(unlocked.data.entries).toEqual([]);
  });
});

describe("walidacja pliku sejfu", () => {
  it("odrzuca dane, które nie są sejfem", () => {
    expect(() => parseVaultFile(null)).toThrow(InvalidVaultFileError);
    expect(() => parseVaultFile({ hello: "world" })).toThrow(InvalidVaultFileError);
    expect(() => parseVaultFile("tekst")).toThrow(InvalidVaultFileError);
  });

  it("odrzuca zbyt małą liczbę iteracji (ochrona przed osłabieniem)", async () => {
    const { file } = await createVault("hasło główne", sample, ITER);
    expect(() => parseVaultFile({ ...file, kdf: { ...file.kdf, iterations: 1000 } })).toThrow(/iteracji/);
  });

  it("przyjmuje poprawny plik po serializacji do JSON", async () => {
    const { file } = await createVault("hasło główne", sample, ITER);
    const roundTrip = parseVaultFile(JSON.parse(JSON.stringify(file)));
    expect(roundTrip).toEqual(file);
  });
});
