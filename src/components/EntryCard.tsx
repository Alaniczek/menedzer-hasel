"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { safeHref } from "@/lib/vault";
import { IconCopy, IconEdit, IconExternal, IconEye, IconEyeOff, IconTrash } from "./icons";

interface EntryCardProps {
  entry: Entry;
  onCopy: (value: string, what: "login" | "hasło") => void;
  onEdit: () => void;
  onDelete: () => void;
}

function initials(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function hue(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function EntryCard({ entry, onCopy, onEdit, onDelete }: EntryCardProps) {
  const [visible, setVisible] = useState(false);
  const href = safeHref(entry.url);

  return (
    <article className="entry" aria-label={entry.name}>
      <header className="entry-head">
        <span className="avatar" style={{ ["--h" as string]: hue(entry.name) }} aria-hidden="true">
          {initials(entry.name)}
        </span>
        <div className="entry-title">
          <h3>{entry.name}</h3>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="entry-url">
              {entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} <IconExternal width={13} height={13} />
            </a>
          ) : entry.url ? (
            <span className="entry-url">{entry.url}</span>
          ) : null}
        </div>
        {entry.category && <span className="tag">{entry.category}</span>}
      </header>

      {entry.username && (
        <div className="entry-row">
          <span className="row-label">Login</span>
          <span className="row-value" title={entry.username}>
            {entry.username}
          </span>
          <button
            type="button"
            className="icon-btn sm"
            onClick={() => onCopy(entry.username, "login")}
            aria-label={`Kopiuj login: ${entry.name}`}
            title="Kopiuj login"
          >
            <IconCopy />
          </button>
        </div>
      )}

      <div className="entry-row">
        <span className="row-label">Hasło</span>
        <span className="row-value mono" data-testid="entry-password">
          {visible ? entry.password : "••••••••••••"}
        </span>
        <button
          type="button"
          className="icon-btn sm"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Ukryj hasło: ${entry.name}` : `Pokaż hasło: ${entry.name}`}
          title={visible ? "Ukryj hasło" : "Pokaż hasło"}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
        <button
          type="button"
          className="icon-btn sm"
          onClick={() => onCopy(entry.password, "hasło")}
          aria-label={`Kopiuj hasło: ${entry.name}`}
          title="Kopiuj hasło (schowek wyczyści się po 30 s)"
        >
          <IconCopy />
        </button>
      </div>

      {entry.notes && <p className="entry-notes">{entry.notes}</p>}

      <footer className="entry-actions">
        <button type="button" className="btn btn-ghost sm" onClick={onEdit} aria-label={`Edytuj: ${entry.name}`}>
          <IconEdit width={15} height={15} /> Edytuj
        </button>
        <button type="button" className="btn btn-ghost sm danger-text" onClick={onDelete} aria-label={`Usuń: ${entry.name}`}>
          <IconTrash width={15} height={15} /> Usuń
        </button>
      </footer>
    </article>
  );
}
