"use client";

import { useRef, useState, type FormEvent } from "react";
import { InvalidVaultFileError, WrongPasswordError, parseVaultFile, type EncryptedVault } from "@/lib/crypto";
import { AUTO_LOCK_OPTIONS, type Settings } from "@/lib/storage";
import Modal from "./Modal";
import PasswordInput from "./PasswordInput";
import StrengthMeter from "./StrengthMeter";
import { MIN_MASTER_LENGTH } from "./SetupScreen";
import { IconDownload, IconUpload } from "./icons";

interface SettingsDialogProps {
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  onExport: () => void;
  onImport: (file: EncryptedVault, password: string) => Promise<void>;
  onChangeMaster: (current: string, next: string) => Promise<void>;
  onClose: () => void;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof WrongPasswordError) return "Nieprawidłowe hasło.";
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function SettingsDialog({
  settings,
  onSettingsChange,
  onExport,
  onImport,
  onChangeMaster,
  onClose,
}: SettingsDialogProps) {
  // --- import ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<EncryptedVault | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // --- zmiana hasła głównego ---
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [nextConfirm, setNextConfirm] = useState("");
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterBusy, setMasterBusy] = useState(false);

  const handleFile = async (file: File) => {
    setImportError(null);
    try {
      setPendingImport(parseVaultFile(JSON.parse(await file.text())));
    } catch (err) {
      setPendingImport(null);
      setImportError(
        err instanceof InvalidVaultFileError ? err.message : "Nie udało się odczytać pliku (to nie jest JSON?).",
      );
    }
  };

  const submitImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingImport) return;
    setImportBusy(true);
    setImportError(null);
    try {
      await onImport(pendingImport, importPassword);
      setPendingImport(null);
      setImportPassword("");
    } catch (err) {
      setImportError(errorMessage(err, "Import nie powiódł się."));
    } finally {
      setImportBusy(false);
    }
  };

  const submitMaster = async (e: FormEvent) => {
    e.preventDefault();
    setMasterError(null);
    if (next.length < MIN_MASTER_LENGTH) {
      setMasterError(`Nowe hasło musi mieć co najmniej ${MIN_MASTER_LENGTH} znaków.`);
      return;
    }
    if (next !== nextConfirm) {
      setMasterError("Nowe hasła nie są identyczne.");
      return;
    }
    setMasterBusy(true);
    try {
      await onChangeMaster(current, next);
      setCurrent("");
      setNext("");
      setNextConfirm("");
    } catch (err) {
      setMasterError(
        err instanceof WrongPasswordError ? "Obecne hasło główne jest nieprawidłowe." : errorMessage(err, "Nie udało się zmienić hasła."),
      );
    } finally {
      setMasterBusy(false);
    }
  };

  return (
    <Modal title="Ustawienia" onClose={onClose}>
      <section className="settings-section">
        <h3>Automatyczna blokada</h3>
        <div className="field">
          <label htmlFor="autolock">Zablokuj sejf po bezczynności trwającej</label>
          <select
            id="autolock"
            className="input"
            value={settings.autoLockMinutes}
            onChange={(e) => onSettingsChange({ ...settings, autoLockMinutes: Number(e.target.value) })}
          >
            {AUTO_LOCK_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>Kopia zapasowa</h3>
        <p className="muted">
          Plik kopii zawiera <strong>zaszyfrowany</strong> sejf – bez hasła głównego nikt go nie odczyta.
          Przechowuj go np. na pendrivie albo w chmurze.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onExport}>
            <IconDownload /> Eksportuj kopię
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <IconUpload /> Importuj kopię
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleFile(f);
            }}
          />
        </div>
        {pendingImport && (
          <form className="inline-panel" onSubmit={submitImport} noValidate>
            <PasswordInput
              id="import-password"
              label="Hasło główne, którym zaszyfrowano kopię"
              value={importPassword}
              onChange={setImportPassword}
              autoComplete="off"
              autoFocus
            />
            <p className="muted small">Wpisy z kopii zostaną dołączone do obecnego sejfu.</p>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={importBusy || !importPassword}>
                {importBusy ? "Odszyfrowywanie…" : "Importuj wpisy"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPendingImport(null)}>
                Anuluj
              </button>
            </div>
          </form>
        )}
        {importError && (
          <p className="error" role="alert">
            {importError}
          </p>
        )}
      </section>

      <section className="settings-section">
        <h3>Zmień hasło główne</h3>
        <form onSubmit={submitMaster} noValidate className="stack">
          <PasswordInput id="master-current" label="Obecne hasło główne" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordInput id="master-next" label="Nowe hasło główne" value={next} onChange={setNext} />
          <StrengthMeter password={next} />
          <PasswordInput id="master-next-confirm" label="Powtórz nowe hasło główne" value={nextConfirm} onChange={setNextConfirm} />
          {masterError && (
            <p className="error" role="alert">
              {masterError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={masterBusy || !current || !next}>
            {masterBusy ? "Szyfrowanie…" : "Zmień hasło główne"}
          </button>
        </form>
      </section>
    </Modal>
  );
}
