import { describe, expect, it } from "vitest";
import { CHARSETS, DEFAULT_GENERATOR_OPTIONS, generatePassword, randomInt } from "./generator";
import { evaluateStrength } from "./strength";

const base = DEFAULT_GENERATOR_OPTIONS;

describe("generator haseł", () => {
  it("generuje hasło o zadanej długości", () => {
    for (const length of [4, 12, 20, 64, 128]) {
      expect(generatePassword({ ...base, length })).toHaveLength(length);
    }
  });

  it("zawiera co najmniej jeden znak z każdej wybranej grupy", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ ...base, length: 8 });
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect([...pw].some((c) => CHARSETS.symbols.includes(c))).toBe(true);
    }
  });

  it("używa tylko wybranych rodzajów znaków", () => {
    const digits = generatePassword({ ...base, lowercase: false, uppercase: false, symbols: false, length: 50 });
    expect(digits).toMatch(/^[0-9]{50}$/);
    const letters = generatePassword({ ...base, digits: false, symbols: false, length: 50 });
    expect(letters).toMatch(/^[a-zA-Z]{50}$/);
  });

  it("pomija podobne znaki, gdy zaznaczono tę opcję", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword({ ...base, length: 64, excludeAmbiguous: true })).not.toMatch(/[Il1O0o|]/);
    }
  });

  it("rzuca błąd, gdy nie wybrano żadnych znaków", () => {
    expect(() =>
      generatePassword({ ...base, lowercase: false, uppercase: false, digits: false, symbols: false }),
    ).toThrow(/co najmniej jeden/);
  });

  it("generuje różne hasła za każdym razem", () => {
    const set = new Set(Array.from({ length: 100 }, () => generatePassword(base)));
    expect(set.size).toBe(100);
  });

  it("randomInt zwraca wartości z zakresu i rozkłada je w miarę równomiernie", () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const n = randomInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
      counts[n]++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(1600); // oczekiwane ~2000
  });

  it("domyślne wygenerowane hasło jest oceniane jako bardzo silne", () => {
    expect(evaluateStrength(generatePassword(base)).score).toBe(4);
  });
});

describe("wskaźnik siły hasła", () => {
  it("puste hasło ma wynik 0", () => {
    expect(evaluateStrength("").score).toBe(0);
  });

  it("popularne hasła są bardzo słabe", () => {
    for (const pw of ["123456", "qwerty", "password1", "haslo123", "Polska1"]) {
      expect(evaluateStrength(pw).score, pw).toBe(0);
    }
  });

  it("krótkie proste hasło jest słabe, długie i zróżnicowane – silne", () => {
    expect(evaluateStrength("kot").score).toBeLessThanOrEqual(1);
    expect(evaluateStrength("Zielony-Rower#2024!").score).toBeGreaterThanOrEqual(3);
  });

  it("karze sekwencje i powtórzenia", () => {
    const withSeq = evaluateStrength("Abcd1234!xyz");
    expect(withSeq.hints.join(" ")).toMatch(/sekwencji/);
    const repeated = evaluateStrength("aaaaaaaaaaaa");
    expect(repeated.score).toBeLessThanOrEqual(1);
  });
});
