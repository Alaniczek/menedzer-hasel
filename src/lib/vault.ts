import type { Entry, EntryInput } from "./types";

export const EMPTY_ENTRY: EntryInput = {
  name: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  category: "",
};

function clean(input: EntryInput): EntryInput {
  return {
    name: input.name.trim(),
    username: input.username.trim(),
    password: input.password,
    url: input.url.trim(),
    notes: input.notes,
    category: input.category.trim(),
  };
}

export function createEntry(input: EntryInput, now = Date.now()): Entry {
  return { ...clean(input), id: globalThis.crypto.randomUUID(), createdAt: now, updatedAt: now };
}

export function updateEntry(entries: Entry[], id: string, input: EntryInput, now = Date.now()): Entry[] {
  return entries.map((e) => (e.id === id ? { ...e, ...clean(input), updatedAt: now } : e));
}

export function removeEntry(entries: Entry[], id: string): Entry[] {
  return entries.filter((e) => e.id !== id);
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name, "pl", { sensitivity: "base" }));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

/** Wyszukiwanie po nazwie, loginie, adresie, kategorii i notatce (bez polskich znaków też działa). */
export function filterEntries(entries: Entry[], query: string, category: string | null): Entry[] {
  const q = normalize(query.trim());
  return sortEntries(entries).filter((e) => {
    if (category !== null && e.category !== category) return false;
    if (!q) return true;
    return [e.name, e.username, e.url, e.category, e.notes].some((field) => normalize(field).includes(q));
  });
}

export function listCategories(entries: Entry[]): string[] {
  return [...new Set(entries.map((e) => e.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pl", { sensitivity: "base" }),
  );
}

/**
 * Łączy wpisy z kopii zapasowej z bieżącym sejfem.
 * Wpis o tym samym id zostaje zastąpiony tylko wtedy, gdy wersja z kopii jest nowsza.
 */
export function mergeEntries(
  current: Entry[],
  incoming: Entry[],
): { entries: Entry[]; added: number; updated: number } {
  const byId = new Map(current.map((e) => [e.id, e]));
  let added = 0;
  let updated = 0;
  for (const entry of incoming) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      added++;
    } else if (entry.updatedAt > existing.updatedAt) {
      byId.set(entry.id, entry);
      updated++;
    }
  }
  return { entries: [...byId.values()], added, updated };
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `sejf-kopia-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Bezpieczny link: tylko http(s), w innym wypadku null. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
