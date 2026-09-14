import { demoSessionSchema, type DemoSession } from "./demo-session";

export const chatStorageKey = "cart-pilot-chat-v2";
const storeStorageKey = "cart-pilot-store-v1";

// The memory copy also keeps the current page usable if browser storage is blocked.
export function createBrowserSession(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  let loaded = false;
  let current: DemoSession | null = null;
  return {
    read() {
      if (!loaded) {
        loaded = true;
        try {
          const raw = storage.getItem(storeStorageKey);
          if (raw) current = demoSessionSchema.parse(JSON.parse(raw));
        } catch {
          try {
            storage.removeItem(storeStorageKey);
            storage.removeItem(chatStorageKey);
          } catch { /* The page can still use its in-memory session. */ }
        }
      }
      return current;
    },
    write(session: DemoSession) {
      current = demoSessionSchema.parse(session);
      loaded = true;
      try { storage.setItem(storeStorageKey, JSON.stringify(current)); } catch { /* Storage is optional. */ }
    },
  };
}

let browserSession: ReturnType<typeof createBrowserSession> | undefined;
export function getBrowserSession() {
  if (typeof window === "undefined") throw new Error("Demo sessions are only available in the browser.");
  browserSession ??= createBrowserSession({
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: (key) => window.sessionStorage.removeItem(key),
  });
  return browserSession;
}
