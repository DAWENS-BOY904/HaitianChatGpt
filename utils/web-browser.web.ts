/**
 * Web platform shim for expo-web-browser.
 * Opens URLs inside the app using an iframe overlay — never navigates away.
 * On native (iOS/Android) the .native.ts file uses SFSafariViewController / Chrome Custom Tabs.
 */

export async function openBrowserAsync(url: string, _options?: any): Promise<{ type: string }> {
  if (typeof document !== 'undefined') {
    try {
      // Create a full-screen in-app overlay with an iframe
      const overlay = document.createElement('div');
      overlay.id = `wb_overlay_${Date.now()}`;
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:999999',
        'background:#000', 'display:flex', 'flex-direction:column',
      ].join(';');

      // Top bar
      const bar = document.createElement('div');
      bar.style.cssText = [
        'display:flex', 'align-items:center', 'justify-content:space-between',
        'padding:8px 16px', 'background:#1c1c1e', 'min-height:48px',
      ].join(';');

      const urlLabel = document.createElement('span');
      urlLabel.textContent = url.replace(/^https?:\/\//, '').split('/')[0];
      urlLabel.style.cssText = 'color:#fff;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = [
        'background:rgba(255,255,255,0.15)', 'border:none', 'color:#fff',
        'width:32px', 'height:32px', 'border-radius:50%', 'cursor:pointer',
        'font-size:14px', 'margin-left:12px',
      ].join(';');
      closeBtn.onclick = () => {
        overlay.remove();
      };

      bar.appendChild(urlLabel);
      bar.appendChild(closeBtn);

      // iFrame
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = 'flex:1;border:none;width:100%;background:#fff;';
      iframe.allow = 'fullscreen';

      overlay.appendChild(bar);
      overlay.appendChild(iframe);
      document.body.appendChild(overlay);

      return { type: 'opened' };
    } catch {
      return { type: 'failed' };
    }
  }
  return { type: 'failed' };
}

export async function openAuthSessionAsync(
  url: string,
  _redirectUrl?: string,
  _options?: any,
): Promise<{ type: string }> {
  return openBrowserAsync(url);
}

export function dismissBrowser(): void {
  if (typeof document !== 'undefined') {
    const overlays = document.querySelectorAll('[id^="wb_overlay_"]');
    overlays.forEach(el => el.remove());
  }
}

export async function warmUpAsync(_browserPackage?: string): Promise<{ type: string }> {
  return { type: 'not-supported' };
}

export async function coolDownAsync(_browserPackage?: string): Promise<{ type: string }> {
  return { type: 'not-supported' };
}

export async function maybeCompleteAuthSession(_options?: any): Promise<{ type: string; message?: string }> {
  return { type: 'failed', message: 'Not supported on web' };
}
