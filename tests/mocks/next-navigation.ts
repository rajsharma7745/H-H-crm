// Test double for `next/navigation`. The real `redirect()` throws a special
// digest error that Next's framework catches to perform the redirect; tests
// mock it to throw an inspectable signal instead, so assertions can confirm
// both that a redirect happened AND where it pointed.
export class RedirectSignal extends Error {
  readonly url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.name = "RedirectSignal";
    this.url = url;
  }
}

export function redirect(url: string): never {
  throw new RedirectSignal(url);
}
