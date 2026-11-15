import { afterEach, describe, expect, it, vi } from "vitest";
import { clearClipboard, copyWithAutoClear } from "./clipboard";
import type { Entry } from "./types";
import { createEntry, filterEntries, listCategories, mergeEntries, safeHref, updateEntry } from "./vault";

function entry(partial: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    name: "",
    username: "",
    password: "x",
    url: "",
    notes: "",
    category: "",
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe("operacje na wpisach", () => {
  const entries = [
    entry({ name: "Łódzki bank", category: "Finanse", username: "jan" }),
    entry({ name: "Poczta", category: "Praca", url: "mail.example.com" }),
    entry({ name: "Allegro", category: "Zakupy", notes: "konto firmowe" }),
  ];

  it("wyszukuje po nazwie, loginie, adresie i notatce – także bez polskich znaków", () => {
    expect(filterEntries(entries, "lodzki", null).map((e) => e.name)).toEqual(["Łódzki bank"]);
    expect(filterEntries(entries, "MAIL.EXAMPLE", null).map((e) => e.name)).toEqual(["Poczta"]);
    expect(filterEntries(entries, "firmowe", null).map((e) => e.name)).toEqual(["Allegro"]);
    expect(filterEntries(entries, "", "Praca").map((e) => e.name)).toEqual(["Poczta"]);
  });

  it("sortuje alfabetycznie i zwraca listę kategorii", () => {
    expect(filterEntries(entries, "", null).map((e) => e.name)).toEqual(["Allegro", "Łódzki bank", "Poczta"]);
    expect(listCategories(entries)).toEqual(["Finanse", "Praca", "Zakupy"]);
  });

  it("tworzy i edytuje wpis, przycinając spacje", () => {
    const created = createEntry({ name: "  Test ", username: " a ", password: " p ", url: "", notes: "", category: " X " }, 5);
    expect(created).toMatchObject({ name: "Test", username: "a", password: " p ", category: "X", createdAt: 5 });
    const [updated] = updateEntry([created], created.id, { ...created, name: "Nowa" }, 9);
    expect(updated).toMatchObject({ name: "Nowa", createdAt: 5, updatedAt: 9 });
  });

  it("scala kopię zapasową: dodaje nowe i nadpisuje tylko nowsze wpisy", () => {
    const a = entry({ id: "a", name: "A", updatedAt: 10 });
    const b = entry({ id: "b", name: "B", updatedAt: 10 });
    const result = mergeEntries(
      [a, b],
      [entry({ id: "a", name: "A-stare", updatedAt: 5 }), entry({ id: "b", name: "B-nowe", updatedAt: 20 }), entry({ id: "c", name: "C" })],
    );
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.entries.map((e) => e.name).sort()).toEqual(["A", "B-nowe", "C"]);
  });

  it("tworzy bezpieczne linki tylko dla http(s)", () => {
    expect(safeHref("example.com")).toBe("https://example.com/");
    expect(safeHref("http://a.pl/x")).toBe("http://a.pl/x");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("schowek", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function mockClipboard() {
    let content = "";
    const clipboard = {
      writeText: vi.fn(async (t: string) => {
        content = t;
      }),
      readText: vi.fn(async () => content),
    };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    return { clipboard, get: () => content, set: (t: string) => (content = t) };
  }

  it("czyści schowek po 30 sekundach", async () => {
    vi.useFakeTimers();
    const cb = mockClipboard();
    await copyWithAutoClear("tajne");
    expect(cb.get()).toBe("tajne");
    await vi.advanceTimersByTimeAsync(29_000);
    expect(cb.get()).toBe("tajne");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(cb.get()).toBe("");
  });

  it("nie nadpisuje schowka, jeśli użytkownik skopiował coś innego", async () => {
    vi.useFakeTimers();
    const cb = mockClipboard();
    await copyWithAutoClear("tajne");
    cb.set("coś innego");
    await vi.advanceTimersByTimeAsync(31_000);
    expect(cb.get()).toBe("coś innego");
  });

  it("clearClipboard czyści od razu (np. przy blokadzie sejfu)", async () => {
    const cb = mockClipboard();
    await copyWithAutoClear("tajne");
    await clearClipboard();
    expect(cb.get()).toBe("");
  });
});
