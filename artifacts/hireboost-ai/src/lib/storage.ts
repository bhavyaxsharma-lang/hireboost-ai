const isBrowser = typeof window !== "undefined";

function storageAvailable(storage: Storage | undefined): boolean {
  if (!isBrowser || !storage) return false;

  try {
    const testKey = "__hireboost_storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const localMemory = new Map<string, string>();
const sessionMemory = new Map<string, string>();

const localStorageAvailable = isBrowser ? storageAvailable(window.localStorage) : false;
const sessionStorageAvailable = isBrowser ? storageAvailable(window.sessionStorage) : false;
const cookieAvailable = isBrowser ? cookieStorageAvailable() : false;

function cookieStorageAvailable(): boolean {
  if (!isBrowser) return false;

  try {
    const testKey = "__hireboost_cookie_test__";
    document.cookie = `${encodeURIComponent(testKey)}=1; path=/; samesite=lax`;
    const enabled = document.cookie.includes(`${encodeURIComponent(testKey)}=1`);
    document.cookie = `${encodeURIComponent(testKey)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
    return enabled;
  } catch {
    return false;
  }
}

function getCookieItem(key: string): string | null {
  if (!cookieAvailable) return null;

  const name = `${encodeURIComponent(key)}=`;
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith(name)) {
      return decodeURIComponent(cookie.slice(name.length));
    }
  }
  return null;
}

function setCookieItem(key: string, value: string): void {
  if (!cookieAvailable) return;

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

function removeCookieItem(key: string): void {
  if (!cookieAvailable) return;

  document.cookie = `${encodeURIComponent(key)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function getLocalStorageItem(key: string): string | null {
  if (localStorageAvailable) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return getCookieItem(key) ?? localMemory.get(key) ?? null;
    }
  }

  return getCookieItem(key) ?? localMemory.get(key) ?? null;
}

export function setLocalStorageItem(key: string, value: string): void {
  if (localStorageAvailable) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // fall back to cookie or memory
    }
  }

  setCookieItem(key, value);
  localMemory.set(key, value);
}

export function removeLocalStorageItem(key: string): void {
  if (localStorageAvailable) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      // fall back to cookie or memory
    }
  }

  removeCookieItem(key);
  localMemory.delete(key);
}

export function clearLocalStorage(): void {
  if (localStorageAvailable) {
    try {
      window.localStorage.clear();
      return;
    } catch {
      // fall back to memory
    }
  }

  localMemory.clear();
}

export function getSessionStorageItem(key: string): string | null {
  if (sessionStorageAvailable) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return sessionMemory.get(key) ?? null;
    }
  }

  return sessionMemory.get(key) ?? null;
}

export function setSessionStorageItem(key: string, value: string): void {
  if (sessionStorageAvailable) {
    try {
      window.sessionStorage.setItem(key, value);
      return;
    } catch {
      // fall back to memory
    }
  }

  sessionMemory.set(key, value);
}

export function removeSessionStorageItem(key: string): void {
  if (sessionStorageAvailable) {
    try {
      window.sessionStorage.removeItem(key);
      return;
    } catch {
      // fall back to memory
    }
  }

  sessionMemory.delete(key);
}

export function clearSessionStorage(): void {
  if (sessionStorageAvailable) {
    try {
      window.sessionStorage.clear();
      return;
    } catch {
      // fall back to memory
    }
  }

  sessionMemory.clear();
}

export function canUseLocalStorage(): boolean {
  return localStorageAvailable;
}

export function canUseSessionStorage(): boolean {
  return sessionStorageAvailable;
}
