"use client";

import { useState, type FormEvent } from "react";
import { WrongPasswordError } from "@/lib/crypto";
import Modal from "./Modal";
import PasswordInput from "./PasswordInput";
import ThemeToggle from "./ThemeToggle";
import { IconLock } from "./icons";

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<void>;
  onReset: () => void;
  notice?: string | null;
}

export default function UnlockScreen({ onUnlock, onReset, notice }: UnlockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Wpisz hasło główne.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onUnlock(password);
    } catch (err) {
      setPassword("");
      setError(
        err instanceof WrongPasswordError
          ? "Nieprawidłowe hasło główne. Spróbuj ponownie."
          : err instanceof Error
            ? err.message
            : "Nie udało się odblokować sejfu.",
      );
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
          <IconLock width={34} height={34} />
        </div>
        <h1>Sejf jest zablokowany</h1>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <PasswordInput
          id="master-unlock"
          label="Hasło główne"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          autoFocus
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Odszyfrowywanie…" : "Odblokuj"}
        </button>
        <button type="button" className="link-btn" onClick={() => setConfirmReset(true)}>
          Nie pamiętasz hasła głównego?
        </button>
      </form>

      {confirmReset && (
        <Modal
          title="Usunąć sejf?"
          size="sm"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Anuluj
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setConfirmReset(false);
                  onReset();
                }}
              >
                Usuń sejf i zacznij od nowa
              </button>
            </>
          }
        >
          <p>
            Hasła głównego <strong>nie da się odzyskać</strong> – nikt (także autor aplikacji) nie zna
            klucza. Jedyne wyjście to usunąć zaszyfrowany sejf z tej przeglądarki i utworzyć nowy.
          </p>
          <p className="muted">
            Jeśli masz kopię zapasową i pamiętasz hasło, którym była zaszyfrowana, możesz ją potem
            przywrócić.
          </p>
        </Modal>
      )}
    </main>
  );
}
