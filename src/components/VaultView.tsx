"use client";

import { useMemo, useState } from "react";
import type { EncryptedVault } from "@/lib/crypto";
import type { Settings } from "@/lib/storage";
import type { Entry, EntryInput } from "@/lib/types";
import { EMPTY_ENTRY, filterEntries, listCategories } from "@/lib/vault";
import EntryCard from "./EntryCard";
import EntryForm from "./EntryForm";
import Modal from "./Modal";
import PasswordGenerator from "./PasswordGenerator";
import SettingsDialog from "./SettingsDialog";
import ThemeToggle from "./ThemeToggle";
import { IconKey, IconLock, IconPlus, IconSearch, IconSettings, IconShield } from "./icons";

interface VaultViewProps {
  entries: Entry[];
  settings: Settings;
  onAdd: (input: EntryInput) => Promise<void>;
  onUpdate: (id: string, input: EntryInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopy: (value: string, what: string) => void;
  onLock: () => void;
  onExport: () => void;
  onImport: (file: EncryptedVault, password: string) => Promise<void>;
  onChangeMaster: (current: string, next: string) => Promise<void>;
  onSettingsChange: (s: Settings) => void;
}

type Dialog =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; entry: Entry }
  | { kind: "delete"; entry: Entry }
  | { kind: "generator" }
  | { kind: "settings" };

export default function VaultView(props: VaultViewProps) {
  const { entries, onCopy } = props;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const close = () => setDialog({ kind: "none" });

  const categories = useMemo(() => listCategories(entries), [entries]);
  const activeCategory = category !== null && categories.includes(category) ? category : null;
  const visible = useMemo(() => filterEntries(entries, query, activeCategory), [entries, query, activeCategory]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <IconShield width={24} height={24} />
          <span>Sejf</span>
        </div>
        <div className="search">
          <IconSearch />
          <input
            type="search"
            className="input"
            placeholder="Szukaj wpisów…"
            aria-label="Szukaj wpisów"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => setDialog({ kind: "generator" })} aria-label="Generator haseł" title="Generator haseł">
            <IconKey />
          </button>
          <button type="button" className="icon-btn" onClick={() => setDialog({ kind: "settings" })} aria-label="Ustawienia" title="Ustawienia">
            <IconSettings />
          </button>
          <ThemeToggle />
          <button type="button" className="btn btn-ghost" onClick={props.onLock} title="Zablokuj sejf">
            <IconLock /> <span className="hide-sm">Zablokuj</span>
          </button>
        </div>
      </header>

      <main className="content">
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Filtruj według kategorii">
            <button
              type="button"
              className={`chip ${activeCategory === null ? "active" : ""}`}
              aria-pressed={activeCategory === null}
              onClick={() => setCategory(null)}
            >
              Wszystkie <span className="chip-count">{entries.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${activeCategory === c ? "active" : ""}`}
                aria-pressed={activeCategory === c}
                onClick={() => setCategory(c)}
              >
                {c} <span className="chip-count">{entries.filter((e) => e.category === c).length}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "new" })}>
            <IconPlus /> Nowy wpis
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="empty">
            <IconShield width={48} height={48} />
            <h2>Twój sejf jest pusty</h2>
            <p className="muted">Dodaj pierwszy wpis – wszystko zostanie zaszyfrowane, zanim trafi do pamięci przeglądarki.</p>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "new" })}>
              <IconPlus /> Dodaj pierwszy wpis
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <IconSearch width={40} height={40} />
            <h2>Brak wyników</h2>
            <p className="muted">Żaden wpis nie pasuje do „{query}”.</p>
          </div>
        ) : (
          <section className="grid" aria-label="Lista wpisów">
            {visible.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onCopy={(value, what) => onCopy(value, what)}
                onEdit={() => setDialog({ kind: "edit", entry })}
                onDelete={() => setDialog({ kind: "delete", entry })}
              />
            ))}
          </section>
        )}
      </main>

      {dialog.kind === "new" && (
        <EntryForm
          isNew
          initial={{ ...EMPTY_ENTRY, category: activeCategory ?? "" }}
          categories={categories}
          onClose={close}
          onSave={async (input) => {
            await props.onAdd(input);
            close();
          }}
        />
      )}
      {dialog.kind === "edit" && (
        <EntryForm
          isNew={false}
          initial={{
            name: dialog.entry.name,
            username: dialog.entry.username,
            password: dialog.entry.password,
            url: dialog.entry.url,
            notes: dialog.entry.notes,
            category: dialog.entry.category,
          }}
          categories={categories}
          onClose={close}
          onSave={async (input) => {
            await props.onUpdate(dialog.entry.id, input);
            close();
          }}
        />
      )}
      {dialog.kind === "delete" && (
        <Modal
          title="Usunąć wpis?"
          size="sm"
          onClose={close}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={close}>
                Anuluj
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await props.onDelete(dialog.entry.id);
                  close();
                }}
              >
                Usuń
              </button>
            </>
          }
        >
          <p>
            Wpis <strong>{dialog.entry.name}</strong> zostanie trwale usunięty z sejfu.
          </p>
        </Modal>
      )}
      {dialog.kind === "generator" && (
        <Modal title="Generator haseł" size="sm" onClose={close}>
          <PasswordGenerator onCopy={(pw) => onCopy(pw, "hasło")} />
        </Modal>
      )}
      {dialog.kind === "settings" && (
        <SettingsDialog
          settings={props.settings}
          onSettingsChange={props.onSettingsChange}
          onExport={props.onExport}
          onImport={props.onImport}
          onChangeMaster={props.onChangeMaster}
          onClose={close}
        />
      )}
    </div>
  );
}
