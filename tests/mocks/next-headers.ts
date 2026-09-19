// Test double for `next/headers`. The real module only works inside a Next.js
// request lifecycle; outside of it (e.g. Vitest) it can't be imported. Tests
// mock the module wholesale to this in-memory stand-in and drive it through
// the __-prefixed controls below.
type CookieSetOptions = {
  name: string;
  value: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

const cookieStore = new Map<string, string>();
const headerStore = new Map<string, string>();

export async function cookies() {
  return {
    get(name: string) {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(opts: CookieSetOptions) {
      cookieStore.set(opts.name, opts.value);
    },
    delete(name: string) {
      cookieStore.delete(name);
    },
  };
}

export async function headers() {
  return {
    get(name: string) {
      return headerStore.get(name.toLowerCase()) ?? null;
    },
  };
}

// --- test-only controls, imported directly from this file by test code ---

/** Simulates an incoming request header, e.g. __setHeader("x-forwarded-for", "1.2.3.4"). */
export function __setHeader(name: string, value: string) {
  headerStore.set(name.toLowerCase(), value);
}

export function __getCookieValue(name: string): string | undefined {
  return cookieStore.get(name);
}

export function __setCookieValue(name: string, value: string) {
  cookieStore.set(name, value);
}

/** Clears cookies and headers between tests so state never leaks across cases. */
export function __reset() {
  cookieStore.clear();
  headerStore.clear();
}
