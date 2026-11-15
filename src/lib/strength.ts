/**
 * Prosta ocena siły hasła: szacowana entropia (rozmiar alfabetu × długość)
 * z karami za typowe słabości (popularne hasła, powtórzenia, sekwencje).
 * To heurystyka – nie zastąpi pełnego narzędzia typu zxcvbn.
 */

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface StrengthResult {
  score: StrengthScore;
  label: string;
  entropyBits: number;
  hints: string[];
}

export const STRENGTH_LABELS: Record<StrengthScore, string> = {
  0: "Bardzo słabe",
  1: "Słabe",
  2: "Średnie",
  3: "Silne",
  4: "Bardzo silne",
};

const COMMON = new Set([
  "123456", "123456789", "12345678", "12345", "1234567", "1234567890", "111111",
  "000000", "123123", "654321", "qwerty", "qwerty123", "qwertyuiop", "asdfgh",
  "zaq12wsx", "password", "password1", "passw0rd", "haslo", "haslo123", "hasło",
  "admin", "admin123", "letmein", "welcome", "iloveyou", "monkey", "dragon",
  "football", "polska", "polska1", "kochanie", "zxcvbnm", "abc123", "abcd1234",
  "matrix", "marcin", "michal", "lol123", "misiek", "mateusz", "agnieszka",
]);

const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

function poolSize(password: string): number {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
  return pool;
}

function hasSequence(lower: string, minRun = 4): boolean {
  for (const seq of SEQUENCES) {
    const rev = [...seq].reverse().join("");
    for (let i = 0; i + minRun <= seq.length; i++) {
      if (lower.includes(seq.slice(i, i + minRun)) || lower.includes(rev.slice(i, i + minRun))) {
        return true;
      }
    }
  }
  return false;
}

export function evaluateStrength(password: string): StrengthResult {
  const hints: string[] = [];
  if (!password) return { score: 0, label: STRENGTH_LABELS[0], entropyBits: 0, hints: ["Wpisz hasło."] };

  const lower = password.toLowerCase();
  const pool = poolSize(password);
  let entropy = password.length * Math.log2(Math.max(pool, 1));

  if (COMMON.has(lower) || COMMON.has(lower.replace(/[0-9!@#$%^&*]+$/, ""))) {
    hints.push("To jedno z najpopularniejszych haseł – łatwo je odgadnąć.");
    entropy = Math.min(entropy, 10);
  }
  if (/(.)\1{2,}/.test(password)) {
    hints.push("Unikaj powtarzania tego samego znaku.");
    entropy *= 0.75;
  }
  if (hasSequence(lower)) {
    hints.push("Unikaj sekwencji typu „abcd”, „1234” czy „qwer”.");
    entropy *= 0.75;
  }
  const uniqueRatio = new Set(password).size / password.length;
  if (password.length >= 6 && uniqueRatio < 0.5) entropy *= 0.8;

  if (password.length < 12) hints.push("Użyj co najmniej 12 znaków (lepiej 16+).");
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) hints.push("Dodaj małe i wielkie litery.");
  if (!/[0-9]/.test(password)) hints.push("Dodaj cyfry.");
  if (!/[^a-zA-Z0-9]/.test(password)) hints.push("Dodaj znaki specjalne.");

  let score: StrengthScore;
  if (entropy < 28) score = 0;
  else if (entropy < 45) score = 1;
  else if (entropy < 64) score = 2;
  else if (entropy < 90) score = 3;
  else score = 4;

  return { score, label: STRENGTH_LABELS[score], entropyBits: Math.round(entropy), hints };
}
