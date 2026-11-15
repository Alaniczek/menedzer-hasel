/**
 * Przechowywanie w localStorage. Zapisujemy WYŁĄCZNIE zaszyfrowany sejf
 * oraz niewrażliwe ustawienia (motyw, czas automatycznej blokady).
 */

import { parseVaultFile, type EncryptedVault } from "./crypto";

const VAULT_KEY = "menedzer-hasel:sejf";
const SETTINGS_KEY = "menedzer-hasel:ustawienia";

export interface Settings {
  autoLockMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = { autoLockMinutes: 5 };
export const AUTO_LOCK_OPTIONS = [1, 2, 5, 10, 15, 30];

export function loadVaultFile(): EncryptedVault | null {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    return parseVaultFile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasStoredVault(): boolean {
  return localStorage.getItem(VAULT_KEY) !== null;
}

export function saveVaultFile(file: EncryptedVault): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(file));
}

export function deleteVaultFile(): void {
  localStorage.removeItem(VAULT_KEY);
}

export function loadSettings(): Settings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    const minutes = Number(parsed.autoLockMinutes);
    return {
      autoLockMinutes: AUTO_LOCK_OPTIONS.includes(minutes) ? minutes : DEFAULT_SETTINGS.autoLockMinutes,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
