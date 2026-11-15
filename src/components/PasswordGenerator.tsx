"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_GENERATOR_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  generatePassword,
  type GeneratorOptions,
} from "@/lib/generator";
import StrengthMeter from "./StrengthMeter";
import { IconCopy, IconRefresh } from "./icons";

interface PasswordGeneratorProps {
  onUse?: (password: string) => void;
  onCopy?: (password: string) => void;
}

const CHECKBOXES: { key: keyof GeneratorOptions; label: string }[] = [
  { key: "lowercase", label: "Małe litery (a–z)" },
  { key: "uppercase", label: "Wielkie litery (A–Z)" },
  { key: "digits", label: "Cyfry (0–9)" },
  { key: "symbols", label: "Znaki specjalne (!@#…)" },
  { key: "excludeAmbiguous", label: "Bez podobnych znaków (l, 1, O, 0)" },
];

export default function PasswordGenerator({ onUse, onCopy }: PasswordGeneratorProps) {
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [password, setPassword] = useState("");

  const noCharset = !options.lowercase && !options.uppercase && !options.digits && !options.symbols;

  const regenerate = useCallback(() => {
    if (noCharset) {
      setPassword("");
      return;
    }
    setPassword(generatePassword(options));
  }, [options, noCharset]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const update = <K extends keyof GeneratorOptions>(key: K, value: GeneratorOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  return (
    <div className="generator">
      <div className="generator-output">
        <output className="mono generated" aria-label="Wygenerowane hasło" aria-live="polite">
          {password || "—"}
        </output>
        <button
          type="button"
          className="icon-btn"
          onClick={regenerate}
          aria-label="Wygeneruj nowe hasło"
          title="Wygeneruj nowe hasło"
          disabled={noCharset}
        >
          <IconRefresh />
        </button>
        {onCopy && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => password && onCopy(password)}
            aria-label="Kopiuj wygenerowane hasło"
            title="Kopiuj"
            disabled={!password}
          >
            <IconCopy />
          </button>
        )}
      </div>
      <StrengthMeter password={password} />

      <div className="field">
        <label htmlFor="gen-length">
          Długość: <strong>{options.length}</strong>
        </label>
        <div className="range-row">
          <input
            id="gen-length"
            type="range"
            min={MIN_LENGTH}
            max={64}
            value={Math.min(options.length, 64)}
            onChange={(e) => update("length", Number(e.target.value))}
          />
          <input
            type="number"
            className="input number"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            value={options.length}
            aria-label="Długość hasła"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) update("length", Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n)));
            }}
          />
        </div>
      </div>

      <fieldset className="checks">
        <legend className="sr-only">Rodzaje znaków</legend>
        {CHECKBOXES.map(({ key, label }) => (
          <label key={key} className="check">
            <input
              type="checkbox"
              checked={options[key] as boolean}
              onChange={(e) => update(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {noCharset && (
        <p className="error" role="alert">
          Wybierz co najmniej jeden rodzaj znaków.
        </p>
      )}

      {onUse && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => password && onUse(password)}
          disabled={!password}
        >
          Użyj tego hasła
        </button>
      )}
    </div>
  );
}
