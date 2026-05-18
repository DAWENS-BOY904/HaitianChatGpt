/**
 * Web platform stub for expo-web-browser.
 * Opens links inside a new tab — never leaves the app context.
 * On native (iOS/Android) the .native.ts file is used instead.
 */

export async function openBrowserAsync(url: string, _options?: any): Promise<{ type: string }> {
  if (typeof window !== 'undefined') {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return { type: 'opened' };
    } catch {
      return { type: 'failed' };
    }
  }
  return { type: 'failed' };
}

export async function openAuthSessionAsync(url: string, _redirectUrl?: string, _options?: any): Promise<{ type: string }> {
  if (typeof window !== 'undefined') {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return { type: 'opened' };
    } catch {
      return { type: 'failed' };
    }
  }
  return { type: 'failed' };
}

export function dismissBrowser(): void {}
export async function warmUpAsync(_browserPackage?: string): Promise<{ type: string }> { return { type: 'not-supported' }; }
export async function coolDownAsync(_browserPackage?: string): Promise<{ type: string }> { return { type: 'not-supported' }; }
