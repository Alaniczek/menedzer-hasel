/**
 * Kopiowanie do schowka z automatycznym czyszczeniem.
 * Uwaga: przeglądarka nie pozwala w 100% kontrolować schowka systemowego –
 * menedżery schowka (np. historia Win+V) mogą zachować skopiowaną wartość.
 */

export const CLIPBOARD_CLEAR_MS = 30_000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopied: string | null = null;

export async function copyWithAutoClear(
  text: string,
  clearAfterMs: number = CLIPBOARD_CLEAR_MS,
): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Schowek jest niedostępny w tej przeglądarce.");
  }
  await navigator.clipboard.writeText(text);
  lastCopied = text;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    void clearClipboard();
  }, clearAfterMs);
}

/** Czyści schowek – ale tylko jeśli nadal jest w nim to, co skopiowaliśmy. */
export async function clearClipboard(): Promise<void> {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  const copied = lastCopied;
  lastCopied = null;
  if (copied === null || !navigator.clipboard) return;
  try {
    if (navigator.clipboard.readText) {
      const current = await navigator.clipboard.readText();
      if (current !== copied) return; // użytkownik skopiował już coś innego
    }
  } catch {
    // Brak uprawnienia do odczytu (lub karta w tle) – czyścimy na wszelki wypadek.
  }
  try {
    await navigator.clipboard.writeText("");
  } catch {
    // Np. dokument nie ma fokusu – nic więcej nie da się zrobić.
  }
}
