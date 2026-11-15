"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Wywołuje onIdle, gdy przez `timeoutMs` nie było żadnej aktywności użytkownika.
 * Sprawdza też czas „na zegarze” (Date.now), bo przeglądarki spowalniają timery
 * w kartach w tle – po powrocie do karty sejf zablokuje się od razu, jeśli czas minął.
 */
export function useIdleLock(enabled: boolean, timeoutMs: number, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;
    let lastActivity = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const check = () => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= timeoutMs) {
        onIdleRef.current();
      } else {
        timer = setTimeout(check, timeoutMs - elapsed);
      }
    };
    const onActivity = () => {
      lastActivity = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        check();
      }
    };

    timer = setTimeout(check, timeoutMs);
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, timeoutMs]);
}
