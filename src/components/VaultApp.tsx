"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_ITERATIONS,
  InvalidVaultFileError,
  createVault,
  parseVaultFile,
  sealVault,
  unlockVault,
  type EncryptedVault,
  type UnlockedVault,
} from "@/lib/crypto";
import { CLIPBOARD_CLEAR_MS, clearClipboard, copyWithAutoClear } from "@/lib/clipboard";
import {
  deleteVaultFile,
  hasStoredVault,
  loadSettings,
  loadVaultFile,
  saveSettings,
  saveVaultFile,
  DEFAULT_SETTINGS,
  type Settings,
} from "@/lib/storage";
import type { Entry } from "@/lib/types";
import { backupFileName, createEntry, mergeEntries, removeEntry, updateEntry } from "@/lib/vault";
import { useIdleLock } from "@/hooks/useIdleLock";
import SetupScreen from "./SetupScreen";
import UnlockScreen from "./UnlockScreen";
import VaultView from "./VaultView";

type Phase = "loading" | "setup" | "locked" | "unlocked";

interface VaultAppProps {
  /** Liczba iteracji PBKDF2 dla nowych sejfów (testy używają mniejszej, by działały szybciej). */
  iterations?: number;
  /** Nadpisuje czas automatycznej blokady (tylko do testów). */
  autoLockMs?: number;
}

export default function VaultApp({ iterations = DEFAULT_ITERATIONS, autoLockMs }: VaultAppProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSessionState] = useState<UnlockedVault | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const sessionRef = useRef<UnlockedVault | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());

  const setSession = (s: UnlockedVault | null) => {
    sessionRef.current = s;
    setSessionState(s);
  };

  useEffect(() => {
    setSettings(loadSettings());
    setPhase(hasStoredVault() ? "locked" : "setup");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (text: string) => setToast({ id: Date.now(), text });

  const lock = useCallback((reason?: string) => {
    // Odrzucamy klucz i odszyfrowane dane – zostaje tylko zaszyfrowany plik.
    sessionRef.current = null;
    setSessionState(null);
    setNotice(reason ?? null);
    setPhase("locked");
    void clearClipboard();
  }, []);

  useIdleLock(
    phase === "unlocked",
    autoLockMs ?? settings.autoLockMinutes * 60_000,
    () => lock("Sejf został automatycznie zablokowany z powodu bezczynności."),
  );

  /** Każda zmiana: nowe dane → szyfrowanie z nowym IV → zapis. Zapisy idą po kolei. */
  const persist = (update: (entries: Entry[]) => Entry[]): Promise<void> => {
    const run = async () => {
      const s = sessionRef.current;
      if (!s) throw new Error("Sejf jest zablokowany.");
      const data = { entries: update(s.data.entries) };
      const file = await sealVault(s.key, s.kdf, data);
      if (sessionRef.current?.key !== s.key) throw new Error("Sejf został zablokowany w trakcie zapisu.");
      saveVaultFile(file);
      setSession({ ...s, data });
    };
    const p = writeQueue.current.then(run, run);
    writeQueue.current = p.catch(() => undefined);
    return p;
  };

  // ---------- akcje ----------

  const handleCreate = async (password: string) => {
    const { file, session: s } = await createVault(password, { entries: [] }, iterations);
    saveVaultFile(file);
    setSession(s);
    setNotice(null);
    setPhase("unlocked");
  };

  const handleUnlock = async (password: string) => {
    const file = loadVaultFile();
    if (!file) throw new InvalidVaultFileError("zapisany sejf jest uszkodzony");
    const s = await unlockVault(file, password);
    setSession(s);
    setNotice(null);
    setPhase("unlocked");
  };

  const handleRestore = (text: string) => {
    try {
      const file = parseVaultFile(JSON.parse(text));
      saveVaultFile(file);
      setNotice("Przywrócono kopię zapasową. Odblokuj ją hasłem głównym, którym była zaszyfrowana.");
      setPhase("locked");
    } catch (err) {
      showToast(err instanceof InvalidVaultFileError ? err.message : "Nie udało się odczytać pliku kopii.");
    }
  };

  const handleReset = () => {
    deleteVaultFile();
    setSession(null);
    setNotice(null);
    setPhase("setup");
  };

  const handleCopy = async (value: string, what: string) => {
    try {
      await copyWithAutoClear(value);
      showToast(
        what === "hasło"
          ? `Skopiowano hasło – schowek zostanie wyczyszczony za ${CLIPBOARD_CLEAR_MS / 1000} s.`
          : `Skopiowano ${what}.`,
      );
    } catch {
      showToast("Nie udało się skopiować do schowka.");
    }
  };

  const handleExport = () => {
    const file = loadVaultFile();
    if (!file) return;
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Zapisano zaszyfrowaną kopię zapasową.");
  };

  const handleImport = async (file: EncryptedVault, password: string) => {
    const imported = await unlockVault(file, password);
    let result = { added: 0, updated: 0 };
    await persist((entries) => {
      const merged = mergeEntries(entries, imported.data.entries);
      result = merged;
      return merged.entries;
    });
    showToast(`Import zakończony: ${result.added} nowych, ${result.updated} zaktualizowanych wpisów.`);
  };

  const handleChangeMaster = async (current: string, next: string) => {
    const stored = loadVaultFile();
    const s = sessionRef.current;
    if (!stored || !s) throw new Error("Sejf jest zablokowany.");
    await unlockVault(stored, current); // weryfikacja obecnego hasła (rzuci WrongPasswordError)
    await writeQueue.current;
    const { file, session: fresh } = await createVault(next, sessionRef.current?.data ?? s.data, iterations);
    saveVaultFile(file);
    setSession(fresh);
    showToast("Hasło główne zostało zmienione. Pamiętaj, by wykonać nową kopię zapasową.");
  };

  const handleSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  // ---------- widok ----------

  let screen: React.ReactNode = null;
  if (phase === "loading") {
    screen = (
      <main className="auth-page">
        <p className="muted">Ładowanie…</p>
      </main>
    );
  } else if (phase === "setup") {
    screen = <SetupScreen onCreate={handleCreate} onRestore={handleRestore} />;
  } else if (phase === "locked" || !session) {
    screen = <UnlockScreen onUnlock={handleUnlock} onReset={handleReset} notice={notice} />;
  } else {
    screen = (
      <VaultView
        entries={session.data.entries}
        settings={settings}
        onAdd={(input) => persist((entries) => [...entries, createEntry(input)])}
        onUpdate={(id, input) => persist((entries) => updateEntry(entries, id, input))}
        onDelete={(id) => persist((entries) => removeEntry(entries, id))}
        onCopy={handleCopy}
        onLock={() => lock()}
        onExport={handleExport}
        onImport={handleImport}
        onChangeMaster={handleChangeMaster}
        onSettingsChange={handleSettings}
      />
    );
  }

  return (
    <>
      {screen}
      <div className="toast-region" aria-live="polite" role="status">
        {toast && (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        )}
      </div>
    </>
  );
}
