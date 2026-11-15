/**
 * Generator haseł oparty na crypto.getRandomValues (kryptograficznie bezpieczne losowanie).
 * Używamy „rejection sampling”, żeby każdy znak był równie prawdopodobny (bez biasu modulo).
 */

export const CHARSETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
} as const;

const AMBIGUOUS = new Set("Il1O0o|`'\"".split(""));

export interface GeneratorOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

/** Losowa liczba całkowita z przedziału [0, max) bez biasu. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError("max musi być dodatnią liczbą całkowitą ≤ 2^32");
  }
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

function activeSets(options: GeneratorOptions): string[] {
  const sets: string[] = [];
  (["lowercase", "uppercase", "digits", "symbols"] as const).forEach((name) => {
    if (!options[name]) return;
    let chars = CHARSETS[name] as string;
    if (options.excludeAmbiguous) chars = [...chars].filter((c) => !AMBIGUOUS.has(c)).join("");
    sets.push(chars);
  });
  return sets;
}

export function generatePassword(options: GeneratorOptions = DEFAULT_GENERATOR_OPTIONS): string {
  const sets = activeSets(options);
  if (sets.length === 0) throw new Error("Wybierz co najmniej jeden rodzaj znaków.");
  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.floor(options.length)));
  const all = sets.join("");

  // Po jednym znaku z każdej wybranej grupy, reszta z całej puli…
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);

  // …a potem tasowanie Fishera–Yatesa, żeby wymuszone znaki nie stały na początku.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
