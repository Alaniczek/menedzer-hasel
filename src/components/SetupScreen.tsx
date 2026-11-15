"use client";

import { useRef, useState, type FormEvent } from "react";
import PasswordInput from "./PasswordInput";
import StrengthMeter from "./StrengthMeter";
import ThemeToggle from "./ThemeToggle";
import { IconShield, IconUpload } from "./icons";

export const MIN_MASTER_LENGTH = 10;

interface SetupScreenProps {
  onCreate: (password: string) => Promise<void>;
  onRestore: (fileText: string) => void;
}

export default function SetupScreen({ onCreate, onRestore }: SetupScreenProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_MASTER_LENGTH) {
      setError(`Hasło główne musi mieć co najmniej ${MIN_MASTER_LENGTH} znaków.`);
      return;
    }
    if (password !== confirm) {
      setError("Hasła nie są identyczne.");
      return;
    }
    if (!understood) {
      setError("Potwierdź, że rozumiesz, iż hasła głównego nie da się odzyskać.");
      return;
    }
    setBusy(true);
    try {
      await onCreate(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć sejfu.");
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-top">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-logo">
          <IconShield width={34} height={34} />
        </div>
        <h1>Utwórz swój sejf</h1>
        <p className="muted">
          Wymyśl <strong>hasło główne</strong> – jedyne, które musisz pamiętać. Szyfruje ono wszystkie
          Twoje dane bezpośrednio w przeglądarce. Nigdzie go nie wysyłamy i <strong>nie da się go
          odzyskać</strong>.
        </p>

        <PasswordInput
          id="master-new"
          label="Hasło główne"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          autoFocus
          describedBy="master-strength"
        />
        <StrengthMeter password={password} showHints id="master-strength" />
        <PasswordInput
          id="master-confirm"
          label="Powtórz hasło główne"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          Rozumiem, że jeśli zapomnę hasła głównego, stracę dostęp do sejfu.
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Tworzenie sejfu…" : "Utwórz sejf"}
        </button>

        <div className="divider">
          <span>albo</span>
        </div>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>
          <IconUpload /> Przywróć z kopii zapasowej
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="restore-input"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onRestore(await file.text());
          }}
        />
      </form>
    </main>
  );
}
