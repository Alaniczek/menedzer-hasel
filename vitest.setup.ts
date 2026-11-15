import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom nie ma pełnego Web Crypto API – podstawiamy implementację z Node.js.
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
