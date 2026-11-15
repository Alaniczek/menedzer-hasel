"use client";

import { useState, type FormEvent } from "react";
import { generatePassword, DEFAULT_GENERATOR_OPTIONS } from "@/lib/generator";
import type { EntryInput } from "@/lib/types";
import Modal from "./Modal";
import PasswordGenerator from "./PasswordGenerator";
import PasswordInput from "./PasswordInput";
import StrengthMeter from "./StrengthMeter";
import { IconRefresh } from "./icons";

interface EntryFormProps {
  initial: EntryInput;
  isNew: boolean;
  categories: string[];
  onSave: (input: EntryInput) => Promise<void>;
  onClose: () => void;
}

export default function EntryForm({ initial, isNew, categories, onSave, onClose }: EntryFormProps) {
  const [form, setForm] = useState<EntryInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const set = (key: keyof EntryInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Podaj nazwę wpisu (np. „Poczta” albo „Bank”).");
      return;
    }
    if (!form.password) {
      setError("Podaj hasło albo je wygeneruj.");
      return;
    }
    setBusy(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać wpisu.");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Nowy wpis" : "Edytuj wpis"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" form="entry-form" className="btn btn-primary" disabled={busy}>
            {busy ? "Zapisywanie…" : "Zapisz"}
          </button>
        </>
      }
    >
      <form id="entry-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="entry-name">Nazwa</label>
          <input
            id="entry-name"
            className="input"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="np. Poczta Gmail"
            autoComplete="off"
            data-autofocus
          />
        </div>
        <div className="field">
          <label htmlFor="entry-username">Login</label>
          <input
            id="entry-username"
            className="input"
            value={form.username}
            onChange={(e) => set("username")(e.target.value)}
            placeholder="np. jan.kowalski@example.com"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
          />
        </div>
        <div className="field-span">
          <PasswordInput
            id="entry-password"
            label="Hasło"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            extraButtons={
              <button
                type="button"
                className="icon-btn"
                aria-label="Wygeneruj hasło"
                title="Wygeneruj silne hasło"
                onClick={() => set("password")(generatePassword(DEFAULT_GENERATOR_OPTIONS))}
              >
                <IconRefresh />
              </button>
            }
          />
          <StrengthMeter password={form.password} />
          <button type="button" className="link-btn" onClick={() => setShowGenerator((s) => !s)}>
            {showGenerator ? "Ukryj opcje generatora" : "Opcje generatora…"}
          </button>
          {showGenerator && (
            <div className="inline-panel">
              <PasswordGenerator
                onUse={(pw) => {
                  set("password")(pw);
                  setShowGenerator(false);
                }}
              />
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="entry-url">Adres strony</label>
          <input
            id="entry-url"
            className="input"
            type="url"
            inputMode="url"
            value={form.url}
            onChange={(e) => set("url")(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
          />
        </div>
        <div className="field">
          <label htmlFor="entry-category">Kategoria</label>
          <input
            id="entry-category"
            className="input"
            list="category-options"
            value={form.category}
            onChange={(e) => set("category")(e.target.value)}
            placeholder="np. Praca, Bank, Social media"
            autoComplete="off"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field field-span">
          <label htmlFor="entry-notes">Notatka</label>
          <textarea
            id="entry-notes"
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
            placeholder="Pytania pomocnicze, kody zapasowe… (też są szyfrowane)"
          />
        </div>
        {error && (
          <p className="error field-span" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
