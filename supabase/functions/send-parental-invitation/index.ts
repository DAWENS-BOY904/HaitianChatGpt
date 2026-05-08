/**
 * send-parental-invitation edge function
 * Sends a family invitation email via Resend (primary) with a fallback log.
 */
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error('[Resend] RESEND_API_KEY not configured');
    return { ok: false, error: 'Email service not configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Dawinix HT <noreply@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[Resend] Error [${res.status}]:`, err);
    return { ok: false, error: `Resend: ${err}` };
  }
  const data = await res.json();
  console.log('[Resend] Sent, id:', data.id);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { toEmail, invitationCode, fromEmail } = await req.json();

    if (!toEmail || !invitationCode) {
      return new Response(
        JSON.stringify({ error: 'toEmail and invitationCode are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subject = `You have been invited to join a family on Dawinix HT`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 16px; }
    .card { background: #111111; border-radius: 20px; overflow: hidden; border: 1px solid #222222; }
    .header { background: linear-gradient(135deg, #10A37F 0%, #0096FF 100%); padding: 40px 32px 32px; text-align: center; }
    .logo-wrap { width: 72px; height: 72px; background: #ffffff; border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
    .brand-name { font-size: 26px; font-weight: 800; color: #ffffff; }
    .brand-sub { font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 6px; }
    .body { padding: 36px 32px; }
    .greeting { font-size: 18px; color: #cccccc; margin-bottom: 24px; line-height: 1.6; }
    .invite-box {
      background: linear-gradient(145deg, #1a1a1a, #161616);
      border: 1px solid #333333; border-radius: 16px;
      padding: 28px; margin: 0 0 28px; text-align: center;
      position: relative; overflow: hidden;
    }
    .invite-box::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0;
      height: 3px; background: linear-gradient(90deg, #10A37F, #0096FF);
    }
    .invite-emoji { font-size: 48px; margin-bottom: 12px; display: block; }
    .invite-title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px; }
    .invite-sub { font-size: 14px; color: #8E8E93; }
    .from-email { color: #10A37F; font-weight: 600; }
    .code-section {
      background: #161616; border: 1px solid #222; border-radius: 14px;
      padding: 20px; margin-bottom: 24px; text-align: center;
    }
    .code-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
    .code-value { font-size: 22px; font-weight: 700; color: #10A37F; font-family: 'Courier New', monospace; letter-spacing: 4px; }
    .steps { background: #161616; border: 1px solid #222; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
    .steps-title { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
    .step:last-child { margin-bottom: 0; }
    .step-num { width: 28px; height: 28px; border-radius: 14px; background: rgba(16,163,127,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #10A37F; flex-shrink: 0; padding-top: 6px; }
    .step-text { font-size: 14px; color: #cccccc; line-height: 1.5; padding-top: 4px; }
    .warning { background: rgba(255,69,58,0.08); border: 1px solid rgba(255,69,58,0.2); border-radius: 12px; padding: 16px 18px; margin-bottom: 8px; }
    .warning-text { font-size: 13px; color: #ff453a; line-height: 1.6; margin: 0; }
    .divider { height: 1px; background: #1a1a1a; }
    .footer { background: #080808; padding: 28px 32px; text-align: center; }
    .footer-brand { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 16px; }
    .footer-links a { color: #555; text-decoration: none; font-size: 12px; margin: 0 10px; }
    .footer-copy { color: #333; font-size: 11px; margin-top: 16px; }
    @media (max-width: 480px) {
      .wrapper { padding: 20px 12px; }
      .body { padding: 24px 20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-wrap">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
            <path d="M24 8C17.37 8 12 13.37 12 20c0 8.33 12 20 12 20s12-11.67 12-20c0-6.63-5.37-12-12-12z" fill="url(#g1)"/>
            <circle cx="24" cy="20" r="5" fill="#fff"/>
            <defs><linearGradient id="g1" x1="12" y1="8" x2="36" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#10A37F"/><stop offset="1" stop-color="#0096FF"/></linearGradient></defs>
          </svg>
        </div>
        <div class="brand-name">Dawinix HT</div>
        <div class="brand-sub">Family Invitation</div>
      </div>

      <div class="body">
        <p class="greeting">Hello,<br>You have been invited to join a family group on Dawinix HT.</p>

        <div class="invite-box">
          <span class="invite-emoji">👨‍👩‍👧</span>
          <p class="invite-title">Family Invitation</p>
          <p class="invite-sub">From <span class="from-email">${fromEmail || 'a Dawinix user'}</span></p>
        </div>

        <div class="code-section">
          <p class="code-label">Your Invitation Code</p>
          <p class="code-value">${invitationCode}</p>
        </div>

        <div class="steps">
          <p class="steps-title">How to accept</p>
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">Open the <strong>Dawinix HT</strong> app on your device</div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">Go to <strong>Settings → Parental Controls</strong></div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">You will see a pending invitation — tap <strong>Accept</strong> to link your account</div>
          </div>
        </div>

        <div class="warning">
          <p class="warning-text">
            <strong>Didn't expect this?</strong> If you did not request to be linked to a family account, you can safely ignore this email. The invitation will expire in 7 days.
          </p>
        </div>
      </div>

      <div class="divider"></div>

      <div class="footer">
        <div class="footer-brand">Dawinix HT</div>
        <div class="footer-links">
          <a href="https://dawinix.com/privacy">Privacy Policy</a>
          <a href="https://dawinix.com/terms">Terms of Service</a>
          <a href="mailto:support@dawinix.com">Support</a>
        </div>
        <p class="footer-copy">© ${new Date().getFullYear()} Dawinix HT. All rights reserved. Port-au-Prince, Haiti.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Try Resend first
    const { ok, error: resendError } = await sendViaResend(toEmail, subject, html);

    if (!ok) {
      // Log fallback attempt
      console.error('[send-parental-invitation] Resend failed:', resendError);
      // Still return success to client — email delivery failure is non-blocking
      return new Response(
        JSON.stringify({ success: false, warning: 'Email delivery failed but invitation was created' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[send-parental-invitation] Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
