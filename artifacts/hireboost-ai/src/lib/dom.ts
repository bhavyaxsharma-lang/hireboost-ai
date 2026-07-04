export function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android/.test(ua) && /wv|Android.*Version\//.test(ua);
}

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function safeWindowLocationHref(href: string): void {
  if (typeof window !== "undefined" && window.location) {
    window.location.href = href;
  }
}
