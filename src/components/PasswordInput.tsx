"use client";

import { useState, type ReactNode } from "react";
import { IconEye, IconEyeOff } from "./icons";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  placeholder?: string;
  extraButtons?: ReactNode;
  describedBy?: string;
}

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  autoFocus,
  required,
  placeholder,
  extraButtons,
  describedBy,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-group">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="input mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          placeholder={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
          title={visible ? "Ukryj hasło" : "Pokaż hasło"}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
        {extraButtons}
      </div>
    </div>
  );
}
