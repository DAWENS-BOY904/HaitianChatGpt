import { Linking } from 'react-native';

export async function openBrowserAsync(url: string, _options?: any): Promise<{ type: string }> {
  try {
    await Linking.openURL(url);
    return { type: 'opened' };
  } catch {
    return { type: 'failed' };
  }
}

export async function openAuthSessionAsync(url: string, _redirectUrl?: string, _options?: any): Promise<{ type: string }> {
  try {
    await Linking.openURL(url);
    return { type: 'opened' };
  } catch {
    return { type: 'failed' };
  }
}

export function dismissBrowser(): void {}
export async function warmUpAsync(_browserPackage?: string): Promise<{ type: string }> { return { type: 'not-supported' }; }
export async function coolDownAsync(_browserPackage?: string): Promise<{ type: string }> { return { type: 'not-supported' }; }
